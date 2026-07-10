/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

// Behaviour added by the skill-system audit fixes:
//  - route() excludes agent/command/lifecycle types + _routing-index
//  - get() falls back to agent:/command: prefixes for a bare name
//  - deadSkills() excludes protected System/Lifecycle categories

import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runMigrations } from '../src/migrator.js'
import { SkillsStore, type SkillType } from '../src/skills-store.js'

function makeDb(): Database.Database {
  const db = new Database(':memory:')
  runMigrations(db)
  return db
}

const skill = (over: Partial<Record<string, unknown>> & { name: string; type?: SkillType; category?: string; content?: string }): any => ({
  category: 'Backend',
  description: 'desc',
  content: '# body',
  type: 'domain',
  tags: [],
  lines: 1,
  updatedAt: new Date().toISOString(),
  ...over,
})

describe('route(): non-task skills are excluded from recommendations', () => {
  let db: Database.Database
  beforeEach(() => { db = makeDb() })
  afterEach(() => { db.close() })

  it('keeps domain/process matches, drops agent/command/lifecycle and _routing-index', () => {
    const store = new SkillsStore(db)
    const body = '# nextjs app router server components tailwind'
    store.upsert(skill({ name: 'nextjs-domain', type: 'domain', category: 'Frontend', content: body }))
    store.upsert(skill({ name: 'nextjs-process', type: 'process', category: 'Process', content: body }))
    store.upsert(skill({ name: 'using-superpowers', type: 'lifecycle', category: 'Lifecycle', content: body }))
    store.upsert(skill({ name: 'agent:nextjs-agent', type: 'agent', category: 'Agents', content: body }))
    store.upsert(skill({ name: 'command:nextjs-cmd', type: 'command', category: 'Commands', content: body }))
    store.upsert(skill({ name: '_routing-index', type: 'domain', category: 'System', content: body }))

    const names = store.route('nextjs app router server components', 10).map((s) => s.name)

    expect(names).toContain('nextjs-domain')
    expect(names).toContain('nextjs-process')
    expect(names).not.toContain('using-superpowers')
    expect(names).not.toContain('agent:nextjs-agent')
    expect(names).not.toContain('command:nextjs-cmd')
    expect(names).not.toContain('_routing-index')
  })
})

describe('get(): agent:/command: prefix fallback', () => {
  let db: Database.Database
  beforeEach(() => { db = makeDb() })
  afterEach(() => { db.close() })

  it('resolves a bare name to a prefixed entry when there is no exact match', () => {
    const store = new SkillsStore(db)
    store.upsert(skill({ name: 'agent:planner', type: 'agent', category: 'Agents' }))
    store.upsert(skill({ name: 'command:frontend', type: 'command', category: 'Commands' }))

    expect(store.get('planner')?.name).toBe('agent:planner')
    expect(store.get('frontend')?.name).toBe('command:frontend')
    expect(store.get('nope')).toBeUndefined()
  })

  it('prefers an exact match over the prefixed fallback', () => {
    const store = new SkillsStore(db)
    store.upsert(skill({ name: 'builder', type: 'domain', category: 'Backend' }))
    store.upsert(skill({ name: 'agent:builder', type: 'agent', category: 'Agents' }))

    expect(store.get('builder')?.type).toBe('domain')
    expect(store.get('agent:builder')?.type).toBe('agent')
  })
})

describe('deadSkills(): protected categories are never flagged dead', () => {
  let db: Database.Database
  beforeEach(() => { db = makeDb() })
  afterEach(() => { db.close() })

  it('excludes System and Lifecycle skills even with zero usage', () => {
    const store = new SkillsStore(db)
    store.upsert(skill({ name: 'lonely-domain', type: 'domain', category: 'Backend' }))
    store.upsert(skill({ name: '_routing-index', type: 'domain', category: 'System' }))
    store.upsert(skill({ name: 'using-superpowers', type: 'lifecycle', category: 'Lifecycle' }))

    const dead = store.deadSkills(30, 20).map((r) => r.skillName)

    expect(dead).toContain('lonely-domain')
    expect(dead).not.toContain('_routing-index')
    expect(dead).not.toContain('using-superpowers')
  })
})
