#!/bin/bash
set +H
cd "/c/Users/ze9167867/Desktop/Apex Nexus"

echo "=== Step 1: Login ==="
LOGIN_STATUS=$(curl -s -X POST http://localhost:8200/api/auth/login \
  -H "Content-Type: application/json" \
  -d @login_body.json \
  -o login_resp.json \
  -w '%{http_code}')
echo "Login HTTP Status: $LOGIN_STATUS"

echo ""
echo "=== Step 2: Extract Token ==="
node -e "const j=require('./login_resp.json');require('fs').writeFileSync('token.txt',j.data.accessToken)"
echo "Token saved to token.txt"
TOKEN=$(cat token.txt)
echo "Token length: ${#TOKEN}"

echo ""
echo "=== Step 3: Test All 7 Endpoints ==="

echo -n "1. /api/auth/me -> "
S1=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/auth/me)
echo "$S1"

echo -n "2. /api/documents/my -> "
S2=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/documents/my)
echo "$S2"

echo -n "3. /api/workflows -> "
S3=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/workflows)
echo "$S3"

echo -n "4. /api/audit/recent -> "
S4=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/audit/recent)
echo "$S4"

echo -n "5. /api/retention/policies -> "
S5=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/retention/policies)
echo "$S5"

echo -n "6. /api/search?q=test -> "
S6=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "http://localhost:8200/api/search?q=test")
echo "$S6"

echo -n "7. /api/notifications -> "
S7=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" http://localhost:8200/api/notifications)
echo "$S7"

echo ""
echo "=== Step 4: Get Response Body for Failed Endpoints ==="
for EP_INFO in "1:/api/auth/me:$S1" "2:/api/documents/my:$S2" "3:/api/workflows:$S3" "4:/api/audit/recent:$S4" "5:/api/retention/policies:$S5" "6:/api/search?q=test:$S6" "7:/api/notifications:$S7"; do
  NUM=$(echo "$EP_INFO" | cut -d: -f1)
  EP=$(echo "$EP_INFO" | cut -d: -f2-)
  STATUS=$(echo "$EP" | rev | cut -d: -f1 | rev)
  ENDPOINT=$(echo "$EP" | rev | cut -d: -f2- | rev)
  if [ "$STATUS" != "200" ]; then
    echo ""
    echo "--- Endpoint $NUM ($ENDPOINT) returned $STATUS ---"
    curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:8200$ENDPOINT"
    echo ""
  fi
done

echo ""
echo "=== ALL TESTS COMPLETE ==="
