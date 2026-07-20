export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Recommendation = 'SAFE' | 'CAUTION' | 'BLOCK'

export interface Finding {
  ruleId: string          // e.g. "E2", "PE3", "SSD-1"
  category: string        // e.g. "data_exfiltration"
  severity: Severity
  confidence: number      // 0..1
  message: string
  line?: number
  match?: string          // matched snippet (truncated)
  source: 'static' | 'llm'
  inExecutableBlock?: boolean
}

export interface ScanReport {
  score: number           // 0..100
  severity: Severity
  recommendation: Recommendation
  findings: Finding[]
  scannedAt: string       // ISO; injected by caller (do not call Date.now in pure core)
}
