#!/bin/bash
cd "$(dirname "$0")"
echo "=== Docker Status ===" > diag_output.txt
docker compose ps >> diag_output.txt 2>&1
echo "" >> diag_output.txt
echo "=== Testing Gateway Health ===" >> diag_output.txt
curl -s -m 5 http://localhost:8200/actuator/health >> diag_output.txt 2>&1
echo "" >> diag_output.txt
echo "=== Testing Auth Direct ===" >> diag_output.txt
curl -s -m 5 http://localhost:8201/actuator/health >> diag_output.txt 2>&1
echo "" >> diag_output.txt
echo "=== Gateway Logs (last 20) ===" >> diag_output.txt
docker logs apex-gateway --tail 20 >> diag_output.txt 2>&1
echo "" >> diag_output.txt
echo "=== DONE ===" >> diag_output.txt
