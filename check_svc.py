import subprocess, time

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    return r.stdout.strip()

# Check search service status
out = run(['docker', 'ps', '-a', '--filter', 'name=apex-search-service', '--format', '{{.Names}}  {{.Status}}'])
print(f"Search svc: {out}")

# Check doc service status
out = run(['docker', 'ps', '-a', '--filter', 'name=apex-document-service', '--format', '{{.Names}}  {{.Status}}'])
print(f"Doc svc: {out}")

# Get last 5 lines of search service logs
r = subprocess.run(['docker', 'logs', '--tail', '5', 'apex-search-service'], capture_output=True, text=True, timeout=10)
print(f"\nSearch service logs (last 5):")
print(r.stdout[-500:] if r.stdout else "(no stdout)")
print(r.stderr[-500:] if r.stderr else "(no stderr)")
