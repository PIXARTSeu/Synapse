/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

/**
 * Security-gate policy helper — wraps @skillbrain/skill-guard's scanner
 * around every skill write path (import + skill_add/skill_update, Task 7).
 *
 * Policy:
 *  - Run scanSkill() on skill.content.
 *  - recommendation === 'BLOCK' → force status = 'pending' (quarantine),
 *    never auto-active, regardless of the incoming status.
 *  - Otherwise (SAFE/CAUTION) → attach the verdict, leave status untouched
 *    (applyGate never *promotes* status — a 'pending' draft stays pending).
 *  - Always populate risk_* fields so downstream consumers (dashboard,
 *    skill_scan MCP tool) can read the verdict without re-scanning.
 *
 * Static-only at both current call sites (import-skills.ts, skills.ts
 * skill_add/skill_update): `opts.llm` is accepted here for forward
 * compatibility (this signature is shared with the on-demand `skill_scan`
 * MCP tool planned for Task 8) but must NOT be passed from those call
 * sites — a synchronous LLM call on every ingestion write would add
 * latency, cost, and per-user API-key plumbing to the write path.
 *
 * scannedAt is injected here (impure boundary) so the skill-guard core
 * (scanStatic/scoreFindings) stays clock-free and unit-testable.
 */

import { scanSkill, type ScanSkillOpts } from '@skillbrain/skill-guard'

export interface GateFields {
  riskScore: number
  riskRecommendation: 'SAFE' | 'CAUTION' | 'BLOCK'
  riskFindings: string
  riskScannedAt: string
}

export async function applyGate<T extends { content?: string; status?: string }>(
  skill: T,
  opts: ScanSkillOpts & { scannedAt?: string } = {},
): Promise<T & GateFields> {
  const scannedAt = opts.scannedAt ?? new Date().toISOString()
  const rep = await scanSkill(skill.content ?? '', { ...opts, scannedAt })
  const status = rep.recommendation === 'BLOCK' ? 'pending' : skill.status

  return {
    ...skill,
    status,
    riskScore: rep.score,
    riskRecommendation: rep.recommendation,
    riskFindings: JSON.stringify(rep.findings),
    riskScannedAt: scannedAt,
  }
}
