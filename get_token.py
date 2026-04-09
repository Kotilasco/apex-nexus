import requests
r = requests.post('http://localhost:8500/api/auth/login', json={'username': 'admin', 'password': 'Admin@2024!'})
d = r.json()
token = d['data']['accessToken']
print(f"Token: {token[:50]}...")
with open('token.txt', 'w') as f:
    f.write(token)

# Test new endpoints
headers = {'Authorization': f'Bearer {token}'}

# Test GET /auth/roles
r2 = requests.get('http://localhost:8500/api/auth/roles', headers=headers)
print(f"\nGET /auth/roles: {r2.status_code}")
if r2.ok:
    import json
    print(json.dumps(r2.json(), indent=2)[:1000])

# Test GET /auth/users
r3 = requests.get('http://localhost:8500/api/auth/users', headers=headers)
print(f"\nGET /auth/users: {r3.status_code}")
if r3.ok:
    import json
    print(json.dumps(r3.json(), indent=2)[:1000])
