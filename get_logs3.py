import subprocess
r = subprocess.run(["docker", "logs", "apex-document-service", "--tail", "150"], capture_output=True, text=True)
with open("c:/Users/ze9167867/Desktop/Apex Nexus/doc_svc_logs3.txt", "w") as f:
    f.write(r.stdout)
print("Done")
