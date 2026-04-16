import requests
base = "http://localhost:9600/api"
r = requests.post(f"{base}/auth/login", json={"username":"admin","password":"Admin@2024!"})
token = r.json()["data"]["accessToken"]
h = {"Authorization": f"Bearer {token}"}

docs = requests.get(f"{base}/documents/my?page=0&size=50", headers=h).json()["data"]["content"]

# Test Word doc + PDF
for prefix in ["f53c2606", "052d0a19", "30e75b8b"]:
    doc = next((d for d in docs if d["id"].startswith(prefix)), None)
    if doc:
        r2 = requests.get(f'{base}/documents/{doc["id"]}/content', headers=h)
        data = r2.json().get("data", r2.json())
        text = data.get("content", data) if isinstance(data, dict) else data
        print(f'{doc["title"]} ({doc["mimeType"]}):')
        print(f'  Status: {r2.status_code}, Len: {len(text) if isinstance(text, str) else "?"}, Preview: {str(text)[:200]}')
        print()
