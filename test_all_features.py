#!/usr/bin/env python3
"""Test script for AI features, email ingestion, and RBAC."""
import requests
import json
import time

BASE = "http://localhost:9600/api"

def login(username, password):
    r = requests.post(f"{BASE}/auth/login", json={"username": username, "password": password})
    if r.status_code == 200:
        data = r.json().get("data", {})
        return data.get("accessToken") or data.get("token")
    print(f"  Login failed: {r.status_code} {r.text[:200]}")
    return None

def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

print("=" * 60)
print("TEST 1: Admin Login")
print("=" * 60)
token = login("admin", "Admin@2024!")
if token:
    print(f"  OK - token: {token[:40]}...")
else:
    print("  FAILED")
    exit(1)

print("\n" + "=" * 60)
print("TEST 2: AI Summarize Endpoint")
print("=" * 60)
try:
    r = requests.post(f"{BASE}/ai/summarize", headers=headers(token), json={
        "content": "This is a contract agreement between Apex Corp and Global Holdings Ltd. The agreement stipulates that Apex Corp will provide enterprise content management services for a period of 3 years starting January 2025. The total contract value is $2.5 million with quarterly payments. Key deliverables include document management, workflow automation, and compliance reporting.",
        "title": "Apex Corp Service Agreement"
    }, timeout=60)
    print(f"  Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        summary = data.get("data", {}).get("summary", data.get("summary", str(data)[:200]))
        print(f"  Summary: {str(summary)[:200]}")
    else:
        print(f"  Response: {r.text[:300]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("TEST 3: AI Ask Question Endpoint")
print("=" * 60)
try:
    r = requests.post(f"{BASE}/ai/ask", headers=headers(token), json={
        "content": "This is a contract agreement between Apex Corp and Global Holdings Ltd. The total contract value is $2.5 million with quarterly payments over 3 years.",
        "title": "Service Agreement",
        "question": "What is the total contract value?"
    }, timeout=60)
    print(f"  Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        answer = data.get("data", {}).get("answer", data.get("answer", str(data)[:200]))
        print(f"  Answer: {str(answer)[:200]}")
    else:
        print(f"  Response: {r.text[:300]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("TEST 4: Email Ingestion - List Configs")
print("=" * 60)
try:
    r = requests.get(f"{BASE}/email-ingestion/configs", headers=headers(token))
    print(f"  Status: {r.status_code}")
    data = r.json()
    configs = data.get("data", [])
    print(f"  Existing configs: {len(configs)}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("TEST 5: Email Ingestion - Create Config (Holdings@2030)")
print("=" * 60)
try:
    r = requests.post(f"{BASE}/email-ingestion/configs", headers=headers(token), json={
        "name": "Holdings Email Ingestion",
        "protocol": "IMAP",
        "imapHost": "mail.globalholdings.com",
        "imapPort": 993,
        "username": "documents@globalholdings.com",
        "password": "Holdings@2030",
        "folderName": "INBOX",
        "useSsl": True,
        "pollInterval": 5
    })
    print(f"  Status: {r.status_code}")
    data = r.json()
    if r.status_code in [200, 201]:
        config = data.get("data", {})
        config_id = config.get("id")
        print(f"  Config ID: {config_id}")
        print(f"  Config Name: {config.get('name')}")
        print(f"  Protocol: {config.get('protocol')}")
        print(f"  Host: {config.get('imapHost')}")
        print(f"  Port: {config.get('imapPort')}")
        print(f"  SSL: {config.get('useSsl')}")
        print(f"  Enabled: {config.get('enabled')}")
    else:
        print(f"  Response: {r.text[:300]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("TEST 6: Role-based - Viewer Login")
print("=" * 60)
viewer_token = login("dave_viewer", "Test@2024!")
if viewer_token:
    print(f"  OK - viewer token: {viewer_token[:40]}...")
    
    # Test viewer can access documents but not admin endpoints
    r = requests.get(f"{BASE}/documents", headers=headers(viewer_token))
    print(f"  Documents access: {r.status_code}")
    
    r = requests.get(f"{BASE}/auth/users", headers=headers(viewer_token))
    print(f"  Users admin access: {r.status_code}")
else:
    print("  FAILED - viewer user may not exist")

print("\n" + "=" * 60)
print("TEST 7: Ollama Direct Test")
print("=" * 60)
try:
    r = requests.post("http://localhost:11434/api/generate", json={
        "model": "llama3.2:1b",
        "prompt": "Say hello in one sentence.",
        "stream": False
    }, timeout=60)
    print(f"  Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"  Response: {data.get('response', '')[:200]}")
    else:
        print(f"  Response: {r.text[:200]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("ALL TESTS COMPLETE")
print("=" * 60)
