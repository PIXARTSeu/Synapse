/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

// Prod-critical regression: migration 035's one-time `rebuild` must REPAIR an
// already-corrupted external-content FTS index, not just keep a fresh one in
// sync. This is exactly the production scenario the fix targets — prod's index
// was orphaned by the old INSERT OR REPLACE churn, and applying 035 on redeploy
// is what heals it. The forward-trigger tests never corrupt the index first, so
// this behaviour was previously unverified.
//
// Note: skills_fts is an FTS5 EXTERNAL-CONTENT table, so orphans/missing rows
// are NOT visible via `SELECT rowid FROM skills_fts` (that reconstructs rows
// from the content table). The reliable corruption signals are the built-in
// `integrity-check` (throws on mismatch) and a `fts5: missing row` throw when
// MATCH hits a posting whose content row was deleted.

import { readFileSync } from 'node:fs'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../src/migrator.js'
import { SkillsStore } from '../src/skills-store.js'

const MIGRATION_035 = readFileSync(
  new URL('../src/migrations/035_skills_fts_triggers.sql', import.meta.url),
  'utf-8',
)

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

const skill = (over: Record<string, unknown> = {}): any => ({
  name: 'x',
  category: 'SEO',
  description: 'desc',
  content: '# body',
  type: 'domain',
  tags: [],
  lines: 1,
  updatedAt: new Date().toISOString(),
  ...over,
})

const match = (db: Database.Database, term: string): string[] =>
  (db.prepare('SELECT name FROM skills_fts WHERE skills_fts MATCH ?').all(term) as { name: string }[]).map((r) => r.name)
const integrityCheck = (db: Database.Database) =>
  db.exec("INSERT INTO skills_fts(skills_fts) VALUES('integrity-check')")

describe('migration 035 rebuild repairs a pre-corrupted FTS index', () => {
  let db: Database.Database
  beforeEach(() => { db = makeDb() })
  afterEach(() => { db.close() })

  it('heals stale terms, orphans, and missing entries after the index is corrupted', () => {
    const store = new SkillsStore(db)
    store.upsert(skill({ name: 'a', content: '# alpha' }))
    store.upsert(skill({ name: 'b', content: '# bravo' }))
    expect(match(db, 'alpha')).toEqual(['a'])
    expect(() => integrityCheck(db)).not.toThrow()

    // --- Simulate the pre-fix corruption ---
    // Drop the triggers so raw writes desync the external-content index, exactly
    // as the old INSERT OR REPLACE path did.
    db.exec('DROP TRIGGER IF EXISTS skills_fts_ai; DROP TRIGGER IF EXISTS skills_fts_ad; DROP TRIGGER IF EXISTS skills_fts_au;')

    // (1) Stale term: content changes but the index still holds the old term.
    db.prepare('UPDATE skills SET content = ? WHERE name = ?').run('# alphanew', 'a')
    // (2) Orphan: skills row deleted, index posting left dangling.
    db.prepare('DELETE FROM skills WHERE name = ?').run('b')
    // (3) Missing: new skills row with no index entry.
    db.prepare(
      `INSERT INTO skills (name, category, description, content, type, tags, lines, updated_at, status)
       VALUES ('c', 'SEO', 'desc', '# charlie', 'domain', '[]', 1, ?, 'active')`,
    ).run(new Date().toISOString())

    // Corruption is real: the index now disagrees with the content table.
    // (We assert via lookups, which are version-independent — the no-arg
    // integrity-check only verifies the index internally, not against external
    // content. 'bravo' is intentionally NOT queried here: reading a deleted
    // external-content row can raise `fts5: missing row`.)
    expect(match(db, 'alpha')).toEqual(['a'])     // STALE hit: 'a' no longer contains "alpha"
    expect(match(db, 'alphanew')).toEqual([])     // new term not indexed
    expect(match(db, 'charlie')).toEqual([])      // 'c' missing from index

    // --- Apply migration 035 to the corrupted DB (drop/recreate triggers + rebuild) ---
    db.exec(MIGRATION_035)

    // --- Everything is repaired ---
    expect(() => integrityCheck(db)).not.toThrow()
    expect(match(db, 'alphanew')).toEqual(['a'])  // stale term reindexed
    expect(match(db, 'alpha')).toEqual([])        // old term gone
    expect(match(db, 'charlie')).toEqual(['c'])   // missing entry added
    expect(match(db, 'bravo')).toEqual([])        // orphan dropped (row was deleted)
  })
})
