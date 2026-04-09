import requests, json, sys

BASE = "http://localhost:8500/api"
results = []

def test(name, fn):
    try:
        ok, detail = fn()
        results.append((name, "PASS" if ok else "FAIL", detail))
    except Exception as e:
        results.append((name, "FAIL", f"Exception: {e}"))

# Login
def login():
    r = requests.post(f"{BASE}/auth/login", json={"username":"admin","password":"Admin@2024!"}, timeout=30)
    return r.json()["data"]["accessToken"]

token = login()
H = {"Authorization": f"Bearer {token}"}

# 1. Basic API health
def t_login():
    return True, "Token obtained"
test("1. Login", t_login)

# 2. Get workflow definitions
def t_wf_defs():
    r = requests.get(f"{BASE}/workflow/definitions", headers=H, timeout=30)
    data = r.json()
    defs = data.get("data", [])
    return r.status_code == 200 and len(defs) > 0, f"Status={r.status_code}, count={len(defs)}"
test("2. Workflow Definitions", t_wf_defs)

# 3. Get my documents (paginated)
def t_my_docs():
    r = requests.get(f"{BASE}/documents/my", headers=H, timeout=30)
    data = r.json()
    content = data.get("data", {}).get("content", [])
    return r.status_code == 200, f"Status={r.status_code}, count={len(content)}"
test("3. My Documents", t_my_docs)

# 4. Get workflow instances for a document
def t_doc_workflow():
    r = requests.get(f"{BASE}/documents/my", headers=H, timeout=30)
    content = r.json().get("data", {}).get("content", [])
    if not content:
        return False, "No documents found"
    doc_id = content[0]["id"]
    r2 = requests.get(f"{BASE}/workflow/instances/document/{doc_id}", headers=H, timeout=30)
    data2 = r2.json()
    instances = data2.get("data", [])
    return r2.status_code == 200, f"Doc={doc_id}, Status={r2.status_code}, instances={len(instances) if isinstance(instances, list) else 'N/A'}"
test("4. Document Workflow Instances", t_doc_workflow)

# 5. Get projects and test default workflow save
def t_project_workflow():
    r = requests.get(f"{BASE}/projects", headers=H, timeout=30)
    projects = r.json().get("data", [])
    if not projects:
        return False, "No projects found"
    proj = projects[0]
    proj_id = proj["id"]
    r2 = requests.get(f"{BASE}/workflow/definitions", headers=H, timeout=30)
    defs = r2.json().get("data", [])
    if not defs:
        return False, "No workflow definitions"
    def_id = defs[0]["id"]
    r3 = requests.put(f"{BASE}/projects/{proj_id}", headers=H, json={
        "name": proj["name"],
        "defaultWorkflowDefinitionId": def_id
    }, timeout=30)
    return r3.status_code == 200, f"Project={proj['name']}, DefId={def_id}, Status={r3.status_code}"
test("5. Project Default Workflow Save", t_project_workflow)

# 6. Get overdue/escalated instances
def t_escalation():
    r = requests.get(f"{BASE}/workflow/instances/overdue", headers=H, timeout=30)
    data = r.json()
    items = data.get("data", [])
    return r.status_code == 200, f"Status={r.status_code}, overdue_count={len(items)}"
test("6. Escalation - Overdue Instances", t_escalation)

# 7. Create a workflow definition with escalation rules
def t_escalation_rules():
    r = requests.post(f"{BASE}/workflow/definitions", headers=H, json={
        "name": "Test Escalation WF",
        "description": "Testing escalation rules",
        "states": ["DRAFT", "REVIEW", "APPROVED"],
        "transitions": [
            {"fromState": "DRAFT", "toState": "REVIEW", "requiredRole": "USER", "name": "Submit for Review"},
            {"fromState": "REVIEW", "toState": "APPROVED", "requiredRole": "MANAGER", "name": "Approve"}
        ],
        "initialState": "DRAFT",
        "escalationRules": [
            {"state": "REVIEW", "slaHours": 24, "maxLevel": 3}
        ]
    }, timeout=30)
    data = r.json()
    success = r.status_code == 200 or r.status_code == 201
    if success and data.get("data"):
        rules = data["data"].get("escalationRules", [])
        return len(rules) > 0, f"Status={r.status_code}, rules_count={len(rules)}"
    return success, f"Status={r.status_code}, msg={data.get('message','?')[:200]}"
test("7. Create WF with Escalation Rules", t_escalation_rules)

# 8. Start a workflow instance
def t_start_instance():
    r = requests.get(f"{BASE}/documents/my", headers=H, timeout=30)
    content = r.json().get("data", {}).get("content", [])
    if not content:
        return False, "No documents"
    r2 = requests.get(f"{BASE}/workflow/definitions", headers=H, timeout=30)
    defs = r2.json().get("data", [])
    if not defs:
        return False, "No definitions"
    r3 = requests.post(f"{BASE}/workflow/instances", headers=H, json={
        "definitionId": defs[0]["id"],
        "documentId": content[0]["id"]
    }, timeout=30)
    data = r3.json()
    ok = r3.status_code == 200 or r3.status_code == 201
    instance = data.get("data", {})
    if isinstance(instance, dict):
        return ok, f"Status={r3.status_code}, id={instance.get('id','N/A')}, state={instance.get('currentState','N/A')}"
    return ok, f"Status={r3.status_code}, msg={data.get('message','?')[:200]}"
test("8. Start Workflow Instance", t_start_instance)

# 9. Test pending approvals
def t_pending():
    r = requests.get(f"{BASE}/workflow/instances/pending", headers=H, timeout=30)
    data = r.json()
    if r.status_code == 200:
        items = data.get("data", [])
        return True, f"Status={r.status_code}, pending_count={len(items) if isinstance(items, list) else 'paginated'}"
    return False, f"Status={r.status_code}, msg={data.get('message','?')[:200]}"
test("9. Pending Approvals", t_pending)

# 10. Frontend accessibility
def t_frontend():
    r = requests.get("http://localhost:3000", timeout=30)
    return r.status_code == 200, f"Status={r.status_code}"
test("10. Frontend Accessible", t_frontend)

# Print results
print("\n" + "="*60)
print("APEX NEXUS - ALL FIXES VERIFICATION")
print("="*60)
for name, status, detail in results:
    icon = "PASS" if status == "PASS" else "FAIL"
    print(f"  [{icon}] {name}: {detail}")

passed = sum(1 for _,s,_ in results if s == "PASS")
total = len(results)
print(f"\n  Results: {passed}/{total} passed")
print("="*60)
