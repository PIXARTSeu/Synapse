/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { z } from 'zod'
import Anthropic from '@anthropic-ai/sdk'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { openDb, closeDb } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'
import { SkillsStore, ConcurrencyError } from '@skillbrain/storage'
import type { Skill } from '@skillbrain/storage'
import { getRegistryEntry, loadRegistry } from '@skillbrain/storage'
import { applyGate } from '@skillbrain/storage'
import { UsersEnvStore } from '@skillbrain/storage'
import { dashboardUrl } from '../../constants.js'
import type { ToolContext } from './index.js'
import { resolveScanTarget, runSkillScan } from './skill-scan.js'

const MEMORY_REPO_NAME = process.env.SKILLBRAIN_MEMORY_REPO || 'skillbrain'
const SKILLBRAIN_ROOT = process.env.SKILLBRAIN_ROOT || ''

function resolveMemoryRepo(nameOrPath?: string): { path: string; name: string } | null {
  if (nameOrPath) {
    const entry = getRegistryEntry(nameOrPath)
    if (entry) return { path: entry.path, name: entry.name }
  }
  const entry = getRegistryEntry(MEMORY_REPO_NAME)
  if (entry) return { path: entry.path, name: entry.name }
  const entries = loadRegistry()
  if (entries.length === 1) return { path: entries[0].path, name: entries[0].name }
  if (SKILLBRAIN_ROOT) return { path: SKILLBRAIN_ROOT, name: 'skillbrain' }
  return null
}

function withSkillsStore<T>(repoPath: string, fn: (store: SkillsStore) => T): T {
  const db = openDb(repoPath)
  const store = new SkillsStore(db)
  try {
    return fn(store)
  } finally {
    closeDb(db)
  }
}

// Async sibling of withSkillsStore — used only by skill_add/skill_update
// (Task 7), which need to `await applyGate(...)` (security-gate scan)
// in between reading the existing row and writing the upserted one.
async function withSkillsStoreAsync<T>(repoPath: string, fn: (store: SkillsStore) => Promise<T>): Promise<T> {
  const db = openDb(repoPath)
  const store = new SkillsStore(db)
  try {
    return await fn(store)
  } finally {
    closeDb(db)
  }
}

// Renders the top 3 findings from a gate verdict's risk_findings JSON for the
// tool response text — so a BLOCK'd skill_add/skill_update tells the caller
// *why*, not just that it happened.
function formatTopFindings(riskFindings: string | undefined, limit = 3): string {
  try {
    const findings = JSON.parse(riskFindings ?? '[]') as { severity: string; message: string; line?: number }[]
    return findings
      .slice(0, limit)
      .map((f) => `- [${f.severity}] ${f.message}${f.line ? ` (line ${f.line})` : ''}`)
      .join('\n')
  } catch {
    return ''
  }
}

const skillTypes = ['domain', 'lifecycle', 'process', 'agent', 'command'] as const

// Resolves an Anthropic API key for skill_scan's optional LLM judge layer
// (Task 8). Precedence mirrors http-server.ts's resolveCredentials():
// per-user key (UsersEnvStore) first, then the server-wide fallback
// (ctx.anthropicApiKey, set from process.env.ANTHROPIC_API_KEY). Returns
// null (never throws) when neither resolves — callers fall back to
// static-only rather than erroring.
function resolveAnthropicKey(ctx: ToolContext, repoPath: string): string | null {
  if (ctx.userId) {
    try {
      const db = openDb(repoPath)
      try {
        const userKey = new UsersEnvStore(db).getEnv(ctx.userId, 'ANTHROPIC_API_KEY')
        if (userKey) return userKey
      } finally {
        closeDb(db)
      }
    } catch {
      // Encryption unavailable, no entry, or DB error — fall through to server key.
    }
  }
  return ctx.anthropicApiKey || null
}

// LLM completion callback for skill_scan's optional judge layer — wraps the
// Anthropic client the same way review.ts's generate-proposal route does
// (review.ts:183-184): `new Anthropic({ apiKey })`, then a single
// messages.create() call, returning the text block.
function makeAnthropicComplete(apiKey: string): (prompt: string) => Promise<string> {
  const client = new Anthropic({ apiKey })
  return async (prompt: string) => {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    return block && block.type === 'text' ? block.text : ''
  }
}

