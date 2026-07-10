/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { importSkills } from '../src/import-skills.js'

const tempDirs: string[] = []

function makeWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'import-skills-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

describe('importSkills()', () => {
  it('prefers .claude/skill over legacy .opencode/skill', () => {
    const workspace = makeWorkspace()

    const claudeSkillDir = path.join(workspace, '.claude', 'skill', 'test-foo')
    fs.mkdirSync(claudeSkillDir, { recursive: true })
    fs.writeFileSync(
      path.join(claudeSkillDir, 'SKILL.md'),
      `---\nname: test-foo\ndescription: Claude skill\n---\n# Test Foo\n`
    )

    const legacySkillDir = path.join(workspace, '.opencode', 'skill', 'legacy-foo')
    fs.mkdirSync(legacySkillDir, { recursive: true })
    fs.writeFileSync(
      path.join(legacySkillDir, 'SKILL.md'),
      `---\nname: legacy-foo\ndescription: Legacy skill\n---\n# Legacy Foo\n`
    )

    const result = importSkills(workspace)
    expect(result.skills).toBe(1)

    const db = new Database(path.join(workspace, '.codegraph', 'graph.db'))
    try {
      const skill = db.prepare('SELECT name, description, type FROM skills WHERE name = ?').get('test-foo') as
        | { name: string; description: string; type: string }
        | undefined
      expect(skill).toBeTruthy()
      expect(skill?.name).toBe('test-foo')
      expect(skill?.description).toBe('Claude skill')
      expect(skill?.type).toBe('domain')

      const legacySkill = db.prepare('SELECT name FROM skills WHERE name = ?').get('legacy-foo') as
        | { name: string }
        | undefined
      expect(legacySkill).toBeUndefined()
    } finally {
      db.close()
    }
  })

  it('--full prune deprecates skills removed from the bundle but protects System/Lifecycle', () => {
    const workspace = makeWorkspace()
    const writeSkill = (name: string, desc: string) => {
      const dir = path.join(workspace, '.claude', 'skill', name)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${desc}\n---\n# ${name}\n`)
    }
    writeSkill('foo', 'Foo skill')
    writeSkill('bar', 'Bar skill')
    importSkills(workspace)

    // Seed protected infra directly in the DB (not backed by files).
    const dbPath = path.join(workspace, '.codegraph', 'graph.db')
    const seed = new Database(dbPath)
    const now = new Date().toISOString()
    const ins = seed.prepare(
      `INSERT INTO skills (name, category, description, content, type, tags, lines, updated_at, status)
       VALUES (?, ?, ?, ?, ?, '[]', 1, ?, 'active')`,
    )
    ins.run('_routing-index', 'System', 'idx', '# idx', 'domain', now)
    ins.run('using-superpowers', 'Lifecycle', 'lc', '# lc', 'lifecycle', now)
    seed.close()

    // Remove bar from the bundle, then full-sync.
    fs.rmSync(path.join(workspace, '.claude', 'skill', 'bar'), { recursive: true, force: true })
    const result = importSkills(workspace, { prune: true })
    expect(result.pruned).toBe(1)

    const db = new Database(dbPath)
    try {
      const status = (n: string) => (db.prepare('SELECT status AS s FROM skills WHERE name = ?').get(n) as { s: string } | undefined)?.s
      expect(status('foo')).toBe('active')               // still in bundle
      expect(status('bar')).toBe('deprecated')           // removed → pruned
      expect(status('_routing-index')).toBe('active')    // System protected
      expect(status('using-superpowers')).toBe('active') // Lifecycle protected
    } finally {
      db.close()
    }
  })
})
