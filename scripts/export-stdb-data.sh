#!/usr/bin/env bash
# Export all SpacetimeDB tables from local instance (port 3100) to JSON files
set -euo pipefail

STDB_URL="http://localhost:3100"
MODULE="clawddao"
BACKUP_DIR="$(dirname "$0")/../stdb-backup"

mkdir -p "$BACKUP_DIR"

TABLES=("agents" "votes" "tracked_realms" "ai_analyses" "activity_log" "delegations")

for table in "${TABLES[@]}"; do
  echo "Exporting $table..."
  curl -sf -X POST "$STDB_URL/database/sql/$MODULE" \
    -H 'Content-Type: text/plain' \
    -d "SELECT * FROM $table" > "$BACKUP_DIR/$table.json"
  echo "  -> $BACKUP_DIR/$table.json"
done

echo ""
echo "Export complete. Files in $BACKUP_DIR/:"
ls -la "$BACKUP_DIR/"
