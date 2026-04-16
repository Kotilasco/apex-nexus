#!/usr/bin/env python3
"""Continue the workflow demo - transition through stages."""
import json
import urllib.request
import urllib.error

BASE = "http://localhost:9600/api"

def api(method, path, data=None, token=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        txt = resp.read().decode()
        return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR {e.code} {method} {path}: {err[:500]}")
        return None

def d(r):
    if r and "data" in r:
        return r["data"]
    return r

def login(username, password):
    r = api("POST", "/auth/login", {"username": username, "password": password})
    if r and r.get("data"):
        return r["data"]["accessToken"]
    return None

# Login all users
print("Logging in users...")
admin_token = login("admin", "Admin@2024!")
alice_token = login("alice_author", "Test@2024!")
bob_token = login("bob_reviewer", "Test@2024!")
carol_token = login("carol_manager", "Test@2024!")
print("  All logins OK")

# Find the workflow instance
wf_id = "23553e58-4d9f-40f0-9004-a74b610f6aa0"
doc_id = "fdd29e72-6b14-477c-a63d-5c5ab885bcbf"
project_id = "70da7d4d-69fa-4a6c-ac3b-43af3ce053cd"

print(f"\nWorkflow ID: {wf_id}")
print(f"Document ID: {doc_id}")

# Check current state
inst = d(api("GET", f"/workflow/instances/{wf_id}", token=admin_token))
if inst:
    print(f"Current State: {inst.get('currentState')}")
else:
    print("Could not get workflow instance")

# --- Transition: DRAFT → REVIEW ---
print("\n[1] Alice submits for review (DRAFT → REVIEW)...")
r = api("POST", f"/workflow/instances/{wf_id}/transition", {
    "action": "submit",
    "comments": "Alice submits document for team review"
}, token=alice_token)
if r:
    state = d(r).get("currentState") if d(r) else "?"
    print(f"  Result: {state}")
else:
    # Check state anyway
    inst = d(api("GET", f"/workflow/instances/{wf_id}", token=admin_token))
    print(f"  Current state: {inst.get('currentState') if inst else 'unknown'}")

# --- Transition: REVIEW → PENDING_APPROVAL ---
print("\n[2] Bob reviews and approves (REVIEW → PENDING_APPROVAL)...")
r = api("POST", f"/workflow/instances/{wf_id}/transition", {
    "action": "approve",
    "comments": "Bob reviewed - document meets quality standards"
}, token=bob_token)
if r:
    state = d(r).get("currentState") if d(r) else "?"
    print(f"  Result: {state}")
else:
    inst = d(api("GET", f"/workflow/instances/{wf_id}", token=admin_token))
    print(f"  Current state: {inst.get('currentState') if inst else 'unknown'}")

# --- Approval: PENDING_APPROVAL → APPROVED ---
print("\n[3] Carol gives final approval (PENDING_APPROVAL → APPROVED)...")
# Try approve endpoint first
r = api("POST", f"/workflow/instances/{wf_id}/approve", {
    "decision": "APPROVED",
    "comments": "Carol approves - meets all compliance requirements"
}, token=carol_token)
if not r:
    r = api("POST", f"/workflow/instances/{wf_id}/transition", {
        "action": "approve",
        "comments": "Carol approves"
    }, token=carol_token)
if r:
    state = d(r).get("currentState") if d(r) else "?"
    print(f"  Result: {state}")
else:
    inst = d(api("GET", f"/workflow/instances/{wf_id}", token=admin_token))
    print(f"  Current state: {inst.get('currentState') if inst else 'unknown'}")

# --- Transition: APPROVED → ARCHIVED ---
print("\n[4] Admin archives the document (APPROVED → ARCHIVED)...")
r = api("POST", f"/workflow/instances/{wf_id}/transition", {
    "action": "archive",
    "comments": "Document archived after full approval"
}, token=admin_token)
if r:
    state = d(r).get("currentState") if d(r) else "?"
    print(f"  Result: {state}")
else:
    inst = d(api("GET", f"/workflow/instances/{wf_id}", token=admin_token))
    print(f"  Current state: {inst.get('currentState') if inst else 'unknown'}")

# --- Final state ---
print("\n\n=== FINAL WORKFLOW STATE ===")
inst = d(api("GET", f"/workflow/instances/{wf_id}", token=admin_token))
if inst:
    print(f"  State: {inst.get('currentState')}")
    print(f"  Escalation: {inst.get('escalationLevel')}")
    print(f"  Corrections: {inst.get('correctionCount')}")

# --- History ---
print("\n=== TRANSITION HISTORY ===")
history = d(api("GET", f"/workflow/instances/{wf_id}/history", token=admin_token))
if history and isinstance(history, list):
    for i, entry in enumerate(history, 1):
        fr = entry.get("fromState", "—")
        to = entry.get("toState", "—")
        action = entry.get("action", "—")
        comment = entry.get("comments", "")
        ts = str(entry.get("createdAt", ""))[:19]
        print(f"  {i}. [{ts}] {fr} → {to} (action: {action})")
        if comment:
            print(f"     Comment: {comment}")
else:
    print("  No history entries")

# --- Summary ---
print("\n=== BROWSER URLS ===")
print(f"  Login:     http://localhost:3000")
print(f"  Workflow:  http://localhost:3000/workflow")
print(f"  Documents: http://localhost:3000/documents")
print(f"  Audit:     http://localhost:3000/audit")
print(f"\n  Users (password: Test@2024!):")
print(f"    alice_author  - AUTHOR")
print(f"    bob_reviewer  - APPROVER")
print(f"    carol_manager - RECORDS_MANAGER")
print(f"    dave_viewer   - VIEWER")
print(f"    eve_deptadmin - DEPARTMENT_ADMIN")
print(f"\n  Admin: admin / Admin@2024!")
