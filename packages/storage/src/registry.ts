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
import path from 'node:path'
import os from 'node:os'
import type { RepoMeta } from './types/graph.js'

const REGISTRY_DIR = path.join(os.homedir(), '.codegraph')
const REGISTRY_FILE = path.join(REGISTRY_DIR, 'registry.json')

export interface RegistryEntry {
  name: string
  path: string
  lastCommit: string | null
  indexedAt: string
  stats: {
    nodes: number
    edges: number
    files: number
    communities: number
    processes: number
  }
}

function ensureDir(): void {
  if (!fs.existsSync(REGISTRY_DIR)) {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true })
  }
}

export function loadRegistry(): RegistryEntry[] {
  ensureDir()
  if (!fs.existsSync(REGISTRY_FILE)) return []
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'))
  } catch {
    return []
  }
}

export function saveRegistry(entries: RegistryEntry[]): void {
  ensureDir()
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(entries, null, 2))
}

export function upsertRegistry(entry: RegistryEntry): void {
  const entries = loadRegistry()
  const idx = entries.findIndex((e) => e.path === entry.path)
  if (idx >= 0) {
    entries[idx] = entry
  } else {
    entries.push(entry)
  }
  saveRegistry(entries)
}

export function removeFromRegistry(repoPath: string): void {
  const entries = loadRegistry().filter((e) => e.path !== repoPath)
  saveRegistry(entries)
}

export function getRegistryEntry(nameOrPath: string): RegistryEntry | undefined {
  const entries = loadRegistry()
  return entries.find((e) => e.name === nameOrPath || e.path === nameOrPath)
}

// ── Workspace trust ────────────────────────────────────
//
// `workspace_path` on a session row is whatever session_start recorded — an
// unvalidated string chosen by the caller (i.e. by the model). Any code that
// shells out with that value as `cwd` must first check it against this
// allowlist: running a subprocess inside an arbitrary directory is enough to
// hand over control, because tools like git read configuration from the
// directory they run in (core.fsmonitor et al).
//
// Trusted roots = registered repos + SKILLBRAIN_ROOT, plus anything the
// operator opts into via SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS (path-separated).

function resolveReal(p: string): string | null {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

export function trustedWorkspaceRoots(): string[] {
  const roots = loadRegistry().map((e) => e.path)
  if (process.env.SKILLBRAIN_ROOT) roots.push(process.env.SKILLBRAIN_ROOT)
  const extra = process.env.SKILLBRAIN_TRUSTED_WORKSPACE_ROOTS
  if (extra) roots.push(...extra.split(path.delimiter).filter(Boolean))
  return Array.from(new Set(roots))
}

/**
 * True when `candidate` resolves to a trusted root or a directory beneath one.
 * Both sides are realpath'd first so a symlink planted inside a trusted root
 * cannot point the subprocess somewhere else.
 */
export function isTrustedWorkspace(candidate: string | undefined | null): boolean {
  if (!candidate) return false
  const real = resolveReal(candidate)
  if (!real) return false

  for (const root of trustedWorkspaceRoots()) {
    const realRoot = resolveReal(root)
    if (!realRoot) continue
    if (real === realRoot || real.startsWith(realRoot + path.sep)) return true
  }
  return false
}
