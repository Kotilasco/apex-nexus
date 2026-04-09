#!/bin/bash
set +H
cd "/c/Users/ze9167867/Desktop/Apex Nexus"

echo "=== FRESH LOGIN ATTEMPT ==="
LOGIN_STATUS=$(curl -s -X POST http://localhost:8200/api/auth/login \
  -H "Content-Type: application/json" \
  -d @login_body.json \
  -o login_resp2.json \
  -w '%{http_code}')
echo "Login HTTP Status: $LOGIN_STATUS"
echo "Login Response:"
cat login_resp2.json
echo ""

TOKEN=$(cat token.txt)
echo ""
echo "Using existing token (length: ${#TOKEN})"

echo ""
echo "=== FAILED ENDPOINT BODIES ==="

echo "--- /api/workflows (was 500) ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/workflows
echo ""

echo "--- /api/audit/recent (was 500) ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/audit/recent
echo ""

echo "--- /api/notifications (was 500) ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/notifications
echo ""

echo "=== DONE ==="
