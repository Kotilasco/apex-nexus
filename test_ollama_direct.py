import requests
import time

# Test Ollama directly (bypass Java and gateway)
print("=== Testing Ollama directly on port 11434 ===")
start = time.time()
try:
    r = requests.post("http://localhost:11434/api/generate", json={
        "model": "llama3.2:1b",
        "prompt": "Say hello in one sentence.",
        "stream": False
    }, timeout=120)
    elapsed = time.time() - start
    print(f"Status: {r.status_code} (took {elapsed:.1f}s)")
    if r.status_code == 200:
        data = r.json()
        print(f"Response: {data.get('response', '')[:300]}")
    else:
        print(f"Error: {r.text[:300]}")
except Exception as e:
    elapsed = time.time() - start
    print(f"Error after {elapsed:.1f}s: {e}")

# Now test via the gateway with longer timeout
print("\n=== Testing AI summarize via gateway (120s timeout) ===")

# Login first
r = requests.post("http://localhost:9600/api/auth/login", json={"username":"admin","password":"Admin@2024!"})
token = r.json().get("data",{}).get("accessToken")
h = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

start = time.time()
try:
    r = requests.post("http://localhost:9600/api/ai/summarize", headers=h, json={
        "content": "This is a contract between Apex Corp and Global Holdings. Value is 2.5 million dollars.",
        "title": "Contract"
    }, timeout=120)
    elapsed = time.time() - start
    print(f"Status: {r.status_code} (took {elapsed:.1f}s)")
    print(f"Response: {r.text[:500]}")
except Exception as e:
    elapsed = time.time() - start
    print(f"Error after {elapsed:.1f}s: {e}")

print("\n=== Testing AI ask via gateway (120s timeout) ===")
start = time.time()
try:
    r = requests.post("http://localhost:9600/api/ai/ask", headers=h, json={
        "content": "This is a contract between Apex Corp and Global Holdings. Value is 2.5 million dollars.",
        "title": "Contract",
        "question": "What is the contract value?"
    }, timeout=120)
    elapsed = time.time() - start
    print(f"Status: {r.status_code} (took {elapsed:.1f}s)")
    print(f"Response: {r.text[:500]}")
except Exception as e:
    elapsed = time.time() - start
    print(f"Error after {elapsed:.1f}s: {e}")
