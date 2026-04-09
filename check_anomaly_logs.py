import subprocess
r = subprocess.run(['docker', 'logs', '--tail', '50', 'apex-document-service'], 
                   capture_output=True, text=True, timeout=30)
# Show all lines (not just filtered)
lines = r.stdout.split('\n')
print(f"Total lines: {len(lines)}")
print("\n--- Last 50 lines ---")
for line in lines[-50:]:
    print(line)
