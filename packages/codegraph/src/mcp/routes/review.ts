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
import Anthropic from '@anthropic-ai/sdk'
import { openDb, closeDb } from '@skillbrain/storage'
import { SkillsStore } from '@skillbrain/storage'
import { AuditStore } from '@skillbrain/storage'
import type { RouteContext } from './index.js'

export function createReviewRouter(ctx: RouteContext): Router {
  const router = Router()

  router.get('/api/review/pending', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    const limit = Math.min(Number(req.query.limit) || 100, 500)
    const offset = Math.max(Number(req.query.offset) || 0, 0)
    try {
      const memories = db.prepare(
        `SELECT id, type, context, solution, skill, tags, created_at FROM memories WHERE status = 'pending-review' ORDER BY created_at DESC LIMIT ? OFFSET ?`
      ).all(limit, offset)
      const skills = db.prepare(
        `SELECT name, category, description, type, updated_at FROM skills WHERE status = 'pending' ORDER BY updated_at DESC`
      ).all()
      const components = db.prepare(
        `SELECT id, name, project, section_type, description, created_at FROM ui_components WHERE status = 'pending' ORDER BY created_at DESC`
      ).all()
      let proposals: unknown[] = []
      let dsScans: unknown[] = []
      try {
        proposals = db.prepare(
          `SELECT * FROM skill_proposals WHERE status = 'pending' ORDER BY proposed_at DESC`
        ).all()
      } catch { /* table not yet migrated */ }
      try {
        dsScans = db.prepare(
          `SELECT * FROM design_system_scans WHERE status = 'pending' ORDER BY scanned_at DESC`
        ).all()
      } catch { /* ignore */ }
      const totals = {
        memories: (db.prepare(`SELECT COUNT(*) as n FROM memories WHERE status='pending-review'`).get() as any).n,
        skills: (db.prepare(`SELECT COUNT(*) as n FROM skills WHERE status='pending'`).get() as any).n,
        components: (db.prepare(`SELECT COUNT(*) as n FROM ui_components WHERE status='pending'`).get() as any).n,
        proposals: proposals.length,
        dsScans: dsScans.length,
      }
      res.json({ memories, skills, components, proposals, dsScans, totals, page: { limit, offset } })
    } finally {
      closeDb(db)
    }
  })

  router.post('/api/review/memory/:id/approve', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    const now = new Date().toISOString()
    db.prepare(`UPDATE memories SET status = 'active', updated_at = ? WHERE id = ?`)
      .run(now, req.params.id)
    new AuditStore(db).log({ entityType: 'memory', entityId: req.params.id, action: 'approve', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  router.post('/api/review/memory/:id/reject', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    const now = new Date().toISOString()
    db.prepare(`UPDATE memories SET status = 'deprecated', updated_at = ? WHERE id = ?`)
      .run(now, req.params.id)
    new AuditStore(db).log({ entityType: 'memory', entityId: req.params.id, action: 'reject', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  router.post('/api/review/skill/:name/approve', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    const name = decodeURIComponent(req.params.name)
    db.prepare(`UPDATE skills SET status = 'active', updated_at = ? WHERE name = ?`)
      .run(new Date().toISOString(), name)
    new AuditStore(db).log({ entityType: 'skill', entityId: name, action: 'approve', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  router.post('/api/review/skill/:name/reject', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    const name = decodeURIComponent(req.params.name)
    const now = new Date().toISOString()
    db.prepare(`UPDATE skills SET status = 'deprecated', updated_at = ?, updated_by_user_id = ? WHERE name = ? AND status = 'pending'`)
      .run(now, (req as any).userId ?? null, name)
    new AuditStore(db).log({ entityType: 'skill', entityId: name, action: 'reject', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  router.post('/api/review/component/:id/approve', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    db.prepare(`UPDATE ui_components SET status = 'active', updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), req.params.id)
    new AuditStore(db).log({ entityType: 'component', entityId: req.params.id, action: 'approve', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  router.post('/api/review/component/:id/reject', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    const now = new Date().toISOString()
    db.prepare(`UPDATE ui_components SET status = 'deprecated', updated_at = ?, updated_by_user_id = ? WHERE id = ? AND status = 'pending'`)
      .run(now, (req as any).userId ?? null, req.params.id)
    new AuditStore(db).log({ entityType: 'component', entityId: req.params.id, action: 'reject', reviewedBy: (req as any).userId ?? 'unknown' })
    closeDb(db)
    res.json({ ok: true })
  })

  router.post('/api/review/proposal/:id/dismiss', (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    try {
      db.prepare(`UPDATE skill_proposals SET status = 'dismissed', reviewed_at = ? WHERE id = ?`)
        .run(new Date().toISOString(), req.params.id)
      new AuditStore(db).log({ entityType: 'proposal', entityId: req.params.id, action: 'dismiss', reviewedBy: (req as any).userId ?? 'unknown' })
    } catch { /* ignore if table not migrated */ }
    closeDb(db)
    res.json({ ok: true })
  })

  router.post('/api/review/proposal/:id/generate', ctx.requireAdmin, async (req, res) => {
    if (!ctx.anthropicApiKey) {
      res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' }); return
    }
    const db = openDb(ctx.skillbrainRoot)
    let proposal: any, skill: any, memories: any[]
    try {
      proposal = db.prepare('SELECT * FROM skill_proposals WHERE id = ?').get(req.params.id)
      if (!proposal) { closeDb(db); res.status(404).json({ error: 'Proposal not found' }); return }
      skill = db.prepare('SELECT * FROM skills WHERE name = ?').get(proposal.skill_name)
      const memIds: string[] = JSON.parse(proposal.memory_ids || '[]')
      memories = memIds
        .map(id => db.prepare('SELECT type, context, problem, solution, reason FROM memories WHERE id = ?').get(id))
        .filter(Boolean) as any[]
    } finally {
      closeDb(db)
    }

    const memoriesText = memories.map((m: any) =>
      `### [${m.type}]\nContext: ${m.context}\nProblem: ${m.problem}\nSolution: ${m.solution}\nWhy: ${m.reason}`
    ).join('\n\n')

    const currentContent = skill?.content
      ? `## Current Skill Content\n\`\`\`\n${skill.content}\n\`\`\``
      : `## Note\nThis skill does not exist yet — create it from scratch based on the learnings below.`

    const prompt = `You are improving a Synapse skill file based on recent learnings.

## Skill: ${proposal.skill_name}
Category: ${skill?.category || 'unknown'}
Description: ${skill?.description || '(new skill)'}

${currentContent}

## New Learnings to Incorporate
${memoriesText}

## Instructions
Generate an improved SKILL.md for skill "${proposal.skill_name}" that incorporates these learnings.
- Keep the existing structure and format if a current version exists
- Add concrete examples, gotchas, and actionable patterns from the learnings
- Be specific and practical — this file is read by an AI agent before working on a task
- Output ONLY the updated Markdown content, nothing else`

    try {
      const client = new Anthropic({ apiKey: ctx.anthropicApiKey })
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      })
      const generatedContent = (response.content[0] as any).text as string

      const db2 = openDb(ctx.skillbrainRoot)
      try {
        db2.prepare(`UPDATE skill_proposals SET proposed_content = ? WHERE id = ?`)
          .run(generatedContent, req.params.id)
        new AuditStore(db2).log({ entityType: 'proposal', entityId: String(req.params.id), action: 'generate', reviewedBy: (req as any).userId ?? 'unknown' })
      } finally {
        closeDb(db2)
      }
      res.json({ ok: true, content: generatedContent })
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Generation failed' })
    }
  })

  router.post('/api/review/proposal/:id/apply', ctx.requireAdmin, (req, res) => {
    const db = openDb(ctx.skillbrainRoot)
    try {
      const proposal = db.prepare('SELECT * FROM skill_proposals WHERE id = ?').get(req.params.id) as any
      if (!proposal?.proposed_content) {
        res.status(400).json({ error: 'No generated content — run generate first' }); return
      }
      const existing = db.prepare('SELECT * FROM skills WHERE name = ?').get(proposal.skill_name) as any
      const now = new Date().toISOString()
      const content = proposal.proposed_content
      const userId = (req as any).userId ?? null
      if (existing) {
        const store = new SkillsStore(db)
        store.upsert({
          ...existing,
          content,
          lines: content.split('\n').length,
          updatedAt: now,
          status: 'active',
          updatedByUserId: userId,
        }, { changedBy: userId, reason: 'haiku-evolution' })
      } else {
        db.prepare(`INSERT INTO skills (name, category, description, content, type, tags, lines, updated_at, status, created_by_user_id) VALUES (?, ?, ?, ?, 'domain', '[]', ?, ?, 'active', ?)`)
          .run(proposal.skill_name, proposal.skill_name, `Auto-generated from memories`, content, content.split('\n').length, now, userId)
      }
      db.prepare(`UPDATE skill_proposals SET status = 'dismissed', reviewed_at = ? WHERE id = ?`)
        .run(now, req.params.id)
      new AuditStore(db).log({ entityType: 'proposal', entityId: String(req.params.id), action: 'apply', reviewedBy: userId ?? 'unknown', metadata: { skillName: proposal.skill_name } })
      res.json({ ok: true, skillName: proposal.skill_name })
    } finally {
      closeDb(db)
    }
  })

  return router
}
