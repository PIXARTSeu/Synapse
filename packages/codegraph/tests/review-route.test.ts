/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

// Task 9: /api/review/pending must surface the skill-guard risk verdict
// (risk_score, risk_recommendation, risk_findings) so the dashboard can render
// a risk badge next to each pending skill. Harness mirrors tests/oauth-router.test.ts
// (real express app + ephemeral http server + raw http.request) — the lightest
// precedent already in this repo for exercising an Express router end-to-end.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import http from 'node:http'
import fs from 'node:fs'
import Database from 'better-sqlite3'
import { runMigrations, SkillsStore } from '@skillbrain/storage'
import { createReviewRouter } from '../src/mcp/routes/review.js'
import type { RouteContext } from '../src/mcp/routes/index.js'

function fetchJson(port: number, path: string): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method: 'GET' }, (res) => {
      let raw = ''
      res.on('data', (c) => { raw += c })
      res.on('end', () => {
        let body: any = raw
        try { body = JSON.parse(raw) } catch { /* keep raw */ }
        resolve({ status: res.statusCode!, body })
      })
    })
    req.on('error', reject)
    req.end()
  })
}

function createApp(skillbrainRoot: string): express.Express {
  const app = express()
  const ctx: RouteContext = {
    skillbrainRoot,
    requireAdmin: (_req, _res, next) => next(),
    hashPassword: async () => ({ hash: '', salt: '' }),
    generatePassword: () => '',
    sendInviteEmail: async () => {},
    anthropicApiKey: '',
    isLocalhost: () => true,
  }
  app.use(createReviewRouter(ctx))
  return app
}

async function withServer(app: express.Express, fn: (port: number) => Promise<void>) {
  const server = http.createServer(app)
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  const port = (server.address() as any).port
  try {
    await fn(port)
  } finally {
    server.close()
  }
}

describe('GET /api/review/pending — risk verdict surfacing', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = `/tmp/review-route-test-${Date.now()}`
    fs.mkdirSync(`${tmpDir}/.codegraph`, { recursive: true })
    const db = new Database(`${tmpDir}/.codegraph/graph.db`)
    runMigrations(db)

    const store = new SkillsStore(db)
    store.upsert({
      name: 'malicious-skill',
      category: 'test',
      description: 'A skill quarantined by the security gate',
      content: '# body',
      type: 'domain',
      tags: [],
      lines: 1,
      updatedAt: new Date().toISOString(),
      status: 'pending',
      riskScore: 78,
      riskRecommendation: 'BLOCK',
      riskFindings: JSON.stringify([{ ruleId: 'E2', category: 'data_exfiltration', severity: 'CRITICAL', message: 'curl | sudo bash' }]),
    } as any)

    db.close()
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('exposes risk_score, risk_recommendation and risk_findings for a BLOCKed pending skill', async () => {
    const app = createApp(tmpDir)
    await withServer(app, async (port) => {
      const res = await fetchJson(port, '/api/review/pending')
      expect(res.status).toBe(200)
      const skill = res.body.skills.find((s: any) => s.name === 'malicious-skill')
      expect(skill).toBeTruthy()
      expect(skill.risk_recommendation).toBe('BLOCK')
      expect(skill.risk_score).toBe(78)
      expect(Array.isArray(JSON.parse(skill.risk_findings))).toBe(true)
      expect(JSON.parse(skill.risk_findings)[0].ruleId).toBe('E2')
    })
  })
})
