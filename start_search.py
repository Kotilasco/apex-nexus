import subprocess, sys, time

def run(cmd, timeout=300):
    print(f"Running: {' '.join(cmd)}")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=r"C:\Users\ze9167867\Desktop\Apex Nexus")
    if r.stdout: print(f"stdout: {r.stdout[-300:]}")
    if r.stderr: print(f"stderr: {r.stderr[-300:]}")
    print(f"exit code: {r.returncode}")
    return r

# Start search service with docker compose
run(['docker', 'compose', 'up', '-d', 'apex-search-service'])

# Wait for startup
print("\nWaiting 120s for search service to start...")
time.sleep(120)

# Check logs
r = run(['docker', 'logs', '--tail', '5', 'apex-search-service'], timeout=10)

# Check if started
r = run(['docker', 'ps', '-a', '--filter', 'name=apex-search-service', '--format', '{{.Names}}  {{.Status}}'], timeout=10)
