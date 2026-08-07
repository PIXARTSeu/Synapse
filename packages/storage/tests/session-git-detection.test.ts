/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runMigrations } from '../src/migrator.js'
import { MemoryStore } from '../src/memory-store.js'

const TEST_KEY = 'c'.repeat(64)

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
}

/**
 * autoCloseStale() shells out to `git log` with the session's recorded
 * workspace_path as cwd. That path is caller-supplied, so it must be checked
 * against the trusted-workspace allowlist before any subprocess runs.
 */
describe('autoCloseStale git detection is confined to trusted workspaces', () => {
  let db: Database.Database
  let store: MemoryStore
  let tmp: string
  let repo: string
  const savedEnv = { ...process.env }

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY
    delete process.env.SKILLBRAIN_ROOT
    delete process.env.SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS

    db = new Database(':memory:')
    runMigrations(db)
    store = new MemoryStore(db)

    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'git-detect-'))
    repo = path.join(tmp, 'repo')
    fs.mkdirSync(repo, { recursive: true })
    git(repo, 'init', '-q')
    git(repo, 'config', 'user.email', 'test@example.com')
    git(repo, 'config', 'user.name', 'Test')
    fs.writeFileSync(path.join(repo, 'a.txt'), 'hello')
    git(repo, 'add', '.')
    git(repo, 'commit', '-q', '-m', 'feat: add a thing')
  })

  afterEach(() => {
    process.env = { ...savedEnv }
    db.close()
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  function staleSessionOn(workspacePath: string): string {
    const session = store.startSession('s', 'proj', workspacePath)
    const past = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    db.prepare('UPDATE session_log SET started_at = ?, last_heartbeat = NULL WHERE id = ?')
      .run(past, session.id)
    return session.id
  }

  function readSession(id: string): any {
    return db.prepare('SELECT status, work_type, commits FROM session_log WHERE id = ?').get(id)
  }

  it('skips git detection for a workspace outside every trusted root', () => {
    const id = staleSessionOn(repo)

    expect(store.autoCloseStale(30)).toBe(1)

    const row = readSession(id)
    // The session still auto-closes — only the git-derived fields are withheld.
    expect(row.status).toBe('paused')
    expect(row.work_type).toBeNull()
    expect(JSON.parse(row.commits)).toEqual([])
  })

  it('detects commits when the workspace is under a trusted root', () => {
    process.env.SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS = tmp
    const id = staleSessionOn(repo)

    expect(store.autoCloseStale(30)).toBe(1)

    const row = readSession(id)
    expect(row.status).toBe('paused')
    expect(row.work_type).toBe('feature')
    expect(JSON.parse(row.commits)).toHaveLength(1)
  })

  // Canary, not a regression test for a live hole: `git log` does not consult
  // core.fsmonitor (only index-refreshing commands do), so this passes with or
  // without the -c flag today. It exists so that if this call ever grows into a
  // command that *does* refresh the index, the hardening stays in place.
  it('leaves repo-local core.fsmonitor inert', () => {
    process.env.SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS = tmp
    const marker = path.join(tmp, 'fsmonitor-ran')
    git(repo, 'config', 'core.fsmonitor', `touch ${marker}`)

    const id = staleSessionOn(repo)
    store.autoCloseStale(30)

    expect(fs.existsSync(marker)).toBe(false)
    expect(readSession(id).status).toBe('paused')
  })
})
