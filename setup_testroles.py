#!/usr/bin/env python3
"""
Setup testroles project with 5 users, upload a document, and walk it through workflow stages.
"""
import json
import sys
import time
import urllib.request
import urllib.error

BASE = "http://localhost:9600/api"

def api(method, path, data=None, token=None, raw=False):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=15)
        txt = resp.read().decode()
        return json.loads(txt) if txt else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  ERROR {e.code} {method} {path}: {err[:300]}")
        return None

def multipart_upload(path, metadata_json, file_bytes, filename, token):
    boundary = "----ApexBoundary12345"
    body = b""
    body += f"--{boundary}\r\n".encode()
    body += b'Content-Disposition: form-data; name="metadata"\r\nContent-Type: application/json\r\n\r\n'
    body += metadata_json.encode() + b"\r\n"
    body += f"--{boundary}\r\n".encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\nContent-Type: application/octet-stream\r\n\r\n'.encode()
    body += file_bytes + b"\r\n"
    body += f"--{boundary}--\r\n".encode()
    url = f"{BASE}{path}"
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", f"multipart/form-data; boundary={boundary}")
    req.add_header("Authorization", f"Bearer {token}")
    resp = urllib.request.urlopen(req, timeout=30)
    return json.loads(resp.read().decode())

def login(username, password):
    r = api("POST", "/auth/login", {"username": username, "password": password})
    if r and r.get("data"):
        return r["data"]["accessToken"], r["data"]["userId"]
    return None, None

def d(r):
    """Extract data from standard response wrapper"""
    if r and "data" in r:
        return r["data"]
    return r

# ============================================================
print("=" * 60)
print("APEX NEXUS - TESTROLES WORKFLOW DEMO SETUP")
print("=" * 60)

# --- Step 1: Admin login ---
print("\n[1] Logging in as admin...")
admin_token, admin_id = login("admin", "Admin@2024!")
if not admin_token:
    print("FAILED to login. Are services running?")
    sys.exit(1)
print(f"  Admin ID: {admin_id}")

# --- Step 2: Get roles ---
print("\n[2] Fetching available roles...")
roles_resp = api("GET", "/auth/roles", token=admin_token)
roles = d(roles_resp)
if not roles:
    print("  No roles found!")
    sys.exit(1)
role_map = {r["name"]: r["id"] for r in roles}
print(f"  Found roles: {list(role_map.keys())}")

# --- Step 3: Create 5 users ---
print("\n[3] Creating 5 test users with different roles...")
users_config = [
    {"username": "alice_author",   "first": "Alice",  "last": "Author",   "role": "AUTHOR",          "dept": "Engineering"},
    {"username": "bob_reviewer",   "first": "Bob",    "last": "Reviewer",  "role": "APPROVER",        "dept": "Quality"},
    {"username": "carol_manager",  "first": "Carol",  "last": "Manager",   "role": "RECORDS_MANAGER", "dept": "Compliance"},
    {"username": "dave_viewer",    "first": "Dave",   "last": "Viewer",    "role": "VIEWER",          "dept": "Operations"},
    {"username": "eve_deptadmin",  "first": "Eve",    "last": "DeptAdmin", "role": "DEPARTMENT_ADMIN", "dept": "IT"},
]

created_users = {}
for u in users_config:
    print(f"  Creating {u['username']} ({u['role']})...")
    r = api("POST", "/auth/register", {
        "username": u["username"],
        "email": f"{u['username']}@testroles.local",
        "password": "Test@2024!",
        "firstName": u["first"],
        "lastName": u["last"],
        "department": u["dept"],
    }, token=admin_token)
    user_data = d(r)
    if not user_data:
        # Maybe user already exists, try to find
        all_users = d(api("GET", "/auth/users", token=admin_token))
        if all_users:
            for eu in all_users:
                if eu.get("username") == u["username"]:
                    user_data = eu
                    print(f"    User already exists: {eu['id']}")
                    break
    if user_data:
        uid = user_data["id"]
        created_users[u["username"]] = {"id": uid, "role": u["role"]}
        # Assign role
        target_role = u["role"]
        if target_role in role_map:
            api("PUT", f"/auth/users/{uid}/roles", {"roles": [target_role]}, token=admin_token)
            print(f"    ID: {uid} | Role: {target_role} ✓")
        else:
            print(f"    ID: {uid} | Role {target_role} not found in system")
    else:
        print(f"    FAILED to create {u['username']}")

