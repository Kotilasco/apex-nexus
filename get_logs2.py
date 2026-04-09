import subprocess
r = subprocess.run(["docker", "logs", "apex-document-service", "--tail", "60"], capture_output=True, text=True)
with open("c:/Users/ze9167867/Desktop/Apex Nexus/doc_svc_logs2.txt", "w") as f:
    f.write(r.stdout)
    f.write("\n---STDERR---\n")
    f.write(r.stderr)
print("Done")
