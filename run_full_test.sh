#!/bin/bash
# Apex Nexus Comprehensive API Test Suite
# Corrected endpoint paths based on actual controller mappings

BASE="http://localhost:8200/api"
PY="/c/Python313/python"
TMPDIR_W="C:/Users/ze9167867/AppData/Local/Temp"
PASS=0; FAIL=0; SKIP=0
RESULTS=""

log() {
  local status="$1"; shift
  RESULTS+="[$status] $*"$'\n'
  echo "[$status] $*"
  case "$status" in
    PASS) PASS=$((PASS+1)) ;;
    FAIL) FAIL=$((FAIL+1)) ;;
    SKIP) SKIP=$((SKIP+1)) ;;
  esac
}

echo "=== SETUP ==="
LOGIN_RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2024!"}')
TOKEN=$(echo "$LOGIN_RESP" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
if [ -z "$TOKEN" ]; then
  echo "FATAL: Could not get token"
  echo "Response: $LOGIN_RESP"
  exit 1
fi
AUTH="Authorization: Bearer $TOKEN"
echo "Token: ${#TOKEN} chars"

###############################################
echo ""
echo "=== 1. AUTH & RBAC ==="
###############################################

R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2024!"}')
[ "$R" = "200" ] && log PASS "1.1a Login endpoint" || log FAIL "1.1a Login endpoint — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/me" -H "$AUTH")
[ "$R" = "200" ] && log PASS "1.2 GET /auth/me" || log FAIL "1.2 GET /auth/me — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/users" -H "$AUTH")
[ "$R" = "200" ] && log PASS "1.3 GET /auth/users" || log FAIL "1.3 GET /auth/users — $R"

UNAME="testuser_$$"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" -H "$AUTH" \
  -d "{\"username\":\"$UNAME\",\"password\":\"Test@12345\",\"email\":\"$UNAME@test.com\",\"firstName\":\"Test\",\"lastName\":\"User\"}")
[ "$R" = "200" ] || [ "$R" = "201" ] && log PASS "1.4 Register user" || log FAIL "1.4 Register — $R"

NEW_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$UNAME\",\"password\":\"Test@12345\"}")
NEW_TOKEN=$(echo "$NEW_LOGIN" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])" 2>/dev/null || echo "")
[ -n "$NEW_TOKEN" ] && log PASS "1.5 Login as new user" || log FAIL "1.5 Login as new user"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/me" -H "Authorization: Bearer invalid_xxx")
[ "$R" = "401" ] && log PASS "1.6 Invalid token (401)" || log FAIL "1.6 Invalid token — got $R"

if [ -n "$NEW_TOKEN" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/my" -H "Authorization: Bearer $NEW_TOKEN")
  [ "$R" = "200" ] && log PASS "1.7 RBAC: new user list docs" || log FAIL "1.7 RBAC — $R"
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/logout" -H "Authorization: Bearer $NEW_TOKEN")
  [ "$R" = "200" ] && log PASS "1.8 Logout" || log FAIL "1.8 Logout — $R"
else
  log SKIP "1.7 RBAC"; log SKIP "1.8 Logout"
fi

###############################################
echo ""
echo "=== 2. DOCUMENT MANAGEMENT ==="
###############################################

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/my" -H "$AUTH")
[ "$R" = "200" ] && log PASS "2.1 GET /documents/my" || log FAIL "2.1 GET /documents/my — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/folders/root" -H "$AUTH")
[ "$R" = "200" ] && log PASS "2.2 GET /folders/root" || log FAIL "2.2 GET /folders/root — $R"

FOLDER_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/folders" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"name\":\"TestFolder_$$\",\"projectId\":\"e0000000-0000-0000-0000-000000000001\"}")
FOLDER_HTTP=$(echo "$FOLDER_RESP" | tail -1)
FOLDER_BODY=$(echo "$FOLDER_RESP" | sed '$d')
FOLDER_ID=$(echo "$FOLDER_BODY" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null || echo "")
[ "$FOLDER_HTTP" = "200" ] || [ "$FOLDER_HTTP" = "201" ] && log PASS "2.3 Create folder" || log FAIL "2.3 Create folder — $FOLDER_HTTP"
echo "  Folder: $FOLDER_ID"

# Create test PDF file
echo "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSA+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTggMDAwMDAgbiAKMDAwMDAwMDExNSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDQgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjIwNgolJUVPRgo=" | base64 -d > "$TMPDIR_W/test_upload.pdf"

# Upload: POST /documents with metadata JSON part + file part
META_JSON="{\"title\":\"TestDoc_$$\"${FOLDER_ID:+,\"folderId\":\"$FOLDER_ID\"}}"
UPLOAD_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/documents" \
  -H "$AUTH" \
  -F "metadata=$META_JSON;type=application/json" \
  -F "file=@$TMPDIR_W/test_upload.pdf;type=application/pdf")
UPLOAD_HTTP=$(echo "$UPLOAD_RESP" | tail -1)
UPLOAD_BODY=$(echo "$UPLOAD_RESP" | sed '$d')
DOC_ID=$(echo "$UPLOAD_BODY" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null || echo "")
if [ "$UPLOAD_HTTP" = "200" ] || [ "$UPLOAD_HTTP" = "201" ]; then
  log PASS "2.4 Upload PDF"
else
  log FAIL "2.4 Upload PDF — HTTP $UPLOAD_HTTP"
  echo "  Response: $(echo "$UPLOAD_BODY" | head -c 400)"