export function registerSkillTools(server: McpServer, ctx: ToolContext): void {
  // --- Tool: skill_list ---
  server.tool(
    'skill_list',
    'List all available skills, optionally filtered by type or category',
    {
      type: z.enum(skillTypes).optional().describe('Filter: domain, lifecycle, process, agent, command'),
      category: z.string().optional().describe('Filter by category name'),
      repo: z.string().optional(),
    },
    async ({ type, category, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const skills = withSkillsStore(resolved.path, (store) => store.list(type, category))
      const formatted = skills.map((s) => ({
        name: s.name, category: s.category, type: s.type,
        description: s.description.slice(0, 120), lines: s.lines,
      }))

      return { content: [{ type: 'text', text: `${formatted.length} skills found:\n\n${JSON.stringify(formatted, null, 2)}` }] }
    },
  )

  // --- Tool: skill_read ---
  server.tool(
    'skill_read',
    'Read the full content of a skill, agent, or command by name',
    {
      name: z.string().describe('Skill name (e.g., "nextjs", "agent:builder", "command:frontend")'),
      project: z.string().optional().describe('Current project (for telemetry)'),
      sessionId: z.string().optional().describe('Synapse session id (for telemetry, if known)'),
      task: z.string().optional().describe('Task this skill is being loaded for (for telemetry)'),
      repo: z.string().optional(),
    },
    async ({ name, project, sessionId, task, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const skill = withSkillsStore(resolved.path, (store) => {
        const s = store.get(name)
        if (s) store.recordUsage(s.name, 'loaded', { sessionId, project, task, userId: ctx.userId })
        return s
      })
      if (!skill) return { content: [{ type: 'text', text: `Skill "${name}" not found. Use skill_list to see available skills.` }] }

      return {
        content: [{
          type: 'text',
          text: `# ${skill.name} (${skill.type}, ${skill.category})\n\n${skill.content}`,
        }],
      }
    },
  )

  // --- Tool: skill_update ---
  server.tool(
    'skill_update',
    'Update the content of an existing skill in the database. Use after generating an improved version based on recent learnings.',
    {
      name: z.string().describe('Skill name (must exist — use skill_list to verify)'),
      content: z.string().describe('Full updated SKILL.md content (complete replacement)'),
      reason: z.string().optional().describe('Why this update was made'),
      draft: z.boolean().optional().default(false).describe('If true, stores as pending for dashboard approval instead of going live immediately'),
      expectedUpdatedAt: z.string().optional().describe('Optimistic lock: pass the skill\'s current updatedAt to detect concurrent edits'),
      repo: z.string().optional(),
    },
    async ({ name, content, reason, draft, expectedUpdatedAt, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      try {
        const result = await withSkillsStoreAsync(resolved.path, async (store) => {
          const existing = store.get(name)
          if (!existing) return null
          // Security gate (Task 7, static-only — no `llm` opt passed here; see
          // packages/storage/src/skill-gate.ts). A BLOCK verdict forces
          // status='pending' regardless of the `draft` flag the caller passed.
          const gated = await applyGate<Skill>({
            ...existing,
            content,
            lines: content.split('\n').length,
            updatedAt: new Date().toISOString(),
            status: draft ? 'pending' : 'active',
          })
          store.upsert(gated, { reason: reason ?? 'manual', expectedUpdatedAt })
          return gated
        })

        if (!result) {
          return { content: [{ type: 'text', text: `Skill "${name}" not found. Use skill_list to see available skills.` }] }
        }

        const quarantined = result.riskRecommendation === 'BLOCK'
        const text = quarantined
          ? `🛑 Skill "${name}" was quarantined to pending — the security gate flagged this update as BLOCK (risk score ${result.riskScore}). It will NOT go live until reviewed and approved at ${dashboardUrl()}/#/review.\nTop findings:\n${formatTopFindings(result.riskFindings)}`
          : result.status === 'pending'
            ? `⏳ Skill "${name}" queued for review — approve at ${dashboardUrl()}/#/review${reason ? `. Reason: ${reason}` : ''}`
            : `Skill "${name}" updated successfully.${reason ? ` Reason: ${reason}` : ''}`

        return { content: [{ type: 'text', text }] }
      } catch (err) {
        if (err instanceof ConcurrencyError) {
          return { content: [{ type: 'text', text: `⚠️ ${err.message}` }] }
        }
        throw err
      }
    },
  )

  // --- Tool: skill_add ---
  server.tool(
    'skill_add',
    'Add a new skill to the database. Stores as pending draft by default — requires approval in dashboard.',
    {
      name: z.string().describe('Skill name (unique, kebab-case, e.g. "nextjs-app-router")'),
      category: z.string().describe('Category (e.g. "frontend", "backend", "devops")'),
      description: z.string().describe('One-line description of what this skill covers'),
      content: z.string().describe('Full SKILL.md content'),
      type: z.enum(['domain', 'lifecycle', 'process', 'agent', 'command']),
      tags: z.array(z.string()).describe('Searchable tags'),
      draft: z.boolean().optional().default(true).describe('If true (default), stores as pending for review. Set false to go live immediately.'),
      repo: z.string().optional(),
    },
    async ({ name, category, description, content, type, tags, draft, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      // Security gate (Task 7, static-only — no `llm` opt passed here; see
      // packages/storage/src/skill-gate.ts). A BLOCK verdict forces
      // status='pending' regardless of the `draft` flag the caller passed.
      const gated = await applyGate<Skill>({
        name, category, description, content, type, tags,
        lines: content.split('\n').length,
        updatedAt: new Date().toISOString(),
        status: draft ? 'pending' : 'active',
      })

      withSkillsStore(resolved.path, (store) => {
        store.upsert(gated, { reason: 'manual' })
      })

      const quarantined = gated.riskRecommendation === 'BLOCK'

      return {
        content: [{
          type: 'text',
          text: quarantined
            ? `🛑 Skill "${name}" was quarantined to pending — the security gate flagged this content as BLOCK (risk score ${gated.riskScore}). It will NOT go live until reviewed and approved at ${dashboardUrl()}/#/review.\nTop findings:\n${formatTopFindings(gated.riskFindings)}`
            : gated.status === 'pending'
              ? `⏳ Skill "${name}" created as draft — approve at ${dashboardUrl()}/#/review`
              : `✅ Skill "${name}" created and active.`,
        }],
      }
    },
  )

  // --- Tool: skill_scan ---
  // On-demand counterpart to the ingestion gate (applyGate, Task 7). That
  // write-path gate is static-only by design (see skill-gate.ts's rationale —
  // no per-request LLM latency/cost on every skill_add/skill_update). Here,
  // on-demand, the optional LLM judge layer built in Task 5
  // (@skillbrain/skill-guard's scanLlm) is actually exposed via `llm: true`.
  server.tool(
    'skill_scan',
    'Run an on-demand security scan of a skill (by name or raw content) using the skill-guard static scanner. Set llm:true to also run the optional LLM judge layer (only runs if an Anthropic API key is available — silently falls back to static-only otherwise).',
    {
      name: z.string().optional().describe('Name of an existing skill to scan (loads its content via the same store as skill_read)'),
      content: z.string().optional().describe('Raw skill/text content to scan — used when "name" is not given'),
      llm: z.boolean().optional().default(false).describe('Also run the optional LLM judge layer, if an Anthropic API key resolves for this user/server'),
      repo: z.string().optional(),
    },
    async ({ name, content, llm, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const scanTarget = resolveScanTarget({ name, content }, (n) =>
        withSkillsStore(resolved.path, (store) => store.get(n)?.content),
      )
      if ('error' in scanTarget) {
        return { content: [{ type: 'text', text: scanTarget.error }] }
      }

      let complete: ((prompt: string) => Promise<string>) | undefined
      if (llm) {
        const apiKey = resolveAnthropicKey(ctx, resolved.path)
        if (apiKey) complete = makeAnthropicComplete(apiKey)
        // No key resolved: `complete` stays undefined → runSkillScan() runs
        // static-only and formatScanReport() notes "requested but skipped".
      }

      const { text } = await runSkillScan(scanTarget.target, { complete, llmRequested: !!llm })
      return { content: [{ type: 'text', text }] }
    },
  )

  // --- Tool: skill_route ---
  server.tool(
    'skill_route',
    'Given a task description, find the best skills to load (semantic search)',
    {
      task: z.string().describe('What you want to do (e.g., "add stripe payments", "fix auth bug")'),
      limit: z.number().optional().default(5),
      project: z.string().optional().describe('Current project (for telemetry)'),
      sessionId: z.string().optional().describe('Synapse session id (for telemetry, if known)'),
      repo: z.string().optional(),
    },
    async ({ task, limit, project, sessionId, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const skills = withSkillsStore(resolved.path, (store) => {
        const results = store.route(task, limit, [], project)
        for (const s of results) {
          store.recordUsage(s.name, 'routed', { sessionId, project, task, userId: ctx.userId })
        }
        return results
      })
      const formatted = skills.map((s) => ({
        name: s.name, category: s.category, type: s.type,
        description: s.description.slice(0, 150), lines: s.lines,
      }))

      return {
        content: [{
          type: 'text',
          text: `Recommended skills for "${task}":\n\n${JSON.stringify(formatted, null, 2)}\n\nUse skill_read to load any skill.`,
        }],
      }
    },
  )

  // --- Tool: skill_dismiss ---
  server.tool(
    'skill_dismiss',
    'Record that a routed skill was not useful for this task. Helps improve future routing.',
    {
      name: z.string().describe('Skill name to dismiss'),
      task: z.string().optional().describe('Task description for context'),
      sessionId: z.string().optional(),
      project: z.string().optional(),
      repo: z.string().optional(),
    },
    async ({ name, task, sessionId, project, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      withSkillsStore(resolved.path, (store) => {
        store.recordUsage(name, 'dismissed', { sessionId, project, task, userId: ctx.userId })
      })

      return { content: [{ type: 'text', text: `Noted: "${name}" dismissed for this task.` }] }
    },
  )

  // --- Tool: skill_apply ---
  server.tool(
    'skill_apply',
    'Record that a loaded skill was actually applied and useful for the current task. Call this after following guidance from a skill to improve future routing.',
    {
      name: z.string().describe('Skill name that was applied'),
      sessionId: z.string().optional(),
      project: z.string().optional(),
      task: z.string().optional().describe('Task description for context'),
      repo: z.string().optional(),
    },
    async ({ name, sessionId, project, task, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      withSkillsStore(resolved.path, (store) => {
        store.recordUsage(name, 'applied', { sessionId, project, task, userId: ctx.userId })
      })

      return { content: [{ type: 'text', text: `Recorded: "${name}" applied successfully.` }] }
    },
  )

  // --- Tool: agent_list ---
  server.tool(
    'agent_list',
    'List all available agents with their model, effort level, and purpose',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const agents = withSkillsStore(resolved.path, (store) => store.list('agent'))
      const formatted = agents.map((a) => ({
        name: a.name.replace('agent:', ''),
        description: a.description.slice(0, 120),
        lines: a.lines,
      }))

      return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
    },
  )

  // --- Tool: agent_read ---
  server.tool(
    'agent_read',
    'Read the full prompt of an agent',
    {
      name: z.string().describe('Agent name (e.g., "builder", "planner", "ux-designer")'),
      repo: z.string().optional(),
    },
    async ({ name, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const agentName = name.startsWith('agent:') ? name : `agent:${name}`
      const agent = withSkillsStore(resolved.path, (store) => store.get(agentName))
      if (!agent) return { content: [{ type: 'text', text: `Agent "${name}" not found. Use agent_list.` }] }

      return { content: [{ type: 'text', text: agent.content }] }
    },
  )

  // --- Tool: command_list ---
  server.tool(
    'command_list',
    'List all available slash commands',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const commands = withSkillsStore(resolved.path, (store) => store.list('command'))
      const formatted = commands.map((c) => ({
        name: '/' + c.name.replace('command:', ''),
        description: c.description,
        lines: c.lines,
      }))

      return { content: [{ type: 'text', text: JSON.stringify(formatted, null, 2) }] }
    },
  )

  // --- Tool: command_read ---
  server.tool(
    'command_read',
    'Read the full content of a slash command',
    {
      name: z.string().describe('Command name (e.g., "frontend", "audit", "new-project")'),
      repo: z.string().optional(),
    },
    async ({ name, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const cmdName = name.startsWith('command:') ? name : `command:${name}`
      const cmd = withSkillsStore(resolved.path, (store) => store.get(cmdName))
      if (!cmd) return { content: [{ type: 'text', text: `Command "${name}" not found. Use command_list.` }] }

      return { content: [{ type: 'text', text: cmd.content }] }
    },
  )

  // --- Tool: cortex_briefing ---
  server.tool(
    'cortex_briefing',
    'Generate a 5-layer working memory briefing for the current session context',
    {
      project: z.string().optional().describe('Current project name'),
      task: z.string().optional().describe('What you are about to work on'),
      sessionId: z.string().optional().describe('Synapse session id (for telemetry, if known)'),
      repo: z.string().optional(),
    },
    async ({ project, task, sessionId, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const db = openDb(resolved.path)
      const memStore = new MemoryStore(db)
      const skillStore = new SkillsStore(db)

      // Layer 1: Identity
      const skillStats = skillStore.stats()

      // Layer 2: Recent sessions
      const sessions = memStore.recentSessions(5)

      // Layer 3: Memory stats
      const memStats = memStore.stats()
      const contradictions = memStore.getContradictions()

      // Layer 4: Unified Context Pack — memories + skills ranked together
      type ContextItem = { kind: 'memory' | 'skill'; score: number; line: string }
      const contextPack: ContextItem[] = []

      // Collect skill-tagged memories for cross-pollination boosts (skill:X tags → +0.3 to skill X)
      const skillTagBoosts = new Map<string, number>()

      if (task) {
        const memResults = memStore.search(task, 15)
        const maxMemRank = memResults.length > 0 ? Math.max(...memResults.map((r) => r.rank)) : 1
        for (const r of memResults) {
          const normBm25 = r.rank / (maxMemRank || 1)
          const score = r.memory.confidence * 0.5 + normBm25 * 0.5
          contextPack.push({
            kind: 'memory', score,
            line: `[memory:${r.memory.type} conf:${r.memory.confidence}] ${r.memory.context.slice(0, 120)}`,
          })
          // Extract skill:X tags for cross-pollination
          for (const tag of (r.memory.tags ?? [])) {
            if (tag.startsWith('skill:')) {
              const skillName = tag.slice(6)
              skillTagBoosts.set(skillName, (skillTagBoosts.get(skillName) ?? 0) + 0.3)
            }
          }
        }

        const routed = skillStore.route(task, 15, [], project)
        for (const s of routed) {
          skillStore.recordUsage(s.name, 'routed', { sessionId, project, task, userId: ctx.userId })
        }
        for (const s of routed) {
          const tagBoost = Math.min(skillTagBoosts.get(s.name) ?? 0, 0.3)
          contextPack.push({
            kind: 'skill', score: 0.5 + tagBoost,
            line: `[skill:${s.category}] **${s.name}**: ${s.description.slice(0, 100)}`,
          })
        }
      } else {
        const memResults = memStore.scored(project, undefined, 10)
        const maxRank = memResults.length > 0 ? Math.max(...memResults.map((r) => r.rank)) : 1
        for (const r of memResults) {
          const score = r.rank / (maxRank || 1)
          contextPack.push({
            kind: 'memory', score,
            line: `[memory:${r.memory.type} conf:${r.memory.confidence}] ${r.memory.context.slice(0, 120)}`,
          })
        }
      }

      contextPack.sort((a, b) => b.score - a.score)
      const top10 = contextPack.slice(0, 10)

      closeDb(db)

      const briefing = [
        `## Cortex Briefing`,
        ``,
        `### Layer 1: System`,
        `- Skills: ${skillStats.total} (${Object.entries(skillStats.byType).map(([t, c]) => `${t}: ${c}`).join(', ')})`,
        `- Memories: ${memStats.total} active, ${memStats.edges} edges`,
        `- Contradictions: ${contradictions.length}`,
        ``,
        `### Layer 2: Recent Sessions`,
        sessions.length > 0
          ? sessions.map((s) => `- **${s.sessionName}** (${s.startedAt.split('T')[0]}): ${s.summary || 'no summary'} [+${s.memoriesCreated} memories]`).join('\n')
          : '- No session history yet',
        ``,
        `### Layer 3: Project Context`,
        `- Project: ${project || 'not specified'}`,
        `- Task: ${task || 'not specified'}`,
        ``,
        `### Layer 4: Context Pack (${top10.length} items, memories + skills unified)`,
        top10.map((item) => `- ${item.line}`).join('\n') || '- Specify a task for context-aware results',
      ].join('\n')

      return { content: [{ type: 'text', text: briefing }] }
    },
  )

  // --- Tool: skill_stats ---
  server.tool(
    'skill_stats',
    'Get statistics about all skills, agents, and commands in the system',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const stats = withSkillsStore(resolved.path, (store) => store.stats())
      return { content: [{ type: 'text', text: JSON.stringify(stats, null, 2) }] }
    },
  )

  // --- Tool: skill_health ---
  server.tool(
    'skill_health',
    'Get skill health report: confidence trends, at-risk skills, usage analytics, dead skills, and cooccurrence patterns',
    { repo: z.string().optional() },
    async ({ repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const health = withSkillsStore(resolved.path, (store) => ({
        confidenceStats: store.confidenceStats(),
        topCooccurrences: store.topCooccurrences(10),
        topRouted: store.topRouted(168, 10),
        topLoaded: store.topLoaded(168, 10),
        topApplied: store.topApplied(168, 10),
        deadSkills: store.deadSkills(30, 10),
        atRiskSkills: store.atRiskSkills(10),
        telemetry_failures: SkillsStore.telemetryFailures,
      }))

      const sections: string[] = []

      if (health.atRiskSkills.length > 0) {
        sections.push(`⚠️ AT RISK (confidence ≤ 4, stale ≥ 3 sessions):\n${health.atRiskSkills.map((s) => `  - ${s.name} (conf: ${s.confidence}, stale: ${s.sessionsStale} sessions)`).join('\n')}`)
      }

      if (health.confidenceStats.growing.length > 0) {
        sections.push(`📈 Growing (confidence ≥ 7):\n${health.confidenceStats.growing.map((s) => `  - ${s.name} (${s.confidence})`).join('\n')}`)
      }

      if (health.confidenceStats.declining.length > 0) {
        sections.push(`📉 Declining (confidence ≤ 3):\n${health.confidenceStats.declining.map((s) => `  - ${s.name} (conf: ${s.confidence}, stale: ${s.sessionsStale})`).join('\n')}`)
      }

      if (health.deadSkills.length > 0) {
        sections.push(`💀 Dead skills (routed but never loaded, 30d):\n${health.deadSkills.map((s) => `  - ${s.skillName} (${s.count}× routed)`).join('\n')}`)
      }

      if (health.topApplied.length > 0) {
        sections.push(`✅ Most applied (7d):\n${health.topApplied.map((s) => `  - ${s.skillName} (${s.count}×)`).join('\n')}`)
      }

      if (health.topCooccurrences.length > 0) {
        sections.push(`🔗 Top cooccurrences:\n${health.topCooccurrences.map((c) => `  - ${c.skillA} + ${c.skillB} (${c.count}×)`).join('\n')}`)
      }

      return { content: [{ type: 'text', text: sections.length > 0 ? sections.join('\n\n') : 'No skill health data available yet.' }] }
    },
  )

  // --- Tool: skill_gc ---
  server.tool(
    'skill_gc',
    'Garbage-collect skills routed >= threshold times in the last N days but never loaded. Marks them deprecated (reversible).',
    {
      threshold: z.number().int().min(1).default(3),
      days: z.number().int().min(1).default(30),
      dryRun: z.boolean().default(true),
      repo: z.string().optional(),
    },
    async ({ threshold, days, dryRun, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const result = withSkillsStore(resolved.path, (store) => store.gcDeadSkills({ threshold, days, dryRun }))
      return {
        content: [{
          type: 'text',
          text: `skill_gc (dryRun=${dryRun}): ${result.deprecated.length} skills marked dead\n${result.deprecated.map((n) => `  - ${n}`).join('\n')}`,
        }],
      }
    },
  )

  // --- Tool: skill_decay ---
  server.tool(
    'skill_decay',
    'Apply confidence decay to skills. Pass usefulSkills to reinforce them (+1 confidence). Decays skills not validated in 10+ sessions, deprecates skills with confidence < 3 after 30 sessions.',
    {
      usefulSkills: z.array(z.string()).optional().describe('Skill names confirmed useful this session — get confidence +1'),
      repo: z.string().optional(),
    },
    async ({ usefulSkills, repo }) => {
      const resolved = resolveMemoryRepo(repo)
      if (!resolved) return { content: [{ type: 'text', text: 'Repository not found.' }] }

      const result = withSkillsStore(resolved.path, (store) => store.applyDecay(usefulSkills ?? []))
      return {
        content: [{
          type: 'text',
          text: `Skill decay applied:\n- Reinforced: ${result.reinforced}\n- Decayed: ${result.decayed}\n- Deprecated: ${result.deprecated}`,
        }],
      }
    },
  )
}
