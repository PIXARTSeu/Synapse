-- 035 — Keep skills_fts in sync via triggers, and repair existing orphans.
--
-- skills_fts is an FTS5 EXTERNAL-CONTENT table (content='skills', content_rowid='rowid').
-- It was previously maintained by hand in SkillsStore.upsert with
--   INSERT OR REPLACE INTO skills_fts(rowid, ...)
-- while the skills upsert itself used INSERT OR REPLACE, which DELETES + REINSERTS the
-- row and CHURNS its rowid on every write. The result: stale FTS index entries pointing
-- at rowids that no longer exist, surfacing as `fts5: missing row N from content table
-- 'skills'` during skill_route searches after any bulk re-import.
--
-- Fix (paired with the stable-rowid ON CONFLICT DO UPDATE upsert in skills-store.ts):
--   * triggers maintain the index for INSERT / UPDATE / DELETE using the FTS5
--     external-content 'delete' + insert protocol (old values remove old terms);
--   * the AFTER UPDATE trigger fires only when an indexed column is in the SET clause,
--     so usage_count/confidence/decay bumps do NOT needlessly re-index;
--   * a one-time 'rebuild' repairs whatever orphans already exist in this DB.
-- The manual FTS write in code is removed (it would now double-index).

DROP TRIGGER IF EXISTS skills_fts_ai;
DROP TRIGGER IF EXISTS skills_fts_ad;
DROP TRIGGER IF EXISTS skills_fts_au;

CREATE TRIGGER skills_fts_ai AFTER INSERT ON skills BEGIN
  INSERT INTO skills_fts(rowid, name, description, content, tags)
  VALUES (new.rowid, new.name, new.description, new.content, new.tags);
END;

CREATE TRIGGER skills_fts_ad AFTER DELETE ON skills BEGIN
  INSERT INTO skills_fts(skills_fts, rowid, name, description, content, tags)
  VALUES ('delete', old.rowid, old.name, old.description, old.content, old.tags);
END;

CREATE TRIGGER skills_fts_au AFTER UPDATE OF name, description, content, tags ON skills BEGIN
  INSERT INTO skills_fts(skills_fts, rowid, name, description, content, tags)
  VALUES ('delete', old.rowid, old.name, old.description, old.content, old.tags);
  INSERT INTO skills_fts(rowid, name, description, content, tags)
  VALUES (new.rowid, new.name, new.description, new.content, new.tags);
END;

-- Repair existing index (drops orphaned entries, reindexes from the content table).
INSERT INTO skills_fts(skills_fts) VALUES('rebuild');
