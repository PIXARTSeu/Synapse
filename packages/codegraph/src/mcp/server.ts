/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { openDb, closeDb } from '@skillbrain/storage'
import { GraphStore } from '@skillbrain/storage'
import { loadRegistry, getRegistryEntry } from '@skillbrain/storage'
import { loadMeta } from '@skillbrain/storage'
import { getHeadCommit } from '../utils/git.js'
import { registerAllTools } from './tools/index.js'

function resolveRepo(nameOrPath?: string): { path: string; name: string } | null {
  if (nameOrPath) {
    const entry = getRegistryEntry(nameOrPath)
    if (entry) return { path: entry.path, name: entry.name }
  }
  const entries = loadRegistry()
  if (entries.length === 1) return { path: entries[0].path, name: entries[0].name }
  return null
}

function withStore<T>(repoPath: string, fn: (store: GraphStore) => T): T {
  const db = openDb(repoPath)
  const store = new GraphStore(db)
  try {
    return fn(store)
  } finally {
    closeDb(db)
  }
}

function extractRepoName(uri: string): string | undefined {
  const match = uri.match(/codegraph:\/\/repo\/([^/]+)/)
  return match?.[1] ? decodeURIComponent(match[1]) : undefined
}

export interface CreateMcpServerOptions {
  /**
   * The authenticated user this MCP session is bound to.
   * Required for user-scoped tools (e.g. user_env_*).
   */
  userId?: string
  /** Server-wide Anthropic API key fallback — see ToolContext.anthropicApiKey (tools/index.ts). */
  anthropicApiKey?: string
}

export function createMcpServer(opts: CreateMcpServerOptions = {}): McpServer {
  const server = new McpServer({
    name: 'codegraph',
    version: '0.1.0',
  })

  // Register all domain tool modules
  registerAllTools(server, { userId: opts.userId, anthropicApiKey: opts.anthropicApiKey })

  // --- Resources ---
  server.resource('codegraph://repos', 'codegraph://repos', async () => {
    const entries = loadRegistry()
    return { contents: [{ uri: 'codegraph://repos', text: JSON.stringify(entries, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: repo context (overview + staleness)
  server.resource('codegraph://repo/context', 'codegraph://repo/{name}/context', async (uri) => {
    const name = extractRepoName(uri.toString())
    const resolved = resolveRepo(name)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: 'Repository not found', mimeType: 'text/plain' }] }

    const meta = loadMeta(resolved.path)
    const head = getHeadCommit(resolved.path)
    const isStale = head !== null && meta?.lastCommit !== head
    const stats = meta?.stats || { nodes: 0, edges: 0, files: 0, communities: 0, processes: 0 }

    const context = {
      name: resolved.name,
      path: resolved.path,
      indexedAt: meta?.indexedAt,
      isStale,
      headCommit: head?.slice(0, 7),
      indexedCommit: meta?.lastCommit?.slice(0, 7),
      ...stats,
    }

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(context, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: clusters (communities)
  server.resource('codegraph://repo/clusters', 'codegraph://repo/{name}/clusters', async (uri) => {
    const name = extractRepoName(uri.toString())
    const resolved = resolveRepo(name)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: '[]', mimeType: 'application/json' }] }

    const clusters = withStore(resolved.path, (store) => {
      const communities = store.getNodesByLabel('Community')
      return communities.map((c) => ({
        name: c.name,
        id: c.id,
        memberCount: c.properties?.memberCount || 0,
      }))
    })

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(clusters, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: processes
  server.resource('codegraph://repo/processes', 'codegraph://repo/{name}/processes', async (uri) => {
    const name = extractRepoName(uri.toString())
    const resolved = resolveRepo(name)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: '[]', mimeType: 'application/json' }] }

    const processes = withStore(resolved.path, (store) => {
      const procs = store.getNodesByLabel('Process')
      return procs.map((p) => ({
        name: p.name,
        id: p.id,
        entryPoint: p.properties?.entryPoint,
        stepCount: p.properties?.stepCount,
      }))
    })

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(processes, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: schema
  server.resource('codegraph://repo/schema', 'codegraph://repo/{name}/schema', async (uri) => {
    const schema = {
      nodeLabels: ['File', 'Function', 'Class', 'Method', 'Interface', 'Community', 'Process'],
      edgeTypes: ['CALLS', 'IMPORTS', 'EXTENDS', 'IMPLEMENTS', 'HAS_METHOD', 'MEMBER_OF', 'STEP_IN_PROCESS'],
      tables: {
        nodes: 'id TEXT PK, label TEXT, name TEXT, file_path TEXT, start_line INT, end_line INT, is_exported INT, properties JSON',
        edges: 'id TEXT PK, source_id TEXT FK, target_id TEXT FK, type TEXT, confidence REAL, reason TEXT, step INT',
        files: 'path TEXT PK, content_hash TEXT, indexed_at TEXT, symbol_count INT',
      },
      queryExamples: [
        "SELECT * FROM nodes WHERE label = 'Function' AND is_exported = 1",
        "SELECT n1.name AS caller, n2.name AS callee FROM edges e JOIN nodes n1 ON e.source_id = n1.id JOIN nodes n2 ON e.target_id = n2.id WHERE e.type = 'CALLS'",
        "SELECT n.name, e.step FROM nodes n JOIN edges e ON e.source_id = n.id WHERE e.target_id = '<process_id>' AND e.type = 'STEP_IN_PROCESS' ORDER BY e.step",
      ],
    }

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(schema, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: cluster detail
  server.resource('codegraph://repo/cluster', 'codegraph://repo/{name}/cluster/{cluster}', async (uri) => {
    const parts = uri.toString().split('/')
    const clusterName = decodeURIComponent(parts[parts.length - 1])
    const repoName = parts.length >= 5 ? parts[parts.length - 3] : undefined
    const resolved = resolveRepo(repoName)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: '[]', mimeType: 'application/json' }] }

    const members = withStore(resolved.path, (store) => {
      const communities = store.getNodesByLabel('Community')
      const community = communities.find((c) => c.name === clusterName)
      if (!community) return []
      return store.getCommunityMembers(community.id).map((m) => ({
        name: m.name,
        label: m.label,
        file: m.filePath,
      }))
    })

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(members, null, 2), mimeType: 'application/json' }] }
  })

  // Resource: process detail
  server.resource('codegraph://repo/process', 'codegraph://repo/{name}/process/{process}', async (uri) => {
    const parts = uri.toString().split('/')
    const processName = decodeURIComponent(parts[parts.length - 1])
    const repoName = parts.length >= 5 ? parts[parts.length - 3] : undefined
    const resolved = resolveRepo(repoName)
    if (!resolved) return { contents: [{ uri: uri.toString(), text: '[]', mimeType: 'application/json' }] }

    const steps = withStore(resolved.path, (store) => {
      const processes = store.getNodesByLabel('Process')
      const proc = processes.find((p) => p.name === processName)
      if (!proc) return []
      return store.getProcessSteps(proc.id).map((s) => ({
        step: s.step,
        name: s.name,
        label: s.label,
        file: s.filePath,
      }))
    })

    return { contents: [{ uri: uri.toString(), text: JSON.stringify(steps, null, 2), mimeType: 'application/json' }] }
  })

  return server
}

export async function startMcpServer(): Promise<void> {
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}
