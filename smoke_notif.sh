#!/bin/bash
AUTHOR=$(cat /tmp/author.tok)
AID="1dbdbf12-4a22-4c1e-a69e-52620d80f108"

echo "== BEFORE unread =="
curl -s -H "Authorization: Bearer $AUTHOR" http://localhost:8200/api/notification/my/unread/count | python -c "import sys,json;print(json.load(sys.stdin)['data'])"

docker exec apex-redis redis-cli RPUSH apex:notifications:events "{\"userId\":\"$AID\",\"type\":\"WORKFLOW_TASK_ASSIGNED\",\"title\":\"E2E approval needed\",\"message\":\"Simulated test event\",\"resourceType\":\"DOCUMENT\",\"sendEmail\":false}" > /dev/null

sleep 5
echo "== AFTER unread =="
curl -s -H "Authorization: Bearer $AUTHOR" http://localhost:8200/api/notification/my/unread/count | python -c "import sys,json;print(json.load(sys.stdin)['data'])"

echo "== latest =="
curl -s -H "Authorization: Bearer $AUTHOR" "http://localhost:8200/api/notification/my?page=0&size=3" | python -c "import sys,json; d=json.load(sys.stdin)['data']; print('total:',d['totalElements']); [print(' -',n['type'],'|',n['title']) for n in d['content']]"
