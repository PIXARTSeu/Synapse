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
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { isTrustedWorkspace, trustedWorkspaceRoots } from '../src/registry.js'

// The registry file lives under $HOME/.codegraph, so these tests drive trust
// through SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS / SKILLBRAIN_ROOT rather than
// writing to the developer's real registry.

describe('workspace trust allowlist', () => {
  let tmp: string
  let trusted: string
  let outside: string
  const savedEnv = { ...process.env }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ws-trust-'))
    trusted = path.join(tmp, 'trusted')
    outside = path.join(tmp, 'outside')
    fs.mkdirSync(path.join(trusted, 'nested', 'deep'), { recursive: true })
    fs.mkdirSync(outside, { recursive: true })
    delete process.env.SKILLBRAIN_ROOT
    process.env.SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS = trusted
  })

  afterEach(() => {
    process.env = { ...savedEnv }
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  it('trusts the root itself', () => {
    expect(isTrustedWorkspace(trusted)).toBe(true)
  })

  it('trusts directories nested under a trusted root', () => {
    expect(isTrustedWorkspace(path.join(trusted, 'nested', 'deep'))).toBe(true)
  })

  it('rejects a directory outside every trusted root', () => {
    expect(isTrustedWorkspace(outside)).toBe(false)
  })

  it('rejects empty, missing, and non-existent paths', () => {
    expect(isTrustedWorkspace(undefined)).toBe(false)
    expect(isTrustedWorkspace('')).toBe(false)
    expect(isTrustedWorkspace(path.join(tmp, 'does-not-exist'))).toBe(false)
  })

  it('rejects traversal that climbs back out of a trusted root', () => {
    expect(isTrustedWorkspace(path.join(trusted, '..', 'outside'))).toBe(false)
  })

  it('rejects a sibling whose name merely prefixes a trusted root', () => {
    const lookalike = `${trusted}-evil`
    fs.mkdirSync(lookalike, { recursive: true })
    expect(isTrustedWorkspace(lookalike)).toBe(false)
  })

  it('rejects a symlink inside a trusted root that points outside it', () => {
    const link = path.join(trusted, 'escape')
    fs.symlinkSync(outside, link, 'dir')
    expect(isTrustedWorkspace(link)).toBe(false)
  })

  it('picks up SKILLBRAIN_ROOT as a trusted root', () => {
    delete process.env.SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS
    process.env.SKILLBRAIN_ROOT = outside
    expect(trustedWorkspaceRoots()).toContain(outside)
    expect(isTrustedWorkspace(outside)).toBe(true)
  })

  it('supports multiple path-separated roots', () => {
    process.env.SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS = [trusted, outside].join(path.delimiter)
    expect(isTrustedWorkspace(trusted)).toBe(true)
    expect(isTrustedWorkspace(outside)).toBe(true)
  })
})
