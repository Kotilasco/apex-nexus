import requests, json

base = "http://localhost:9600/api"
login = requests.post(f"{base}/auth/login", json={"username":"admin","password":"Admin@2024!"})
token = login.json().get("data", login.json()).get("token", login.json().get("accessToken"))
if not token:
    token = login.json().get("token")
h = {"Authorization": f"Bearer {token}"}
print(f"Login OK, token: {token[:20]}...")

# List documents to find a binary one
docs = requests.get(f"{base}/documents/my?page=0&size=50", headers=h)
docs_data = docs.json().get("data", docs.json())
content_list = docs_data.get("content", []) if isinstance(docs_data, dict) else docs_data

print(f"\nFound {len(content_list)} documents:")
for d in content_list[:15]:
    mime = d.get("mimeType", "unknown")
    title = d.get("title", d.get("originalFilename", "?"))
    did = d.get("id", "?")
    print(f"  {did[:8]}... | {mime:40s} | {title}")

# Find a non-text doc
binary_doc = None
for d in content_list:
    mime = d.get("mimeType", "")
    if not mime.startswith("text/") and mime != "application/json" and mime:
        binary_doc = d
        break

if binary_doc:
    did = binary_doc["id"]
    print(f"\nTesting binary doc: {binary_doc.get('title')} (mime: {binary_doc.get('mimeType')})")
    
    # Test content endpoint (should now return extracted text for binary files)
    r = requests.get(f"{base}/documents/{did}/content", headers=h)
    print(f"  GET /content -> {r.status_code}")
    if r.status_code == 200:
        data = r.json().get("data", r.json())
        text = data.get("content", data) if isinstance(data, dict) else data
        if isinstance(text, str):
            print(f"  Content length: {len(text)} chars")
            print(f"  Preview: {text[:200]}...")
        else:
            print(f"  Unexpected response: {str(data)[:200]}")
    else:
        print(f"  Error: {r.text[:200]}")
    
    # Test redacted content endpoint
    r2 = requests.get(f"{base}/documents/{did}/content/redacted", headers=h)
    print(f"\n  GET /content/redacted -> {r2.status_code}")
    if r2.status_code == 200:
        data2 = r2.json().get("data", r2.json())
        text2 = data2.get("content", data2) if isinstance(data2, dict) else data2
        if isinstance(text2, str):
            print(f"  Redacted length: {len(text2)} chars")
            print(f"  Preview: {text2[:200]}...")
else:
    print("\nNo binary documents found. All docs are text-based.")
    if content_list:
        # Still test with the first doc
        did = content_list[0]["id"]
        print(f"Testing text doc: {content_list[0].get('title')}")
        r = requests.get(f"{base}/documents/{did}/content", headers=h)
        print(f"  GET /content -> {r.status_code}")
        data = r.json().get("data", r.json()) 
        text = data.get("content", data) if isinstance(data, dict) else data
        if isinstance(text, str):
            print(f"  Content length: {len(text)} chars")
            print(f"  Preview: {text[:200]}...")