# --- Step 4: Create testroles project ---
print("\n[4] Creating 'testroles' project...")
proj_resp = api("POST", "/projects", {
    "name": "testroles",
    "description": "Test project for demonstrating workflow roles and document lifecycle stages",
    "aiEnabled": False,
    "defaultRetentionPeriodYears": 5,
}, token=admin_token)
project = d(proj_resp)
if not project:
    # Try to find existing
    projs = d(api("GET", "/projects", token=admin_token))
    if projs:
        for p in projs:
            if p.get("name") == "testroles":
                project = p
                print(f"  Project already exists: {p['id']}")
                break
if not project:
    print("  FAILED to create project")
    sys.exit(1)
project_id = project["id"]
print(f"  Project ID: {project_id}")

# --- Step 5: Add all users as project members ---
print("\n[5] Adding users as project members...")
for uname, uinfo in created_users.items():
    uid = uinfo["id"]
    role_name = uinfo["role"]
    rid = role_map.get(role_name, role_map.get("AUTHOR"))
    perms = ["READ", "WRITE"]
    if role_name in ("APPROVER", "RECORDS_MANAGER", "DEPARTMENT_ADMIN"):
        perms = ["READ", "WRITE", "APPROVE", "MANAGE", "DELETE"]
    if role_name == "VIEWER":
        perms = ["READ"]
    r = api("POST", f"/projects/{project_id}/members", {
        "userId": uid,
        "roleId": rid,
        "permissions": perms,
    }, token=admin_token)
    status = "✓" if r else "already member or failed"
    print(f"  {uname} → {status}")

# --- Step 6: Upload a test document ---
print("\n[6] Uploading test document...")
# Login as alice (author) to upload
alice_token, alice_id = login("alice_author", "Test@2024!")
if not alice_token:
    print("  Could not login as alice, using admin token")
    alice_token = admin_token
    alice_id = admin_id

doc_content = b"""APEX NEXUS TEST DOCUMENT
========================

Project: testroles
Author: Alice Author
Date: 2026-04-16

This document demonstrates the workflow lifecycle in Apex Nexus.
It will go through the following stages:
1. DRAFT - Initial creation
2. REVIEW - Submitted for review
3. PENDING_APPROVAL - Sent for approval
4. APPROVED - Approved by reviewer
5. ARCHIVED - Finally archived

This is a test document for the testroles project demonstration.
"""

metadata = json.dumps({
    "title": "Workflow Lifecycle Test Document",
    "description": "Test document to demonstrate all workflow stages in the testroles project",
    "projectId": project_id,
    "tags": ["test", "workflow", "demo"],
})

try:
    doc_resp = multipart_upload("/documents", metadata, doc_content, "workflow_test.txt", alice_token)
    document = d(doc_resp)
except Exception as e:
    print(f"  Upload error: {e}")
    document = None

if not document:
    print("  FAILED to upload document")
    sys.exit(1)
doc_id = document["id"]
print(f"  Document ID: {doc_id}")
print(f"  Title: {document.get('title', 'N/A')}")

# --- Step 7: Create workflow on document ---
print("\n[7] Starting workflow on document...")
# Use the default Standard Approval workflow
wf_def_id = "d0000000-0000-0000-0000-000000000001"

# Get bob's ID for assignee
bob_id = created_users.get("bob_reviewer", {}).get("id")
carol_id = created_users.get("carol_manager", {}).get("id")

approvers = []
if bob_id:
    approvers.append({"approverId": bob_id, "approvalOrder": 1, "isParallel": False})
if carol_id:
    approvers.append({"approverId": carol_id, "approvalOrder": 2, "isParallel": False})

wf_resp = api("POST", "/workflow/instances", {
    "documentId": doc_id,
    "definitionId": wf_def_id,
    "assignedTo": bob_id,
    "priority": 1,
    "approvers": approvers,
    "comments": "Starting workflow for testroles demo",
    "projectId": project_id,
}, token=alice_token)
wf_instance = d(wf_resp)
if not wf_instance:
    print("  FAILED to start workflow")
    sys.exit(1)
wf_id = wf_instance["id"]
print(f"  Workflow Instance ID: {wf_id}")
print(f"  Current State: {wf_instance.get('currentState', 'N/A')}")

# --- Step 8: Progress through workflow stages ---
print("\n[8] Progressing through workflow stages...")
print("=" * 50)

