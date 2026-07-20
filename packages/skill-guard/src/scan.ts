/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import { scanStatic } from './scan-static.js'
import { scanLlm, type LlmClient } from './scan-llm.js'
import { scoreFindings } from './score.js'
import type { ScanReport } from './types.js'

export interface ScanSkillOpts {
  llm?: { complete: LlmClient['complete'] }
  scannedAt?: string
}

export async function scanSkill(content: string, opts: ScanSkillOpts = {}): Promise<ScanReport> {
  const staticRep = scanStatic(content, opts.scannedAt)
  if (!opts.llm) return staticRep
  const llmFindings = await scanLlm(content, opts.llm)
  return scoreFindings([...staticRep.findings, ...llmFindings], opts.scannedAt ?? '')
}