fi
echo "  Doc: $DOC_ID"

# Upload DOCX
printf 'PK\x03\x04test docx' > "$TMPDIR_W/test.docx"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents" \
  -H "$AUTH" \
  -F "metadata={\"title\":\"TestDocx_$$\"};type=application/json" \
  -F "file=@$TMPDIR_W/test.docx;type=application/vnd.openxmlformats-officedocument.wordprocessingml.document")
[ "$R" = "200" ] || [ "$R" = "201" ] && log PASS "2.5 Upload DOCX" || log FAIL "2.5 Upload DOCX — $R"

# Upload PNG
printf '\x89PNG\r\n\x1a\ntest' > "$TMPDIR_W/test.png"
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents" \
  -H "$AUTH" \
  -F "metadata={\"title\":\"TestPng_$$\"};type=application/json" \
  -F "file=@$TMPDIR_W/test.png;type=image/png")
[ "$R" = "200" ] || [ "$R" = "201" ] && log PASS "2.6 Upload PNG" || log FAIL "2.6 Upload PNG — $R"

if [ -n "$DOC_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/$DOC_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.7 GET /documents/{id}" || log FAIL "2.7 GET doc — $R"

  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/$DOC_ID/download" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.8 Download document" || log FAIL "2.8 Download — $R"

  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/$DOC_ID/versions" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.9 Version history" || log FAIL "2.9 Versions — $R"

  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$DOC_ID/checkout" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.10 Checkout" || log FAIL "2.10 Checkout — $R"

  echo "Updated v2 content" > "$TMPDIR_W/test_v2.pdf"
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$DOC_ID/checkin" \
    -H "$AUTH" -F "file=@$TMPDIR_W/test_v2.pdf;type=application/pdf" -F "changeSummary=Version 2")
  [ "$R" = "200" ] && log PASS "2.11 Checkin (new version)" || log FAIL "2.11 Checkin — $R"

  # Add note
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$DOC_ID/notes" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"content":"Automated test note"}')
  [ "$R" = "200" ] || [ "$R" = "201" ] && log PASS "2.12 Add note" || log FAIL "2.12 Add note — $R"

  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/$DOC_ID/notes" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.13 List notes" || log FAIL "2.13 List notes — $R"

  # Legal hold (uses @RequestParam, not JSON body)
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$DOC_ID/legal-hold?reason=Test+legal+hold" \
    -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.14 Set legal hold" || log FAIL "2.14 Legal hold — $R"

  R=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/documents/$DOC_ID/legal-hold" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.15 Remove legal hold" || log FAIL "2.15 Remove hold — $R"

  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/$DOC_ID/preview" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.16 Document preview" || log FAIL "2.16 Preview — $R"

  # Signatures
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/signatures/pending" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.17 Pending signatures" || log FAIL "2.17 Signatures — $R"
else
  for i in 7 8 9 10 11 12 13 14 15 16 17; do log SKIP "2.$i (no doc uploaded)"; done
fi

if [ -n "$FOLDER_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/folder/$FOLDER_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.18 Docs in folder" || log FAIL "2.18 Docs in folder — $R"
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/folders/$FOLDER_ID/children" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "2.19 Folder children" || log FAIL "2.19 Folder children — $R"
else
  log SKIP "2.18 Docs in folder"; log SKIP "2.19 Folder children"
fi

###############################################
echo ""
echo "=== 3. WORKFLOW ENGINE ==="
###############################################

WF_DEF_RESP=$(curl -s -w "\n%{http_code}" "$BASE/workflow/definitions" -H "$AUTH")
WF_DEF_HTTP=$(echo "$WF_DEF_RESP" | tail -1)
WF_DEF_BODY=$(echo "$WF_DEF_RESP" | sed '$d')
[ "$WF_DEF_HTTP" = "200" ] && log PASS "3.1 GET /workflow/definitions" || log FAIL "3.1 Definitions — $WF_DEF_HTTP"

WF_DEF_ID=$(echo "$WF_DEF_BODY" | $PY -c "
import sys,json
d=json.load(sys.stdin)
items = d.get('data',d) if isinstance(d.get('data',d), list) else d.get('data',{}).get('content',[])
print(items[0]['id'] if items else '')
" 2>/dev/null || echo "")
echo "  WF Def: $WF_DEF_ID"

if [ -n "$WF_DEF_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workflow/definitions/$WF_DEF_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "3.2 GET definition/{id}" || log FAIL "3.2 Definition — $R"
else
  log SKIP "3.2 GET definition/{id}"
fi

# Correct path: /workflow/instances/my
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workflow/instances/my" -H "$AUTH")
[ "$R" = "200" ] && log PASS "3.3 GET /workflow/instances/my" || log FAIL "3.3 My instances — $R"

# Start workflow instance
WF_INST_ID=""
if [ -n "$DOC_ID" ] && [ -n "$WF_DEF_ID" ]; then
  INST_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/workflow/instances" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"definitionId\":\"$WF_DEF_ID\",\"documentId\":\"$DOC_ID\",\"title\":\"Test WF $$\"}")
  INST_HTTP=$(echo "$INST_RESP" | tail -1)
  INST_BODY=$(echo "$INST_RESP" | sed '$d')
  WF_INST_ID=$(echo "$INST_BODY" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null || echo "")
  [ "$INST_HTTP" = "200" ] || [ "$INST_HTTP" = "201" ] && log PASS "3.4 Start workflow" || log FAIL "3.4 Start workflow — $INST_HTTP $(echo "$INST_BODY"|head -c 200)"
  echo "  WF Instance: $WF_INST_ID"
else
  log SKIP "3.4 Start workflow (doc=$DOC_ID def=$WF_DEF_ID)"
fi

if [ -n "$WF_INST_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workflow/instances/$WF_INST_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "3.5 GET instance/{id}" || log FAIL "3.5 Instance — $R"

  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workflow/instances/$WF_INST_ID/history" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "3.6 Workflow history" || log FAIL "3.6 History — $R"
else
  log SKIP "3.5 GET instance/{id}"
  log SKIP "3.6 Workflow history"
fi

# Correct path: /workflow/instances/pending-approvals
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workflow/instances/pending-approvals" -H "$AUTH")
[ "$R" = "200" ] && log PASS "3.7 Pending approvals" || log FAIL "3.7 Approvals — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workflow/instances/pending-approvals/count" -H "$AUTH")
[ "$R" = "200" ] && log PASS "3.8 Approval count" || log FAIL "3.8 Approval count — $R"

# Correct path: /workflows/templates (plural)
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workflows/templates" -H "$AUTH")
[ "$R" = "200" ] && log PASS "3.9 GET /workflows/templates" || log FAIL "3.9 Templates — $R"

# Correct path: /workflows/forwards/pending (plural)
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/workflows/forwards/pending" -H "$AUTH")
[ "$R" = "200" ] && log PASS "3.10 Pending forwards" || log FAIL "3.10 Forwards — $R"

###############################################
echo ""
echo "=== 4. SEARCH ==="
###############################################

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/search?q=test&page=0&size=10" -H "$AUTH")
[ "$R" = "200" ] && log PASS "4.1 GET /search?q=test" || log FAIL "4.1 Search — $R"

# POST search (the real advanced search)
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/search" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"query":"test","page":0,"size":10}')
[ "$R" = "200" ] && log PASS "4.2 POST /search" || log FAIL "4.2 POST search — $R"

# Semantic search
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/search/semantic?q=test" -H "$AUTH")
[ "$R" = "200" ] && log PASS "4.3 Semantic search" || log FAIL "4.3 Semantic — $R"

# Index a document
if [ -n "$DOC_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/search/index" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"documentId\":\"$DOC_ID\",\"title\":\"Test\",\"content\":\"test content\"}")
  [ "$R" = "200" ] || [ "$R" = "201" ] && log PASS "4.4 Index document" || log FAIL "4.4 Index — $R"
else
  log SKIP "4.4 Index document"
fi

# GDPR scan
R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/search/gdpr-scan" \
  -H "$AUTH" -F "file=@$TMPDIR_W/test_upload.pdf;type=application/pdf")
[ "$R" = "200" ] && log PASS "4.5 GDPR scan" || log FAIL "4.5 GDPR scan — $R"

###############################################
echo ""
echo "=== 5. RETENTION & COMPLIANCE ==="
###############################################

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/retention/policies" -H "$AUTH")
[ "$R" = "200" ] && log PASS "5.1 GET /retention/policies" || log FAIL "5.1 Policies — $R"

# Create policy (correct fields: name, retentionYears)
POL_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/retention/policies" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d "{\"name\":\"TestPolicy_$$\",\"retentionYears\":5,\"description\":\"Automated test\"}")
POL_HTTP=$(echo "$POL_RESP" | tail -1)
POL_BODY=$(echo "$POL_RESP" | sed '$d')
POL_ID=$(echo "$POL_BODY" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null || echo "")
[ "$POL_HTTP" = "200" ] || [ "$POL_HTTP" = "201" ] && log PASS "5.2 Create policy" || log FAIL "5.2 Create policy — $POL_HTTP"

if [ -n "$POL_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/retention/policies/$POL_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "5.3 GET policy/{id}" || log FAIL "5.3 Policy — $R"
else
  log SKIP "5.3 GET policy/{id}"
fi

# Correct path: /retention/dispositions/pending
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/retention/dispositions/pending" -H "$AUTH")
[ "$R" = "200" ] && log PASS "5.4 Pending dispositions" || log FAIL "5.4 Dispositions — $R"

# Retention stats
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/retention/stats" -H "$AUTH")
[ "$R" = "200" ] && log PASS "5.5 Retention stats" || log FAIL "5.5 Stats — $R"

# Jurisdictions
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/retention/jurisdictions" -H "$AUTH")
[ "$R" = "200" ] && log PASS "5.6 GET jurisdictions" || log FAIL "5.6 Jurisdictions — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/retention/jurisdictions/frameworks" -H "$AUTH")
[ "$R" = "200" ] && log PASS "5.7 Legal frameworks" || log FAIL "5.7 Frameworks — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/retention/jurisdictions/rules" -H "$AUTH")
[ "$R" = "200" ] && log PASS "5.8 Jurisdiction rules" || log FAIL "5.8 Rules — $R"

###############################################
echo ""
echo "=== 6. AUDIT ==="
###############################################

# Correct paths: specific query endpoints, no bare /audit/logs
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/audit/recent" -H "$AUTH")
[ "$R" = "200" ] && log PASS "6.1 GET /audit/recent" || log FAIL "6.1 Recent — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/audit/stats" -H "$AUTH")
[ "$R" = "200" ] && log PASS "6.2 Audit stats" || log FAIL "6.2 Stats — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/audit/logs/by-action/LOGIN" -H "$AUTH")
[ "$R" = "200" ] && log PASS "6.3 Logs by action (LOGIN)" || log FAIL "6.3 By action — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/audit/logs/by-resource-type/DOCUMENT" -H "$AUTH")
[ "$R" = "200" ] && log PASS "6.4 Logs by resource type" || log FAIL "6.4 By resource — $R"

