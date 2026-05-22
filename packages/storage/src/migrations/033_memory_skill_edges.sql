-- 033 — Memory ↔ Skill edges (Step 4 of autolearning fix)
-- Why a new table instead of reusing memory_edges:
--   memory_edges.target_id has a FK to memories(id) — incompatible with skill names.
-- This table is dedicated to skill provenance: which skills produced which memories.
-- Drives the Graph view in the dashboard and contextual skill_route suggestions.

CREATE TABLE IF NOT EXISTS memory_skill_edges (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL REFERENCES skills(name) ON DELETE CASCADE,
  -- DerivedFrom = memory was created in a session where this skill was loaded/applied
  -- Future: AppliesTo, Contradicts, etc.
  type TEXT NOT NULL CHECK(type IN ('DerivedFrom')),
  -- 0.4 = skill was only loaded · 0.9 = skill was applied (explicit signal)
  strength REAL NOT NULL DEFAULT 0.5,
  reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(memory_id, skill_name, type)
);

CREATE INDEX IF NOT EXISTS idx_mse_memory ON memory_skill_edges(memory_id);
CREATE INDEX IF NOT EXISTS idx_mse_skill ON memory_skill_edges(skill_name);
CREATE INDEX IF NOT EXISTS idx_mse_created ON memory_skill_edges(created_at);
