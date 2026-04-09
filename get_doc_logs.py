import subprocess
result = subprocess.run(
    ['docker', 'logs', '--tail', '300', 'apex-document-service'],
    capture_output=True, text=True, timeout=10
)
with open('doc_logs_latest.txt', 'w') as f:
    f.write(result.stdout)
    f.write(result.stderr)
print("Logs saved to doc_logs_latest.txt")
print(f"stdout len: {len(result.stdout)}, stderr len: {len(result.stderr)}")
