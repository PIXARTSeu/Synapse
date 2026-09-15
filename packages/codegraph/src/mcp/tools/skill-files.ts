/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import type { Skill, SkillFileInfo } from '@skillbrain/storage'

export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

/** Upstream skills link support files as "./NAME.md"; stored paths have no "./". */
export function normalizeSupportPath(file: string): string {
  return file.replace(/^(\.\/)+/, '')
}

/** skill_read output without `file`: the skill, plus its support files when it has any. */
export function formatSkillRead(skill: Pick<Skill, 'name' | 'type' | 'category' | 'content'>, files: SkillFileInfo[]): string {
  const base = `# ${skill.name} (${skill.type}, ${skill.category})\n\n${skill.content}`
  if (files.length === 0) return base
  const list = files.map((f) => `- ${f.path} (${formatBytes(f.bytes)})`).join('\n')
  return `${base}\n\n## Supporting files\n${list}\nRead one with skill_read({ name: "${skill.name}", file: "<path>" }).`
}

/** skill_read output with `file`: the file, or a not-found message listing what exists. */
export function formatSkillFile(skillName: string, filePath: string, content: string | undefined, files: SkillFileInfo[]): string {
  if (content !== undefined) return `# ${skillName} / ${filePath}\n\n${content}`
  const available = files.length > 0 ? files.map((f) => `- ${f.path}`).join('\n') : '(none)'
  return `File "${filePath}" not found for skill "${skillName}". Available files:\n${available}`
}
