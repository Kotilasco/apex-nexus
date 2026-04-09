import requests
r = requests.post('http://localhost:8200/api/auth/login', 
                  json={'username':'admin','password':'Admin@2024!'},
                  timeout=30)
print(f"Auth: {r.status_code}")
if r.status_code == 200:
    token = r.json()['data']['accessToken']
    headers = {'Authorization': f'Bearer {token}'}
    # Warm up document service
    r2 = requests.get(f'http://localhost:8200/api/documents?page=0&size=1', 
                      headers=headers, timeout=30)
    print(f"Doc service: {r2.status_code}")
