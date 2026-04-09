import subprocess, json, urllib.request, sys

OUT = []
def log(msg):
    OUT.append(msg)
    
# Login via gateway
log("=== Login ===")
login_data = json.dumps({"username": "admin", "password": "Admin@2024!"}).encode()
try:
    req = urllib.request.Request("http://localhost:8200/api/auth/login", data=login_data, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=15)
    token = json.loads(resp.read())["data"]["accessToken"]
    log(f"OK: token={token[:30]}...")
except Exception as e:
    log(f"FAIL via gateway, trying direct auth service...")
    try:
        req = urllib.request.Request("http://localhost:8201/auth/login", data=login_data, headers={"Content-Type": "application/json"})
        resp = urllib.request.urlopen(req, timeout=10)
        token = json.loads(resp.read())["data"]["accessToken"]
        log(f"OK via direct: token={token[:30]}...")
    except Exception as e2:
        log(f"Both failed: {e2}")
        with open("c:/Users/ze9167867/Desktop/Apex Nexus/test_results_anomaly.txt", "w") as f:
            f.write("\n".join(OUT))
        sys.exit(1)

# Test version endpoint directly against document service
log("\n=== Version History (direct port 8202) ===")
doc_id = "dff73b47-30b0-491f-804d-09a9826bb908"
try:
    req2 = urllib.request.Request(f"http://localhost:8202/documents/{doc_id}/versions", headers={"Authorization": f"Bearer {token}"})
    resp2 = urllib.request.urlopen(req2, timeout=15)
    raw = json.loads(resp2.read())
    versions = raw.get("data", raw) if isinstance(raw, dict) else raw
    for v in versions:
        anom = v.get('anomalyDetected', 'N/A')
        score = v.get('similarityScore', 'N/A')
        reasons = v.get('anomalyReasons', [])
        log(f"  V{v['versionNumber']}: file={v.get('fileName')}, size={v.get('fileSizeBytes')}, author={v.get('authorName')}, anomaly={anom}, score={score}, reasons={reasons}")
    log(f"  Total: {len(versions)} versions")
except Exception as e:
    log(f"  FAIL: {e}")

# Test document checkout and checkin with a completely different file
log("\n=== Checkout doc for anomaly test ===")
try:
    req3 = urllib.request.Request(f"http://localhost:8202/documents/{doc_id}/checkout", method="POST", 
                                  headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"})
    resp3 = urllib.request.urlopen(req3, timeout=15)
    log(f"  Checkout: HTTP {resp3.status}")
except urllib.error.HTTPError as e:
    log(f"  Checkout: HTTP {e.code} - {e.read().decode()[:200]}")
except Exception as e:
    log(f"  Checkout: {e}")

log("\n=== Check-in with COMPLETELY DIFFERENT file ===")
# Build multipart form data
boundary = "----WebKitFormBoundary7MA4Ytest"
fake_content = b"COMPLETELY DIFFERENT CONTENT\nThis document is about cooking recipes and gardening.\nNothing to do with NCC access, memos, or any IT correspondence.\n" * 10
parts = []
parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"random_recipes.txt\"\r\nContent-Type: text/plain\r\n\r\n".encode() + fake_content + b"\r\n")
parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"changeSummary\"\r\n\r\nReplaced with cooking recipes - SHOULD trigger anomaly\r\n".encode())
parts.append(f"--{boundary}--\r\n".encode())
body = b"".join(parts)

try:
    req4 = urllib.request.Request(
        f"http://localhost:8202/documents/{doc_id}/checkin",
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": f"multipart/form-data; boundary={boundary}"
        },
        method="POST"
    )
    resp4 = urllib.request.urlopen(req4, timeout=30)
    result = json.loads(resp4.read())
    log(f"  Check-in: HTTP {resp4.status}")
    log(f"  Response: {json.dumps(result, indent=2, default=str)[:600]}")
except urllib.error.HTTPError as e:
    body_text = e.read().decode()[:500]
    log(f"  Check-in: HTTP {e.code}")
    log(f"  Response: {body_text}")
except Exception as e:
    log(f"  Check-in: {e}")

# Check versions again
log("\n=== Versions After Check-In ===")
try:
    req5 = urllib.request.Request(f"http://localhost:8202/documents/{doc_id}/versions", headers={"Authorization": f"Bearer {token}"})
    resp5 = urllib.request.urlopen(req5, timeout=15)
    raw = json.loads(resp5.read())
    versions = raw.get("data", raw) if isinstance(raw, dict) else raw
    for v in versions:
        anom = v.get('anomalyDetected', False)
        score = v.get('similarityScore', 'N/A')
        reasons = v.get('anomalyReasons', [])
        flag = " *** ANOMALY DETECTED ***" if anom else ""
        log(f"  V{v['versionNumber']}: {v.get('changeSummary', 'N/A')} | anomaly={anom}, score={score}{flag}")
        if reasons:
            for r in reasons:
                log(f"    -> {r}")
except Exception as e:
    log(f"  FAIL: {e}")

# Save results
with open("c:/Users/ze9167867/Desktop/Apex Nexus/test_results_anomaly.txt", "w") as f:
    f.write("\n".join(OUT))
print("Results written to test_results_anomaly.txt")
