#!/bin/bash
# Full plugin test: activate all, upload, verify
set -e

TOKEN=$(cat token.txt)
BASE="http://localhost:8500"
AUTH="Authorization: Bearer $TOKEN"

echo "=== Step 1: Activate all plugins ==="
for pid in "f1b4833c-d507-4af4-9088-101ae0e40262" "fbc38f4a-59bc-44f3-989a-6234809313dd" "f81a7bcc-9028-4e0f-8a4d-42e75b34d943" "ff8118fd-eab5-47e2-87d4-62c53eba5726"; do
    RESP=$(curl -s -X POST "$BASE/api/auth/plugins/$pid/activate" -H "$AUTH")
    NAME=$(echo "$RESP" | python -c "import sys,json; print(json.load(sys.stdin)['data']['name'])" 2>/dev/null || echo "?")
    STATUS=$(echo "$RESP" | python -c "import sys,json; print(json.load(sys.stdin)['data']['status'])" 2>/dev/null || echo "?")
    echo "  $NAME: $STATUS"
done

echo ""
echo "=== Step 2: Upload Final Test Document ==="
echo "This is the Final Comprehensive Plugin Test Invoice for April 2026" > final_test_doc.txt
UPLOAD_RESP=$(curl -s -X POST "$BASE/api/documents" \
    -H "$AUTH" \
    -F "metadata={\"title\":\"Final Test Invoice All Plugins\",\"projectId\":\"e0000000-0000-0000-0000-000000000001\",\"folderId\":\"c0000000-0000-0000-0000-000000000001\"};type=application/json" \
    -F "file=@final_test_doc.txt;filename=FinalTestInvoice.txt")
DOC_ID=$(echo "$UPLOAD_RESP" | python -c "import sys,json; print(json.load(sys.stdin)['data']['id'])" 2>/dev/null || echo "FAILED")
echo "  Upload response doc ID: $DOC_ID"
echo "$DOC_ID" > last_doc_id.txt

echo ""
echo "=== Step 3: Wait for search-service processing (20s) ==="
sleep 20
echo "  Done waiting."

echo ""
echo "=== Step 4: Check DB fields ==="
docker exec -i apex-postgres psql -U apex_admin -d apex_nexus -t -A <<EOSQL > db_final_check.txt
SELECT 'CL=' || coalesce(classification_label,'NULL') || '|M365=' || coalesce(substring(m365_link,1,30),'NULL') || '|SAP=' || coalesce(sap_document_number,'NULL') FROM documents WHERE id='$DOC_ID';
EOSQL
echo "  DB result: $(cat db_final_check.txt)"

echo ""
echo "=== Step 5: Check API response ==="
API_RESP=$(curl -s "$BASE/api/documents/$DOC_ID" -H "$AUTH")
echo "$API_RESP" | python -c "
import sys,json
d = json.load(sys.stdin).get('data',{})
print(f\"  title: {d.get('title')}\")
print(f\"  classificationLabel: {d.get('classificationLabel')}\")
print(f\"  m365Link: {d.get('m365Link')}\")
print(f\"  docusignEnvelopeId: {d.get('docusignEnvelopeId')}\")
print(f\"  sapDocumentNumber: {d.get('sapDocumentNumber')}\")
"

echo ""
echo "=== Step 6: Check search-service logs ==="
docker logs apex-search-service --tail 20 2>&1 | grep -i "Final Test\|classified\|M365 link\|SAP doc" || echo "  (no matching log lines)"

echo ""
echo "=== DONE ==="
