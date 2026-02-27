#!/usr/bin/env bash
# VPS deployment script for ClawdDAO
# Usage: ssh into VPS then run this script, or run remotely:
#   ssh root@57.131.43.122 'bash -s' < scripts/deploy.sh
set -euo pipefail

REPO_URL="https://github.com/aryan877/clawddao.git"
DEPLOY_DIR="/opt/clawddao"

echo "=== ClawdDAO VPS Deployment ==="

# 1. Install Docker if missing
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
fi

# 2. Install git/curl if missing
apt-get update -qq && apt-get install -y -qq git curl > /dev/null

# 3. Clone or pull repo
if [ -d "$DEPLOY_DIR/.git" ]; then
  echo "Updating existing repo..."
  cd "$DEPLOY_DIR"
  git pull --ff-only
else
  echo "Cloning repo..."
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# 4. Check .env.prod exists
if [ ! -f "$DEPLOY_DIR/.env.prod" ]; then
  echo "ERROR: .env.prod not found!"
  echo "Copy it from local: scp .env.prod root@57.131.43.122:$DEPLOY_DIR/.env.prod"
  exit 1
fi

# 5. Build and start containers
echo "Building and starting containers..."
docker compose -f docker-compose.prod.yml up -d --build

# 6. Wait for SpacetimeDB to be healthy
echo "Waiting for SpacetimeDB to be healthy..."
for i in $(seq 1 30); do
  if docker exec clawddao-spacetimedb curl -sf http://localhost:3000/v1/ping > /dev/null 2>&1; then
    echo "SpacetimeDB is healthy!"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: SpacetimeDB failed to start"
    docker compose -f docker-compose.prod.yml logs spacetimedb
    exit 1
  fi
  sleep 2
done

# 7. Publish SpacetimeDB module
echo "Publishing SpacetimeDB module..."
docker exec clawddao-spacetimedb spacetime publish clawddao --anonymous || true

# 8. Import data if backup files exist
if [ -d "$DEPLOY_DIR/stdb-backup" ] && [ -f "$DEPLOY_DIR/scripts/import-stdb-data.sh" ]; then
  echo "Importing SpacetimeDB data..."
  bash "$DEPLOY_DIR/scripts/import-stdb-data.sh"
fi

# 9. Verify health
echo ""
echo "=== Verification ==="
echo -n "App health: "
curl -sf http://localhost:3000/api/health && echo " OK" || echo " FAIL"
echo -n "Worker health: "
curl -sf http://localhost:4000/health && echo " OK" || echo " FAIL"
echo -n "SpacetimeDB: "
curl -sf http://localhost:3000/v1/ping && echo " OK" || echo " FAIL"
echo ""
docker compose -f docker-compose.prod.yml ps
echo ""
echo "=== Deployment complete ==="
echo "Set DNS: clawddao.aryankumar.dev A -> 57.131.43.122"
echo "Caddy will auto-provision HTTPS once DNS propagates."