def show_state(label):
    r = api("GET", f"/workflow/instances/{wf_id}", token=admin_token)
    inst = d(r)
    if inst:
        state = inst.get("currentState", "N/A")
        print(f"\n  >>> Current State: {state} ({label})")
        return state
    return None

# Stage 1: DRAFT (current)
show_state("Document just created, workflow started")

# Stage 2: DRAFT → REVIEW (submit for review)
print("\n  [Alice submits document for review]")
r = api("POST", f"/workflow/instances/{wf_id}/transition", {
    "action": "submit",
    "comments": "Alice submits document for team review"
}, token=alice_token)
if r:
    show_state("Alice submitted for review")
else:
    print("  Transition to REVIEW failed")

# Stage 3: REVIEW → PENDING_APPROVAL (reviewer sends to approval)
print("\n  [Bob reviews and sends to approval]")
bob_token, _ = login("bob_reviewer", "Test@2024!") if bob_id else (None, None)
use_token = bob_token or admin_token
r = api("POST", f"/workflow/instances/{wf_id}/transition", {
    "action": "approve",
    "comments": "Bob reviewed - looks good, sending for final approval"
}, token=use_token)
if r:
    show_state("Bob reviewed, sent to approval")
else:
    print("  Transition to PENDING_APPROVAL failed")

# Stage 4: PENDING_APPROVAL → APPROVED (approver approves)
print("\n  [Carol approves the document]")
carol_token, _ = login("carol_manager", "Test@2024!") if carol_id else (None, None)
use_token = carol_token or admin_token

# Try the approve endpoint
r = api("POST", f"/workflow/instances/{wf_id}/approve", {
    "decision": "APPROVED",
    "comments": "Carol approves - document meets all compliance requirements"
}, token=use_token)
if not r:
    # Fallback: try transition
    r = api("POST", f"/workflow/instances/{wf_id}/transition", {
        "action": "approve",
        "comments": "Carol approves the document"
    }, token=use_token)
if r:
    show_state("Carol approved the document")
else:
    print("  Approval failed")

# Stage 5: APPROVED → ARCHIVED (archive)
print("\n  [Admin archives the approved document]")
r = api("POST", f"/workflow/instances/{wf_id}/transition", {
    "action": "archive",
    "comments": "Document archived after approval"
}, token=admin_token)
if r:
    show_state("Document archived")
else:
    print("  Archive transition failed")

# --- Step 9: Get full workflow history ---
print("\n\n[9] Workflow Transition History:")
print("=" * 50)
history = d(api("GET", f"/workflow/instances/{wf_id}/history", token=admin_token))
if history:
    for i, entry in enumerate(history, 1):
        fr = entry.get("fromState", "—")
        to = entry.get("toState", "—")
        action = entry.get("action", "—")
        actor = entry.get("actorId", "—")[:8] if entry.get("actorId") else "system"
        comment = entry.get("comments", "")
        ts = entry.get("createdAt", "")[:19] if entry.get("createdAt") else ""
        print(f"  {i}. [{ts}] {fr} → {to} (action: {action}) by {actor}...")
        if comment:
            print(f"     Comment: {comment}")
else:
    print("  No history available")

# --- Summary ---
print("\n\n" + "=" * 60)
print("SETUP COMPLETE - SUMMARY")
print("=" * 60)
print(f"\n  Project:  testroles ({project_id})")
print(f"  Document: Workflow Lifecycle Test Document ({doc_id})")
print(f"  Workflow: {wf_id}")
print(f"\n  Users Created:")
for uname, uinfo in created_users.items():
    print(f"    {uname:20s} | {uinfo['role']:20s} | {uinfo['id']}")
print(f"\n  All passwords: Test@2024!")
print(f"\n  Login Credentials:")
print(f"    alice_author   / Test@2024!  (Author - uploads documents)")
print(f"    bob_reviewer   / Test@2024!  (Approver - reviews documents)")
print(f"    carol_manager  / Test@2024!  (Records Manager - approves)")
print(f"    dave_viewer    / Test@2024!  (Viewer - read-only)")
print(f"    eve_deptadmin  / Test@2024!  (Dept Admin - admin access)")
print(f"\n  Open in browser: http://localhost:3000")
print(f"  Workflow page:   http://localhost:3000/workflow")
print(f"  Document page:   http://localhost:3000/documents")
print(f"  Audit log:       http://localhost:3000/audit")
print()
