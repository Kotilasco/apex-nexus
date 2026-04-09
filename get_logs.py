import subprocess, sys

# Get docker logs
r = subprocess.run(["docker", "logs", "apex-document-service", "--tail", "40"], capture_output=True, text=True)
with open("c:/Users/ze9167867/Desktop/Apex Nexus/doc_svc_logs.txt", "w") as f:
    f.write("STDOUT:\n")
    f.write(r.stdout)
    f.write("\nSTDERR:\n")
    f.write(r.stderr)
print("Logs saved to doc_svc_logs.txt")
