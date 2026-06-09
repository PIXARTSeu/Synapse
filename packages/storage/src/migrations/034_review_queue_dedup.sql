-- 034 — Dedup guards for the auto-generated review queues
-- Why: session_end re-creates skill_proposals on EVERY session, and session_start
-- re-creates design_system_scans on every scan with unresolved token conflicts.
-- Both use `INSERT OR IGNORE` but with a fresh-random primary-key id each call, so
-- OR IGNORE never actually deduped — it only guarded against a missing table. The
-- pending "Needs attention" queue therefore grew without bound (the primary driver
-- of the perpetually-high "Pending reviews" count on the dashboard).
--
-- Fix: a PARTIAL UNIQUE INDEX scoped to status='pending' makes "at most one OPEN
-- item per key" an invariant, so INSERT OR IGNORE finally fires when an open item
-- already exists. dismissed/applied rows are excluded from the index, so a skill or
-- project can be re-proposed once its previous proposal has been actioned.

-- Collapse any pre-existing duplicate OPEN proposals to the earliest per skill first;
-- otherwise creating the unique index would fail on the existing duplicates.
DELETE FROM skill_proposals
 WHERE status = 'pending'
   AND id NOT IN (
     SELECT MIN(id) FROM skill_proposals WHERE status = 'pending' GROUP BY skill_name
   );

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_proposals_open
  ON skill_proposals(skill_name) WHERE status = 'pending';

-- Same treatment for design-system scans: one open scan per project at a time.
DELETE FROM design_system_scans
 WHERE status = 'pending'
   AND id NOT IN (
     SELECT MIN(id) FROM design_system_scans WHERE status = 'pending' GROUP BY project
   );

CREATE UNIQUE INDEX IF NOT EXISTS idx_dss_open
  ON design_system_scans(project) WHERE status = 'pending';
