/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

// skill_read support files: the tool handler wires SkillsStore.listFiles/getFile
// into these pure formatters (same testing approach as skill-scan-tool.test.ts).

import { describe, expect, it } from 'vitest'
import { formatSkillFile, formatSkillRead } from '../src/mcp/tools/skill-files.js'

const skill = { name: 'teach', type: 'process' as const, category: 'Process', content: '# Teach\nBody' }

describe('formatSkillRead', () => {
  it('returns the skill as before when it has no support files', () => {
    expect(formatSkillRead(skill, [])).toBe('# teach (process, Process)\n\n# Teach\nBody')
  })

  it('appends the supporting files with sizes and how to read one', () => {
    const text = formatSkillRead(skill, [
      { path: 'MISSION-FORMAT.md', bytes: 2150 },
      { path: 'notes.md', bytes: 512 },
    ])
    expect(text).toBe(
      [
        '# teach (process, Process)',
        '',
        '# Teach',
        'Body',
        '',
        '## Supporting files',
        '- MISSION-FORMAT.md (2.1 KB)',
        '- notes.md (512 B)',
        'Read one with skill_read({ name: "teach", file: "<path>" }).',
      ].join('\n'),
    )
  })
})

describe('formatSkillFile', () => {
  it('returns the file under a name / path heading', () => {
    expect(formatSkillFile('teach', 'MISSION-FORMAT.md', '# Mission', [])).toBe('# teach / MISSION-FORMAT.md\n\n# Mission')
  })

  it('names the missing path and lists the available files', () => {
    expect(formatSkillFile('teach', 'nope.md', undefined, [{ path: 'MISSION-FORMAT.md', bytes: 10 }])).toBe(
      'File "nope.md" not found for skill "teach". Available files:\n- MISSION-FORMAT.md',
    )
  })

  it('says none are available when the skill has no support files', () => {
    expect(formatSkillFile('teach', 'nope.md', undefined, [])).toBe(
      'File "nope.md" not found for skill "teach". Available files:\n(none)',
    )
  })
})
