#!/bin/bash
set +H
cd "/c/Users/ze9167867/Desktop/Apex Nexus"

# Extract fresh token
node -e "const j=require('./login_resp2.json');require('fs').writeFileSync('token.txt',j.data.accessToken)"
TOKEN=$(cat token.txt)
echo "Fresh token length: ${#TOKEN}"
echo ""

echo "=== ALL 7 ENDPOINTS WITH FRESH TOKEN ==="

echo -n "1. /api/auth/me -> "
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/auth/me
echo ""

echo -n "2. /api/documents/my -> "
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/documents/my
echo ""

echo -n "3. /api/workflows -> "
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/workflows
echo ""

echo -n "4. /api/audit/recent -> "
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/audit/recent
echo ""

echo -n "5. /api/retention/policies -> "
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/retention/policies
echo ""

echo -n "6. /api/search?q=test -> "
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "http://localhost:8200/api/search?q=test"
echo ""

echo -n "7. /api/notifications -> "
curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/notifications
echo ""

echo ""
echo "=== ERROR BODIES FOR NON-200 ==="
echo "--- /api/workflows ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/workflows
echo ""
echo "--- /api/audit/recent ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/audit/recent
echo ""
echo "--- /api/notifications ---"
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/notifications
echo ""

echo "=== COMPLETE ==="
