import requests, json, time

BASE = 'http://localhost:8200/api'
DOC_ID = 'dff73b47-30b0-491f-804d-09a9826bb908'
TIMEOUT = 120

# 1. Login
print("=== Step 1: Login ===")
resp = requests.post(f'{BASE}/auth/login', json={'username':'admin','password':'Admin@2024!'}, timeout=TIMEOUT)
assert resp.status_code == 200, f"Login failed: {resp.status_code}"
token = resp.json()['data']['accessToken']
headers = {'Authorization': f'Bearer {token}'}
print(f"Token: {token[:30]}...")

# 2. Cancel any outstanding checkout
print("\n=== Step 2: Cancel outstanding checkout ===")
resp = requests.post(f'{BASE}/documents/{DOC_ID}/cancel-checkout', headers=headers, timeout=TIMEOUT)
print(f"Cancel: {resp.status_code}")

# 3. Get doc info
print("\n=== Step 3: Get document info ===")
resp = requests.get(f'{BASE}/documents/{DOC_ID}', headers=headers, timeout=TIMEOUT)
doc = resp.json()['data']
print(f"Title: {doc['title']}, currentVersion: {doc['currentVersion']}")

# 4. Checkout
print("\n=== Step 4: Checkout ===")
resp = requests.post(f'{BASE}/documents/{DOC_ID}/checkout', headers=headers, timeout=TIMEOUT)
print(f"Checkout: {resp.status_code} {resp.text[:200]}")
assert resp.status_code == 200, f"Checkout failed: {resp.status_code} {resp.text[:200]}"

# 5. Check in a completely different file (recipe)
print("\n=== Step 5: Check in anomalous file ===")
recipe = """CHOCOLATE CAKE RECIPE
Ingredients: 2 cups flour, 1.5 cups sugar, 3/4 cup cocoa powder, 2 eggs, 1 cup milk, 
1/2 cup vegetable oil, 2 tsp vanilla extract, 1 cup boiling water.
Instructions: Preheat oven to 350F. Mix dry ingredients. Add eggs, milk, oil, vanilla. 
Beat 2 minutes. Stir in boiling water. Pour into greased pans. Bake 30-35 minutes.
Let cool before frosting with chocolate buttercream.
"""
files = {'file': ('chocolate_cake_recipe.txt', recipe.encode('utf-8'), 'text/plain')}
data = {'comment': 'Anomaly test - completely different content'}
resp = requests.post(f'{BASE}/documents/{DOC_ID}/checkin', headers=headers, files=files, data=data, timeout=TIMEOUT)
print(f"Checkin: {resp.status_code}")
if resp.status_code == 200:
    checkin_data = resp.json()
    print(f"Response: {json.dumps(checkin_data, indent=2)[:500]}")
else:
    print(f"ERROR: {resp.text[:500]}")
    exit(1)

# 6. Wait for async anomaly check
print("\n=== Step 6: Wait 20s for async anomaly check ===")
time.sleep(20)

# 7. Get version history
print("\n=== Step 7: Get version history ===")
resp = requests.get(f'{BASE}/documents/{DOC_ID}/versions', headers=headers, timeout=TIMEOUT)
print(f"Versions: {resp.status_code}")
versions = resp.json()['data']
print(f"Total versions: {len(versions)}")

# Find latest version
latest = max(versions, key=lambda v: v['versionNumber'])
print(f"\nLatest version (V{latest['versionNumber']}):")
print(f"  fileName: {latest.get('fileName')}")
print(f"  anomalyFlagged: {latest.get('anomalyFlagged')}")
print(f"  anomalyScore: {latest.get('anomalyScore')}")
print(f"  similarityScore: {latest.get('similarityScore')}")
print(f"  anomalyReasons: {latest.get('anomalyReasons')}")

if latest.get('anomalyFlagged'):
    print("\n*** SUCCESS: Anomaly was detected! ***")
else:
    print("\n*** WARNING: Anomaly NOT detected yet ***")
    print("Checking docker logs for anomaly info...")
