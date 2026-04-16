import requests, json

BASE = 'http://localhost:9500/api'

# Login as admin
r = requests.post(f'{BASE}/auth/login', json={'username': 'admin', 'password': 'Admin@2024!'})
d = r.json()
token = d['data']['accessToken']
uid = d['data']['userId']
print(f"Admin userId: {uid}")

headers = {'Authorization': f'Bearer {token}'}

# Get projects
r2 = requests.get(f'{BASE}/projects', headers=headers)
projects = r2.json().get('data', r2.json())
if isinstance(projects, dict) and 'content' in projects:
    projects = projects['content']
print(f"\nProjects ({len(projects)}):")
for p in projects:
    print(f"  {p['id'][:8]}... name={p['name']} ownerId={p.get('ownerId','MISSING')}")

# Get members for first project
if projects:
    pid = projects[0]['id']
    print(f"\nMembers of '{projects[0]['name']}' ({pid}):")
    r3 = requests.get(f'{BASE}/projects/{pid}/members', headers=headers)
    members = r3.json().get('data', r3.json())
    if isinstance(members, list):
        for m in members:
            print(f"  userId={m.get('userId','?')[:8]}... user={m.get('username','?')} perms={m.get('effectivePermissions','MISSING')} mask={m.get('permissionsMask','MISSING')}")
    else:
        print(f"  raw: {json.dumps(members)[:500]}")

# Check if the Test project (owned by testAdmin) has correct data
for p in projects:
    if p['name'] == 'Test':
        pid = p['id']
        print(f"\nTest project ownerId: {p.get('ownerId','MISSING')}")
        r4 = requests.get(f'{BASE}/projects/{pid}/members', headers=headers)
        members = r4.json().get('data', r4.json())
        if isinstance(members, list):
            for m in members:
                print(f"  userId={m.get('userId','?')[:8]}... user={m.get('username','?')} perms={m.get('effectivePermissions','MISSING')} mask={m.get('permissionsMask','MISSING')}")
