import requests, json, os, sys

BASE = "http://localhost:8500"

# Login
r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "Admin@2024!"})
token = r.json()["data"]["accessToken"]
headers = {"Authorization": f"Bearer {token}"}

action = sys.argv[1] if len(sys.argv) > 1 else "status"

M365_ID = "f1b4833c-d507-4af4-9088-101ae0e40262"
DOCUSIGN_ID = "fbc38f4a-59bc-44f3-989a-6234809313dd"
SAP_ID = "f81a7bcc-9028-4e0f-8a4d-42e75b34d943"
CLASSIFY_ID = "ff8118fd-eab5-47e2-87d4-62c53eba5726"

plugins = {
    "M365": M365_ID,
    "DocuSign": DOCUSIGN_ID,
    "SAP": SAP_ID,
    "Classification": CLASSIFY_ID,
}

if action == "deactivate-m365-sap":
    for name, pid in [("M365", M365_ID), ("SAP", SAP_ID)]:
        r = requests.post(f"{BASE}/api/auth/plugins/{pid}/deactivate", headers=headers)
        print(f"{name}: {r.json()['data']['status']}")

elif action == "activate-all":
    for name, pid in plugins.items():
        r = requests.post(f"{BASE}/api/auth/plugins/{pid}/activate", headers=headers)
        print(f"{name}: {r.json()['data']['status']}")

elif action == "status":
    for name, pid in plugins.items():
        r = requests.get(f"{BASE}/api/auth/plugins/{pid}", headers=headers)
        print(f"{name}: {r.json()['data']['status']}")

elif action == "upload":
    title = sys.argv[2] if len(sys.argv) > 2 else "Test Doc Deactivated"
    # Create a temp file
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
        f.write(f"This is {title}")
        tmppath = f.name
    metadata = json.dumps({
        "title": title,
        "projectId": "e0000000-0000-0000-0000-000000000001",
        "folderId": "00000000-0000-0000-0000-000000000001",
    })
    with open(tmppath, 'rb') as f:
        r = requests.post(f"{BASE}/api/documents",
            headers=headers,
            files={
                "metadata": (None, metadata, "application/json"),
                "file": (f"{title}.txt", f, "text/plain"),
            })
    os.unlink(tmppath)
    data = r.json()
    print(f"STATUS: {r.status_code}")
    print(f"DOC_ID: {data.get('data', {}).get('id', 'N/A')}")
    print(json.dumps(data, indent=2))

elif action == "check-doc":
    doc_id = sys.argv[2]
    r = requests.get(f"{BASE}/api/documents/{doc_id}", headers=headers)
    d = r.json().get("data", {})
    print(f"title: {d.get('title')}")
    print(f"classificationLabel: {d.get('classificationLabel')}")
    print(f"m365Link: {d.get('m365Link')}")
    print(f"docusignEnvelopeId: {d.get('docusignEnvelopeId')}")
    print(f"sapDocumentNumber: {d.get('sapDocumentNumber')}")
