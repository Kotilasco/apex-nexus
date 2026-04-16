import requests, json, sys

base = "http://localhost:9600/api"

# Login
r = requests.post(f"{base}/auth/login", json={"username":"admin","password":"Admin@2024!"})
print(f"Login status: {r.status_code}")
resp = r.json()
print(f"Login keys: {list(resp.keys()) if isinstance(resp, dict) else type(resp)}")

# Extract token from various response formats
token = None
if isinstance(resp, dict):
    token = resp.get("token") or resp.get("accessToken")
    if not token and "data" in resp:
        d = resp["data"]
        if isinstance(d, dict):
            token = d.get("token") or d.get("accessToken")
        elif isinstance(d, str):
            token = d

if not token:
    print(f"Could not extract token. Full response: {json.dumps(resp)[:500]}")
    sys.exit(1)

print(f"Token: {token[:20]}...")
h = {"Authorization": f"Bearer {token}"}

# List my documents
docs_r = requests.get(f"{base}/documents/my?page=0&size=50", headers=h)
print(f"\nDocuments status: {docs_r.status_code}")
docs_json = docs_r.json()
# Unwrap data wrapper
docs_data = docs_json.get("data", docs_json) if isinstance(docs_json, dict) else docs_json
content_list = docs_data.get("content", []) if isinstance(docs_data, dict) else (docs_data if isinstance(docs_data, list) else [])

print(f"Found {len(content_list)} documents")
for d in content_list[:15]:
    mime = d.get("mimeType", "?")
    title = d.get("title", d.get("originalFilename", "?"))
    did = d.get("id", "?")
    print(f"  {str(did)[:8]}... | {str(mime):40s} | {title}")

# Find a non-text doc
binary_doc = None
for d in content_list:
    mime = d.get("mimeType", "")
    if mime and not mime.startswith("text/") and mime != "application/json":
        binary_doc = d
        break

target = binary_doc or (content_list[0] if content_list else None)
if not target:
    print("No documents found to test!")
    sys.exit(1)

did = target["id"]
print(f"\nTesting: {target.get('title')} (mime: {target.get('mimeType')})")

# Test content endpoint
r1 = requests.get(f"{base}/documents/{did}/content", headers=h)
print(f"GET /content -> {r1.status_code}")
if r1.status_code == 200:
    data = r1.json()
    inner = data.get("data", data) if isinstance(data, dict) else data
    text = inner.get("content", inner) if isinstance(inner, dict) else inner
    if isinstance(text, str):
        print(f"  Length: {len(text)} chars")
        print(f"  Preview: {text[:300]}...")
    else:
        print(f"  Response: {str(inner)[:300]}")
else:
    print(f"  Error: {r1.text[:300]}")

# Test redacted content endpoint
r2 = requests.get(f"{base}/documents/{did}/content/redacted", headers=h)
print(f"\nGET /content/redacted -> {r2.status_code}")
if r2.status_code == 200:
    data2 = r2.json()
    inner2 = data2.get("data", data2) if isinstance(data2, dict) else data2
    text2 = inner2.get("content", inner2) if isinstance(inner2, dict) else inner2
    if isinstance(text2, str):
        print(f"  Length: {len(text2)} chars")
        print(f"  Preview: {text2[:300]}...")
