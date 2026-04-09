import requests, time, json

BASE = 'http://localhost:8200/api'
DOC_ID = 'dff73b47-30b0-491f-804d-09a9826bb908'
TIMEOUT = 120

# Step 1: Login
print("=== Step 1: Login ===")
r = requests.post(f'{BASE}/auth/login', json={'username':'admin','password':'Admin@2024!'}, timeout=TIMEOUT)
assert r.status_code == 200, f"Login failed: {r.status_code}"
token = r.json()['data']['accessToken']
headers = {'Authorization': f'Bearer {token}'}
print("Login OK")

# Step 2: Get current versions
print("\n=== Step 2: Current Versions ===")
r = requests.get(f'{BASE}/documents/{DOC_ID}/versions', headers=headers, timeout=TIMEOUT)
assert r.status_code == 200, f"Get versions failed: {r.status_code}"
versions = r.json()['data']
print(f"Total versions: {len(versions)}")
for v in versions:
    print(f"  V{v['versionNumber']}: flagged={v.get('anomalyFlagged')}, score={v.get('anomalyScore')}, sim={v.get('similarityScore')}")

# Step 3: Cancel any outstanding checkout
print("\n=== Step 3: Cancel Checkout (if any) ===")
r = requests.post(f'{BASE}/documents/{DOC_ID}/cancel-checkout', headers=headers, timeout=TIMEOUT)
print(f"Cancel: {r.status_code}")

# Step 4: Checkout
print("\n=== Step 4: Checkout ===")
r = requests.post(f'{BASE}/documents/{DOC_ID}/checkout', headers=headers, timeout=TIMEOUT)
print(f"Checkout: {r.status_code} - {r.text[:200]}")
assert r.status_code == 200, f"Checkout failed: {r.status_code} {r.text[:300]}"

# Step 5: Check in a COMPLETELY DIFFERENT file (recipe text instead of memo docx)
print("\n=== Step 5: Check-in with totally different content ===")
recipe_content = b"""CHOCOLATE CAKE RECIPE
Ingredients:
- 2 cups all-purpose flour
- 2 cups sugar
- 3/4 cup unsweetened cocoa powder
- 2 teaspoons baking soda
- 1 teaspoon baking powder
- 1 teaspoon salt
- 2 eggs
- 1 cup buttermilk
- 1 cup hot water
- 1/2 cup vegetable oil
- 2 teaspoons vanilla extract

Instructions:
1. Preheat oven to 350F. Grease and flour two 9-inch round baking pans.
2. Mix dry ingredients in a large bowl.
3. Add eggs, buttermilk, oil, and vanilla. Beat for 2 minutes.
4. Stir in hot water (batter will be thin).
5. Pour into prepared pans.
6. Bake 30-35 minutes or until toothpick comes out clean.
7. Cool 10 minutes. Remove from pans.
"""

files = {'file': ('chocolate_cake_recipe.txt', recipe_content, 'text/plain')}
data = {'changeSummary': 'Anomaly test: completely different file type and content'}

r = requests.post(f'{BASE}/documents/{DOC_ID}/checkin', headers=headers, files=files, data=data, timeout=TIMEOUT)
print(f"Check-in: {r.status_code}")
if r.status_code == 200:
    print(f"Response: {json.dumps(r.json(), indent=2)[:500]}")
else:
    print(f"Error: {r.text[:500]}")
    exit(1)

# Step 6: Wait for async anomaly check
print("\n=== Step 6: Waiting 15s for async anomaly check ===")
time.sleep(15)

# Step 7: Get versions after check-in
print("\n=== Step 7: Versions After Check-in ===")
r = requests.get(f'{BASE}/documents/{DOC_ID}/versions', headers=headers, timeout=TIMEOUT)
versions = r.json()['data']
print(f"Total versions: {len(versions)}")
for v in versions:
    vn = v['versionNumber']
    flagged = v.get('anomalyFlagged', False)
    score = v.get('anomalyScore', 0)
    sim = v.get('similarityScore')
    reasons = v.get('anomalyReasons', [])
    marker = " *** ANOMALY ***" if flagged else ""
    print(f"  V{vn}: flagged={flagged}, anomalyScore={score}, similarityScore={sim}, reasons={reasons}{marker}")

# Step 8: Check the latest version for anomaly
latest = versions[0]  # Should be sorted newest first
print(f"\n=== Step 8: Anomaly Detection Result ===")
print(f"Latest version: V{latest['versionNumber']}")
print(f"Anomaly Flagged: {latest.get('anomalyFlagged')}")
print(f"Anomaly Score: {latest.get('anomalyScore')}")
print(f"Similarity Score: {latest.get('similarityScore')}")
print(f"Anomaly Reasons: {latest.get('anomalyReasons')}")

if latest.get('anomalyFlagged'):
    print("\n✅ SUCCESS: Anomaly was detected! The AI correctly flagged the completely different document.")
elif latest.get('similarityScore') is not None and latest.get('similarityScore') > 0:
    print("\n⚠️ PARTIAL: Similarity was checked but not flagged as anomaly.")
else:
    print("\n❌ FAIL: Anomaly was not detected. Check the search service and document service logs.")