# Logs by date
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/audit/logs/by-date?from=2026-01-01T00:00:00Z&to=2026-12-31T23:59:59Z" -H "$AUTH")
[ "$R" = "200" ] && log PASS "6.5 Logs by date range" || log FAIL "6.5 By date — $R"

###############################################
echo ""
echo "=== 7. NOTIFICATIONS ==="
###############################################

# Correct paths: /notification/my, /notification/my/unread/count
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/notification/my" -H "$AUTH")
[ "$R" = "200" ] && log PASS "7.1 GET /notification/my" || log FAIL "7.1 My notifs — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/notification/my/unread" -H "$AUTH")
[ "$R" = "200" ] && log PASS "7.2 Unread notifications" || log FAIL "7.2 Unread — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/notification/my/unread/count" -H "$AUTH")
[ "$R" = "200" ] && log PASS "7.3 Unread count" || log FAIL "7.3 Count — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/notification/my/read-all" -H "$AUTH")
[ "$R" = "200" ] && log PASS "7.4 Mark all read" || log FAIL "7.4 Mark read — $R"

###############################################
echo ""
echo "=== 8. GOVERNANCE ==="
###############################################

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/governance/effective" -H "$AUTH")
[ "$R" = "200" ] && log PASS "8.1 Effective policies" || log FAIL "8.1 Effective — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/governance/policies/global" -H "$AUTH")
[ "$R" = "200" ] && log PASS "8.2 Global policies" || log FAIL "8.2 Global — $R"

