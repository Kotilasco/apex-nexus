import requests
r = requests.post('http://localhost:9600/api/auth/login', json={'username':'admin','password':'Admin@2024!'})
print(r.status_code)
print(r.text[:500])
