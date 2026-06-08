/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { Router } from 'express'
import { openDb, closeDb } from '@skillbrain/storage'
import { MemoryStore } from '@skillbrain/storage'
import type { RouteContext } from './index.js'

export function createMemoriesRouter(ctx: RouteContext): Router {
  const router = Router()

  router.get('/api/memories', (req, res) => {
    const { type, minConfidence, skill, project, status, search, limit, scope, mine } = req.query as any
    const userId = (req as any).userId as string | undefined
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      let memories
      if (search) {
        memories = store.search(search, parseInt(limit || '50', 10)).map((r) => ({
          ...r.memory, edges: r.edges,
        }))
      } else {
        const typeArr = type ? (Array.isArray(type) ? type : [type]) : undefined
        memories = store.query({
          type: typeArr,
          minConfidence: minConfidence ? parseInt(minConfidence, 10) : undefined,
          skill, project, status,
          scope: scope || undefined,
          userId,
          mine: mine === 'true' || mine === '1',
          limit: parseInt(limit || '50', 10),
        }).map((m) => ({ ...m, edges: store.getEdges(m.id) }))
      }
      const stats = store.stats()
      closeDb(db)
      res.json({ memories, total: stats.total, stats })
    } catch {
      res.json({ memories: [], total: 0, stats: {} })
    }
  })

  router.post('/api/memories', (req, res) => {
    const userId = (req as any).userId as string | undefined
    const { type, context, problem, solution, reason, tags, project, skill, scope, confidence, importance, status } = req.body || {}
    if (!type || !context || !problem || !solution || !reason) {
      res.status(400).json({ error: 'type, context, problem, solution, reason are required' })
      return
    }
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      const tagList = Array.isArray(tags)
        ? tags
        : (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [])
      const memory = store.add({
        type, context, problem, solution, reason,
        tags: tagList,
        project: project || undefined,
        skill: skill || undefined,
        scope: scope || 'team',
        confidence: confidence != null ? parseInt(String(confidence), 10) : undefined,
        importance: importance != null ? parseInt(String(importance), 10) : undefined,
        status: status || undefined,
        createdByUserId: userId,
      })
      closeDb(db)
      res.json({ memory })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.get('/api/memories/:id', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      const memory = store.get(req.params.id)
      if (!memory) { closeDb(db); res.status(404).json({ error: 'Memory not found' }); return }
      const edges = store.getEdges(memory.id)
      closeDb(db)
      res.json({ ...memory, edges })
    } catch {
      res.status(500).json({ error: 'Internal error' })
    }
  })

  router.delete('/api/memories/:id', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      store.delete(req.params.id)
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  router.put('/api/memories/:id', (req, res) => {
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      store.updateMemory(req.params.id, req.body || {})
      closeDb(db)
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // Non-destructive "Reinforce / Keep" action: bumps confidence +1 and resets the
  // staleness counter so a valuable low-confidence memory can be rehabilitated from
  // the dashboard instead of only Deprecate/Delete. Also doubles as the human
  // counterpart to the auto-decay's pending-review flagging.
  router.post('/api/memories/:id/reinforce', (req, res) => {
    const userId = (req as any).userId as string | undefined
    try {
      const db = openDb(ctx.skillbrainRoot)
      const store = new MemoryStore(db)
      const ok = store.reinforce(req.params.id, userId)
      closeDb(db)
      if (!ok) { res.status(404).json({ error: 'Memory not found' }); return }
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}
