#!/bin/bash
# Deploy JobHacker to production server
# Usage: ./deploy.sh

set -e

SERVER="root@64.226.115.78"
REMOTE_DIR="/root/jobhacker"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploy JobHacker → $SERVER ==="

# Sync files (exclude dev/local stuff)
echo "→ Syncing files..."
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.DS_Store' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'uploads/*' \
  --exclude 'legacy' \
  --exclude 'docs' \
  --exclude 'dist' \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

# Restore .env from backup or copy local
if ssh "$SERVER" "test -f /tmp/jobhacker-env-backup"; then
  echo "→ Restoring .env from previous deploy..."
  ssh "$SERVER" "cp /tmp/jobhacker-env-backup $REMOTE_DIR/.env"
elif ssh "$SERVER" "test -f $REMOTE_DIR/.env"; then
  echo "→ .env already on server (not overwritten)"
else
  echo "→ .env missing on server, copying local..."
  scp "$LOCAL_DIR/.env" "$SERVER:$REMOTE_DIR/.env"
  echo "⚠ Review $REMOTE_DIR/.env on server — update SESSION_SECRET for production!"
fi

# Preserve old .env and stop old containers
echo "→ Stopping old containers..."
ssh "$SERVER" "cp /root/annacvmaker/.env /tmp/jobhacker-env-backup 2>/dev/null; cd /root/annacvmaker && docker compose down 2>/dev/null; rm -rf /root/annacvmaker"
ssh "$SERVER" "docker rm -f cvmaker-app-1 cvmaker-db-1 2>/dev/null; docker system prune -f 2>/dev/null"

# Build and restart
echo "→ Building and starting containers..."
ssh "$SERVER" "cd $REMOTE_DIR && docker compose up -d --build"

# Wait for health check
echo "→ Waiting for app to start..."
sleep 15
ssh "$SERVER" "curl -sf http://localhost:3000/api/health || echo 'HEALTH CHECK FAILED'"

echo "=== Done. https://jobhacker.it ==="
