import urllib.request, json, sys

DOC_ID = "dff73b47-30b0-491f-804d-09a9826bb908"

# Login directly to auth service
print("=== LOGIN (direct to auth:8201) ===")
data = json.dumps({"username": "admin", "password": "Admin@2024!"}).encode()
req = urllib.request.Request("http://localhost:8201/auth/login", data=data, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req, timeout=15)
body = json.loads(resp.read())
token = body["data"]["accessToken"]
print(f"Token obtained, length={len(token)}")

headers = {"Authorization": f"Bearer {token}"}

# Test 1: Pre-check (direct to doc service:8202)
print("\n=== TEST 1: Pre-check with format mismatch (text file) ===")
boundary = "----FormBoundary123456"
txt_content = b"This is a completely unrelated test document about quantum physics and black holes in the universe."
body_bytes = (
    f"--{boundary}\r\n"
    f'Content-Disposition: form-data; name="file"; filename="test_mismatch.txt"\r\n'
    f"Content-Type: text/plain\r\n"
    f"\r\n"
).encode() + txt_content + f"\r\n--{boundary}--\r\n".encode()

req = urllib.request.Request(
    f"http://localhost:8202/documents/{DOC_ID}/checkin-precheck",
    data=body_bytes,
    headers={**headers, "Content-Type": f"multipart/form-data; boundary={boundary}"},
    method="POST"
)
try:
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read())
    print(json.dumps(result, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")
except Exception as e:
    print(f"Error: {e}")

# Test 2: Compare versions (V1 vs V2)
print("\n=== TEST 2: Compare versions V1 vs V2 ===")
req = urllib.request.Request(
    f"http://localhost:8202/documents/{DOC_ID}/versions/1/compare/2",
    headers=headers,
    method="GET"
)
try:
    resp = urllib.request.urlopen(req, timeout=120)
    result = json.loads(resp.read())
    if "data" in result and result["data"]:
        d = result["data"]
        for k in ["text1", "text2"]:
            if k in d and d[k]:
                d[k] = d[k][:200] + "..." if len(str(d[k])) > 200 else d[k]
    print(json.dumps(result, indent=2))
except urllib.error.HTTPError as e:
    print(f"HTTP {e.code}: {e.read().decode()[:500]}")
except Exception as e:
    print(f"Error: {e}")

print("\n=== ALL TESTS DONE ===")