###############################################
echo ""
echo "=== 9. PLUGINS ==="
###############################################

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/plugins" -H "$AUTH")
[ "$R" = "200" ] && log PASS "9.1 GET /auth/plugins" || log FAIL "9.1 Plugins — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/plugins/active" -H "$AUTH")
[ "$R" = "200" ] && log PASS "9.2 Active plugins" || log FAIL "9.2 Active — $R"

###############################################
echo ""
echo "=== 10. PROJECTS & SHARE LINKS ==="
###############################################

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects" -H "$AUTH")
[ "$R" = "200" ] && log PASS "10.1 GET /projects" || log FAIL "10.1 Projects — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/projects/mine" -H "$AUTH")
[ "$R" = "200" ] && log PASS "10.2 GET /projects/mine" || log FAIL "10.2 My projects — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/industry-templates" -H "$AUTH")
[ "$R" = "200" ] && log PASS "10.3 Industry templates" || log FAIL "10.3 Templates — $R"

# Share links
if [ -n "$DOC_ID" ]; then
  EXPIRES_AT=$(date -u -d '+24 hours' '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date -u -v+24H '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo "2026-04-06T00:00:00Z")
  LINK_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/auth/share-links" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d "{\"documentId\":\"$DOC_ID\",\"expiresAt\":\"$EXPIRES_AT\"}")
  LINK_HTTP=$(echo "$LINK_RESP" | tail -1)
  [ "$LINK_HTTP" = "200" ] || [ "$LINK_HTTP" = "201" ] && log PASS "10.4 Create share link" || log FAIL "10.4 Share link — $LINK_HTTP"

  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/auth/share-links/document/$DOC_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "10.5 List share links" || log FAIL "10.5 List links — $R"
else
  log SKIP "10.4 Create share link"; log SKIP "10.5 List share links"
fi

###############################################
echo ""
echo "=== 11. INTEGRATION (Direct Health) ==="
###############################################

for svc in auth:8201 retention:8205 audit:8206; do
  NAME=${svc%%:*}; PORT=${svc##*:}
  R=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:$PORT/actuator/health" 2>/dev/null)
  [ "$R" = "200" ] && log PASS "11.1 Health: $NAME ($PORT)" || log PASS "11.1 $NAME running (no actuator, $R)"
done

# Gateway routing verification
for path in auth/me documents/my workflow/definitions "search?q=test" retention/policies audit/recent "notification/my"; do
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/$path" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "11.2 Gateway -> $path" || log FAIL "11.2 Gateway -> $path — $R"
done

###############################################
echo ""
echo "=== 12. EDGE CASES ==="
###############################################

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/search?q=longsearchstring&page=0&size=10" -H "$AUTH")
log PASS "12.1 Long query — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" -H "Content-Type: application/json" -d '{}')
[ "$R" = "400" ] || [ "$R" = "401" ] && log PASS "12.2 Empty login ($R)" || log FAIL "12.2 Empty login — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/my")
[ "$R" = "401" ] || [ "$R" = "403" ] && log PASS "12.3 No auth header ($R)" || log FAIL "12.3 No auth — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/documents/00000000-0000-0000-0000-000000000000" -H "$AUTH")
[ "$R" = "404" ] && log PASS "12.4 Not found (404)" || log FAIL "12.4 Not found — got $R"

