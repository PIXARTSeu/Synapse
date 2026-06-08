#!/usr/bin/env bash
#
# Synapse — one-time remediation of the "Needs attention" backlog
# (the historical 308 pending reviews / 30 decaying memories on production).
#
# Policy: AUTO-APPROVE IN-PLACE (chosen by the operator). It drains the
# auto-generated review backlog without manual triage:
#   - pending-review memories            -> active, staleness reset
#   - all active memories with ssv >= 5  -> staleness reset (clean slate; the
#                                           kept auto-enqueue restarts its 15-cycle clock)
#   - pending skill_proposals            -> dismissed (auto-generated nudges)
#   - pending design_system_scans        -> dismissed (auto-generated)
#   - decay metadata clock               -> reset to now
#
# IMPORTANT — run order:
#   1. Deploy the new code FIRST so migration 034 (dedup indexes) has run and the
#      new approve/decay logic is live. Otherwise the backlog will simply refill.
#   2. Then run this script on the box that holds the production DB (Coolify container).
#
# It refuses to run without a backup and prints before/after counts.
#
# Usage:
#   ./remediate-attention-backlog.sh [/path/to/graph.db]
# Default DB path: /data/.codegraph/graph.db   (Synapse production layout)

set -euo pipefail

DB="${1:-/data/.codegraph/graph.db}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "ERROR: sqlite3 not found in PATH." >&2
  exit 1
fi
if [[ ! -f "$DB" ]]; then
  echo "ERROR: database not found at: $DB" >&2
  echo "Pass the correct path as the first argument." >&2
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="${DB}.bak-pre-attention-remediation-${STAMP}"

echo "==> Database:  $DB"
echo "==> Backup:    $BACKUP"
# .backup is safe on a live WAL DB (consistent snapshot).
sqlite3 "$DB" ".backup '$BACKUP'"
echo "==> Backup created."

echo
echo "==> BEFORE:"
sqlite3 "$DB" <<'SQL'
.mode column
.headers on
SELECT 'memories.pending-review' AS metric, COUNT(*) AS n FROM memories WHERE status='pending-review'
UNION ALL SELECT 'memories.active.ssv>=15', COUNT(*) FROM memories WHERE status='active' AND sessions_since_validation>=15
UNION ALL SELECT 'decaying(real: conf<4 & ssv>=5)', COUNT(*) FROM memories WHERE status='active' AND confidence<4 AND sessions_since_validation>=5 AND id NOT LIKE 'M-_system_%'
UNION ALL SELECT 'skill_proposals.pending', COUNT(*) FROM skill_proposals WHERE status='pending'
UNION ALL SELECT 'design_system_scans.pending', COUNT(*) FROM design_system_scans WHERE status='pending';
SQL

echo
echo "==> Applying remediation (single transaction)…"
sqlite3 "$DB" <<'SQL'
BEGIN;

-- 1. Auto-approve every queued memory in place + reset its staleness so the next
--    decay cycle does not immediately re-flag it (these were timer-generated, not
--    human-queued).
UPDATE memories
   SET status = 'active',
       sessions_since_validation = 0,
       last_validated = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
       updated_at     = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE status = 'pending-review';

-- 2. Clean slate for the kept auto-enqueue mechanism: reset the staleness clock on
--    every active memory that had already aged, so the 15-cycle countdown restarts
--    fresh after the fix instead of immediately re-queuing a wave of old memories.
UPDATE memories
   SET sessions_since_validation = 0,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
 WHERE status = 'active'
   AND sessions_since_validation >= 5
   AND id NOT LIKE 'M-_system_%';

-- 3. Dismiss the auto-generated proposal/scan nudges (content is untouched; they
--    re-propose only when genuinely warranted now that dedup indexes exist).
UPDATE skill_proposals      SET status = 'dismissed', reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE status = 'pending';
UPDATE design_system_scans  SET status = 'dismissed' WHERE status = 'pending';

-- 4. Reset the decay clock so the next scheduler tick starts a fresh 24h window.
UPDATE memories SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 'M-_system_decay_last_run';

COMMIT;
SQL

echo "==> Done."
echo
echo "==> AFTER:"
sqlite3 "$DB" <<'SQL'
.mode column
.headers on
SELECT 'memories.pending-review' AS metric, COUNT(*) AS n FROM memories WHERE status='pending-review'
UNION ALL SELECT 'memories.active.ssv>=15', COUNT(*) FROM memories WHERE status='active' AND sessions_since_validation>=15
UNION ALL SELECT 'decaying(real: conf<4 & ssv>=5)', COUNT(*) FROM memories WHERE status='active' AND confidence<4 AND sessions_since_validation>=5 AND id NOT LIKE 'M-_system_%'
UNION ALL SELECT 'skill_proposals.pending', COUNT(*) FROM skill_proposals WHERE status='pending'
UNION ALL SELECT 'design_system_scans.pending', COUNT(*) FROM design_system_scans WHERE status='pending';
SQL

echo
echo "All five counters should now read 0. If anything looks wrong, restore with:"
echo "    cp '$BACKUP' '$DB'   # (stop the server first)"
echo
echo "NOTE: pending skill/component DRAFTS (skills.status='pending' / ui_components.status='pending')"
echo "are intentional human/agent submissions and are NOT auto-approved here. Review them in the"
echo "dashboard, or to also auto-approve them (publishes unreviewed drafts) run:"
echo "    sqlite3 '$DB' \"UPDATE skills SET status='active' WHERE status='pending'; UPDATE ui_components SET status='active' WHERE status='pending';\""
