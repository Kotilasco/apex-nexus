#!/bin/bash
# Step-by-step plugin test without python dependency
TOKEN=$(cat token.txt)
BASE="http://localhost:8500"
AUTH="Authorization: Bearer $TOKEN"

echo "--- Activating M365 ---"
curl -s -X POST "$BASE/api/auth/plugins/f1b4833c-d507-4af4-9088-101ae0e40262/activate" -H "$AUTH" -o activate_m365.json -w "HTTP:%{http_code}\n"

echo "--- Activating SAP ---"
curl -s -X POST "$BASE/api/auth/plugins/f81a7bcc-9028-4e0f-8a4d-42e75b34d943/activate" -H "$AUTH" -o activate_sap.json -w "HTTP:%{http_code}\n"

echo "--- Uploading Final Test Invoice ---"
echo "This is the Final Comprehensive Plugin Test Invoice for April 2026" > final_test_doc.txt
curl -s -X POST "$BASE/api/documents" \
    -H "$AUTH" \
    -F "metadata={\"title\":\"Final Test Invoice All Plugins\",\"projectId\":\"e0000000-0000-0000-0000-000000000001\",\"folderId\":\"c0000000-0000-0000-0000-000000000001\"};type=application/json" \
    -F "file=@final_test_doc.txt;filename=FinalTestInvoice.txt" \
    -o upload_final.json -w "Upload HTTP:%{http_code}\n"

echo "--- Waiting 20s for search processing ---"
sleep 20

echo "--- Done ---"
