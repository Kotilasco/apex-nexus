import urllib.request, json, sys, os

BASE = "http://localhost:8200/api"
DOC_ID = "dff73b47-30b0-491f-804d-09a9826bb908"

# Login via gateway
print("=== LOGIN ===")
data = json.dumps({"username": "admin", "password": "Admin@2024!"}).encode()
req = urllib.request.Request(f"{BASE}/auth/login", data=data, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
body = json.loads(resp.read())
token = body["data"]["accessToken"]
print(f"Token obtained, length={len(token)}")

headers = {"Authorization": f"Bearer {token}"}

# Test 1: Pre-check with a text file (format mismatch - previous was likely PDF/DOCX)
print("\n=== TEST 1: Pre-check with format mismatch (text file) ===")
boundary = "----FormBoundary123456"
txt_content = b"This is a completely unrelated test document about quantum physics and black holes."
body_bytes = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="test_mismatch.txt"\r\n'
    f"Content-Type: text/plain\r\n"
    f"\r\n"
).encode() + txt_content + f"\r\n--{boundary}--\r\n".encode()

req = urllib.request.Request(
    f"{BASE}/documents/{DOC_ID}/checkin-precheck",
    data=body_bytes,
    headers={**headers, "Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST"
)
try:
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    print(json.dumps(result, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")

# Test 2: Compare versions (V1 vs V2)
print("\n=== TEST 2: Compare versions V1 vs V2 ===")
req = urllib.request.Request(
    f"{BASE}/documents/{DOC_ID}/versions/1/compare/2",
    headers=headers,
    method="GET"
)
try:
    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read())
    # Show structure but truncate text
    if "data" in result and result["data"]:
        d = result["data"]
        for k in ["text1", "text2"]:
            if k in d and d[k]:
                d[k] = d[k][:200] + "..." if len(d[k]) > 200 else d[k]
    print(json.dumps(result, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")

print("\n=== ALL TESTS DONE ===")
