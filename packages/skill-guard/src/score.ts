import type { Finding, ScanReport, Severity, Recommendation } from './types.js'

const BASE_POINTS: Record<Severity, number> = { CRITICAL: 50, HIGH: 25, MEDIUM: 10, LOW: 5 }
const DIMINISHING = [1.0, 0.5, 0.25] // 4th+ hit of a ruleId ignored
const EXEC_MULTIPLIER = 1.3

function bandFor(score: number): { severity: Severity; recommendation: Recommendation } {
  if (score <= 20) return { severity: 'LOW', recommendation: 'SAFE' }
  if (score <= 50) return { severity: 'MEDIUM', recommendation: 'CAUTION' }
  if (score <= 80) return { severity: 'HIGH', recommendation: 'BLOCK' }
  return { severity: 'CRITICAL', recommendation: 'BLOCK' }
}

/** Pure scoring — no clock/RNG. Caller sets scannedAt. */
export function scoreFindings(findings: Finding[], scannedAt = ''): ScanReport {
  const seen = new Map<string, number>()
  let score = 0
  for (const fnd of findings) {
    const n = seen.get(fnd.ruleId) ?? 0
    seen.set(fnd.ruleId, n + 1)
    if (n >= DIMINISHING.length) continue
    const weight = DIMINISHING[n]
    const conf = Math.min(1, Math.max(0, fnd.confidence))
    const exec = fnd.inExecutableBlock ? EXEC_MULTIPLIER : 1
    score += BASE_POINTS[fnd.severity] * weight * conf * exec
  }
  const final = Math.min(100, Math.max(0, Math.floor(score)))
  const band = bandFor(final)
  return { score: final, ...band, findings, scannedAt }
}
