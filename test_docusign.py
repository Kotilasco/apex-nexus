import requests, json

BASE = "http://localhost:8500"

# Login
r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "Admin@2024!"})
token = r.json()["data"]["accessToken"]
headers = {"Authorization": f"Bearer {token}"}

# Request DocuSign signature
r = requests.post(f"{BASE}/api/documents/signatures/request", headers=headers, json={
    "documentId": "6c46ee9f-0827-4428-90a1-2091b9777597",
    "signerId": "910ca17f-3052-4cde-bfa4-3e414b7da7b8",
    "provider": "DOCUSIGN"
})
print("STATUS:", r.status_code)
print("BODY:", json.dumps(r.json(), indent=2))
