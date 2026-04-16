import requests

# Login
r = requests.post("http://localhost:9600/api/auth/login", json={"username":"admin","password":"Admin@2024!"})
token = r.json().get("data",{}).get("accessToken")
h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Test direct to workflow-service port 8203
print("=== Direct to workflow-service:8203 ===")

print("\nGET /ai/status:")
r = requests.get("http://localhost:8203/ai/status", headers=h, timeout=10)
print(f"  {r.status_code}: {r.text[:200]}")

print("\nPOST /ai/summarize:")
r = requests.post("http://localhost:8203/ai/summarize", headers=h, json={
    "content": "Test content",
    "title": "Test"
}, timeout=120)
print(f"  {r.status_code}: {r.text[:200]}")

print("\nPOST /ai/ask:")
r = requests.post("http://localhost:8203/ai/ask", headers=h, json={
    "content": "Test content about a contract worth 2.5 million.",
    "title": "Test",
    "question": "What is the value?"
}, timeout=120)
print(f"  {r.status_code}: {r.text[:200]}")
