#!/bin/bash
set -e
cd "$(dirname "$0")/backend"

for svc in apex-auth-service apex-workflow-service apex-audit-service apex-search-service apex-retention-service apex-notification-service; do
  echo "Building Docker image for $svc..."
  cd "$svc"
  # Extract the image name from Dockerfile or use convention
  img_name="apex-nexus/$(echo $svc | sed 's/apex-//')"
  docker build -t "$img_name:latest" . 2>&1 | tail -1
  echo "Done: $img_name"
  cd ..
done

echo "ALL_BUILDS_COMPLETE"
