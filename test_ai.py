import urllib.request
import json

# Login
login_data = json.dumps({"username": "admin", "password": "Admin@2024!"}).encode()
req = urllib.request.Request("http://localhost:8200/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req, timeout=10)
token = json.loads(resp.read())["data"]["accessToken"]
print("Got token:", token[:30] + "...")

headers = {"Authorization": "Bearer " + token}

# Test 1: Semantic search
print("\n=== SEMANTIC SEARCH: q=memo ===")
req2 = urllib.request.Request("http://localhost:8200/api/search/semantic?q=memo&k=3", headers=headers)
r2 = urllib.request.urlopen(req2, timeout=15)
data2 = json.loads(r2.read())
print(json.dumps(data2, indent=2)[:600])

# Test 2: Quick search
print("\n=== QUICK SEARCH: q=memo ===")
req3 = urllib.request.Request("http://localhost:8200/api/search?q=memo", headers=headers)
r3 = urllib.request.urlopen(req3, timeout=15)
data3 = json.loads(r3.read())
print(json.dumps(data3, indent=2)[:600])

# Test 3: Check ES for documents with contentVector
print("\n=== ES: docs with contentVector ===")
es_body = json.dumps({"query": {"exists": {"field": "contentVector"}}, "size": 3, "_source": ["title", "classificationLabel", "classificationCategory", "classificationConfidence"]}).encode()
req4 = urllib.request.Request("http://localhost:9200/apex-documents/_search", data=es_body, headers={"Content-Type": "application/json"})
r4 = urllib.request.urlopen(req4, timeout=10)
data4 = json.loads(r4.read())
print(json.dumps(data4, indent=2)[:800])

print("\nAll AI tests complete!")
