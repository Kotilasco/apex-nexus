import subprocess
r = subprocess.run(['docker', 'logs', '--tail', '3', 'apex-document-service'], 
                   capture_output=True, text=True, timeout=10)
print("STDOUT:", r.stdout[-300:])
print("STDERR:", r.stderr[-300:])
# Also check if started
r2 = subprocess.run(['docker', 'logs', 'apex-document-service'], 
                    capture_output=True, text=True, timeout=10)
if 'Started' in r2.stdout:
    for line in r2.stdout.split('\n'):
        if 'Started' in line:
            print("STARTED:", line.strip())
