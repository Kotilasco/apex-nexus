import requests, json, sys

base = "http://localhost:9600/api"
r = requests.post(f"{base}/auth/login", json={"username":"admin","password":"Admin@2024!"})
token = r.json()["data"]["accessToken"]
h = {"Authorization": f"Bearer {token}"}

# Test 1: Quick search
print("=== Quick Search ===")
r1 = requests.get(f"{base}/search?q=contract&page=0&size=5", headers=h)
print(f"Status: {r1.status_code}")
if r1.status_code == 200:
    data = r1.json()
    inner = data.get("data", data)
    if isinstance(inner, dict) and "content" in inner:
        print(f"Results: {inner.get('totalElements', '?')} total, showing {len(inner['content'])}")
        for d in inner["content"][:3]:
            print(f"  - {d.get('title', d.get('documentTitle', '?'))}")
    elif isinstance(inner, list):
        print(f"Results: {len(inner)}")
        for d in inner[:3]:
            print(f"  - {d.get('title', d.get('documentTitle', '?'))}")
    else:
        print(f"Response: {str(inner)[:300]}")
else:
    print(f"Error: {r1.text[:500]}")

# Test 2: Semantic search
print("\n=== Semantic Search ===")
r2 = requests.get(f"{base}/search/semantic?q=contract&size=5", headers=h)
print(f"Status: {r2.status_code}")
if r2.status_code == 200:
    data2 = r2.json()
    inner2 = data2.get("data", data2)
    if isinstance(inner2, list):
        print(f"Results: {len(inner2)}")
        for d in inner2[:3]:
            print(f"  - {d.get('title', d.get('documentTitle', '?'))} (score: {d.get('score', '?')})")
    elif isinstance(inner2, dict):
        content = inner2.get("content", inner2.get("results", []))
        if isinstance(content, list):
            print(f"Results: {len(content)}")
            for d in content[:3]:
                print(f"  - {d.get('title', d.get('documentTitle', '?'))}")
        else:
            print(f"Response: {str(inner2)[:300]}")
    else:
        print(f"Response: {str(inner2)[:300]}")
else:
    print(f"Error: {r2.text[:500]}")

# Test 3: Advanced search
print("\n=== Advanced Search ===")
r3 = requests.post(f"{base}/search", json={"query": "contract", "page": 0, "size": 5}, headers=h)
print(f"Status: {r3.status_code}")
if r3.status_code == 200:
    data3 = r3.json()
    inner3 = data3.get("data", data3)
    if isinstance(inner3, dict) and "content" in inner3:
        print(f"Results: {inner3.get('totalElements', '?')} total")
        for d in inner3["content"][:3]:
            print(f"  - {d.get('title', d.get('documentTitle', '?'))}")
    elif isinstance(inner3, list):
        print(f"Results: {len(inner3)}")
    else:
        print(f"Response: {str(inner3)[:300]}")
else:
    print(f"Error: {r3.text[:500]}")
