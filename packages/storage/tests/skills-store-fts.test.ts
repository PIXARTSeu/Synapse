/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

// Regression tests for the stable-rowid upsert + FTS-trigger fix (migration 035).
// Before the fix, INSERT OR REPLACE churned skills.rowid on every write, orphaning the
// FTS5 external-content index → `fts5: missing row` errors in skill_route after re-import.

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../src/migrator.js'
import { SkillsStore } from '../src/skills-store.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

const skill = (over: Record<string, unknown> = {}): any => ({
  name: 'nextjs-seo',
  category: 'SEO',
  description: 'desc about sitemap',
  content: '# body keyword alpha',
  type: 'domain',
  tags: ['seo', 'sitemap'],
  lines: 1,
  updatedAt: new Date().toISOString(),
  ...over,
})

const ftsNames = (db: Database.Database, term: string): string[] =>
  (db.prepare('SELECT name FROM skills_fts WHERE skills_fts MATCH ?').all(term) as { name: string }[]).map(r => r.name)

describe('skills upsert: stable rowid + FTS triggers (migration 035)', () => {
  let db: Database.Database
  beforeEach(() => { db = makeDb() })
  afterEach(() => { db.close() })

  it('keeps FTS queryable across repeated re-upserts with no orphan errors', () => {
    const store = new SkillsStore(db)
    store.upsert(skill())
    expect(ftsNames(db, 'alpha')).toContain('nextjs-seo')

    for (let i = 0; i < 3; i++) {
      store.upsert(skill({ content: `# body keyword beta ${i}`, updatedAt: new Date(Date.now() + i + 1).toISOString() }))
    }
    // No `fts5: missing row` throw, old term de-indexed, new term present.
    expect(() => ftsNames(db, 'beta')).not.toThrow()
    expect(ftsNames(db, 'beta')).toContain('nextjs-seo')
    expect(ftsNames(db, 'alpha')).toHaveLength(0)
  })

  it('does not churn the rowid on update', () => {
    const store = new SkillsStore(db)
    store.upsert(skill())
    const r1 = db.prepare('SELECT rowid AS r FROM skills WHERE name=?').get('nextjs-seo') as { r: number }
    store.upsert(skill({ description: 'updated', content: '# new content' }))
    const r2 = db.prepare('SELECT rowid AS r FROM skills WHERE name=?').get('nextjs-seo') as { r: number }
    expect(r2.r).toBe(r1.r)
  })

  it('preserves autolearning columns and created_by on update', () => {
    const store = new SkillsStore(db)
    store.upsert(skill({ createdByUserId: 'u1' }))
    db.prepare(`UPDATE skills SET confidence=9, usage_count=42, useful_count=7, sessions_since_validation=3, last_validated='2026-01-01' WHERE name=?`).run('nextjs-seo')

    store.upsert(skill({ category: 'Frontend', content: '# changed' }), { changedBy: 'u2' })

    const row = db.prepare('SELECT * FROM skills WHERE name=?').get('nextjs-seo') as any
    expect(row.confidence).toBe(9)
    expect(row.usage_count).toBe(42)
    expect(row.useful_count).toBe(7)
    expect(row.sessions_since_validation).toBe(3)
    expect(row.last_validated).toBe('2026-01-01')
    expect(row.created_by_user_id).toBe('u1')
    expect(row.updated_by_user_id).toBe('u2')
    expect(row.category).toBe('Frontend')
  })

  it('status: active on insert, preserved on null-update, explicit honored', () => {
    const store = new SkillsStore(db)
    store.upsert(skill())
    expect((db.prepare('SELECT status AS s FROM skills WHERE name=?').get('nextjs-seo') as any).s).toBe('active')

    db.prepare(`UPDATE skills SET status='deprecated' WHERE name=?`).run('nextjs-seo')
    store.upsert(skill({ content: '# x' })) // status omitted -> preserve
    expect((db.prepare('SELECT status AS s FROM skills WHERE name=?').get('nextjs-seo') as any).s).toBe('deprecated')

    store.upsert(skill({ status: 'active', content: '# y' })) // explicit wins
    expect((db.prepare('SELECT status AS s FROM skills WHERE name=?').get('nextjs-seo') as any).s).toBe('active')
  })

  it('removes the skill from FTS on delete', () => {
    const store = new SkillsStore(db)
    store.upsert(skill({ content: '# body keyword gamma' }))
    expect(ftsNames(db, 'gamma')).toHaveLength(1)
    db.prepare('DELETE FROM skills WHERE name=?').run('nextjs-seo')
    expect(ftsNames(db, 'gamma')).toHaveLength(0)
  })
})
