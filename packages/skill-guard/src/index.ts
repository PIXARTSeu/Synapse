/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

export const SKILL_GUARD_VERSION = '0.1.0'
export * from './types.js'
export { scanStatic } from './scan-static.js'
export { scoreFindings } from './score.js'
export { PATTERNS } from './patterns.js'
export { scanSkill } from './scan.js'
export { scanLlm, JUDGE_PROMPT, type LlmClient } from './scan-llm.js'
