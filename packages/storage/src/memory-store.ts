/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type Database from 'better-sqlite3'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { randomId } from './utils/hash.js'
import { MEMORY_DECAY_INTERVAL_HOURS, SESSION_STALE_THRESHOLD_MS } from './constants.js'
import { deriveEdgeCandidates } from './memory-edge-derivation.js'
import { EmbeddingService, vectorToBlob, blobToVector, cosine } from './embedding-service.js'

// ── Session & Notification Types ───────────────────────

export type SessionStatus = 'in-progress' | 'completed' | 'paused' | 'blocked'

export type WorkType = 'feature' | 'fix' | 'setup' | 'deploy' | 'refactor' | 'design' | 'docs' | 'other'

export interface SessionLog {
  id: string
  sessionName: string
  startedAt: string
  endedAt?: string
  summary?: string
  memoriesCreated: number
  memoriesValidated: number
  filesChanged: string[]
  project?: string
  workspacePath?: string
  taskDescription?: string
  status: SessionStatus
  nextSteps?: string
  blockers?: string
  commits: string[]
  branch?: string
  workType?: WorkType
  deliverables?: string
}

export interface Notification {
  id: string
  channel: string
  eventType: string
  payload?: string
  sentAt: string
  success: boolean
  error?: string
  consecutiveFailures: number
}

// ── Types ──────────────────────────────────────────────

export type MemoryType =
  | 'Fact'
  | 'Preference'
  | 'Decision'
  | 'Pattern'
  | 'AntiPattern'
  | 'BugFix'
  | 'Goal'
  | 'Todo'

export type MemoryEdgeType =
  | 'RelatedTo'
  | 'Updates'
  | 'Contradicts'
  | 'CausedBy'
  | 'PartOf'

export type MemoryStatus = 'active' | 'pending-review' | 'deprecated'
export type MemoryScope = 'global' | 'project-specific' | 'personal' | 'team' | 'project'

export interface Memory {
  id: string
  type: MemoryType
  status: MemoryStatus
  scope: MemoryScope
  project?: string
  skill?: string
  context: string
  problem: string
  solution: string
  reason: string
  confidence: number
  importance: number
  tags: string[]
  createdAt: string
  updatedAt: string
  lastValidated?: string
  sessionsSinceValidation: number
  validatedBy: string[]
  validUntilVersion?: string
  sourceFile?: string
  sourceSession?: string
  migratedFrom?: string
  createdByUserId?: string
  updatedByUserId?: string
}

export interface MemoryEdge {
  id: string
  sourceId: string
  targetId: string
  type: MemoryEdgeType
  reason?: string
  createdAt: string
}

export interface MemoryInput {
  type: MemoryType
  status?: MemoryStatus
  scope?: MemoryScope
  project?: string
  skill?: string
  context: string
  problem: string
  solution: string
  reason: string
  confidence?: number
  importance?: number
  tags: string[]
  sourceFile?: string
  sourceSession?: string
  migratedFrom?: string
  createdByUserId?: string
}

export interface MemoryQuery {
  type?: MemoryType | MemoryType[]
  status?: MemoryStatus
  scope?: MemoryScope
  project?: string
  skill?: string
  minConfidence?: number
  tags?: string[]
  limit?: number
  userId?: string
  mine?: boolean  // filter by created_by_user_id = userId, regardless of scope
}

export interface MemorySearchResult {
  memory: Memory
  rank: number
  edges: MemoryEdge[]
}

export interface DecayResult {
  reinforced: number
  decayed: number
  pendingReview: number
  deprecated: number
}

// ── Store ──────────────────────────────────────────────

const INITIAL_CONFIDENCE_CAPS: Partial<Record<MemoryType, number>> = {
  Pattern: 8,
  Preference: 8,
  BugFix: 8,
  Goal: 8,
  Todo: 8,
  Fact: 6,
  AntiPattern: 10,
  Decision: 10,
}

const DEFAULT_INITIAL_CAP = 8

function capInitialConfidence(type: MemoryType, requested: number): number {
  const cap = INITIAL_CONFIDENCE_CAPS[type] ?? DEFAULT_INITIAL_CAP
  return Math.min(requested, cap)
}

export class MemoryStore {
  private stmts: ReturnType<typeof this.prepareStatements>

  constructor(private db: Database.Database) {
    this.stmts = this.prepareStatements()
  }

  private prepareStatements() {
    return {
      insertEdge: this.db.prepare(`
        INSERT OR IGNORE INTO memory_edges (id, source_id, target_id, type, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `),
      getById: this.db.prepare('SELECT * FROM memories WHERE id = ?'),
      getEdgesFrom: this.db.prepare('SELECT * FROM memory_edges WHERE source_id = ?'),
      getEdgesTo: this.db.prepare('SELECT * FROM memory_edges WHERE target_id = ?'),
      getEdgesBetween: this.db.prepare(`
        SELECT * FROM memory_edges
        WHERE (source_id = ? AND target_id = ?) OR (source_id = ? AND target_id = ?)
      `),
      deleteMemory: this.db.prepare('DELETE FROM memories WHERE id = ?'),
      deleteEdge: this.db.prepare('DELETE FROM memory_edges WHERE id = ?'),
      searchFts: this.db.prepare(`
        SELECT m.*, fts.rank
        FROM memories_fts fts
        JOIN memories m ON m.rowid = fts.rowid
        WHERE memories_fts MATCH ?
        ORDER BY fts.rank
        LIMIT ?
      `),
      countByType: this.db.prepare('SELECT type, COUNT(*) as count FROM memories GROUP BY type'),
      countByStatus: this.db.prepare('SELECT status, COUNT(*) as count FROM memories GROUP BY status'),
      allActive: this.db.prepare(`
        SELECT * FROM memories WHERE status = 'active' AND id NOT LIKE 'M-_system_%' ORDER BY confidence DESC, updated_at DESC
      `),
      byProject: this.db.prepare(`
        SELECT * FROM memories WHERE (project = ? OR scope = 'global') AND status = 'active'
        ORDER BY confidence DESC LIMIT ?
      `),
      bySkill: this.db.prepare(`
        SELECT * FROM memories WHERE skill = ? AND status = 'active'
        ORDER BY confidence DESC
      `),
      byTags: this.db.prepare(`
        SELECT * FROM memories WHERE status = 'active' AND tags LIKE ?
        ORDER BY confidence DESC LIMIT ?
      `),
      getContradictions: this.db.prepare(`
        SELECT m1.id as id1, m1.context as ctx1, m2.id as id2, m2.context as ctx2,
               e.reason as edge_reason
        FROM memory_edges e
        JOIN memories m1 ON e.source_id = m1.id
        JOIN memories m2 ON e.target_id = m2.id
        WHERE e.type = 'Contradicts'
      `),
      // Decay queries
      reinforceMemory: this.db.prepare(`
        UPDATE memories SET
          confidence = MIN(confidence + 1, 10),
          last_validated = ?,
          sessions_since_validation = 0,
          validated_by = ?,
          updated_at = ?
        WHERE id = ?
      `),
      incrementSessionCount: this.db.prepare(`
        UPDATE memories SET sessions_since_validation = sessions_since_validation + 1
        WHERE id != ? AND status = 'active'
      `),
      applyDecay: this.db.prepare(`
        UPDATE memories SET
          confidence = MAX(confidence - 1, 1),
          updated_at = ?
        WHERE sessions_since_validation >= 5 AND confidence > 1 AND status = 'active'
      `),
      markPendingReview: this.db.prepare(`
        UPDATE memories SET
          status = 'pending-review',
          updated_at = ?
        WHERE sessions_since_validation >= 15 AND status = 'active'
      `),
      markDeprecated: this.db.prepare(`
        UPDATE memories SET
          status = 'deprecated',
          updated_at = ?
        WHERE sessions_since_validation >= 30 AND status = 'pending-review'
      `),
      insertDismissal: this.db.prepare(
        `INSERT INTO memory_dismissals (memory_id, reason, user_id) VALUES (?, ?, ?)`
      ),
      countDismissals: this.db.prepare(
        `SELECT COUNT(*) as c FROM memory_dismissals WHERE memory_id = ?`
      ),
      allDismissalCounts: this.db.prepare(
        `SELECT memory_id, COUNT(*) as c FROM memory_dismissals GROUP BY memory_id`
      ),
      insertMemoryUsage: this.db.prepare(
        `INSERT INTO memory_usage (memory_id, session_id, project, action, user_id) VALUES (?, ?, ?, ?, ?)`
      ),
      getUsageBySession: this.db.prepare(
        `SELECT memory_id as memoryId, action, ts FROM memory_usage WHERE session_id = ? ORDER BY ts ASC`
      ),
      getUsageBySessionAction: this.db.prepare(
        `SELECT memory_id as memoryId, action, ts FROM memory_usage WHERE session_id = ? AND action = ? ORDER BY ts ASC`
      ),
    }
  }

