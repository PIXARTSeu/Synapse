import { describe, it, expect } from 'vitest'
import { scoreFindings } from '../src/score.js'
import type { Finding } from '../src/types.js'

const f = (o: Partial<Finding>): Finding => ({
  ruleId: 'X', category: 'c', severity: 'HIGH', confidence: 1,
  message: 'm', source: 'static', ...o,
})

describe('scoreFindings', () => {
  it('no findings → SAFE 0', () => {
    const r = scoreFindings([])
    expect(r.score).toBe(0)
    expect(r.recommendation).toBe('SAFE')
    expect(r.severity).toBe('LOW')
  })

  it('single CRITICAL (score 50) → CAUTION', () => {
    const r = scoreFindings([f({ severity: 'CRITICAL', confidence: 1 })])
    expect(r.score).toBe(50)          // 50 * 1.0 * 1.0
    expect(r.recommendation).toBe('CAUTION') // band 21-50 = CAUTION per spec
  })

  it('two CRITICAL of SAME ruleId → diminishing (50 + 25) = 75 → BLOCK', () => {
    const r = scoreFindings([
      f({ ruleId: 'A', severity: 'CRITICAL' }),
      f({ ruleId: 'A', severity: 'CRITICAL' }),
    ])
    expect(r.score).toBe(75)
    expect(r.recommendation).toBe('BLOCK')
  })

  it('executable-block multiplier 1.3x', () => {
    const r = scoreFindings([f({ severity: 'MEDIUM', confidence: 1, inExecutableBlock: true })])
    expect(r.score).toBe(13)          // 10 * 1.0 * 1.0 * 1.3
  })

  it('confidence scales contribution', () => {
    const r = scoreFindings([f({ severity: 'HIGH', confidence: 0.6 })])
    expect(r.score).toBe(15)          // 25 * 1.0 * 0.6
  })

  it('caps at 100', () => {
    const many = Array.from({ length: 10 }, (_, i) => f({ ruleId: `R${i}`, severity: 'CRITICAL' }))
    expect(scoreFindings(many).score).toBe(100)
  })
})
