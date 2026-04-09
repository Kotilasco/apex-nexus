#!/bin/bash
cd "$(dirname "$0")"

# Login and get token
RESP=$(curl -s -X POST http://localhost:8500/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@2024!"}')

echo "$RESP" > login_resp4.json

# Extract token
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "LOGIN_FAILED"
  echo "$RESP"
  exit 1
fi

echo "$TOKEN" > token2.txt
echo "TOKEN_SAVED"

# Fetch document
curl -s http://localhost:8500/api/documents/327bc0b0-0340-4bd3-98df-ef354530a263 \
  -H "Authorization: Bearer $TOKEN" > api_final_check.json

echo "API_CHECK_DONE"

# Also fetch the deactivated doc for comparison
curl -s http://localhost:8500/api/documents/cf7cd55c-09cb-41a8-902c-239de261b627 \
  -H "Authorization: Bearer $TOKEN" > api_deactivated_check.json

echo "ALL_DONE"
