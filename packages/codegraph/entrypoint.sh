#!/bin/sh
# SkillBrain entrypoint — import skills on first boot, then start MCP HTTP server

DATA_DIR="${SKILLBRAIN_ROOT:-/data}"
HASH_FILE="$DATA_DIR/.codegraph/catalog.hash"

# Check if skills are already imported
SKILL_COUNT=$(sqlite3 "$DATA_DIR/.codegraph/graph.db" "SELECT COUNT(*) FROM skills;" 2>/dev/null || echo "0")

# Hash the bundled skill catalog. /data is a PERSISTENT volume, so a plain
# "import only when empty" gate means new/edited git-tracked skills never reach
# prod on redeploy. Comparing a content hash of /app/data against the last
# imported hash re-runs the import whenever the bundle changes. Import is an
# idempotent, FTS-safe upsert (stable rowid + migration 035 triggers), so
# re-running is cheap and additive. If sha1sum is unavailable the hash is empty
# and we fall back to the original first-boot-only behaviour.
bundle_hash() {
  find /app/data -type f 2>/dev/null | LC_ALL=C sort | xargs sha1sum 2>/dev/null | sha1sum 2>/dev/null | cut -d' ' -f1
}
BUNDLE_HASH=$(bundle_hash)
STORED_HASH=$(cat "$HASH_FILE" 2>/dev/null || echo "")

run_import() {
  # Create workspace structure that import-skills expects
  mkdir -p "$DATA_DIR/.opencode" "$DATA_DIR/.agents/skills"

  # Symlink bundled data
  ln -sf /app/data/skill "$DATA_DIR/.opencode/skill"
  ln -sf /app/data/agents "$DATA_DIR/.opencode/agents"
  ln -sf /app/data/command "$DATA_DIR/.opencode/command"

  # Symlink lifecycle skills
  if [ -d /app/data/lifecycle-skills ]; then
    for d in /app/data/lifecycle-skills/*/; do
      name=$(basename "$d")
      mkdir -p "$DATA_DIR/.agents/skills/$name"
      ln -sf "$d/SKILL.md" "$DATA_DIR/.agents/skills/$name/SKILL.md" 2>/dev/null
    done
  fi

  # Run import (additive — never prunes on boot; use `import-skills --full` manually for that)
  BEFORE=$(sqlite3 "$DATA_DIR/.codegraph/graph.db" "SELECT COUNT(*) FROM skills;" 2>/dev/null || echo "?")
  if node dist/cli.js import-skills "$DATA_DIR" 2>&1; then
    AFTER=$(sqlite3 "$DATA_DIR/.codegraph/graph.db" "SELECT COUNT(*) FROM skills;" 2>/dev/null || echo "?")
    echo "Skill catalog: ${BEFORE} -> ${AFTER} skills"
    # Record the imported bundle hash ONLY on success, so a failed import retries
    # on the next boot instead of being permanently masked by a stale hash.
    [ -n "$BUNDLE_HASH" ] && printf '%s' "$BUNDLE_HASH" > "$HASH_FILE"
  else
    echo "WARNING: skill import FAILED (exit $?) — catalog.hash left unchanged so the next boot retries." >&2
  fi

  # Cleanup symlinks (data stays in SQLite)
  rm -rf "$DATA_DIR/.opencode" "$DATA_DIR/.agents"
}

if [ "$SKILL_COUNT" = "0" ] || [ "$SKILL_COUNT" = "" ]; then
  echo "First boot: importing skills from bundled data..."
  run_import
  echo "Skills import complete."
elif [ -n "$BUNDLE_HASH" ] && [ "$BUNDLE_HASH" != "$STORED_HASH" ]; then
  echo "Bundled skill catalog changed ($STORED_HASH -> $BUNDLE_HASH): re-importing..."
  run_import
  echo "Skills re-import complete."
else
  echo "Skills already loaded and catalog unchanged: $SKILL_COUNT items"
fi

# Daily backup on boot (keeps last 30 days)
if [ -f "$DATA_DIR/.codegraph/graph.db" ]; then
  BACKUP_DIR="$DATA_DIR/.codegraph/backups"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="$BACKUP_DIR/graph.db.$(date +%Y-%m-%d).gz"
  if [ ! -f "$BACKUP_FILE" ]; then
    sqlite3 "$DATA_DIR/.codegraph/graph.db" ".dump" 2>/dev/null | gzip > "$BACKUP_FILE" && \
      echo "Backup created: $BACKUP_FILE"
  fi
  # Keep only last 30 days
  find "$BACKUP_DIR" -name "graph.db.*.gz" -mtime +30 -delete 2>/dev/null
fi

# Start MCP HTTP server
exec node dist/cli.js mcp --http
