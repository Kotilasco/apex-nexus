#!/bin/bash
cd "$(dirname "$0")"

# Login and get token
RESP=$(curl -s -X POST http://localhost:8500/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"Admin@2024!"}')

echo "$RESP" > login_resp4.json

# Extract token using grep/sed instead of python
TOKEN=$(echo "$RESP" | grep -o '"accessToken":"[^"]*"' | head -1 | sed 's/"accessToken":"//;s/"//')

if [ -z "$TOKEN" ]; then
  echo "LOGIN_FAILED"
  exit 1
fi

echo "$TOKEN" > token2.txt
echo "TOKEN_SAVED"

# Fetch document (all plugins active)
curl -s http://localhost:8500/api/documents/327bc0b0-0340-4bd3-98df-ef354530a263 \
  -H "Authorization: Bearer $TOKEN" > api_final_check.json

echo "API_CHECK_1_DONE"

# Fetch deactivated doc for comparison
curl -s http://localhost:8500/api/documents/cf7cd55c-09cb-41a8-902c-239de261b627 \
  -H "Authorization: Bearer $TOKEN" > api_deactivated_check.json

echo "ALL_DONE"
