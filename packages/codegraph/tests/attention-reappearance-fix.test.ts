/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

// Regression tests for the "Needs attention items keep reappearing" bug cluster.
// See the root-cause analysis: approve didn't reset staleness (memories bounced back
// to pending-review every decay cycle), skill upsert wiped autolearning state, and
// session_end re-created duplicate skill_proposals forever.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDb, closeDb, runMigrations, MemoryStore, SkillsStore } from '@skillbrain/storage'
import type Database from 'better-sqlite3'

describe('attention reappearance fixes', () => {
  let dir: string
  let db: Database.Database

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'sb-reappear-'))
    db = openDb(dir)
    runMigrations(db)
  })

  afterEach(() => {
    closeDb(db)
    rmSync(dir, { recursive: true, force: true })
  })

  // The exact SQL the dashboard approve endpoint runs (review.ts).
  const approveMemory = (id: string) => {
    const now = new Date().toISOString()
    db.prepare(
      `UPDATE memories SET status = 'active', sessions_since_validation = 0, last_validated = ?, updated_at = ? WHERE id = ?`
    ).run(now, now, id)
  }

  describe('FIX 1.1 — approve resets staleness so the memory does not bounce back', () => {
    it('an approved memory stays active across the next decay cycle', () => {
      const store = new MemoryStore(db)
      const m = store.add({ type: 'Pattern', context: 'bounce', problem: '', solution: 'sol', reason: '', tags: [] })
      // Simulate decay having pushed it past the pending-review threshold.
      db.prepare("UPDATE memories SET status = 'pending-review', sessions_since_validation = 15 WHERE id = ?").run(m.id)

      approveMemory(m.id)
      expect(store.get(m.id)!.status).toBe('active')
      expect(store.get(m.id)!.sessionsSinceValidation).toBe(0)

      // Next 24h auto-decay cycle (no validated ids).
      store.applyDecay([], new Date().toISOString().split('T')[0])

      // The fix: counter is now 1, well below 15, so it is NOT re-flagged.
      expect(store.get(m.id)!.status).toBe('active')
    })

    it('WITHOUT the staleness reset the memory bounces straight back (proves the bug)', () => {
      const store = new MemoryStore(db)
      const m = store.add({ type: 'Pattern', context: 'bug', problem: '', solution: 'sol', reason: '', tags: [] })
      db.prepare("UPDATE memories SET status = 'pending-review', sessions_since_validation = 15 WHERE id = ?").run(m.id)

      // Old approve behaviour: flip status only, leave ssv untouched.
      db.prepare("UPDATE memories SET status = 'active', updated_at = ? WHERE id = ?").run(new Date().toISOString(), m.id)
      store.applyDecay([], new Date().toISOString().split('T')[0])

      // ssv went 15 -> 16, markPendingReview re-flagged it.
      expect(store.get(m.id)!.status).toBe('pending-review')
    })
  })

  describe('FIX 2.2 — manual reinforce', () => {
    it('bumps confidence +1 and resets the staleness counter', () => {
      const store = new MemoryStore(db)
      const m = store.add({ type: 'Pattern', context: 'reinf', problem: '', solution: 'sol', reason: '', tags: [], confidence: 2 })
      db.prepare('UPDATE memories SET sessions_since_validation = 20 WHERE id = ?').run(m.id)

      expect(store.reinforce(m.id, 'tester')).toBe(true)
      const after = store.get(m.id)!
      expect(after.confidence).toBe(3)
      expect(after.sessionsSinceValidation).toBe(0)
    })

    it('returns false for an unknown id', () => {
      const store = new MemoryStore(db)
      expect(store.reinforce('M-does-not-exist')).toBe(false)
    })
  })

  describe('FIX 3.1/3.2 — skill upsert preserves autolearning state and status on replace', () => {
    const baseSkill = (over: Record<string, unknown> = {}) => ({
      name: 'nextjs', category: 'frontend', description: 'desc', content: '# c',
      type: 'domain' as const, tags: [] as string[], lines: 1,
      updatedAt: new Date().toISOString(),
      ...over,
    })

    it('keeps confidence/usage/useful/ssv/last_validated across a metadata re-upsert', () => {
      const store = new SkillsStore(db)
      store.upsert(baseSkill({ status: 'active' }) as any)
      const ts = new Date().toISOString()
      db.prepare(
        `UPDATE skills SET confidence = 9, usage_count = 42, useful_count = 7, sessions_since_validation = 3, last_validated = ? WHERE name = 'nextjs'`
      ).run(ts)

      // Re-upsert with NO autolearning fields (dashboard edit / re-import shape).
      store.upsert(baseSkill({ status: 'active', category: 'web', content: '# new', lines: 2 }) as any)

      const row = db.prepare('SELECT * FROM skills WHERE name = ?').get('nextjs') as any
      expect(row.confidence).toBe(9)
      expect(row.usage_count).toBe(42)
      expect(row.useful_count).toBe(7)
      expect(row.sessions_since_validation).toBe(3)
      expect(row.last_validated).toBe(ts)
      // ...while the metadata the caller DID pass is updated.
      expect(row.category).toBe('web')
      expect(row.content).toBe('# new')
    })

    it('re-import (no status passed) preserves a deprecated skill instead of resurrecting it', () => {
      const store = new SkillsStore(db)
      store.upsert(baseSkill({ status: 'active' }) as any)
      db.prepare("UPDATE skills SET status = 'deprecated' WHERE name = 'nextjs'").run()

      // importSkills builds Skill objects WITHOUT a status field.
      store.upsert(baseSkill() as any)

      const row = db.prepare('SELECT status FROM skills WHERE name = ?').get('nextjs') as any
      expect(row.status).toBe('deprecated')
    })

    it('a brand-new skill with no status still defaults to active', () => {
      const store = new SkillsStore(db)
      store.upsert(baseSkill({ name: 'fresh-skill' }) as any)
      const row = db.prepare('SELECT status FROM skills WHERE name = ?').get('fresh-skill') as any
      expect(row.status).toBe('active')
    })
  })

  describe('FIX 1.3 — skill_proposals dedup (migration 034)', () => {
    it('creates a partial unique index on open proposals', () => {
      const idx = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_skill_proposals_open'"
      ).get()
      expect(idx).toBeTruthy()
    })

    it('INSERT OR IGNORE dedups a second OPEN proposal for the same skill', () => {
      const ins = (id: string, sid: string) =>
        db.prepare(
          `INSERT OR IGNORE INTO skill_proposals (id, skill_name, session_id, memory_ids) VALUES (?, ?, ?, '[]')`
        ).run(id, 'nextjs', sid)

      expect(ins('SP-1', 's1').changes).toBe(1)
      expect(ins('SP-2', 's2').changes).toBe(0) // deduped — already an open proposal

      const open = db.prepare(
        "SELECT COUNT(*) AS n FROM skill_proposals WHERE skill_name = 'nextjs' AND status = 'pending'"
      ).get() as { n: number }
      expect(open.n).toBe(1)

      // Once the open one is actioned, a fresh proposal is allowed again.
      db.prepare("UPDATE skill_proposals SET status = 'dismissed' WHERE id = 'SP-1'").run()
      expect(ins('SP-3', 's3').changes).toBe(1)
    })
  })
})
