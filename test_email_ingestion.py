#!/usr/bin/env python3
"""End-to-end email ingestion test via GreenMail SMTP/IMAP"""
import requests, json, time, smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

BASE = "http://localhost:9600/api"

# Step 1: Login
print("=== Step 1: Login ===")
login = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "Admin@2024!"})
token = login.json().get("data", {}).get("accessToken") or login.json().get("accessToken")
if not token:
    print(f"Login failed: {login.text[:200]}")
    exit(1)
headers = {"Authorization": f"Bearer {token}"}
print(f"Logged in. Token: {token[:30]}...")

# Step 2: Delete old configs pointing to mail.globalholdings.com
print("\n=== Step 2: Cleanup old configs ===")
configs_res = requests.get(f"{BASE}/email-ingestion/configs", headers=headers)
configs = configs_res.json().get("data", []) if configs_res.ok else []
for c in configs:
    if "greenmail" in (c.get("imapHost") or "") or "globalholdings" in (c.get("imapHost") or ""):
        print(f"  Deleting old config: {c['name']} (host={c.get('imapHost')})")
        requests.delete(f"{BASE}/email-ingestion/configs/{c['id']}", headers=headers)

# Step 3: Create email ingestion config pointing to GreenMail
print("\n=== Step 3: Create GreenMail ingestion config ===")
config_payload = {
    "name": "GreenMail Test Ingestion",
    "protocol": "IMAP",
    "imapHost": "greenmail",
    "imapPort": 3143,
    "username": "ingest@globalholdings.com",
    "password": "Holdings2030",
    "folderName": "INBOX",
    "useSsl": False,
    "pollInterval": 2
}
create_res = requests.post(f"{BASE}/email-ingestion/configs", json=config_payload, headers=headers)
print(f"Create config: {create_res.status_code}")
if not create_res.ok:
    print(f"  Error: {create_res.text[:300]}")
    exit(1)
config_data = create_res.json().get("data", create_res.json())
config_id = config_data.get("id")
print(f"  Config ID: {config_id}")

# Step 4: Add an ingestion rule
print("\n=== Step 4: Add ingestion rule ===")
rule_payload = {
    "ruleName": "Ingest all with attachments",
    "ruleType": "HAS_ATTACHMENT",
    "ruleValue": ""
}
rule_res = requests.post(f"{BASE}/email-ingestion/configs/{config_id}/rules", json=rule_payload, headers=headers)
print(f"Add rule: {rule_res.status_code}")
if rule_res.ok:
    print(f"  Rule: {rule_res.json().get('data', {}).get('ruleName', 'OK')}")

# Step 5: Enable the config
print("\n=== Step 5: Enable config ===")
toggle_res = requests.patch(f"{BASE}/email-ingestion/configs/{config_id}/toggle", headers=headers)
print(f"Toggle: {toggle_res.status_code}")

# Step 6: Send test email with attachment via GreenMail SMTP (port 3025)
print("\n=== Step 6: Send test email via GreenMail SMTP ===")
try:
    msg = MIMEMultipart()
    msg["From"] = "sender@acme.com"
    msg["To"] = "ingest@globalholdings.com"
    msg["Subject"] = "Contract Document - Q2 2026 Review"
    
    body = """Dear Team,

Please find attached the Q2 2026 contract review document for Global Holdings.

Key points:
- Contract value: $2.5 million
- Start date: April 1, 2026
- Payment terms: Net 30

Best regards,
John Smith
VP of Contracts, ACME Corp"""
    msg.attach(MIMEText(body, "plain"))
    
    # Create a test PDF-like attachment
    attachment_content = b"""%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 100 700 Td (Q2 Contract Review) Tj ET
endstream
endobj
xref
0 5
trailer
<< /Root 1 0 R /Size 5 >>
startxref
0
%%EOF"""
    
    part = MIMEBase("application", "pdf")
    part.set_payload(attachment_content)
    encoders.encode_base64(part)
    part.add_header("Content-Disposition", "attachment", filename="Q2_Contract_Review_2026.pdf")
    msg.attach(part)
    
    # Also add a text file attachment
    txt_part = MIMEBase("text", "plain")
    txt_part.set_payload(b"Contract Summary\n\nTotal Value: $2,500,000\nDuration: 12 months\nParties: ACME Corp, Global Holdings\n")
    encoders.encode_base64(txt_part)
    txt_part.add_header("Content-Disposition", "attachment", filename="contract_summary.txt")
    msg.attach(txt_part)
    
    with smtplib.SMTP("localhost", 3025) as smtp:
        smtp.send_message(msg)
    print("  Email sent successfully with 2 attachments!")
    
    # Send a second email without attachment
    msg2 = MIMEText("This is a plain notification email without attachments.\nPlease review the Q2 reports.")
    msg2["From"] = "notifications@acme.com"
    msg2["To"] = "ingest@globalholdings.com"
    msg2["Subject"] = "Notification: Q2 Reports Available"
    
    with smtplib.SMTP("localhost", 3025) as smtp:
        smtp.send_message(msg2)
    print("  Second email sent (no attachments)")
    
except Exception as e:
    print(f"  SMTP Error: {e}")
    exit(1)

# Step 7: Wait a moment then trigger manual poll
print("\n=== Step 7: Trigger manual poll ===")
time.sleep(2)
poll_res = requests.post(f"{BASE}/email-ingestion/configs/{config_id}/poll", headers=headers, timeout=30)
print(f"Poll result: {poll_res.status_code}")
if poll_res.ok:
    poll_data = poll_res.json()
    print(f"  Response: {json.dumps(poll_data, indent=2)[:500]}")
else:
    print(f"  Error: {poll_res.text[:500]}")

# Step 8: Check documents were created
print("\n=== Step 8: Check for ingested documents ===")
time.sleep(1)
docs_res = requests.get(f"{BASE}/documents/documents?search=Q2+Contract", headers=headers)
if docs_res.ok:
    docs = docs_res.json().get("data", {})
    if isinstance(docs, dict):
        content = docs.get("content", [])
    else:
        content = docs if isinstance(docs, list) else []
    print(f"  Found {len(content)} documents matching 'Q2 Contract'")
    for d in content[:5]:
        print(f"    - {d.get('title', d.get('name', 'unknown'))} ({d.get('mimeType', '?')})")
else:
    print(f"  Search error: {docs_res.status_code}")

# Step 9: Final config status
print("\n=== Step 9: Final config status ===")
final_res = requests.get(f"{BASE}/email-ingestion/configs/{config_id}", headers=headers)
if final_res.ok:
    fc = final_res.json().get("data", final_res.json())
    print(f"  Name: {fc.get('name')}")
    print(f"  Host: {fc.get('imapHost')}:{fc.get('imapPort')}")
    print(f"  Enabled: {fc.get('enabled')}")
    print(f"  Rules: {len(fc.get('rules', []))}")

print("\n=== Email Ingestion Test Complete ===")
