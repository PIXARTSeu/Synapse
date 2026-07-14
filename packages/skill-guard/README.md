# @skillbrain/skill-guard

Security scanner for SkillBrain skill packages. Every skill written through
the import pipeline or the `skill_add` / `skill_update` MCP tools is scanned
before it lands in the catalog — this package is the scanner.

Portions of the detection catalog, scoring model, and LLM judge prompt
structure are derived from NVIDIA SkillSpector (Apache-2.0). See `NOTICE`
for the full attribution.

## What it does

`scanSkill()` inspects a skill's Markdown content for signals commonly seen
in prompt-injection / data-exfiltration payloads — piped-curl-to-shell,
credential/SSH-key reads followed by network calls, webhook exfil
indicators, obfuscated commands, etc. — and returns a `ScanReport`:

```ts
export interface ScanReport {
  score: number                              // 0..100
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  recommendation: 'SAFE' | 'CAUTION' | 'BLOCK'
  findings: Finding[]                        // one entry per matched rule
  scannedAt: string                          // ISO timestamp, set by caller
}
```

## Usage

```ts
import { scanSkill } from '@skillbrain/skill-guard'

// Static-only (default) — synchronous pattern matching, no network/LLM call.
const report = await scanSkill(skillMarkdownContent)

// With the optional LLM judge layer — pass a `complete()` callback and the
// static findings are combined with a semantic second pass before scoring.
const reportWithLlm = await scanSkill(skillMarkdownContent, {
  llm: { complete: async (prompt) => anthropic.messages.create(...) },
})
```

- **Static is always run.** `scanStatic()` (regex/pattern catalog in
  `patterns.ts`) executes on every call — no configuration needed, no
  external dependency, no cost.
- **LLM is opt-in.** Only runs when an `opts.llm.complete` callback is
  supplied. Without it, `scanSkill` returns the static-only report. This
  keeps the scan cheap and synchronous-safe on hot write paths (skill
  import, `skill_add`/`skill_update`), while still allowing a deeper
  semantic pass on demand (the `skill_scan` MCP tool can request it
  explicitly).

## Scoring bands

Findings are weighted by severity (CRITICAL/HIGH/MEDIUM/LOW), diminishing
per repeated rule ID, and boosted when the pattern sits inside an
executable code block. The final 0–100 score maps to a recommendation:

| Score   | Severity | Recommendation |
|---------|----------|----------------|
| 0–20    | LOW      | `SAFE`         |
| 21–50   | MEDIUM   | `CAUTION`      |
| 51–100  | HIGH/CRITICAL | `BLOCK`   |

## How the gate uses this

`@skillbrain/storage`'s `applyGate()` wraps `scanSkill()` around every skill
write path (bulk import and the `skill_add`/`skill_update` MCP tools):

- `recommendation === 'BLOCK'` → the skill's `status` is forced to
  `'pending'`, regardless of what status it was written with. It never
  auto-activates; a human must review it via `/api/review/pending` (which
  exposes `risk_score`, `risk_recommendation`, `risk_findings` for the
  dashboard's risk badge) before it can go `active`.
- `SAFE` / `CAUTION` → the verdict is attached (`risk_*` columns) but the
  skill's status is left untouched — the gate never *promotes* a skill,
  only quarantines one.
