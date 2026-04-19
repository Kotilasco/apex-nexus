#!/bin/bash
MAX=$(docker exec apex-postgres psql -U apex_admin -d apex_nexus -t -c "SELECT MAX(sequence_number) FROM audit_log;" | tr -d ' \n')
echo "Current max sequence: $MAX"
for i in 1 2 3 4; do
  curl -s -X POST http://localhost:8200/api/auth/login -H "Content-Type: application/json" -d '{"username":"admin","password":"Admin@123"}' > /dev/null
done
sleep 5
MAX2=$(docker exec apex-postgres psql -U apex_admin -d apex_nexus -t -c "SELECT MAX(sequence_number) FROM audit_log;" | tr -d ' \n')
echo "New max sequence: $MAX2"
BASELINE=$((MAX + 1))
echo "Verifying chain fromSequence=$BASELINE"
curl -s -H "Authorization: Bearer $(cat /tmp/admin.tok)" "http://localhost:8200/api/audit/chain/verify?fromSequence=$BASELINE"
echo ""
