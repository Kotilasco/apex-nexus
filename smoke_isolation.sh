#!/bin/bash
AUTHOR=$(cat /tmp/author.tok)
ADMIN=$(cat /tmp/admin.tok)
ISO_DOC="99999999-8888-7777-6666-555555555555"
ISO_PRJ="11111111-2222-3333-4444-555555555555"
OWN_PRJ="45fdc0a8-d948-4c99-99c7-a901fd5b38ce"
BASE="http://localhost:8200"

printf "T1 author->isolated doc        (expect 403): "
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $AUTHOR" "$BASE/api/documents/$ISO_DOC"

printf "T2 admin ->isolated doc        (expect 200): "
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $ADMIN"  "$BASE/api/documents/$ISO_DOC"

printf "T3 author->iso project list    (expect 403): "
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $AUTHOR" "$BASE/api/documents/project/$ISO_PRJ?page=0&size=20"

printf "T4 admin ->iso project list    (expect 200): "
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $ADMIN"  "$BASE/api/documents/project/$ISO_PRJ?page=0&size=20"

printf "T5 author->download iso doc    (expect 403): "
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $AUTHOR" "$BASE/api/documents/$ISO_DOC/download"

printf "T6 author->own project list    (expect 200): "
curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer $AUTHOR" "$BASE/api/documents/project/$OWN_PRJ?page=0&size=20"

printf "T7 author->search 'TOP SECRET' (expect hits=0): "
curl -s -H "Authorization: Bearer $AUTHOR" -H "Content-Type: application/json" \
  -X POST "$BASE/api/search" -d '{"query":"TOP SECRET Isolated","page":0,"size":10}' \
  | python -c "import sys,json; d=json.load(sys.stdin); print('hits=', d.get('data',{}).get('totalHits','?'))"

printf "T8 admin ->search 'TOP SECRET' (expect hits>=1): "
curl -s -H "Authorization: Bearer $ADMIN"  -H "Content-Type: application/json" \
  -X POST "$BASE/api/search" -d '{"query":"TOP SECRET Isolated","page":0,"size":10}' \
  | python -c "import sys,json; d=json.load(sys.stdin); print('hits=', d.get('data',{}).get('totalHits','?'))"
