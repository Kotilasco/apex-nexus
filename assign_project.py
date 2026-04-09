import requests, json

BASE = 'http://localhost:8500/api'

# Login as admin
r = requests.post(f'{BASE}/auth/login', json={'username': 'admin', 'password': 'Admin@2024!'})
token = r.json()['data']['accessToken']
headers = {'Authorization': f'Bearer {token}'}

# Get projects
r2 = requests.get(f'{BASE}/documents/projects', headers=headers)
print(f'Projects: {r2.status_code}')
print(r2.text[:500])

# Get users for IDs
r3 = requests.get(f'{BASE}/auth/users', headers=headers)
users = r3.json()['data']
user_map = {u['username']: u['id'] for u in users}

if r2.ok:
    data = r2.json().get('data', r2.json())
    projects = data if isinstance(data, list) else data.get('content', [])
    if projects:
        project = projects[0]
        print(f'\nUsing project: {project["name"]} ({project["id"]})')
        
        # Add all test users to the project
        for username in ['reviewer1', 'approver1', 'manager1', 'viewer1']:
            uid = user_map.get(username)
            if uid:
                # Try adding member
                r4 = requests.post(
                    f'{BASE}/documents/projects/{project["id"]}/members',
                    json={'userId': uid, 'role': 'MEMBER'},
                    headers=headers
                )
                print(f'  Add {username} to project: {r4.status_code}')
                if not r4.ok:
                    print(f'    {r4.text[:200]}')
