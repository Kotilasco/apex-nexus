import requests, json, time

BASE = 'http://localhost:8500/api'

# Login as admin
r = requests.post(f'{BASE}/auth/login', json={'username': 'admin', 'password': 'Admin@2024!'})
token = r.json()['data']['accessToken']
headers = {'Authorization': f'Bearer {token}'}

# Create test users
users_to_create = [
    {'username': 'approver1', 'email': 'approver1@company.com', 'password': 'Password123', 'firstName': 'Sarah', 'lastName': 'Approver'},
    {'username': 'manager1', 'email': 'manager1@company.com', 'password': 'Password123', 'firstName': 'Mike', 'lastName': 'Manager'},
    {'username': 'viewer1', 'email': 'viewer1@company.com', 'password': 'Password123', 'firstName': 'Lisa', 'lastName': 'Viewer'},
]

for u in users_to_create:
    r = requests.post(f'{BASE}/auth/register', json=u)
    if r.ok:
        print(f"Created user: {u['username']} -> {r.status_code}")
    else:
        print(f"Failed to create {u['username']}: {r.status_code} {r.text[:200]}")

# Re-login to get fresh token (token might not have new users yet)
time.sleep(1)

# Get all users to find IDs
r = requests.get(f'{BASE}/auth/users', headers=headers)
users = r.json()['data']
print(f"\nAll users ({len(users)}):")
user_map = {}
for u in users:
    print(f"  {u['id'][:8]}... {u['username']:15} roles: {u['roles']}")
    user_map[u['username']] = u['id']

# Assign roles
role_assignments = {
    'reviewer1': ['APPROVER', 'AUTHOR'],      # Can approve and author docs
    'approver1': ['APPROVER'],                  # Can only approve
    'manager1': ['RECORDS_MANAGER', 'DEPARTMENT_ADMIN'],  # Manager roles
    'viewer1': ['VIEWER'],                      # Read-only
}

print("\nAssigning roles...")
for username, roles in role_assignments.items():
    uid = user_map.get(username)
    if uid:
        r = requests.put(f'{BASE}/auth/users/{uid}/roles', json={'roles': roles}, headers=headers)
        if r.ok:
            print(f"  {username}: {roles} -> OK")
        else:
            print(f"  {username}: FAILED {r.status_code} {r.text[:200]}")
    else:
        print(f"  {username}: NOT FOUND")

# Verify final state
r = requests.get(f'{BASE}/auth/users', headers=headers)
users = r.json()['data']
print(f"\nFinal user state:")
for u in users:
    print(f"  {u['username']:15} roles: {u['roles']}")
