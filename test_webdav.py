import requests, json

BASE = 'http://localhost:9500/api'

# Login
r = requests.post(f'{BASE}/auth/login', json={'username': 'admin', 'password': 'Admin@2024!'})
d = r.json()
token = d.get('data', {}).get('accessToken', '')
print(f'Login: {r.status_code} token={token[:20]}...')

headers = {'Authorization': f'Bearer {token}'}

# List documents
r2 = requests.get(f'{BASE}/documents/my', headers=headers, params={'page': 0, 'size': 5})
docs_data = r2.json()
content = docs_data.get('data', docs_data)
if isinstance(content, dict):
    content = content.get('content', [])
print(f'\nDocuments ({len(content)} found):')

for doc in content[:3]:
    doc_id = doc.get('id', '')
    title = doc.get('title', '')
    mime = doc.get('mimeType', '')
    print(f'  - {title} | mime={mime} | id={doc_id}')

    # Test download endpoint
    r3 = requests.get(f'{BASE}/documents/{doc_id}/download', headers=headers)
    print(f'    download: {r3.status_code} content-type={r3.headers.get("content-type","")} size={len(r3.content)}')

    # Test WOPI token generation
    r4 = requests.post(f'{BASE}/wopi/token/{doc_id}', headers=headers, json={'permissions': 'EDIT'})
    print(f'    wopi token: {r4.status_code} {str(r4.text)[:100]}')

    # Test WebDAV endpoint
    r5 = requests.get(f'{BASE}/webdav/documents/{doc_id}/test.docx', params={'access_token': token})
    print(f'    webdav GET: {r5.status_code} content-type={r5.headers.get("content-type","")} size={len(r5.content)}')
    print()
