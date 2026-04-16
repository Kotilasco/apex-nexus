import requests

# Login
r = requests.post("http://localhost:9600/api/auth/login", json={"username":"admin","password":"Admin@2024!"})
token = r.json().get("data",{}).get("accessToken")
h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

# Test direct to workflow-service port 9603
print("=== Direct to workflow-service:9603 ===")

print("\nGET /ai/status:")
try:
    r = requests.get("http://localhost:9603/ai/status", headers=h, timeout=10)
    print(f"  {r.status_code}: {r.text[:200]}")
except Exception as e:
    print(f"  Error: {e}")

print("\nPOST /ai/summarize:")
try:
    r = requests.post("http://localhost:9603/ai/summarize", headers=h, json={
        "content": "Test content about a contract.",
        "title": "Test"
    }, timeout=120)
    print(f"  {r.status_code}: {r.text[:300]}")
except Exception as e:
    print(f"  Error: {e}")