  // ── CRUD ──────────────────────────────────────────

  add(input: MemoryInput): Memory {
    const now = new Date().toISOString()
    const id = `M-${input.type.toLowerCase()}-${randomId()}`
    const memory: Memory = {
      id,
      type: input.type,
      status: input.status ?? 'active',
      scope: input.scope ?? 'team',
      project: input.project,
      skill: input.skill,
      context: input.context,
      problem: input.problem,
      solution: input.solution,
      reason: input.reason,
      confidence: capInitialConfidence(input.type, input.confidence ?? 1),
      importance: input.importance ?? 5,
      tags: input.tags,
      createdAt: now,
      updatedAt: now,
      sessionsSinceValidation: 0,
      validatedBy: [],
      sourceFile: input.sourceFile,
      sourceSession: input.sourceSession,
      migratedFrom: input.migratedFrom,
      createdByUserId: input.createdByUserId,
    }

    this.db.prepare(`
      INSERT OR REPLACE INTO memories
        (id, type, status, scope, project, skill,
         context, problem, solution, reason,
         confidence, importance, tags,
         created_at, updated_at, last_validated,
         sessions_since_validation, validated_by,
         valid_until_version, source_file, source_session, migrated_from,
         created_by_user_id, updated_by_user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      memory.id, memory.type, memory.status, memory.scope,
      memory.project ?? null, memory.skill ?? null,
      memory.context, memory.problem, memory.solution, memory.reason,
      memory.confidence, memory.importance, JSON.stringify(memory.tags),
      memory.createdAt, memory.updatedAt, memory.lastValidated ?? null,
      memory.sessionsSinceValidation, JSON.stringify(memory.validatedBy),
      memory.validUntilVersion ?? null, memory.sourceFile ?? null,
      memory.sourceSession ?? null, memory.migratedFrom ?? null,
      memory.createdByUserId ?? null, null,
    )

    // Populate FTS
    this.populateFts(memory)

    // Auto-derive edges (best-effort, never throws)
    try {
      const candidates = this.queryRecentForDerivation(memory)
      const edges = deriveEdgeCandidates(memory, candidates)
      for (const e of edges) {
        this.addEdge(memory.id, e.targetId, e.type, e.reason)
      }
    } catch (err) {
      // log only — never block memory_add on edge derivation failure
      console.error('[memory-store] edge derivation failed', err)
    }

    // async fire-and-forget — never blocks add() return
    try {
      const svc = EmbeddingService.get()
      const text = `${memory.context}\n${memory.solution ?? ''}`.slice(0, 2000)
      svc.embed(text, 'passage').then((vec) => {
        if (vec) this.upsertEmbedding(memory.id, vec)
      }).catch((err) => console.error('[memory-store] embed on-add failed', err))
    } catch { /* swallow */ }

    return memory
  }

  private queryRecentForDerivation(subject: Memory): Memory[] {
    // Pull a bounded candidate set: same project (if any) OR tag-overlap candidates from last 200 memories.
    const sql = `
      SELECT * FROM memories
      WHERE status = 'active' AND id != ?
        AND (project = ? OR tags LIKE ? OR tags LIKE ?)
      ORDER BY updated_at DESC
      LIMIT 200
    `
    const tagLike1 = subject.tags[0] ? `%"${subject.tags[0]}"%` : '%'
    const tagLike2 = subject.tags[1] ? `%"${subject.tags[1]}"%` : '%'
    const rows = this.db.prepare(sql).all(subject.id, subject.project ?? '', tagLike1, tagLike2) as any[]
    return rows.map((r) => this.rowToMemory(r))
  }

  addEdge(sourceId: string, targetId: string, type: MemoryEdgeType, reason?: string): MemoryEdge {
    const now = new Date().toISOString()
    const id = randomId()
    const edge: MemoryEdge = { id, sourceId, targetId, type, reason, createdAt: now }

    this.stmts.insertEdge.run(id, sourceId, targetId, type, reason ?? null, now)
    return edge
  }

  get(id: string): Memory | undefined {
    const row = this.stmts.getById.get(id) as any
    return row ? this.rowToMemory(row) : undefined
  }

  delete(id: string): void {
    this.stmts.deleteMemory.run(id)
  }

  // ── Dismissals ────────────────────────────────────

  dismissMemory(memoryId: string, reason?: string, userId?: string): void {
    // Guard: FK constraint on memory_dismissals(memory_id) → memories(id).
    // Silently no-op if the memory doesn't exist so callers (e.g. suggest dismissal
    // after a memory was already deleted) don't surface an unexpected DB error.
    const exists = this.stmts.getById.get(memoryId)
    if (!exists) return
    this.stmts.insertDismissal.run(memoryId, reason ?? null, userId ?? null)
  }

  dismissalCount(memoryId: string): number {
    const row = this.stmts.countDismissals.get(memoryId) as { c: number } | undefined
    return row?.c ?? 0
  }

  private dismissalPenalty(memoryId: string): number {
    const c = this.dismissalCount(memoryId)
    return Math.min(c * 0.05, 0.30)
  }

  // ── Usage Tracking ────────────────────────────────

  logMemoryUsage(memoryId: string, sessionId: string | undefined, action: 'loaded' | 'applied', project?: string, userId?: string): void {
    this.stmts.insertMemoryUsage.run(memoryId, sessionId ?? null, project ?? null, action, userId ?? null)
  }

  getMemoryUsageInSession(sessionId: string, action?: 'loaded' | 'applied'): Array<{ memoryId: string; action: string; ts: string }> {
    const rows = action
      ? this.stmts.getUsageBySessionAction.all(sessionId, action) as any[]
      : this.stmts.getUsageBySession.all(sessionId) as any[]
    return rows.map((r) => ({ memoryId: r.memoryId, action: r.action, ts: r.ts }))
  }

  // ── Query ─────────────────────────────────────────

  query(q: MemoryQuery): Memory[] {
    let sql = 'SELECT * FROM memories WHERE status != \'deprecated\''
    const params: any[] = []

    if (q.status) {
      sql += ' AND status = ?'
      params.push(q.status)
    }

    if (q.type) {
      if (Array.isArray(q.type)) {
        sql += ` AND type IN (${q.type.map(() => '?').join(',')})`
        params.push(...q.type)
      } else {
        sql += ' AND type = ?'
        params.push(q.type)
      }
    }

    if (q.scope) {
      // Normalize scope aliases for filtering
      const normalizedScope = q.scope === 'global' ? 'team'
        : q.scope === 'project-specific' ? 'project'
        : q.scope

      if (normalizedScope === 'personal') {
        // Personal memories: only visible to their creator
        sql += ' AND scope = \'personal\''
        if (q.userId) {
          sql += ' AND created_by_user_id = ?'
          params.push(q.userId)
        }
      } else if (normalizedScope === 'team') {
        sql += ' AND scope IN (\'team\', \'global\')'
      } else if (normalizedScope === 'project') {
        sql += ' AND scope IN (\'project\', \'project-specific\')'
      } else {
        sql += ' AND scope = ?'
        params.push(q.scope)
      }
    } else if (q.userId) {
      // No scope filter but userId given: exclude other users' personal memories
      sql += ' AND (scope != \'personal\' OR created_by_user_id = ?)'
      params.push(q.userId)
    }

    if (q.mine && q.userId) {
      sql += ' AND created_by_user_id = ?'
      params.push(q.userId)
    }

    if (q.project) {
      sql += ' AND (project = ? OR scope IN (\'global\', \'team\'))'
      params.push(q.project)
    }

    if (q.skill) {
      sql += ' AND skill = ?'
      params.push(q.skill)
    }

    if (q.minConfidence) {
      sql += ' AND confidence >= ?'
      params.push(q.minConfidence)
    }

    if (q.tags && q.tags.length > 0) {
      for (const tag of q.tags) {
        sql += ' AND tags LIKE ?'
        params.push(`%"${tag}"%`)
      }
    }

    sql += ' ORDER BY confidence DESC, updated_at DESC'

    if (q.limit) {
      sql += ' LIMIT ?'
      params.push(q.limit)
    }

    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(this.rowToMemory)
  }

  search(query: string, limit = 15, project?: string, activeSkills?: string[]): MemorySearchResult[] {
    if (query.length > 500) query = query.slice(0, 500) // guard against oversized queries
    const tokens = query
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1)

    if (tokens.length === 0) return []

    let rows: Memory[] = []
    try {
      // Trigram FTS — supports partial/prefix matching ("serv" → "server")
      const ftsQuery = tokens.join(' OR ')
      rows = this.db.prepare(`
        SELECT m.* FROM memories_fts_trgm fts
        JOIN memories m ON m.rowid = fts.rowid
        WHERE memories_fts_trgm MATCH ? AND m.status = 'active'
        ORDER BY fts.rank LIMIT ?
      `).all(ftsQuery, limit * 3) as any[]
    } catch {
      // Fallback: legacy FTS (unicode61) for DBs not yet migrated
      try {
        const ftsQuery = tokens.map((w) => `"${w}"`).join(' OR ')
        rows = (this.stmts.searchFts.all(ftsQuery, limit * 3) as any[]).map((r) => r as Memory)
      } catch {
        return []
      }
    }

    if (rows.length === 0) return []

    const reranked = this.bm25Rerank(rows.map((r) => this.rowToMemory(r)), tokens)
    const penalized = reranked.map(({ memory, score }) => ({
      memory,
      score: score * (1 - this.dismissalPenalty(memory.id)),
    }))
    const boosted = this.closetBoost(penalized.sort((a, b) => b.score - a.score), project, activeSkills)

    const sorted = boosted.sort((a, b) => b.finalScore - a.finalScore)

    // 1-hop edge expansion: pull RelatedTo / CausedBy targets that aren't in the result set
    // Cache edges for direct hits to avoid re-fetching in final return
    const seen = new Set(sorted.map((r) => r.memory.id))
    const expandedWithEdges: Array<{ memory: Memory; finalScore: number; edges: MemoryEdge[] }> = []
    const sortedWithEdges: Array<{ memory: Memory; finalScore: number; edges: MemoryEdge[] }> = []
    const EXPANSION_TYPES = new Set<string>(['RelatedTo', 'CausedBy'])
    const RANK_DECAY = 0.5

    // Fetch edges only for top-limit direct hits
    for (const r of sorted.slice(0, limit)) {
      const edges = this.getEdges(r.memory.id)
      sortedWithEdges.push({ memory: r.memory, finalScore: r.finalScore, edges })
      // Expand from these edges
      for (const e of edges) {
        if (!EXPANSION_TYPES.has(e.type)) continue
        const targetId = e.sourceId === r.memory.id ? e.targetId : e.sourceId
        if (seen.has(targetId)) continue
        const target = this.get(targetId)
        if (!target || target.status !== 'active') continue
        seen.add(targetId)
        expandedWithEdges.push({
          memory: target,
          finalScore: r.finalScore * RANK_DECAY,
          edges: this.getEdges(targetId),
        })
      }
    }

    const merged = [...sortedWithEdges, ...expandedWithEdges]
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit * 2)

    return merged.map(({ memory, finalScore, edges }) => ({
      memory,
      rank: finalScore,
      edges,
    }))
  }

  private getEmbedding(memoryId: string): Float32Array | null {
    const row = this.db.prepare('SELECT embedding FROM memory_embeddings WHERE memory_id = ?').get(memoryId) as { embedding: Buffer } | undefined
    return row ? blobToVector(row.embedding) : null
  }

  async searchAsync(query: string, limit = 15, project?: string, activeSkills?: string[]): Promise<MemorySearchResult[]> {
    // Step 1: BM25 candidates (top limit*3)
    const bm25Results = this.search(query, limit * 3, project, activeSkills)
    if (bm25Results.length === 0) return []

    // Step 2: query embedding
    let qVec: Float32Array | null = null
    try {
      qVec = await EmbeddingService.get().embed(query, 'query')
    } catch {
      // model unavailable or threw — fall back to BM25-only
    }
    if (!qVec) {
      // graceful degradation: no model → BM25-only
      return bm25Results.slice(0, limit)
    }

    // Step 3: hybrid scoring
    // Normalize BM25 relative to the max score in this candidate set (avoids capping multi-term scores at 1)
    const maxBm25 = Math.max(bm25Results.reduce((m, r) => Math.max(m, r.rank), 0), 1)
    const scored = bm25Results.map(({ memory, rank, edges }) => {
      const docVec = this.getEmbedding(memory.id)
      const cosineSim = docVec ? cosine(qVec, docVec) : 0
      const bm25Norm = rank / maxBm25  // relative normalization, always 0..1
      const finalScore = 0.5 * bm25Norm + 0.5 * cosineSim
      return { memory, rank: finalScore, edges }
    })

    // Step 4: sort desc, slice to limit
    return scored.sort((a, b) => b.rank - a.rank).slice(0, limit)
  }

  private bm25Rerank(candidates: Memory[], queryTokens: string[]): Array<{ memory: Memory; score: number }> {
    if (candidates.length === 0) return []

    const totalActive = (this.db.prepare(`SELECT COUNT(*) as n FROM memories WHERE status = 'active'`).get() as any)?.n ?? 1
    const k1 = 1.5, b = 0.75
    const TAG_MATCH_BONUS = 0.30

    const texts = candidates.map((m) =>
      [m.context, m.problem, m.solution, m.reason, ...(m.tags ?? [])].join(' ').toLowerCase()
    )
    const avgdl = texts.reduce((s, t) => s + t.length, 0) / texts.length

    return candidates.map((m, i) => {
      const text = texts[i]
      const dl = text.length
      let score = 0
      for (const t of queryTokens) {
        const df = texts.filter((tx) => tx.includes(t)).length
        if (df === 0) continue
        const idf = Math.log((totalActive - df + 0.5) / (df + 0.5) + 1)
        const tf = (text.match(new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) ?? []).length
        score += idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl / avgdl))
      }

      // Tag match bonus: exact token match against memory tags
      const memTags = (m.tags ?? []).map((t) => t.toLowerCase())
      for (const qt of queryTokens) {
        if (memTags.includes(qt)) {
          score += TAG_MATCH_BONUS
        }
      }

      return { memory: m, score }
    })
  }

  private closetBoost(
    results: Array<{ memory: Memory; score: number }>,
    project?: string,
    activeSkills?: string[],
  ): Array<{ memory: Memory; finalScore: number }> {
    const BOOSTS = [0.40, 0.25, 0.15, 0.08, 0.04]
    const SIBLING_BOOST = 0.20
    const clusterCount = new Map<string, number>()
    const activeSet = new Set(activeSkills ?? [])

    return results.map(({ memory, score }) => {
      const isTarget = !!project && memory.project === project
      const key = `${memory.project ?? ''}::${memory.skill ?? ''}`
      const pos = isTarget ? (clusterCount.get(key) ?? 0) : -1
      if (isTarget) clusterCount.set(key, pos + 1)

      let boost = pos >= 0 && pos < BOOSTS.length ? BOOSTS[pos] : 0

      // Sibling project boost: memory from different project but shares skill tags
      if (!isTarget && memory.project && memory.project !== project && activeSet.size > 0) {
        const memTags = memory.tags ?? []
        const overlap = memTags.filter((t) => activeSet.has(t))
        if (overlap.length > 0) {
          boost = SIBLING_BOOST * Math.min(overlap.length, 3) / 3
        }
      }

      return { memory, finalScore: score + boost }
    })
  }

  getEdges(memoryId: string): MemoryEdge[] {
    const from = (this.stmts.getEdgesFrom.all(memoryId) as any[]).map(this.rowToEdge)
    const to = (this.stmts.getEdgesTo.all(memoryId) as any[]).map(this.rowToEdge)
    return [...from, ...to]
  }

  getContradictions(): { id1: string; ctx1: string; id2: string; ctx2: string; reason?: string }[] {
    return this.stmts.getContradictions.all() as any[]
  }

  // ── Scoring (load-learnings algorithm) ────────────

  scored(project?: string, activeSkills?: string[], limit = 15): MemorySearchResult[] {
    try { this.autoDecayIfDue() } catch {}

    const TYPE_WEIGHTS: Record<string, number> = {
      BugFix: 1.5, AntiPattern: 1.4, Pattern: 1.3,
      Decision: 1.2, Preference: 1.1, Fact: 1.0, Goal: 0.8, Todo: 0.7,
    }

    const active = (this.stmts.allActive.all() as any[])
      .map(this.rowToMemory)
      .filter((m) => !m.id.startsWith('M-_system_'))

    // Pre-fetch all dismissal counts in one query to avoid N+1
    const dismissalMap = new Map<string, number>(
      (this.stmts.allDismissalCounts.all() as Array<{ memory_id: string; c: number }>).map((r) => [r.memory_id, r.c])
    )

    // Pre-fetch suggest preferences to apply type-bias
    const prefs = this.suggestPreferences()

    const scored = active
      .filter((m) => {
        if ((m.scope === 'project-specific' || m.scope === 'project') && project && m.project !== project) return false
        return true
      })
      .map((m) => {
        let score = m.confidence * 2
        if (m.scope === 'global' || m.scope === 'team' || m.project === project) score += 3
        if (m.sessionsSinceValidation <= 5) score += 2
        if (activeSkills?.includes(m.skill ?? '')) score += 2
        score += m.importance * 0.5
        score *= (TYPE_WEIGHTS[m.type] ?? 1.0)
        const dismissCount = dismissalMap.get(m.id) ?? 0
        const dismissPenalty = Math.min(dismissCount * 0.05, 0.30)
        score -= dismissPenalty * 10  // ~3.0 max — drops 3x-dismissed below undisputed peer
        // Suggest preference type-bias: 0.8 (rate 0) → 1.2 (rate 1), neutral 1.0 (no history)
        const prefRate = prefs[m.type]?.rate ?? 0.5
        score *= 0.8 + 0.4 * prefRate
        return { memory: m, rank: score, edges: this.getEdges(m.id) }
      })
      .sort((a, b) => b.rank - a.rank)

    return scored.slice(0, limit)
  }

  // ── Decay ─────────────────────────────────────────

  /**
   * Manually reinforce a single memory — the non-destructive "Keep / Reinforce"
   * action exposed in the dashboard. Bumps confidence +1 (capped at 10), resets
   * sessions_since_validation to 0, and appends `by` to validated_by. This is the
   * only dashboard path that can RAISE a memory's confidence; previously the UI
   * could only Deprecate/Delete, so a valuable-but-low-confidence memory had no
   * non-destructive remedy. Returns false if the id does not exist.
   */
  reinforce(id: string, by?: string): boolean {
    const mem = this.get(id)
    if (!mem) return false
    const now = new Date().toISOString()
    const newValidatedBy = [...mem.validatedBy, by ?? 'dashboard']
    this.stmts.reinforceMemory.run(now, JSON.stringify(newValidatedBy), now, id)
    return true
  }

  applyDecay(validatedIds: string[], sessionDate: string): DecayResult {
    const now = new Date().toISOString()
    let reinforced = 0

    return this.db.transaction(() => {
      // Reinforce validated memories
      for (const id of validatedIds) {
        const mem = this.get(id)
        if (!mem) continue
        const newValidatedBy = [...mem.validatedBy, sessionDate]
        this.stmts.reinforceMemory.run(now, JSON.stringify(newValidatedBy), now, id)
        reinforced++
      }

      // Increment session count for all non-validated active memories in a single query
      // Bug fix: previous loop ran once per validatedId, accidentally incrementing validated memories too
      if (validatedIds.length > 0) {
        const placeholders = validatedIds.map(() => '?').join(', ')
        this.db.prepare(
          `UPDATE memories SET sessions_since_validation = sessions_since_validation + 1 WHERE id NOT IN (${placeholders}) AND status = 'active'`
        ).run(...validatedIds)
      } else {
        this.stmts.incrementSessionCount.run('__none__')
      }

      // Apply decay thresholds (all batch SQL — no loops)
      this.stmts.applyDecay.run(now)
      const pendingReview = this.db.prepare(
        `SELECT COUNT(*) as c FROM memories WHERE sessions_since_validation >= 15 AND status = 'active'`
      ).get() as any
      this.stmts.markPendingReview.run(now)

      const deprecatedCount = this.db.prepare(
        `SELECT COUNT(*) as c FROM memories WHERE sessions_since_validation >= 30 AND status = 'pending-review'`
      ).get() as any
      this.stmts.markDeprecated.run(now)

      const decayed = this.db.prepare(
        `SELECT COUNT(*) as c FROM memories WHERE sessions_since_validation >= 5 AND status = 'active'`
      ).get() as any

      return {
        reinforced,
        decayed: decayed?.c ?? 0,
        pendingReview: pendingReview?.c ?? 0,
        deprecated: deprecatedCount?.c ?? 0,
      }
    })()
  }

  // ── Contradiction Detection ───────────────────────

  detectContradictions(memory: Memory): Memory[] {
    // Find memories with 2+ overlapping tags
    const candidates = this.query({ status: 'active', tags: memory.tags.slice(0, 2) })
    return candidates.filter((m) => {
      if (m.id === memory.id) return false
      const overlap = m.tags.filter((t) => memory.tags.includes(t))
      return overlap.length >= 2
    })
  }

  // ── Semantic Dedup ────────────────────────────────

  findDuplicate(input: Pick<MemoryInput, 'type' | 'context' | 'solution' | 'problem' | 'reason' | 'tags'>): Memory | null {
    const candidates = this.search(input.solution.slice(0, 200), 5)
    if (candidates.length === 0) return null

    const inputTrigrams = this.trigrams(input.solution.toLowerCase())
    for (const { memory } of candidates) {
      if (memory.type !== input.type) continue
      const existTrigrams = this.trigrams(memory.solution.toLowerCase())
      const similarity = this.jaccardSimilarity(inputTrigrams, existTrigrams)
      if (similarity >= 0.45) return memory
    }
    return null
  }

  private trigrams(text: string): Set<string> {
    const set = new Set<string>()
    const clean = text.replace(/\s+/g, ' ').trim()
    for (let i = 0; i <= clean.length - 3; i++) {
      set.add(clean.slice(i, i + 3))
    }
    return set
  }

  private jaccardSimilarity(a: Set<string>, b: Set<string>): number {
    let intersection = 0
    for (const t of a) {
      if (b.has(t)) intersection++
    }
    const union = a.size + b.size - intersection
    return union === 0 ? 0 : intersection / union
  }

  // ── Suggest Personalization ────────────────────────

  logSuggestOutcome(type: string, accepted: boolean, project?: string): void {
    try {
      this.db.prepare(
        'INSERT INTO suggest_log (suggested_type, accepted, project) VALUES (?, ?, ?)'
      ).run(type, accepted ? 1 : 0, project ?? null)
    } catch { /* table may not exist */ }
  }

  suggestPreferences(): Record<string, { accepted: number; total: number; rate: number }> {
    try {
      const rows = this.db.prepare(`
        SELECT suggested_type, SUM(accepted) as accepted, COUNT(*) as total
        FROM suggest_log GROUP BY suggested_type
      `).all() as any[]

      return rows.reduce((acc, r) => {
        acc[r.suggested_type] = {
          accepted: r.accepted,
          total: r.total,
          rate: r.total > 0 ? r.accepted / r.total : 0,
        }
        return acc
      }, {} as Record<string, { accepted: number; total: number; rate: number }>)
    } catch {
      return {}
    }
  }

  // ── Health ────────────────────────────────────────

  memoryHealth(): {
    totals: Record<string, number>
    atRisk: Array<{ id: string; type: string; confidence: number; sessionsStale: number }>
    contradictions: Array<{ id: string; sourceId: string; targetId: string; type: string; reason?: string }>
    pendingReview: number
    topDecayCandidates: Array<{ id: string; type: string; sessionsStale: number }>
  } {
    const totals: Record<string, number> = { active: 0, 'pending-review': 0, deprecated: 0 }
    for (const row of this.db.prepare(`SELECT status, COUNT(*) as c FROM memories GROUP BY status`).all() as any[]) {
      totals[row.status] = row.c
    }

    const atRisk = (this.db.prepare(`
      SELECT id, type, confidence, sessions_since_validation as sessionsStale
      FROM memories
      WHERE status = 'active' AND confidence < 4 AND sessions_since_validation >= 5
      ORDER BY confidence ASC, sessions_since_validation DESC
      LIMIT 20
    `).all() as any[]).map((r) => ({
      id: r.id,
      type: r.type,
      confidence: r.confidence,
      sessionsStale: r.sessionsStale,
    }))

    const contradictions = (this.db.prepare(`
      SELECT id, source_id as sourceId, target_id as targetId, type, reason
      FROM memory_edges WHERE type = 'Contradicts'
      LIMIT 50
    `).all() as any[])

    const pendingReview = ((this.db.prepare(`SELECT COUNT(*) as c FROM memories WHERE status = 'pending-review'`).get() as any)?.c) ?? 0

    const topDecayCandidates = (this.db.prepare(`
      SELECT id, type, sessions_since_validation as sessionsStale
      FROM memories
      WHERE status = 'active' AND sessions_since_validation >= 5
      ORDER BY sessions_since_validation DESC
      LIMIT 10
    `).all() as any[]).map((r) => ({ id: r.id, type: r.type, sessionsStale: r.sessionsStale }))

    return { totals, atRisk, contradictions, pendingReview, topDecayCandidates }
  }

  // ── Stats ─────────────────────────────────────────

  stats() {
    const byType = (this.stmts.countByType.all() as any[])
      .reduce((acc, r) => ({ ...acc, [r.type]: r.count }), {} as Record<string, number>)
    const byStatus = (this.stmts.countByStatus.all() as any[])
      .reduce((acc, r) => ({ ...acc, [r.status]: r.count }), {} as Record<string, number>)
    const total = (Object.values(byStatus) as number[]).reduce((a, b) => a + b, 0)
    const edgeCount = (this.db.prepare('SELECT COUNT(*) as c FROM memory_edges').get() as any).c

    return { total, byType, byStatus, edges: edgeCount }
  }

  // ── FTS Population ────────────────────────────────

  private stripSystemNoise(text: string): string {
    return text
      .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/gi, '')
      .replace(/^(Hook output|Pre-commit hook|Running hook)[^\n]*\n/gim, '')
      .replace(/\[claude_ai_\w+__\w+\][^\n]*/g, '')
      .trim()
  }

  private populateFts(memory: Memory): void {
    const clean = {
      context: this.stripSystemNoise(memory.context),
      problem: this.stripSystemNoise(memory.problem),
      solution: this.stripSystemNoise(memory.solution),
      reason: this.stripSystemNoise(memory.reason),
      tags: memory.tags.join(' '),
    }

    // Legacy FTS (unicode61) — backward compat
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO memories_fts(rowid, context, problem, solution, reason, tags)
        VALUES ((SELECT rowid FROM memories WHERE id = ?), ?, ?, ?, ?, ?)
      `).run(memory.id, clean.context, clean.problem, clean.solution, clean.reason, clean.tags)
    } catch {
      // FTS insert can fail if memory was just deleted
    }

