/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../src/migrator.js'
import { SkillsStore } from '../src/skills-store.js'

function makeStore(): SkillsStore {
  const db = new Database(':memory:')
  runMigrations(db)
  return new SkillsStore(db)
}

describe('SkillsStore support files', () => {
  it('lists stored files by path with their byte size and reads one back', () => {
    const store = makeStore()
    store.replaceFiles('teach', [
      { path: 'references/b.md', content: 'bee', bytes: 3 },
      { path: 'A-FORMAT.md', content: '# A', bytes: 3 },
    ])

    expect(store.listFiles('teach')).toEqual([
      { path: 'A-FORMAT.md', bytes: 3 },
      { path: 'references/b.md', bytes: 3 },
    ])
    expect(store.getFile('teach', 'references/b.md')).toBe('bee')
    expect(store.getFile('teach', 'missing.md')).toBeUndefined()
    expect(store.listFiles('other-skill')).toEqual([])
  })

  it('replaces the whole file set of a skill on each call', () => {
    const store = makeStore()
    store.replaceFiles('teach', [
      { path: 'old.md', content: 'old', bytes: 3 },
      { path: 'kept.md', content: 'v1', bytes: 2 },
    ])
    store.replaceFiles('teach', [{ path: 'kept.md', content: 'v2', bytes: 2 }])

    expect(store.listFiles('teach')).toEqual([{ path: 'kept.md', bytes: 2 }])
    expect(store.getFile('teach', 'kept.md')).toBe('v2')

    store.replaceFiles('teach', [])
    expect(store.listFiles('teach')).toEqual([])
  })
})
