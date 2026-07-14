import { PATTERNS } from './patterns.js'
import { scoreFindings } from './score.js'
import type { Finding, ScanReport } from './types.js'

const EXEC_LANGS = /^(sh|bash|shell|zsh|python|py|js|ts|javascript|typescript)\b/i

/** Returns, per 0-based line index, whether that line is inside an executable fenced block. */
function execBlockMap(lines: string[]): boolean[] {
  const map = new Array(lines.length).fill(false)
  let inFence = false
  let exec = false
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^\s*```+\s*([A-Za-z0-9_+-]*)/)
    if (fence) {
      if (!inFence) { inFence = true; exec = EXEC_LANGS.test(fence[1] ?? '') }
      else { inFence = false; exec = false }
      continue // the fence line itself is not content
    }
    map[i] = inFence && exec
  }
  return map
}

export function scanStatic(content: string, scannedAt = ''): ScanReport {
  const lines = content.split(/\r?\n/)
  const execMap = execBlockMap(lines)
  const findings: Finding[] = []
  for (const rule of PATTERNS) {
    const re = new RegExp(rule.regex, rule.flags ?? 'i')
    for (let i = 0; i < lines.length; i++) {
      const m = re.exec(lines[i])
      if (!m) continue
      findings.push({
        ruleId: rule.ruleId,
        category: rule.category,
        severity: rule.severity,
        confidence: rule.confidence,
        message: rule.message,
        line: i + 1,
        match: m[0].slice(0, 120),
        source: 'static',
        inExecutableBlock: execMap[i],
      })
    }
  }
  return scoreFindings(findings, scannedAt)
}