    // Trigram FTS — partial/prefix matching (from migration 018)
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO memories_fts_trgm(rowid, context, problem, solution, reason, tags)
        VALUES ((SELECT rowid FROM memories WHERE id = ?), ?, ?, ?, ?, ?)
      `).run(memory.id, clean.context, clean.problem, clean.solution, clean.reason, clean.tags)
    } catch {
      // Table may not exist on old DBs — silently skip
    }
  }

  private upsertEmbedding(memoryId: string, vec: Float32Array): void {
    this.db.prepare(`
      INSERT INTO memory_embeddings (memory_id, embedding) VALUES (?, ?)
      ON CONFLICT(memory_id) DO UPDATE SET embedding = excluded.embedding, created_at = datetime('now')
    `).run(memoryId, vectorToBlob(vec))
  }

  // ── Row Mappers ───────────────────────────────────

  private rowToMemory(row: any): Memory {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      scope: row.scope,
      project: row.project ?? undefined,
      skill: row.skill ?? undefined,
      context: row.context,
      problem: row.problem,
      solution: row.solution,
      reason: row.reason,
      confidence: row.confidence,
      importance: row.importance,
      tags: JSON.parse(row.tags || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastValidated: row.last_validated ?? undefined,
      sessionsSinceValidation: row.sessions_since_validation,
      validatedBy: JSON.parse(row.validated_by || '[]'),
      validUntilVersion: row.valid_until_version ?? undefined,
      sourceFile: row.source_file ?? undefined,
      sourceSession: row.source_session ?? undefined,
      migratedFrom: row.migrated_from ?? undefined,
      createdByUserId: row.created_by_user_id ?? undefined,
      updatedByUserId: row.updated_by_user_id ?? undefined,
    }
  }

  private rowToEdge(row: any): MemoryEdge {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      type: row.type,
      reason: row.reason ?? undefined,
      createdAt: row.created_at,
    }
  }

  // ── Session Log ───────────────────────────────────

  startSession(sessionName: string, project?: string, workspacePath?: string, taskDescription?: string, branch?: string): SessionLog {
    const id = `S-${randomId()}`
    const now = new Date().toISOString()
    const session: SessionLog = {
      id, sessionName, startedAt: now, memoriesCreated: 0,
      memoriesValidated: 0, filesChanged: [], project, workspacePath,
      taskDescription, status: 'in-progress', commits: [], branch,
    }
    this.db.prepare(`
      INSERT INTO session_log (id, session_name, started_at, project, workspace_path, task_description, status, branch)
      VALUES (?, ?, ?, ?, ?, ?, 'in-progress', ?)
    `).run(id, sessionName, now, project ?? null, workspacePath ?? null, taskDescription ?? null, branch ?? null)
    return session
  }

  endSession(id: string, summary: string, memoriesCreated: number, memoriesValidated: number, filesChanged: string[], nextSteps?: string, blockers?: string, commits?: string[], status?: SessionStatus, workType?: WorkType, deliverables?: string): void {
    this.db.prepare(`
      UPDATE session_log SET
        ended_at = ?, summary = ?, memories_created = ?, memories_validated = ?,
        files_changed = ?, next_steps = ?, blockers = ?, commits = ?,
        status = ?, work_type = ?, deliverables = ?
      WHERE id = ?
    `).run(
      new Date().toISOString(), summary, memoriesCreated, memoriesValidated,
      JSON.stringify(filesChanged), nextSteps ?? null, blockers ?? null,
      JSON.stringify(commits || []), status || 'completed',
      workType ?? null, deliverables ?? null, id,
    )
  }

  // ── Session Chunks (MemPalace verbatim indexing) ──

  indexSessionChunks(sessionId: string, text: string, project?: string, startedAt?: string): number {
    const clean = this.stripSystemNoise(text)
    const CHUNK = 800, STEP = 700, MIN = 50  // overlap = 100 chars
    let count = 0
    for (let i = 0; i * STEP < clean.length; i++) {
      const chunk = clean.slice(i * STEP, i * STEP + CHUNK)
      if (chunk.length < MIN) break
      const id = `sc_${sessionId}_${i}`
      try {
        this.db.prepare(
          `INSERT OR IGNORE INTO session_chunks (id, session_id, chunk_index, content, project, started_at) VALUES (?,?,?,?,?,?)`
        ).run(id, sessionId, i, chunk, project ?? null, startedAt ?? null)
        const row = this.db.prepare('SELECT rowid FROM session_chunks WHERE id = ?').get(id) as any
        if (row) {
          this.db.prepare(
            `INSERT OR REPLACE INTO session_chunks_fts(rowid, content) VALUES (?,?)`
          ).run(row.rowid, chunk)
        }
        count++
      } catch {
        // table may not exist on old DBs — skip silently
        break
      }
    }
    return count
  }

  searchSessions(query: string, limit = 10): Array<{ sessionId: string; chunkIndex: number; content: string; project?: string }> {
    const tokens = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2)
    if (tokens.length === 0) return []
    const ftsQuery = tokens.join(' OR ')
    try {
      return this.db.prepare(`
        SELECT sc.session_id as sessionId, sc.chunk_index as chunkIndex, sc.content, sc.project
        FROM session_chunks_fts fts
        JOIN session_chunks sc ON sc.rowid = fts.rowid
        WHERE session_chunks_fts MATCH ?
        ORDER BY fts.rank LIMIT ?
      `).all(ftsQuery, limit) as any[]
    } catch {
      return []
    }
  }

  recentSessions(limit = 5): SessionLog[] {
    this.autoCloseStale()
    const rows = this.db.prepare(
      'SELECT * FROM session_log ORDER BY started_at DESC LIMIT ?'
    ).all(limit) as any[]
    return rows.map(this.rowToSession)
  }

  projectSessions(project: string, limit = 10): SessionLog[] {
    this.autoCloseStale()
    const rows = this.db.prepare(
      'SELECT * FROM session_log WHERE project = ? ORDER BY started_at DESC LIMIT ?'
    ).all(project, limit) as any[]
    return rows.map(this.rowToSession)
  }

  lastProjectSession(project: string): SessionLog | undefined {
    this.autoCloseStale()
    const row = this.db.prepare(
      'SELECT * FROM session_log WHERE project = ? ORDER BY started_at DESC LIMIT 1'
    ).get(project) as any
    return row ? this.rowToSession(row) : undefined
  }

  pendingSessions(): SessionLog[] {
    this.autoCloseStale()
    const rows = this.db.prepare(
      "SELECT * FROM session_log WHERE status IN ('in-progress', 'paused', 'blocked') ORDER BY started_at DESC"
    ).all() as any[]
    return rows.map(this.rowToSession)
  }

  // ── Projects (auto-derived from sessions) ──────────

  listProjects(): { name: string; lastSession: any; totalSessions: number; totalMemories: number; memoriesByType: Record<string, number>; lastBranch?: string; blockers?: string }[] {
    // Get all unique projects from sessions
    const sessionStats = this.db.prepare(`
      SELECT sl.project, COUNT(*) as total,
        MAX(sl.started_at) as last_date
      FROM session_log sl
      LEFT JOIN projects p ON sl.project = p.name
      WHERE sl.project IS NOT NULL AND sl.project != ''
        AND (p.name IS NULL OR p.status NOT IN ('archived', 'completed'))
      GROUP BY sl.project
      ORDER BY last_date DESC
    `).all() as any[]

    return sessionStats.map((ps) => {
      // Last session for this project
      const last = this.db.prepare(
        'SELECT * FROM session_log WHERE project = ? ORDER BY started_at DESC LIMIT 1'
      ).get(ps.project) as any

      // Memory count
      const memCount = this.db.prepare(
        "SELECT COUNT(*) as c FROM memories WHERE project = ? AND status = 'active'"
      ).get(ps.project) as any

      // Memory by type
      const memTypes = this.db.prepare(
        "SELECT type, COUNT(*) as c FROM memories WHERE project = ? AND status = 'active' GROUP BY type"
      ).all(ps.project) as any[]

      return {
        name: ps.project,
        lastSession: last ? {
          date: last.started_at,
          status: last.status || 'completed',
          task: last.task_description,
          nextSteps: last.next_steps,
          summary: last.summary,
        } : null,
        totalSessions: ps.total,
        totalMemories: memCount?.c || 0,
        memoriesByType: memTypes.reduce((acc: any, r: any) => ({ ...acc, [r.type]: r.c }), {}),
        lastBranch: last?.branch ?? undefined,
        blockers: last?.blockers ?? undefined,
      }
    })
  }

  projectDetail(project: string): { name: string; sessions: SessionLog[]; memories: any[]; stats: any } {
    const sessions = this.projectSessions(project, 10)
    const memories = this.query({ project, limit: 20 }).map((m) => ({
      ...m, edges: this.getEdges(m.id),
    }))

    // Also include global memories that mention this project in context
    const searchResults = this.search(project, 10)
    const relatedMemories = searchResults
      .filter((r) => !memories.find((m) => m.id === r.memory.id))
      .map((r) => ({ ...r.memory, edges: r.edges }))

    return {
      name: project,
      sessions,
      memories: [...memories, ...relatedMemories],
      stats: {
        totalSessions: sessions.length,
        totalMemories: memories.length,
        relatedMemories: relatedMemories.length,
      },
    }
  }

  // ── Auto-Decay (lazy, runs once per 24h) ──────────

  autoDecayIfDue(): { ran: boolean; reinforced?: number; decayed?: number; deprecated?: number } {
    // Check last decay run via SQLite pragma-style metadata (use a dedicated memory row)
    const METADATA_ID = 'M-_system_decay_last_run'

    const last = this.db.prepare("SELECT updated_at FROM memories WHERE id = ?").get(METADATA_ID) as any
    const now = new Date()
    const lastRun = last ? new Date(last.updated_at) : new Date(0)
    const hoursSince = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60)

    if (hoursSince < MEMORY_DECAY_INTERVAL_HOURS) return { ran: false }

    // Run decay with no validated IDs (just ages all memories)
    const result = this.applyDecay([], now.toISOString().split('T')[0])

    // Upsert metadata row (skip FTS population to keep this internal)
    const nowIso = now.toISOString()
    this.db.prepare(`
      INSERT OR REPLACE INTO memories
        (id, type, status, scope, context, problem, solution, reason,
         confidence, importance, tags, created_at, updated_at,
         sessions_since_validation, validated_by)
      VALUES (?, 'Fact', 'active', 'global',
        'system: last decay run', 'internal metadata', 'n/a', 'system',
        10, 1, '["_system"]', ?, ?, 0, '[]')
    `).run(METADATA_ID, last ? (last as any).created_at || nowIso : nowIso, nowIso)

    return { ran: true, ...result }
  }

  // ── Heartbeat & Auto-Close Stale ──────────────────

  heartbeat(id: string): void {
    this.db.prepare('UPDATE session_log SET last_heartbeat = ? WHERE id = ?')
      .run(new Date().toISOString(), id)
  }

  /**
   * Auto-close sessions with no heartbeat for >staleMinutes.
   * Generates smart summary + auto-detects workType/deliverables from git commits.
   */
  autoCloseStale(staleMinutes?: number): number {
    staleMinutes ??= SESSION_STALE_THRESHOLD_MS / 60 / 1000
    const threshold = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString()
    const now = new Date().toISOString()

    // Find stale sessions with workspace_path for git detection
    const stale = this.db.prepare(`
      SELECT id, started_at, project, workspace_path FROM session_log
      WHERE status = 'in-progress'
        AND (last_heartbeat IS NULL OR last_heartbeat < ?)
        AND started_at < ?
    `).all(threshold, threshold) as any[]

    let closed = 0
    for (const s of stale) {
      // Auto-detect workType + deliverables from git commits (if any)
      const detection = this.detectWorkFromGit(s.workspace_path, s.started_at)
      const smartSummary = this.generateSessionSummary(s.id, s.started_at, s.project)

      this.db.prepare(`
        UPDATE session_log SET
          status = 'paused', ended_at = ?, summary = ?,
          work_type = COALESCE(work_type, ?),
          deliverables = COALESCE(deliverables, ?),
          commits = COALESCE(NULLIF(commits, '[]'), ?)
        WHERE id = ?
      `).run(
        now, smartSummary,
        detection.workType, detection.deliverables,
        JSON.stringify(detection.commits), s.id,
      )
      closed++
    }
    return closed
  }

  /**
   * Detect workType and deliverables from git commits in the workspace
   * made after the session started.
   */
  private detectWorkFromGit(workspacePath: string | undefined, sessionStart: string): { workType: string | null; deliverables: string | null; commits: string[] } {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
      return { workType: null, deliverables: null, commits: [] }
    }

    try {
      const since = new Date(sessionStart).toISOString()
      const log = execSync(
        `git log --since="${since}" --pretty=format:"%H|%s" --no-merges`,
        { cwd: workspacePath, stdio: ['pipe', 'pipe', 'pipe'], encoding: 'utf-8' },
      ).trim()

      if (!log) return { workType: null, deliverables: null, commits: [] }

      const lines = log.split('\n').filter(Boolean)
      const commits = lines.map((l) => l.split('|')[0].slice(0, 7))
      const messages = lines.map((l) => l.split('|').slice(1).join('|'))

      // Detect workType from conventional commit prefixes (weighted)
      const counts: Record<string, number> = {}
      for (const msg of messages) {
        const m = msg.match(/^(feat|fix|chore|docs|refactor|test|style|perf|build|ci|deploy|setup|design)(\([^)]+\))?!?:/i)
        if (m) {
          const prefix = m[1].toLowerCase()
          const mapped = this.mapCommitPrefixToWorkType(prefix)
          counts[mapped] = (counts[mapped] || 0) + 1
        }
      }

      // Pick the most common type
      const workType = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

      // Deliverables = concatenation of top commit messages (cleaned)
      const deliverables = messages
        .slice(0, 5)
        .map((m) => m.replace(/^(feat|fix|chore|docs|refactor|test|style|perf|build|ci)(\([^)]+\))?!?:\s*/i, ''))
        .filter((m) => m.length > 0 && !m.includes('Co-Authored-By'))
        .join('; ')
        .slice(0, 200)

      return { workType, deliverables: deliverables || null, commits: commits.slice(0, 20) }
    } catch {
      return { workType: null, deliverables: null, commits: [] }
    }
  }

  private mapCommitPrefixToWorkType(prefix: string): string {
    const map: Record<string, string> = {
      feat: 'feature', fix: 'fix', docs: 'docs', refactor: 'refactor',
      test: 'refactor', style: 'design', perf: 'refactor',
      build: 'deploy', ci: 'deploy', deploy: 'deploy',
      chore: 'other', setup: 'setup', design: 'design',
    }
    return map[prefix] || 'other'
  }

  /**
   * Generate a smart summary for a session from its activity:
   * memories created during the session window + any recorded files/commits.
   */
  private generateSessionSummary(sessionId: string, startedAt: string, project?: string): string {
    const parts: string[] = []

    // Find memories created during this session
    const session = this.db.prepare('SELECT ended_at, files_changed, commits FROM session_log WHERE id = ?').get(sessionId) as any
    const endTime = session?.ended_at || new Date().toISOString()

    // Memory type breakdown in the session window
    const memories = this.db.prepare(`
      SELECT type, COUNT(*) as c FROM memories
      WHERE created_at >= ? AND created_at <= ?
      ${project ? 'AND (project = ? OR project IS NULL)' : ''}
      GROUP BY type
    `).all(
      ...(project ? [startedAt, endTime, project] : [startedAt, endTime]),
    ) as any[]

    if (memories.length > 0) {
      const memStr = memories.map((m) => `${m.c} ${m.type}`).join(', ')
      parts.push(`captured ${memStr}`)
    }

    // Files / commits
    try {
      const files = JSON.parse(session?.files_changed || '[]') as string[]
      if (files.length > 0) parts.push(`${files.length} file${files.length > 1 ? 's' : ''} changed`)
    } catch {}
    try {
      const commits = JSON.parse(session?.commits || '[]') as string[]
      if (commits.length > 0) parts.push(`${commits.length} commit${commits.length > 1 ? 's' : ''}`)
    } catch {}

    if (parts.length === 0) return 'Session ended (no activity recorded)'
    return `Auto-closed: ${parts.join(', ')}`
  }

  // ── Delete/Update Sessions ────────────────────────

  cleanupOrphanedSessions(olderThanDays = 7): number {
    const threshold = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
    const result = this.db.prepare(`
      DELETE FROM session_log
      WHERE status = 'paused'
        AND ended_at < ?
        AND (summary IS NULL OR summary LIKE 'Session ended (no activity%' OR summary LIKE 'Auto-closed%')
        AND memories_created = 0
    `).run(threshold)
    return result.changes
  }

  deleteSession(id: string): void {
    this.db.prepare('DELETE FROM session_log WHERE id = ?').run(id)
  }

  updateSession(id: string, fields: Partial<SessionLog>): void {
    const allowed: Record<string, any> = {}
    if (fields.status !== undefined) allowed.status = fields.status
    if (fields.summary !== undefined) allowed.summary = fields.summary
    if (fields.nextSteps !== undefined) allowed.next_steps = fields.nextSteps
    if (fields.blockers !== undefined) allowed.blockers = fields.blockers
    if (fields.deliverables !== undefined) allowed.deliverables = fields.deliverables
    if (fields.workType !== undefined) allowed.work_type = fields.workType
    if (fields.taskDescription !== undefined) allowed.task_description = fields.taskDescription

    const keys = Object.keys(allowed)
    if (keys.length === 0) return

    const setClauses = keys.map((k) => `${k} = ?`).join(', ')
    const values = keys.map((k) => allowed[k])
    this.db.prepare(`UPDATE session_log SET ${setClauses} WHERE id = ?`).run(...values, id)
  }

  // ── Update Memory ─────────────────────────────────

  updateMemory(id: string, fields: { confidence?: number; status?: MemoryStatus; context?: string; problem?: string; solution?: string; reason?: string; tags?: string[] }): void {
    const allowed: Record<string, any> = {}
    if (fields.confidence !== undefined) allowed.confidence = fields.confidence
    if (fields.status !== undefined) allowed.status = fields.status
    if (fields.context !== undefined) allowed.context = fields.context
    if (fields.problem !== undefined) allowed.problem = fields.problem
    if (fields.solution !== undefined) allowed.solution = fields.solution
    if (fields.reason !== undefined) allowed.reason = fields.reason
    if (fields.tags !== undefined) allowed.tags = JSON.stringify(fields.tags)

    const keys = Object.keys(allowed)
    if (keys.length === 0) return

    const setClauses = keys.map((k) => `${k} = ?`).join(', ')
    const values = keys.map((k) => allowed[k])
    this.db.prepare(`UPDATE memories SET ${setClauses}, updated_at = ? WHERE id = ?`).run(
      ...values, new Date().toISOString(), id,
    )

    // Update FTS if content changed
    if (fields.context || fields.problem || fields.solution || fields.reason) {
      const mem = this.get(id)
      if (mem) {
        try {
          this.db.prepare(`
            INSERT OR REPLACE INTO memories_fts(rowid, context, problem, solution, reason, tags)
            VALUES ((SELECT rowid FROM memories WHERE id = ?), ?, ?, ?, ?, ?)
          `).run(id, mem.context, mem.problem, mem.solution, mem.reason, mem.tags.join(' '))
        } catch {}
      }
    }
  }

  workLog(): Record<string, { entries: any[]; totalEntries: number }> {
    const sessions = this.db.prepare(`
      SELECT * FROM session_log
      WHERE project IS NOT NULL AND project != ''
        AND (deliverables IS NOT NULL OR summary IS NOT NULL)
      ORDER BY started_at DESC
    `).all() as any[]

    const byProject: Record<string, any[]> = {}
    for (const s of sessions) {
      const proj = s.project
      if (!byProject[proj]) byProject[proj] = []
      byProject[proj].push({
        date: s.started_at?.split('T')[0] || '',
        type: s.work_type || 'other',
        deliverable: s.deliverables || s.summary || 'No description',
        commits: JSON.parse(s.commits || '[]').length,
        files: JSON.parse(s.files_changed || '[]').length,
        branch: s.branch,
        status: s.status || 'completed',
        nextSteps: s.next_steps,
        sessionName: s.session_name,
      })
    }

    const result: Record<string, { entries: any[]; totalEntries: number }> = {}
    for (const [proj, entries] of Object.entries(byProject)) {
      result[proj] = { entries, totalEntries: entries.length }
    }
    return result
  }

  private rowToSession(r: any): SessionLog {
    return {
      id: r.id, sessionName: r.session_name, startedAt: r.started_at,
      endedAt: r.ended_at ?? undefined, summary: r.summary ?? undefined,
      memoriesCreated: r.memories_created, memoriesValidated: r.memories_validated,
      filesChanged: JSON.parse(r.files_changed || '[]'),
      project: r.project ?? undefined, workspacePath: r.workspace_path ?? undefined,
      taskDescription: r.task_description ?? undefined,
      status: r.status || 'completed',
      nextSteps: r.next_steps ?? undefined,
      blockers: r.blockers ?? undefined,
      commits: JSON.parse(r.commits || '[]'),
      branch: r.branch ?? undefined,
      workType: r.work_type ?? undefined,
      deliverables: r.deliverables ?? undefined,
    }
  }

  // ── Notifications ─────────────────────────────────

  logNotification(channel: string, eventType: string, success: boolean, payload?: string, error?: string): void {
    const id = randomId()
    const now = new Date().toISOString()

    // Get consecutive failures for this channel
    const last = this.db.prepare(
      'SELECT consecutive_failures, success FROM notifications WHERE channel = ? ORDER BY sent_at DESC LIMIT 1'
    ).get(channel) as any

    const failures = success ? 0 : (last?.consecutive_failures ?? 0) + 1

    this.db.prepare(`
      INSERT INTO notifications (id, channel, event_type, payload, sent_at, success, error, consecutive_failures)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, channel, eventType, payload ?? null, now, success ? 1 : 0, error ?? null, failures)
  }

  isChannelCircuitBroken(channel: string): boolean {
    const last = this.db.prepare(
      'SELECT consecutive_failures FROM notifications WHERE channel = ? ORDER BY sent_at DESC LIMIT 1'
    ).get(channel) as any
    return (last?.consecutive_failures ?? 0) >= 3
  }
}
