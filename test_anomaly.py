"""
Test AI Version Anomaly Detection
1. Upload a document (creates v1)
2. Check out the document
3. Check in with a COMPLETELY DIFFERENT document (simulating a mistake)
4. Verify anomaly was detected and flagged
"""
import urllib.request
import urllib.error
import json
import os
import io
import time

BASE = "http://localhost:8200/api"

def login():
    data = json.dumps({"username": "admin", "password": "Admin@2024!"}).encode()
    req = urllib.request.Request(f"{BASE}/auth/login", data=data,
                                 headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=15)
    return json.loads(resp.read())["data"]["accessToken"]

def multipart_encode(fields, files):
    """Build multipart/form-data body."""
    boundary = "----ApexTestBoundary12345"
    body = b""
    for key, value in fields.items():
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{key}"\r\n\r\n'.encode()
        body += f"{value}\r\n".encode()
    for key, (filename, filedata, content_type) in files.items():
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{key}"; filename="{filename}"\r\n'.encode()
        body += f"Content-Type: {content_type}\r\n\r\n".encode()
        body += filedata + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    return body, f"multipart/form-data; boundary={boundary}"

token = login()
headers = {"Authorization": f"Bearer {token}"}
print("Logged in OK\n")

# Step 1: Get the existing Memo document
print("=== Step 1: Find existing Memo document ===")
req = urllib.request.Request(f"{BASE}/search?q=memo", headers=headers)
resp = urllib.request.urlopen(req, timeout=15)
data = json.loads(resp.read())
results = data.get("data", {}).get("results", [])
if not results:
    print("ERROR: No memo document found!")
    exit(1)
doc_id = results[0]["documentId"]
doc_title = results[0]["title"]
print(f"Found: {doc_title} (id={doc_id})")

# Get current version info
req = urllib.request.Request(f"{BASE}/documents/{doc_id}/versions", headers=headers)
resp = urllib.request.urlopen(req, timeout=10)
versions_before = json.loads(resp.read())
if isinstance(versions_before, dict) and "data" in versions_before:
    versions_before = versions_before["data"]
print(f"Current versions: {len(versions_before)}")
for v in versions_before:
    vn = v.get("versionNumber", "?")
    af = v.get("anomalyFlagged", False)
    print(f"  v{vn} — anomalyFlagged={af}")

# Step 2: Check out the document
print("\n=== Step 2: Check out document ===")
req = urllib.request.Request(f"{BASE}/documents/{doc_id}/checkout",
                              method="POST", headers=headers)
try:
    resp = urllib.request.urlopen(req, timeout=15)
    checkout_data = json.loads(resp.read())
    print(f"Checked out OK: isCheckedOut={checkout_data.get('data', {}).get('isCheckedOut')}")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"Checkout failed ({e.code}): {body}")
    # Maybe already checked out, try cancel and retry
    if "already checked out" in body.lower() or "checked out" in body.lower():
        print("Attempting cancel and retry...")
        cancel_req = urllib.request.Request(f"{BASE}/documents/{doc_id}/cancel-checkout",
                                             method="POST", headers=headers)
        urllib.request.urlopen(cancel_req, timeout=10)
        resp = urllib.request.urlopen(req, timeout=15)
        checkout_data = json.loads(resp.read())
        print(f"Checked out OK after cancel: isCheckedOut={checkout_data.get('data', {}).get('isCheckedOut')}")

# Step 3: Create a COMPLETELY DIFFERENT document and check it in
print("\n=== Step 3: Check in a COMPLETELY DIFFERENT document ===")
# Create a fake text file with completely unrelated content (an invoice)
fake_content = b"""INVOICE #2024-5678

From: Acme Corporation
To: Widget Industries Ltd.

Date: 2024-12-15
Due Date: 2025-01-15

Items:
1. Premium Widget Subscription - 12 months    $4,800.00
2. Installation Service Fee                    $1,200.00
3. Training Package (10 sessions)              $2,500.00

Subtotal: $8,500.00
Tax (15%): $1,275.00
TOTAL DUE: $9,775.00

Payment Terms: Net 30
Bank: First National Bank
Account: 1234567890
Routing: 987654321

Thank you for your business!
"""

body, content_type = multipart_encode(
    {"changeSummary": "Updated document", "versionType": "MAJOR"},
    {"file": ("Invoice_Acme_2024.txt", fake_content, "text/plain")}
)

req = urllib.request.Request(
    f"{BASE}/documents/{doc_id}/checkin",
    data=body,
    headers={**headers, "Content-Type": content_type},
    method="POST"
)
try:
    resp = urllib.request.urlopen(req, timeout=60)  # Long timeout for anomaly check
    checkin_data = json.loads(resp.read())
    new_version = checkin_data.get("data", {}).get("currentVersion")
    print(f"Checked in OK: new version = v{new_version}")
except urllib.error.HTTPError as e:
    print(f"Check-in failed ({e.code}): {e.read().decode()[:500]}")
    exit(1)

# Step 4: Check the version history for anomaly flags
print("\n=== Step 4: Check version history for anomaly flags ===")
time.sleep(2)  # Give a moment for async processing
req = urllib.request.Request(f"{BASE}/documents/{doc_id}/versions", headers=headers)
resp = urllib.request.urlopen(req, timeout=10)
versions_after = json.loads(resp.read())
if isinstance(versions_after, dict) and "data" in versions_after:
    versions_after = versions_after["data"]

print(f"Total versions now: {len(versions_after)}")
anomaly_found = False
for v in versions_after:
    vn = v.get("versionNumber", "?")
    af = v.get("anomalyFlagged", False)
    score = v.get("anomalyScore", 0)
    sim = v.get("similarityScore")
    reasons = v.get("anomalyReasons", [])
    flag_text = ""
    if af:
        flag_text = f" *** ANOMALY FLAGGED *** score={score}, similarity={sim}"
        anomaly_found = True
    print(f"  v{vn}: anomalyFlagged={af}{flag_text}")
    if reasons:
        for r in reasons:
            print(f"       Reason: {r}")

print("\n" + "="*60)
if anomaly_found:
    print("SUCCESS: AI anomaly detection correctly flagged the suspicious version!")
else:
    print("NOTE: No anomaly flagged yet. Check search service logs.")
    print("This could mean the search service was temporarily unavailable during check-in.")

# Step 5: Also test the search service anomaly endpoint directly
print("\n=== Step 5: Direct test of /search/version-anomaly endpoint ===")

# Create two very different files
file1_content = b"This is a memo about employee access to NCC building. The employee needs badge access and security clearance."
file2_content = fake_content

body, content_type = multipart_encode(
    {},
    {
        "previousFile": ("memo.txt", file1_content, "text/plain"),
        "newFile": ("invoice.txt", file2_content, "text/plain")
    }
)
req = urllib.request.Request(
    f"{BASE}/search/version-anomaly",
    data=body,
    headers={**headers, "Content-Type": content_type},
    method="POST"
)
try:
    resp = urllib.request.urlopen(req, timeout=30)
    anomaly_result = json.loads(resp.read())
    print(json.dumps(anomaly_result, indent=2))
except urllib.error.HTTPError as e:
    print(f"Anomaly check failed ({e.code}): {e.read().decode()[:500]}")

print("\nTest complete!")
