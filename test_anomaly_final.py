"""End-to-end anomaly detection test:
1. Login
2. Checkout a document
3. Check in a COMPLETELY DIFFERENT file (random recipes instead of original memo)
4. Verify anomaly detection flags
"""
import requests, json, time

BASE = "http://localhost:8200/api"
DOC_ID = "dff73b47-30b0-491f-804d-09a9826bb908"
TIMEOUT = 60

# Login
print("=== Step 1: Login ===")
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "Admin@2024!"}, timeout=TIMEOUT)
token = r.json()["data"]["accessToken"]
headers = {"Authorization": f"Bearer {token}"}
print(f"Login: {r.status_code} OK")

# Check current versions
print("\n=== Step 2: Current Versions ===")
r = requests.get(f"{BASE}/documents/{DOC_ID}/versions", headers=headers, timeout=TIMEOUT)
versions = r.json()["data"]
print(f"Total versions: {len(versions)}")
for v in versions:
    print(f"  V{v['versionNumber']}: anomalyFlagged={v.get('anomalyFlagged')}, score={v.get('anomalyScore')}, sim={v.get('similarityScore')}")

# Checkout
print("\n=== Step 3: Checkout ===")
r = requests.post(f"{BASE}/documents/{DOC_ID}/checkout", headers=headers, timeout=TIMEOUT)
print(f"Checkout: {r.status_code} - {r.json().get('message', 'OK')}")

if r.status_code != 200:
    print("Checkout failed, trying cancel first...")
    r2 = requests.post(f"{BASE}/documents/{DOC_ID}/cancel-checkout", headers=headers, timeout=TIMEOUT)
    print(f"Cancel checkout: {r2.status_code}")
    r = requests.post(f"{BASE}/documents/{DOC_ID}/checkout", headers=headers, timeout=TIMEOUT)
    print(f"Retry checkout: {r.status_code}")

# Check in a COMPLETELY DIFFERENT file
print("\n=== Step 4: Check in completely different content ===")
different_content = b"""CHOCOLATE CAKE RECIPE
====================

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
1. Preheat oven to 350F (175C)
2. Mix dry ingredients in large bowl
3. Add eggs, buttermilk, oil, and vanilla
4. Beat with mixer for 2 minutes
5. Stir in hot water (batter will be thin)
6. Pour into greased 9x13 pan
7. Bake 30-35 minutes until toothpick comes out clean
8. Let cool and frost with your favorite frosting

BANANA BREAD
=============
Ingredients:
- 3 ripe bananas
- 1/3 cup melted butter
- 3/4 cup sugar
- 1 egg, beaten
- 1 teaspoon vanilla
- 1 teaspoon baking soda  
- Pinch of salt
- 1 1/2 cups flour

Instructions:
1. Preheat to 350F
2. Mash bananas with fork
3. Mix in butter, sugar, egg, vanilla
4. Add baking soda, salt, flour
5. Pour into loaf pan
6. Bake 60-65 minutes

This file contains recipes and has absolutely nothing to do with the original memo document.
The AI anomaly detection should flag this as suspicious.
"""

files = {"file": ("random_recipes.txt", different_content, "text/plain")}
data = {"changeSummary": "Test: uploading completely different content for anomaly detection"}
r = requests.post(f"{BASE}/documents/{DOC_ID}/checkin", headers=headers, files=files, data=data, timeout=TIMEOUT)
print(f"Check-in: {r.status_code}")
print(f"Response: {json.dumps(r.json(), indent=2)[:500]}")

# Wait a moment for async processing
time.sleep(2)

# Check versions after check-in
print("\n=== Step 5: Versions After Check-in ===")
r = requests.get(f"{BASE}/documents/{DOC_ID}/versions", headers=headers, timeout=TIMEOUT)
versions = r.json()["data"]
print(f"Total versions: {len(versions)}")
for v in versions:
    flagged = v.get('anomalyFlagged')
    score = v.get('anomalyScore')
    sim = v.get('similarityScore')
    reasons = v.get('anomalyReasons', [])
    print(f"  V{v['versionNumber']}: flagged={flagged}, anomalyScore={score}, similarityScore={sim}")
    if reasons:
        for reason in reasons:
            print(f"    -> {reason}")

# Check specifically the latest version for anomaly
latest = versions[0]  # sorted desc by version number
print(f"\n=== Step 6: Anomaly Detection Result ===")
print(f"Latest version: V{latest['versionNumber']}")
print(f"Anomaly Flagged: {latest.get('anomalyFlagged')}")
print(f"Anomaly Score: {latest.get('anomalyScore')}")
print(f"Similarity Score: {latest.get('similarityScore')}")
print(f"Anomaly Reasons: {latest.get('anomalyReasons')}")

if latest.get('anomalyFlagged'):
    print("\n✅ SUCCESS: AI correctly detected that a completely different document was checked in!")
elif latest.get('similarityScore') is not None:
    print(f"\n⚠ Anomaly check ran but didn't flag (similarity={latest.get('similarityScore')}). Check thresholds.")
else:
    print("\n❌ Anomaly check did not produce results - check search service connectivity")
