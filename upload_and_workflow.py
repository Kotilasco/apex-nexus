import requests
import json

BASE = "http://localhost:8500/api"

# Login as admin
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "Admin@2024!"})
login_data = r.json()
token = login_data["data"]["accessToken"]
headers = {"Authorization": f"Bearer {token}"}

# Upload a new document with proper multipart metadata
project_id = "e0000000-0000-0000-0000-000000000001"
metadata = json.dumps({
    "title": "Workflow Test Doc",
    "description": "Document for testing workflows with multiple users",
    "projectId": project_id
})

files = {
    "file": ("Workflow_Test_Doc.txt", b"This is a test document for workflow testing.", "text/plain"),
    "metadata": (None, metadata, "application/json")
}
r = requests.post(f"{BASE}/documents", headers=headers, files=files)
print("Upload:", r.status_code)
upload_resp = r.json()
print(json.dumps(upload_resp, indent=2)[:500])

if r.status_code in [200, 201]:
    doc_id = upload_resp["data"]["id"]
    print(f"\nDocument ID: {doc_id}")
    
    # Get workflow definitions
    r2 = requests.get(f"{BASE}/workflows/definitions", headers=headers)
    print(f"\nWorkflow Definitions: {r2.status_code}")
    defs_data = r2.json().get("data", r2.json())
    if isinstance(defs_data, list):
        for d in defs_data:
            print(f"  - ID: {d.get('id')} | Name: {d.get('name')} | States: {d.get('states', [])[:5]}")
    else:
        print(json.dumps(defs_data, indent=2)[:500])
    
    # Get user IDs
    r3 = requests.get(f"{BASE}/auth/users", headers=headers)
    users = r3.json()["data"]
    user_map = {u["username"]: u["id"] for u in users}
    print("\nUser IDs:")
    for name, uid in user_map.items():
        print(f"  {name}: {uid}")
    
    # Find Standard Approval definition
    std_def = None
    for d in (defs_data if isinstance(defs_data, list) else []):
        if "standard" in d.get("name", "").lower():
            std_def = d
            break
    
    if not std_def and isinstance(defs_data, list) and len(defs_data) > 0:
        std_def = defs_data[0]
        print(f"\nUsing first definition: {std_def.get('name')}")
    
    if std_def:
        print(f"\nUsing definition: {std_def.get('name')} (ID: {std_def.get('id')})")
        
        # Start workflow with reviewer1 as assignee
        start_req = {
            "documentId": doc_id,
            "definitionId": std_def["id"],
            "assignedTo": user_map.get("reviewer1"),
            "priority": 2,
            "comments": "Testing workflow with reviewer1"
        }
        r5 = requests.post(f"{BASE}/workflows/instances", headers=headers, json=start_req)
        print(f"\nStart Workflow: {r5.status_code}")
        print(json.dumps(r5.json(), indent=2)[:800])
    else:
        print("\nNo workflow definitions found!")
