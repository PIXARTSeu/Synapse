/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

// Migration 036: risk_* columns on `skills`, populated by @skillbrain/skill-guard
// (Task 7-9) and read back through SkillsStore.upsert()/get() (this task).

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
  name: 'risky-skill',
  category: 'Backend',
  description: 'desc',
  content: '# body',
  type: 'domain',
  tags: ['backend'],
  lines: 1,
  updatedAt: new Date().toISOString(),
  ...over,
})

describe('036_skill_risk', () => {
  it('adds risk columns to skills', () => {
    const db = makeDb()
    const cols = db.prepare('PRAGMA table_info(skills)').all() as { name: string }[]
    const names = cols.map((c) => c.name)
    expect(names).toContain('risk_score')
    expect(names).toContain('risk_recommendation')
    expect(names).toContain('risk_findings')
    expect(names).toContain('risk_scanned_at')
    db.close()
  })
})

describe('SkillsStore risk verdict passthrough', () => {
  let db: Database.Database
  beforeEach(() => { db = makeDb() })
  afterEach(() => { db.close() })

  it('round-trips a risk verdict through upsert() then get()', () => {
    const store = new SkillsStore(db)
    store.upsert(skill({
      riskScore: 82,
      riskRecommendation: 'CAUTION',
      riskFindings: '[{"rule":"shell-exec","severity":"medium"}]',
      riskScannedAt: '2026-07-01T00:00:00.000Z',
    }))

    const found = store.get('risky-skill')
    expect(found?.riskScore).toBe(82)
    expect(found?.riskRecommendation).toBe('CAUTION')
    expect(found?.riskFindings).toBe('[{"rule":"shell-exec","severity":"medium"}]')
    expect(found?.riskScannedAt).toBe('2026-07-01T00:00:00.000Z')
  })

  it('preserves the stored verdict when a later upsert omits risk fields (COALESCE)', () => {
    const store = new SkillsStore(db)
    store.upsert(skill({
      riskScore: 10,
      riskRecommendation: 'BLOCK',
      riskFindings: '[{"rule":"eval","severity":"high"}]',
      riskScannedAt: '2026-07-01T00:00:00.000Z',
    }))

    // Re-upsert without any risk_* fields (e.g. a plain content edit/re-import) —
    // must NOT wipe the existing verdict.
    store.upsert(skill({ description: 'updated desc', content: '# new body' }))

    const found = store.get('risky-skill')
    expect(found?.description).toBe('updated desc')
    expect(found?.riskScore).toBe(10)
    expect(found?.riskRecommendation).toBe('BLOCK')
    expect(found?.riskFindings).toBe('[{"rule":"eval","severity":"high"}]')
    expect(found?.riskScannedAt).toBe('2026-07-01T00:00:00.000Z')
  })
})