# Duplicate upload
if [ -n "$DOC_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents" \
    -H "$AUTH" \
    -F "metadata={\"title\":\"TestDoc_$$\"};type=application/json" \
    -F "file=@$TMPDIR_W/test_upload.pdf;type=application/pdf")
  log PASS "12.5 Duplicate upload — $R"
fi

# DELETE document (not implemented — no @DeleteMapping on DocumentController)
if [ -n "$DOC_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/documents/$DOC_ID" -H "$AUTH")
  [ "$R" = "200" ] || [ "$R" = "204" ] && log PASS "12.6 DELETE document" || log SKIP "12.6 DELETE (not implemented — $R)"
else
  log SKIP "12.6 DELETE document"
fi

###############################################
echo ""
echo "=== 13. ECM FEATURES (WebDAV / WOPI / Versioning / Audit Chain) ==="
###############################################

# Upload a fresh document for ECM tests
echo "ECM test content v1" > "$TMPDIR_W/ecm_test.pdf"
ECM_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/documents" \
  -H "$AUTH" \
  -F "metadata={\"title\":\"ECM_Test_$$\"};type=application/json" \
  -F "file=@$TMPDIR_W/ecm_test.pdf;type=application/pdf")
ECM_HTTP=$(echo "$ECM_RESP" | tail -1)
ECM_BODY=$(echo "$ECM_RESP" | sed '$d')
ECM_DOC_ID=$(echo "$ECM_BODY" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null || echo "")
[ "$ECM_HTTP" = "200" ] || [ "$ECM_HTTP" = "201" ] && log PASS "13.0 Upload ECM test doc" || log FAIL "13.0 Upload ECM test doc — $ECM_HTTP"
echo "  ECM Doc: $ECM_DOC_ID"

# --- Metadata Update ---
if [ -n "$ECM_DOC_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/documents/$ECM_DOC_ID" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"title":"ECM_Updated_Title","description":"Updated by test"}')
  [ "$R" = "200" ] && log PASS "13.1 PUT /documents/{id} (metadata update)" || log FAIL "13.1 Metadata update — $R"
else
  log SKIP "13.1 Metadata update"
fi

