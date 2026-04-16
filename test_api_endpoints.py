import requests

BASE = "http://localhost:9500/api"
pw = "Admin@2024" + chr(33)

# Login
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": pw}, timeout=10)
print("LOGIN:", r.status_code)
d = r.json()
tk = d.get("data", {}).get("accessToken", "")
print("TOKEN:", tk[:40] if tk else "NONE")

headers = {"Authorization": f"Bearer {tk}"}

# List docs
r2 = requests.get(f"{BASE}/documents/my", headers=headers, params={"page": 0, "size": 3}, timeout=10)
print("LIST:", r2.status_code)
content = r2.json().get("data", {}).get("content", [])
print("DOCS:", len(content))

if content:
    doc = content[0]
    did = doc["id"]
    print(f"DOC: {did[:20]}... title={doc['title']} mime={doc.get('mimeType', '?')}")

    # Download
    r3 = requests.get(f"{BASE}/documents/{did}/download", headers=headers, timeout=10)
    print(f"DOWNLOAD: status={r3.status_code} ct={r3.headers.get('content-type', '?')} size={len(r3.content)}")

    # Content (text)
    r4 = requests.get(f"{BASE}/documents/{did}/content", headers=headers, timeout=10)
    print(f"CONTENT: status={r4.status_code}")

    # WOPI token
    r5 = requests.post(f"{BASE}/wopi/token/{did}", headers=headers, params={"permissions": "EDIT"}, timeout=10)
    print(f"WOPI TOKEN: status={r5.status_code}")
    if r5.status_code == 200:
        wopi = r5.json()
        print(f"WOPI DATA: {wopi}")
else:
    print("No documents found")
