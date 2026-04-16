import requests, json

login = requests.post('http://localhost:9600/api/auth/login', 
    json={'username':'admin','password':'Admin@2024!'})
resp = login.json()
token = resp.get('token') or resp.get('accessToken') or (resp.get('data',{}) or {}).get('accessToken')
if not token:
    print("Login response:", json.dumps(resp, indent=2)[:500])
    exit(1)
h = {'Authorization': f'Bearer {token}'}

# Get documents
docs = requests.get('http://localhost:9600/api/documents', headers=h)
docs_data = docs.json()
if isinstance(docs_data, dict) and 'content' in docs_data:
    content_list = docs_data['content']
elif isinstance(docs_data, dict) and 'data' in docs_data:
    data = docs_data['data']
    content_list = data.get('content', data) if isinstance(data, dict) else data
elif isinstance(docs_data, list):
    content_list = docs_data
else:
    print("Unexpected response:", json.dumps(docs_data, indent=2)[:500])
    exit(1)

print("=== DOCUMENTS ===")
for d in content_list[:10]:
    mime = d.get('mimeType', '')
    print(f"  {d['id'][:8]}... | {d['title'][:50]} | {mime}")

# Test content endpoint for non-text documents
for d in content_list[:10]:
    mime = d.get('mimeType', '')
    if mime and not mime.startswith('text/') and mime != 'application/json':
        doc_id = d['id']
        print(f"\n=== Testing content for: {d['title']} (MIME: {mime}) ===")
        
        # Try the content endpoint
        r = requests.get(f'http://localhost:9600/api/documents/{doc_id}/content', headers=h)
        print(f"  GET /content => {r.status_code}")
        if r.status_code == 200:
            txt = r.text[:200]
            print(f"  Content preview: {txt}...")
        else:
            print(f"  Error: {r.text[:200]}")
        
        # Try the redacted content endpoint  
        r2 = requests.get(f'http://localhost:9600/api/documents/{doc_id}/content/redacted', headers=h)
        print(f"  GET /content/redacted => {r2.status_code}")
        if r2.status_code == 200:
            txt2 = r2.text[:200]
            print(f"  Redacted preview: {txt2}...")
        else:
            print(f"  Error: {r2.text[:200]}")
        break

print("\n=== DONE ===")