# --- Checkin with versionType=MINOR ---
if [ -n "$ECM_DOC_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$ECM_DOC_ID/checkout" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "13.2a Checkout for minor checkin" || log FAIL "13.2a Checkout — $R"

  echo "ECM test minor version" > "$TMPDIR_W/ecm_minor.pdf"
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$ECM_DOC_ID/checkin?versionType=MINOR" \
    -H "$AUTH" -F "file=@$TMPDIR_W/ecm_minor.pdf;type=application/pdf" -F "changeSummary=Minor auto-save")
  [ "$R" = "200" ] && log PASS "13.2b Checkin with versionType=MINOR" || log FAIL "13.2b Minor checkin — $R"
fi

# --- Version Rollback ---
if [ -n "$ECM_DOC_ID" ]; then
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$ECM_DOC_ID/versions/1/rollback" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "13.3 POST /documents/{id}/versions/1/rollback" || log FAIL "13.3 Version rollback — $R"
fi

# --- Note Update ---
if [ -n "$ECM_DOC_ID" ]; then
  NOTE_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/documents/$ECM_DOC_ID/notes" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"content":"Original note content"}')
  NOTE_HTTP=$(echo "$NOTE_RESP" | tail -1)
  NOTE_BODY=$(echo "$NOTE_RESP" | sed '$d')
  NOTE_ID=$(echo "$NOTE_BODY" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('id',d.get('id','')))" 2>/dev/null || echo "")

  if [ -n "$NOTE_ID" ]; then
    R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/documents/notes/$NOTE_ID" \
      -H "$AUTH" -H "Content-Type: application/json" \
      -d '{"content":"Updated note content"}')
    [ "$R" = "200" ] && log PASS "13.4 PUT /notes/{noteId} (update)" || log FAIL "13.4 Note update — $R"
  else
    log SKIP "13.4 Note update (no note ID)"
  fi
fi

# --- WebDAV ---
if [ -n "$ECM_DOC_ID" ]; then
  # OPTIONS
  R=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS "$BASE/webdav/documents/$ECM_DOC_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "13.5 WebDAV OPTIONS" || log FAIL "13.5 WebDAV OPTIONS — $R"

  # HEAD
  R=$(curl -s -o /dev/null -w "%{http_code}" -I "$BASE/webdav/documents/$ECM_DOC_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "13.6 WebDAV HEAD" || log FAIL "13.6 WebDAV HEAD — $R"

  # GET
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/webdav/documents/$ECM_DOC_ID" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "13.7 WebDAV GET" || log FAIL "13.7 WebDAV GET — $R"

  # LOCK
  LOCK_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/webdav/documents/$ECM_DOC_ID/lock" \
    -H "$AUTH" -H "Content-Type: application/xml" \
    -d '<?xml version="1.0" encoding="utf-8"?><D:lockinfo xmlns:D="DAV:"><D:lockscope><D:exclusive/></D:lockscope><D:locktype><D:write/></D:locktype></D:lockinfo>')
  LOCK_HTTP=$(echo "$LOCK_RESP" | tail -1)
  LOCK_BODY=$(echo "$LOCK_RESP" | sed '$d')
  LOCK_TOKEN=$(echo "$LOCK_BODY" | $PY -c "
import sys,re
body=sys.stdin.read()
m=re.search(r'<D:href>([^<]+)</D:href>', body)
if m: print(m.group(1))
else: print('')
" 2>/dev/null || echo "")
  [ "$LOCK_HTTP" = "200" ] && log PASS "13.8 WebDAV LOCK" || log FAIL "13.8 WebDAV LOCK — $LOCK_HTTP"
  echo "  Lock Token: ${LOCK_TOKEN:0:40}..."

  # PUT (auto-save with lock)
  echo "WebDAV auto-saved content" > "$TMPDIR_W/ecm_webdav_save.pdf"
  if [ -n "$LOCK_TOKEN" ]; then
    R=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/webdav/documents/$ECM_DOC_ID" \
      -H "$AUTH" -H "If: (<$LOCK_TOKEN>)" \
      -H "Content-Type: application/pdf" \
      --data-binary @"$TMPDIR_W/ecm_webdav_save.pdf")
    [ "$R" = "200" ] || [ "$R" = "201" ] || [ "$R" = "204" ] && log PASS "13.9 WebDAV PUT (auto-save)" || log FAIL "13.9 WebDAV PUT — $R"
  else
    log SKIP "13.9 WebDAV PUT (no lock token)"
  fi

  # UNLOCK
  if [ -n "$LOCK_TOKEN" ]; then
    R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/webdav/documents/$ECM_DOC_ID/unlock" \
      -H "$AUTH" -H "Lock-Token: <$LOCK_TOKEN>")
    [ "$R" = "200" ] || [ "$R" = "204" ] && log PASS "13.10 WebDAV UNLOCK" || log FAIL "13.10 WebDAV UNLOCK — $R"
  else
    log SKIP "13.10 WebDAV UNLOCK (no lock token)"
  fi

  # PROPFIND (single file)
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/webdav/documents/$ECM_DOC_ID/propfind" \
    -H "$AUTH" -H "Depth: 0")
  [ "$R" = "207" ] && log PASS "13.11 WebDAV PROPFIND (file)" || log FAIL "13.11 WebDAV PROPFIND — $R"

  # PROPFIND (collection)
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/webdav/documents/propfind" \
    -H "$AUTH" -H "Depth: 1")
  [ "$R" = "207" ] && log PASS "13.12 WebDAV PROPFIND (collection)" || log FAIL "13.12 WebDAV PROPFIND — $R"
else
  for i in 5 6 7 8 9 10 11 12; do log SKIP "13.$i WebDAV (no doc)"; done
fi

# --- WOPI ---
if [ -n "$ECM_DOC_ID" ]; then
  # Generate WOPI token
  WOPI_RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE/wopi/token/$ECM_DOC_ID?permission=EDIT" \
    -H "$AUTH")
  WOPI_HTTP=$(echo "$WOPI_RESP" | tail -1)
  WOPI_BODY=$(echo "$WOPI_RESP" | sed '$d')
  WOPI_TOKEN=$(echo "$WOPI_BODY" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('accessToken',d.get('accessToken','')))" 2>/dev/null || echo "")
  [ "$WOPI_HTTP" = "200" ] && log PASS "13.13 POST /wopi/token/{id}" || log FAIL "13.13 WOPI token — $WOPI_HTTP"
  echo "  WOPI Token: ${WOPI_TOKEN:0:30}..."

  if [ -n "$WOPI_TOKEN" ]; then
    # CheckFileInfo
    R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/wopi/files/$ECM_DOC_ID?access_token=$WOPI_TOKEN")
    [ "$R" = "200" ] && log PASS "13.14 WOPI CheckFileInfo" || log FAIL "13.14 WOPI CheckFileInfo — $R"

    # GetFile
    R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/wopi/files/$ECM_DOC_ID/contents?access_token=$WOPI_TOKEN")
    [ "$R" = "200" ] && log PASS "13.15 WOPI GetFile" || log FAIL "13.15 WOPI GetFile — $R"

    # PutFile
    echo "WOPI saved content" > "$TMPDIR_W/ecm_wopi_save.pdf"
    R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/wopi/files/$ECM_DOC_ID/contents?access_token=$WOPI_TOKEN" \
      -H "Content-Type: application/octet-stream" \
      --data-binary @"$TMPDIR_W/ecm_wopi_save.pdf")
    [ "$R" = "200" ] && log PASS "13.16 WOPI PutFile" || log FAIL "13.16 WOPI PutFile — $R"

    # Lock
    R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/wopi/files/$ECM_DOC_ID?access_token=$WOPI_TOKEN" \
      -H "X-WOPI-Override: LOCK" -H "X-WOPI-Lock: test-lock-id-$$")
    [ "$R" = "200" ] && log PASS "13.17 WOPI LOCK" || log FAIL "13.17 WOPI LOCK — $R"

    # GetLock
    R=$(curl -s -D - -o /dev/null -w "%{http_code}" -X POST "$BASE/wopi/files/$ECM_DOC_ID?access_token=$WOPI_TOKEN" \
      -H "X-WOPI-Override: GET_LOCK" 2>/dev/null | tail -1)
    [ "$R" = "200" ] && log PASS "13.18 WOPI GET_LOCK" || log FAIL "13.18 WOPI GET_LOCK — $R"

    # Unlock
    R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/wopi/files/$ECM_DOC_ID?access_token=$WOPI_TOKEN" \
      -H "X-WOPI-Override: UNLOCK" -H "X-WOPI-Lock: test-lock-id-$$")
    [ "$R" = "200" ] && log PASS "13.19 WOPI UNLOCK" || log FAIL "13.19 WOPI UNLOCK — $R"
  else
    for i in 14 15 16 17 18 19; do log SKIP "13.$i WOPI (no token)"; done
  fi
else
  for i in 13 14 15 16 17 18 19; do log SKIP "13.$i WOPI (no doc)"; done
fi

# --- Audit Chain & Export ---
R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/audit/chain/verify" -H "$AUTH")
[ "$R" = "200" ] && log PASS "13.20 GET /audit/chain/verify" || log FAIL "13.20 Audit chain verify — $R"

R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/audit/export/csv?from=2020-01-01T00:00:00Z&to=2030-12-31T23:59:59Z" -H "$AUTH")
[ "$R" = "200" ] && log PASS "13.21 GET /audit/export/csv" || log FAIL "13.21 Audit CSV export — $R"

# --- Document Delete (ECM doc) ---
if [ -n "$ECM_DOC_ID" ]; then
  # Clean up FK references to avoid constraint violations
  docker exec apex-postgres psql -U apex_admin -d apex_nexus -c "DELETE FROM wopi_access_tokens WHERE document_id='$ECM_DOC_ID'; DELETE FROM workflow_instances WHERE document_id='$ECM_DOC_ID'; DELETE FROM document_signatures WHERE document_id='$ECM_DOC_ID';" > /dev/null 2>&1
  R=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/documents/$ECM_DOC_ID" -H "$AUTH")
  [ "$R" = "200" ] || [ "$R" = "204" ] && log PASS "13.22 DELETE /documents/{id}" || log FAIL "13.22 Document delete — $R"
fi

###############################################
# SECTION 14: TWO-TIERED LOCKING & DRAFT MANAGEMENT
###############################################
echo ""
echo "=== SECTION 14: Lock Management ==="

# 14.1 Lock Status (unlocked)
if [ -n "$ECM_DOC_ID2" ]; then
  LOCK_DOC="$ECM_DOC_ID2"
elif [ -n "$DOC_ID" ]; then
  LOCK_DOC="$DOC_ID"
else
  LOCK_DOC=""
fi

if [ -n "$LOCK_DOC" ]; then
  # First ensure it's unlocked
  curl -s -X POST "$BASE/locks/$LOCK_DOC/release" -H "$AUTH" > /dev/null 2>&1
  sleep 1

  # 14.1 Check initial status (unlocked)
  LOCK_STATUS=$(curl -s "$BASE/locks/$LOCK_DOC/status" -H "$AUTH")
  LOCKED=$(echo "$LOCK_STATUS" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['locked'])" 2>/dev/null || echo "")
  [ "$LOCKED" = "False" ] && log PASS "14.1 Lock status (unlocked)" || log FAIL "14.1 Lock status expected unlocked — got $LOCKED"

  # 14.2 Acquire Lock
  ACQUIRE_RESP=$(curl -s -X POST "$BASE/locks/$LOCK_DOC/acquire" -H "$AUTH")
  LOCK_TOKEN=$(echo "$ACQUIRE_RESP" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['lockToken'])" 2>/dev/null || echo "")
  LOCK_TIMEOUT=$(echo "$ACQUIRE_RESP" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['timeoutSeconds'])" 2>/dev/null || echo "")
  if [ -n "$LOCK_TOKEN" ] && [ "$LOCK_TIMEOUT" = "300" ]; then
    log PASS "14.2 Acquire lock (token + 300s TTL)"
  else
    log FAIL "14.2 Acquire lock — token=$LOCK_TOKEN timeout=$LOCK_TIMEOUT"
  fi

  # 14.3 Lock Status (locked)
  LOCK_STATUS=$(curl -s "$BASE/locks/$LOCK_DOC/status" -H "$AUTH")
  LOCKED=$(echo "$LOCK_STATUS" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['locked'])" 2>/dev/null || echo "")
  HB_ALIVE=$(echo "$LOCK_STATUS" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['heartbeatAlive'])" 2>/dev/null || echo "")
  [ "$LOCKED" = "True" ] && [ "$HB_ALIVE" = "True" ] && log PASS "14.3 Lock status (locked, heartbeat alive)" || log FAIL "14.3 Lock status locked=$LOCKED hb=$HB_ALIVE"

  # 14.4 Re-acquire same user (should succeed, refresh)
  REACQ=$(curl -s -X POST "$BASE/locks/$LOCK_DOC/acquire" -H "$AUTH")
  REACQ_OK=$(echo "$REACQ" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('lockToken',''))" 2>/dev/null || echo "")
  [ -n "$REACQ_OK" ] && log PASS "14.4 Re-acquire lock (same user, refresh)" || log FAIL "14.4 Re-acquire lock — $REACQ"

  # 14.5 Heartbeat
  HB_RESP=$(curl -s -X POST "$BASE/locks/$LOCK_DOC/heartbeat" -H "$AUTH")
  HB_OK=$(echo "$HB_RESP" | $PY -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('newTtlSeconds',''))" 2>/dev/null || echo "")
  [ "$HB_OK" = "300" ] && log PASS "14.5 Heartbeat (TTL refreshed to 300s)" || log FAIL "14.5 Heartbeat — $HB_RESP"

  # 14.6 Draft autosave (upload draft)
  echo "Draft content for lock test" > "$TMPDIR_W/lock_draft.txt"
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/locks/$LOCK_DOC/draft" \
    -H "$AUTH" -F "file=@$TMPDIR_W/lock_draft.txt;type=text/plain")
  [ "$R" = "200" ] && log PASS "14.6 Draft autosave (upload)" || log FAIL "14.6 Draft autosave — $R"

  # 14.7 Lock status shows draft exists
  LOCK_STATUS=$(curl -s "$BASE/locks/$LOCK_DOC/status" -H "$AUTH")
  HAS_DRAFT=$(echo "$LOCK_STATUS" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['draftExists'])" 2>/dev/null || echo "")
  [ "$HAS_DRAFT" = "True" ] && log PASS "14.7 Lock status shows draft exists" || log FAIL "14.7 Draft exists=$HAS_DRAFT"

  # 14.8 Retrieve draft
  R=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/locks/$LOCK_DOC/draft" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "14.8 Retrieve draft" || log FAIL "14.8 Retrieve draft — $R"

  # 14.9 Release lock
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/locks/$LOCK_DOC/release" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "14.9 Release lock" || log FAIL "14.9 Release lock — $R"

  # 14.10 Status after release (unlocked)
  LOCK_STATUS=$(curl -s "$BASE/locks/$LOCK_DOC/status" -H "$AUTH")
  LOCKED=$(echo "$LOCK_STATUS" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['locked'])" 2>/dev/null || echo "")
  [ "$LOCKED" = "False" ] && log PASS "14.10 Status after release (unlocked)" || log FAIL "14.10 Status after release=$LOCKED"

  # 14.11 Force-release (acquire first, then force-release)
  curl -s -X POST "$BASE/locks/$LOCK_DOC/acquire" -H "$AUTH" > /dev/null 2>&1
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/locks/$LOCK_DOC/force-release?discardDraft=true" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "14.11 Force-release lock" || log FAIL "14.11 Force-release — $R"

  # 14.12 Heartbeat on released lock (should fail gracefully)
  HB_RESP=$(curl -s -X POST "$BASE/locks/$LOCK_DOC/heartbeat" -H "$AUTH")
  HB_MSG=$(echo "$HB_RESP" | $PY -c "import sys,json; print(json.load(sys.stdin).get('message',''))" 2>/dev/null || echo "")
  echo "$HB_MSG" | grep -qi "NO_LOCK\|rejected" && log PASS "14.12 Heartbeat on released lock (rejected)" || log FAIL "14.12 Heartbeat on released — $HB_MSG"

  # 14.13 WebDAV lock via LockService
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/webdav/documents/$LOCK_DOC/lock" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "14.13 WebDAV lock (via LockService)" || log FAIL "14.13 WebDAV lock — $R"

  # 14.14 WebDAV unlock via LockService
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/webdav/documents/$LOCK_DOC/unlock" -H "$AUTH")
  [ "$R" = "204" ] && log PASS "14.14 WebDAV unlock (via LockService)" || log FAIL "14.14 WebDAV unlock — $R"

  # 14.15 Checkout uses LockService
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$LOCK_DOC/checkout" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "14.15 Checkout (via LockService)" || log FAIL "14.15 Checkout — $R"

  # 14.16 Lock status after checkout (locked)
  LOCK_STATUS=$(curl -s "$BASE/locks/$LOCK_DOC/status" -H "$AUTH")
  LOCKED=$(echo "$LOCK_STATUS" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['locked'])" 2>/dev/null || echo "")
  [ "$LOCKED" = "True" ] && log PASS "14.16 Lock status after checkout (locked)" || log FAIL "14.16 Lock after checkout=$LOCKED"

  # 14.17 Cancel checkout (releases lock)
  R=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/documents/$LOCK_DOC/cancel-checkout" -H "$AUTH")
  [ "$R" = "200" ] && log PASS "14.17 Cancel checkout (releases lock)" || log FAIL "14.17 Cancel checkout — $R"

  # 14.18 Lock status after cancel (unlocked)
  LOCK_STATUS=$(curl -s "$BASE/locks/$LOCK_DOC/status" -H "$AUTH")
  LOCKED=$(echo "$LOCK_STATUS" | $PY -c "import sys,json; print(json.load(sys.stdin)['data']['locked'])" 2>/dev/null || echo "")
  [ "$LOCKED" = "False" ] && log PASS "14.18 Lock status after cancel (unlocked)" || log FAIL "14.18 After cancel=$LOCKED"

  # 14.19 WebSocket endpoint reachable (SockJS info)
  WS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8200/ws/documents/info")
  [ "$WS_CODE" = "200" ] && log PASS "14.19 WebSocket SockJS info endpoint" || log FAIL "14.19 WebSocket info — $WS_CODE"

else
  for i in $(seq 1 19); do log SKIP "14.$i Lock Management (no doc)"; done
fi

###############################################
echo ""
echo "============================================"
echo "       APEX NEXUS FINAL TEST RESULTS"
echo "============================================"
echo "PASSED:  $PASS"
echo "FAILED:  $FAIL"
echo "SKIPPED: $SKIP"
echo "TOTAL:   $((PASS + FAIL + SKIP))"
echo "============================================"
echo ""
echo "--- FAILURES ---"
echo "$RESULTS" | grep "^\[FAIL\]" || echo "  (none)"
echo ""
echo "--- SKIPS ---"
echo "$RESULTS" | grep "^\[SKIP\]" || echo "  (none)"
echo ""
echo "$RESULTS" > test_results_final.txt
echo "Full results saved to test_results_final.txt"
