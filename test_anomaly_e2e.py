import subprocess, json, urllib.request, os, sys

# Check docker containers
print("=== Docker Containers ===")
r = subprocess.run(["docker", "ps", "--format", "table {{.Names}}\t{{.Status}}"], capture_output=True, text=True)
print(r.stdout)
print()

# Login
print("=== Login ===")
login_data = json.dumps({"username": "admin", "password": "Admin@2024!"}).encode()
req = urllib.request.Request("http://localhost:8200/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    token = json.loads(resp.read())["data"]["accessToken"]
    print(f"Login OK, token: {token[:20]}...")
except Exception as e:
    print(f"Login FAILED: {e}")
    sys.exit(1)

# Test version endpoint
print("\n=== Version History (doc dff73b47) ===")
doc_id = "dff73b47-30b0-491f-804d-09a9826bb908"
try:
    req2 = urllib.request.Request(f"http://localhost:8202/documents/{doc_id}/versions", headers={"Authorization": f"Bearer {token}"})
    resp2 = urllib.request.urlopen(req2, timeout=10)
    data = json.loads(resp2.read())
    versions = data.get("data", data) if isinstance(data, dict) else data
    for v in versions:
        print(f"  V{v['versionNumber']}: fileName={v.get('fileName')}, size={v.get('fileSizeBytes')}, author={v.get('authorName')}, anomaly={v.get('anomalyDetected')}, score={v.get('similarityScore')}")
except Exception as e:
    print(f"Version endpoint FAILED: {e}")

# Test search service anomaly endpoint
print("\n=== Search Service Anomaly Endpoint Check ===")
try:
    req3 = urllib.request.Request("http://localhost:8204/search/health")
    resp3 = urllib.request.urlopen(req3, timeout=5)
    print(f"Search service: {resp3.status}")
except Exception as e:
    print(f"Search service check: {e}")

# Test document upload + check-in flow to trigger anomaly detection
print("\n=== Test Check-In with Different Document ===")
# First check out a doc
try:
    req4 = urllib.request.Request(f"http://localhost:8202/documents/{doc_id}/checkout", method="POST", headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    resp4 = urllib.request.urlopen(req4, timeout=10)
    print(f"Checkout: {resp4.status}")
except urllib.error.HTTPError as e:
    print(f"Checkout: HTTP {e.code} - {e.read().decode()[:200]}")
except Exception as e:
    print(f"Checkout: {e}")

# Check-in with a completely different file
print("\n=== Check-In with changed file ===")
import io

# Create a fake docx (actually just a text file for testing)
fake_content = b"This is a completely different document about cooking recipes and gardening tips. Nothing related to NCC access or memos."
boundary = "----FormBoundary7MA4YWxkTrZu0gW"
body = f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"different_doc.txt\"\r\nContent-Type: text/plain\r\n\r\n".encode() + fake_content + f"\r\n--{boundary}\r\nContent-Disposition: form-data; name=\"changeSummary\"\r\n\r\nReplaced with a completely different document\r\n--{boundary}--\r\n".encode()

try:
    req5 = urllib.request.Request(
        f"http://localhost:8202/documents/{doc_id}/checkin",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        },
        method="POST"
    )
    resp5 = urllib.request.urlopen(req5, timeout=30)
    result = json.loads(resp5.read())
    print(f"Check-in: {resp5.status}")
    print(json.dumps(result, indent=2, default=str)[:500])
except urllib.error.HTTPError as e:
    body_text = e.read().decode()[:500]
    print(f"Check-in: HTTP {e.code}")
    print(f"  Response: {body_text}")
except Exception as e:
    print(f"Check-in: {e}")

# Check versions again to see anomaly flags
print("\n=== Versions After Check-In ===")
try:
    req6 = urllib.request.Request(f"http://localhost:8202/documents/{doc_id}/versions", headers={"Authorization": f"Bearer {token}"})
    resp6 = urllib.request.urlopen(req6, timeout=10)
    data = json.loads(resp6.read())
    versions = data.get("data", data) if isinstance(data, dict) else data
    for v in versions:
        flags = ""
        if v.get("anomalyDetected"):
            flags = f" *** ANOMALY: score={v.get('similarityScore')}, reasons={v.get('anomalyReasons')}"
        print(f"  V{v['versionNumber']}: {v.get('changeSummary', 'N/A')}{flags}")
except Exception as e:
    print(f"Versions: {e}")

print("\nDone!")
