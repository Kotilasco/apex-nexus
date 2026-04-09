import subprocess, time

def run(cmd, timeout=300):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=r"C:\Users\ze9167867\Desktop\Apex Nexus")
    if r.stdout: print(f"stdout: {r.stdout[-500:]}")
    if r.stderr: print(f"stderr: {r.stderr[-500:]}")
    return r

# Cancel checkout first (doc might be checked out from failed test)
import requests
r = requests.post('http://localhost:8200/api/auth/login', 
                  json={'username':'admin','password':'Admin@2024!'}, timeout=30)
if r.status_code == 200:
    token = r.json()['data']['accessToken']
    headers = {'Authorization': f'Bearer {token}'}
    DOC_ID = 'dff73b47-30b0-491f-804d-09a9826bb908'
    r2 = requests.post(f'http://localhost:8200/api/documents/{DOC_ID}/cancel-checkout', 
                       headers=headers, timeout=30)
    print(f"Cancel checkout: {r2.status_code} - {r2.text[:200]}")

# Rebuild and restart doc service
print("\nRebuilding docker image...")
run(['docker', 'compose', 'build', 'apex-document-service'])

print("\nStopping old container...")
run(['docker', 'stop', 'apex-document-service'], timeout=30)
run(['docker', 'rm', 'apex-document-service'], timeout=10)

print("\nStarting new container...")
run(['docker', 'compose', 'up', '-d', 'apex-document-service'])

print("\nWaiting 150s for startup...")
time.sleep(150)

r = subprocess.run(['docker', 'logs', '--tail', '3', 'apex-document-service'], 
                   capture_output=True, text=True, timeout=10)
print(f"\nDoc service logs: {r.stdout[-300:]}")
