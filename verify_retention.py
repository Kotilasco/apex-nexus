import urllib.request
import json

# Login
login_data = json.dumps({"username": "admin", "password": "Admin@2024!"}).encode()
req = urllib.request.Request("http://localhost:8500/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
try:
    resp = urllib.request.urlopen(req, timeout=10)
    login_resp = json.loads(resp.read())
    print(f"Login: {login_resp.get('success')}")
    token = login_resp["data"]["accessToken"]
except Exception as e:
    print(f"Login failed: {e}")
    # Try direct
    req2 = urllib.request.Request("http://localhost:8501/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
    try:
        resp2 = urllib.request.urlopen(req2, timeout=10)
        login_resp = json.loads(resp2.read())
        print(f"Login (direct): {login_resp.get('success')}")
        token = login_resp["data"]["accessToken"]
    except Exception as e2:
        print(f"Login (direct) also failed: {e2}")
        exit(1)

# Get projects
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
req3 = urllib.request.Request("http://localhost:8500/api/projects?page=0&size=5", headers=headers)
try:
    resp3 = urllib.request.urlopen(req3, timeout=10)
    projects_resp = json.loads(resp3.read())
    pdata = projects_resp.get("data", projects_resp) if isinstance(projects_resp, dict) else projects_resp
    projects = pdata.get("content", pdata) if isinstance(pdata, dict) else pdata
    if isinstance(projects, list):
        print(f"\nProjects ({len(projects)}):")
        for p in projects[:3]:
            print(f"  - {p.get('name')}: retentionPeriod={p.get('defaultRetentionPeriodYears')}, jurisdiction={p.get('jurisdictionCode')}, privacyRedaction={p.get('privacyRedactionEnabled')}, compliance={p.get('complianceCategory')}")
    else:
        print(f"\nProjects raw: {str(projects)[:300]}")
except Exception as e:
    print(f"Projects failed: {e}")

# Get jurisdictions
req4 = urllib.request.Request("http://localhost:8500/api/retention/jurisdictions", headers=headers)
try:
    resp4 = urllib.request.urlopen(req4, timeout=10)
    jurisdictions = json.loads(resp4.read())
    jdata = jurisdictions.get("data", jurisdictions)
    if isinstance(jdata, list):
        print(f"\nJurisdictions ({len(jdata)}):")
        for j in jdata:
            print(f"  - {j.get('code')}: {j.get('name')} ({j.get('region')})")
    else:
        print(f"\nJurisdictions response: {str(jdata)[:200]}")
except Exception as e:
    print(f"Jurisdictions failed: {e}")

print("\nVerification complete!")
