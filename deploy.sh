#!/bin/bash
# Deploy JobHacker to production server
# Usage: ./deploy.sh

set -e

SERVER="root@64.226.115.78"
REMOTE_DIR="/root/jobhacker"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Deploy JobHacker → $SERVER ==="

# Step 1: Backup current .env BEFORE anything else
echo "→ Backing up .env..."
ssh "$SERVER" "test -f $REMOTE_DIR/.env && cp $REMOTE_DIR/.env /tmp/jobhacker-env-backup || true"

# Step 2: Sync files (exclude dev/local stuff + .env)
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
  --exclude '.claude' \
  --exclude '.playwright-mcp' \
  --exclude '*.png' \
  --exclude 'public' \
  --exclude 'annacvmaker - first build *' \
  "$LOCAL_DIR/" "$SERVER:$REMOTE_DIR/"

# Step 3: Restore .env from backup (rsync --delete may have removed it)
if ssh "$SERVER" "test -f /tmp/jobhacker-env-backup"; then
  echo "→ Restoring .env from backup..."
  ssh "$SERVER" "cp /tmp/jobhacker-env-backup $REMOTE_DIR/.env"
else
  echo "⚠ No .env backup found — copying local .env"
  scp "$LOCAL_DIR/.env" "$SERVER:$REMOTE_DIR/.env"
  echo "⚠ Review $REMOTE_DIR/.env on server!"
fi

# Step 4: Cleanup old containers/images
echo "→ Cleaning up..."
ssh "$SERVER" "docker system prune -f 2>/dev/null || true"

# Step 5: Build and restart
echo "→ Building and starting containers..."
ssh "$SERVER" "cd $REMOTE_DIR && docker compose up -d --build"

# Step 6: Health check
echo "→ Waiting for app to start..."
sleep 15
ssh "$SERVER" "curl -sf http://localhost:3000/api/health || echo 'HEALTH CHECK FAILED'"

echo "=== Done. https://jobhacker.it ==="
