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
 * Pure scan-and-format logic behind the `skill_scan` MCP tool (Task 8) —
 * the on-demand counterpart to the ingestion gate (`applyGate`, Task 7).
 *
 * Split out of skills.ts so it can be unit-tested without spinning up an
 * McpServer or a SkillsStore-backed DB (see tests/skill-scan-tool.test.ts).
 * The actual server.tool('skill_scan', ...) handler in skills.ts is a thin
 * wrapper: resolve the target content (resolveScanTarget), resolve an
 * Anthropic key if `llm: true` was requested, then call runSkillScan().
 *
 * Unlike applyGate (write-path, static-only by design — see skill-gate.ts),
 * this is the read-path/on-demand tool where the optional LLM judge layer
 * built in Task 5 (@skillbrain/skill-guard's scanLlm) is actually reachable.
 */

import { scanSkill, type LlmClient, type ScanReport } from '@skillbrain/storage'

export interface ResolveScanTargetInput {
  name?: string
  content?: string
}

export type ScanTargetResult = { target: string } | { error: string }

/**
 * Resolve what to scan: an existing skill's content (by name, via the
 * caller-supplied loader) takes precedence, falling back to raw `content`.
 * Returns a clear, user-facing error string when neither resolves.
 */
export function resolveScanTarget(
  input: ResolveScanTargetInput,
  loadSkillContent: (name: string) => string | undefined,
): ScanTargetResult {
  if (input.name) {
    const content = loadSkillContent(input.name)
    if (content === undefined) {
      return { error: `Skill "${input.name}" not found. Use skill_list to see available skills.` }
    }
    return { target: content }
  }
  if (input.content) return { target: input.content }
  return { error: 'Provide either "name" (an existing skill) or "content" (raw text) to scan.' }
}

function verdictLine(report: ScanReport): string {
  const icon = report.recommendation === 'BLOCK' ? '⛔' : report.recommendation === 'CAUTION' ? '⚠️' : '✅'
  return `${icon} ${report.recommendation} (score ${report.score})`
}

export interface FormatScanReportOpts {
  llmRequested: boolean
  llmRan: boolean
}

/** Renders the ScanReport as JSON text plus a one-line human verdict + LLM-layer note. */
export function formatScanReport(report: ScanReport, opts: FormatScanReportOpts): string {
  const layerNote = opts.llmRan
    ? 'LLM judge: ran'
    : opts.llmRequested
      ? 'LLM judge: requested but skipped (no Anthropic API key resolved) — static-only result'
      : 'LLM judge: not requested (static-only)'
  return `${verdictLine(report)}\n${layerNote}\n\n${JSON.stringify(report, null, 2)}`
}

export interface RunSkillScanOpts {
  /** LLM completion callback. If provided, the LLM judge layer runs. */
  complete?: LlmClient['complete']
  /** Whether the caller asked for `llm: true` — used only for the "skipped" note when `complete` is absent. */
  llmRequested?: boolean
}

export interface SkillScanResult {
  report: ScanReport
  text: string
  llmRan: boolean
}

/** Runs scanSkill() (LLM layer only when `complete` is given) and formats the response. */
export async function runSkillScan(content: string, opts: RunSkillScanOpts = {}): Promise<SkillScanResult> {
  const llmRan = typeof opts.complete === 'function'
  const report = await scanSkill(content, llmRan ? { llm: { complete: opts.complete! } } : {})
  return { report, text: formatScanReport(report, { llmRequested: !!opts.llmRequested, llmRan }), llmRan }
}
