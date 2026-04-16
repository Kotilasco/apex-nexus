import requests, json

login = requests.post('http://localhost:9600/api/auth/login', 
    json={'username':'admin','password':'Admin@2024!'})
resp = login.json()
token = resp.get('data',{}).get('accessToken')
h = {'Authorization': f'Bearer {token}'}

# Get documents
docs = requests.get('http://localhost:9600/api/documents', headers=h)
docs_data = docs.json()

# Debug structure
print("Type:", type(docs_data))
if isinstance(docs_data, dict):
    print("Keys:", list(docs_data.keys())[:10])
    if 'data' in docs_data:
        d = docs_data['data']
        print("Data type:", type(d))
        if isinstance(d, dict):
            print("Data keys:", list(d.keys())[:10])
            if 'content' in d:
                items = d['content']
                print(f"Found {len(items)} documents")
                for doc in items[:5]:
                    mime = doc.get('mimeType','')
                    print(f"  {doc.get('id','')[:8]}... | {doc.get('title','')[:50]} | {mime}")
                
                # Test content for non-text doc
                for doc in items:
                    mime = doc.get('mimeType','')
                    if mime and not mime.startswith('text/') and mime != 'application/json':
                        did = doc['id']
                        print(f"\n=== Testing: {doc['title']} ({mime}) ===")
                        r = requests.get(f'http://localhost:9600/api/documents/{did}/content', headers=h)
                        print(f"  /content => {r.status_code}")
                        if r.status_code == 200:
                            print(f"  Preview: {r.text[:200]}")
                        else:
                            print(f"  Error: {r.text[:200]}")
                        break
