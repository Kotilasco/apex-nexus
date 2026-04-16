import requests
import json

BASE = "http://localhost:9600/api"

# Login
r = requests.post(f"{BASE}/auth/login", json={"username":"admin","password":"Admin@2024!"})
token = r.json().get("data",{}).get("accessToken")
h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Test if AI status endpoint works (GET /ai/status)
print("=== Test GET /ai/status ===")
r = requests.get(f"{BASE}/ai/status", headers=h)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:300]}")

# Test existing generate-workflow endpoint
print("\n=== Test POST /ai/generate-workflow ===")
r = requests.post(f"{BASE}/ai/generate-workflow", headers=h, json={"prompt":"simple approval"}, timeout=60)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:300]}")

# Test direct to workflow service (bypass gateway)
print("\n=== Test direct POST to workflow-service:8203/ai/summarize ===")
r = requests.post("http://localhost:8203/ai/summarize", headers=h, json={
    "content": "Test document content about a contract.",
    "title": "Test Doc"
}, timeout=60)
print(f"Status: {r.status_code}")
print(f"Response: {r.text[:300]}")
