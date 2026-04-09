import requests, socket

# Test direct auth service
print("Testing direct auth service (port 8201)...")
try:
    s = socket.create_connection(('localhost', 8201), timeout=5)
    s.close()
    print("  Port 8201 is reachable")
except Exception as e:
    print(f"  Port 8201 NOT reachable: {e}")

# Test gateway port
print("Testing gateway (port 8200)...")
try:
    s = socket.create_connection(('localhost', 8200), timeout=5)
    s.close()
    print("  Port 8200 is reachable")
except Exception as e:
    print(f"  Port 8200 NOT reachable: {e}")

# Test direct auth login
print("\nTesting direct auth login...")
try:
    r = requests.post('http://localhost:8201/api/auth/login', 
                      json={'username':'admin', 'password':'Admin@2024!'}, timeout=10)
    print(f"  Direct auth: {r.status_code}")
except Exception as e:
    print(f"  Direct auth failed: {e}")

# Test gateway login
print("\nTesting gateway login...")
try:
    r = requests.post('http://localhost:8200/api/auth/login', 
                      json={'username':'admin', 'password':'Admin@2024!'}, timeout=60)
    print(f"  Gateway auth: {r.status_code}")
except Exception as e:
    print(f"  Gateway auth failed: {e}")
