import requests, json

BASE = 'http://localhost:8500/api'

# Login as admin
r = requests.post(f'{BASE}/auth/login', json={'username': 'admin', 'password': 'Admin@2024!'})
token = r.json()['data']['accessToken']
headers = {'Authorization': f'Bearer {token}'}

# Get projects - routed to auth service via /api/projects
r2 = requests.get(f'{BASE}/projects', headers=headers)
print(f'Projects: {r2.status_code}')
if r2.ok:
    data = r2.json().get('data', r2.json())
    projects = data if isinstance(data, list) else data.get('content', [])
    for p in projects:
        print(f'  {p["id"]} - {p["name"]}')
else:
    print(r2.text[:500])

# Get users for IDs
r3 = requests.get(f'{BASE}/auth/users', headers=headers)
users = r3.json()['data']
user_map = {u['username']: u['id'] for u in users}
print(f'\nUser IDs:')
for un, uid in user_map.items():
    print(f'  {un}: {uid}')

# Get role IDs
r_roles = requests.get(f'{BASE}/auth/roles', headers=headers)
print(f'\nRoles:')
role_map = {}
if r_roles.ok:
    for role in r_roles.json().get('data', []):
        print(f'  {role["id"]} - {role["name"]}')
        role_map[role['name']] = role['id']

if r2.ok and projects:
    project = projects[0]
    print(f'\nUsing project: {project["name"]} ({project["id"]})')
    
    # Check existing members
    r_members = requests.get(f'{BASE}/projects/{project["id"]}/members', headers=headers)
    print(f'\nExisting members: {r_members.status_code}')
    if r_members.ok:
        members = r_members.json().get('data', [])
        for m in members:
            print(f'  {m}')
    
    # Add all test users to the project with appropriate roles
    user_role_mapping = {
        'reviewer1': 'APPROVER',
        'approver1': 'APPROVER',
        'manager1': 'RECORDS_MANAGER',
        'viewer1': 'VIEWER',
    }
    for username, role_name in user_role_mapping.items():
        uid = user_map.get(username)
        rid = role_map.get(role_name)
        if uid and rid:
            r4 = requests.post(
                f'{BASE}/projects/{project["id"]}/members',
                json={'userId': uid, 'roleId': rid},
                headers=headers
            )
            print(f'  Add {username} ({uid}): {r4.status_code}')
            if not r4.ok:
                print(f'    ERROR: {r4.text[:300]}')
            else:
                print(f'    OK: {r4.json().get("data", {}).get("role", "?")}')
    
    # Verify members
    r_members2 = requests.get(f'{BASE}/projects/{project["id"]}/members', headers=headers)
    print(f'\nFinal members:')
    if r_members2.ok:
        members = r_members2.json().get('data', [])
        for m in members:
            print(f'  {json.dumps(m)[:200]}')
