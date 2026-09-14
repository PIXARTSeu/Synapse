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
 * Import skills, agents, and commands from filesystem into SQLite.
 *
 * Primary source: .claude/ — Legacy fallback: .opencode/
 * Walks .claude/skill/, .agents/skills/, .claude/agents/, .claude/command/
 * and imports all SKILL.md, AGENT.md, and command .md files.
 */

import fs from 'node:fs'
import path from 'node:path'
import { openDb, closeDb } from './db.js'
import { SkillsStore, type Skill, type SkillFileInput, type SkillType } from './skills-store.js'
import { applyGate } from './skill-gate.js'

function pickDir(workspacePath: string, ...segments: string[]): string {
  const newPath = path.join(workspacePath, '.claude', ...segments)
  if (fs.existsSync(newPath)) return newPath
  return path.join(workspacePath, '.opencode', ...segments)
}

// Single source of truth for skill → category. 16 canonical categories:
// Frontend, Mobile, Backend, Data, DevOps, Testing, Marketing, SEO, CMS,
// Process, Lifecycle, Agents, Commands, Legal, Media, System.
// agent:* and command:* are auto-resolved by prefix in detectCategory().
const CATEGORY_MAP: Record<string, string> = {
  // Frontend (web UI + 3D)
  'angular-architect': 'Frontend', animations: 'Frontend', astro: 'Frontend',
  'claude-design': 'Frontend', 'css-3d-transforms': 'Frontend', figma: 'Frontend',
  fonts: 'Frontend', 'framer-motion-advanced': 'Frontend', 'frontend-design': 'Frontend',
  'glsl-shaders': 'Frontend', 'gltf-asset-pipeline': 'Frontend', i18n: 'Frontend',
  'mobile-first': 'Frontend', 'motion-system': 'Frontend', 'next-best-practices': 'Frontend',
  nextjs: 'Frontend', 'nextjs-developer': 'Frontend', nuxt: 'Frontend', pwa: 'Frontend',
  'r3f-physics': 'Frontend', 'r3f-postprocessing': 'Frontend', 'react-expert': 'Frontend',
  'react-three-fiber': 'Frontend', 'scroll-3d-animations': 'Frontend', shadcn: 'Frontend',
  'spline-rive-web': 'Frontend', state: 'Frontend', stitch: 'Frontend',
  sveltekit: 'Frontend', tailwind: 'Frontend', 'threejs-fundamentals': 'Frontend',
  'ui-ux-pro-max': 'Frontend', 'vercel-react-best-practices': 'Frontend',
  'vue-expert': 'Frontend', 'vue-expert-js': 'Frontend', 'web-design-guidelines': 'Frontend',
  'webgpu-tsl': 'Frontend', 'webxr-spatial': 'Frontend',

  // Mobile
  // The two 'Expo UI …' title-case keys are the pre-kebab-case names these two
  // skills used to self-report; kept so already-imported rows keep their Mobile
  // category instead of silently falling back to 'Other'.
  'Expo UI Jetpack Compose': 'Mobile', 'Expo UI SwiftUI': 'Mobile',
  'expo-ui-jetpack-compose': 'Mobile', 'expo-ui-swiftui': 'Mobile',
  'building-native-ui': 'Mobile', 'expo-api-routes': 'Mobile',
  'expo-cicd-workflows': 'Mobile', 'expo-deployment': 'Mobile',
  'expo-dev-client': 'Mobile', 'expo-module': 'Mobile',
  'expo-tailwind-setup': 'Mobile', 'flutter-expert': 'Mobile',
  'kotlin-specialist': 'Mobile', 'native-data-fetching': 'Mobile',
  'react-native-best-practices': 'Mobile', 'react-native-brownfield-migration': 'Mobile',
  'react-native-expert': 'Mobile', 'swift-expert': 'Mobile',
  'upgrading-expo': 'Mobile', 'upgrading-react-native': 'Mobile', 'use-dom': 'Mobile',

  // Backend
  'ai-image-generation': 'Backend', 'ai-sdk': 'Backend', 'api-designer': 'Backend',
  'architecture-designer': 'Backend', auth: 'Backend', 'background-jobs': 'Backend',
  'claude-api-patterns': 'Backend', 'cli-developer': 'Backend', 'cpp-pro': 'Backend',
  'csharp-developer': 'Backend', 'django-expert': 'Backend', 'dotnet-core-expert': 'Backend',
  email: 'Backend', 'embedded-systems': 'Backend', 'fastapi-expert': 'Backend',
  'fine-tuning-expert': 'Backend', forms: 'Backend', 'fullstack-guardian': 'Backend',
  'game-developer': 'Backend', 'golang-pro': 'Backend', 'graphql-architect': 'Backend',
  'java-architect': 'Backend', 'javascript-pro': 'Backend', 'laravel-specialist': 'Backend',
  'legacy-modernizer': 'Backend', 'mcp-developer': 'Backend',
  'microservices-architect': 'Backend', 'nestjs-expert': 'Backend',
  'nodemailer-transactional': 'Backend', payments: 'Backend', 'php-pro': 'Backend',
  'prompt-engineer': 'Backend', 'python-pro': 'Backend', 'rails-expert': 'Backend',
  realtime: 'Backend', 'resend-react-email': 'Backend',
  'rhf-zod-server-actions': 'Backend', 'rust-engineer': 'Backend',
  'secure-code-guardian': 'Backend', 'security-headers': 'Backend',
  'security-reviewer': 'Backend', 'spark-engineer': 'Backend',
  'spec-miner': 'Backend', 'spring-boot-engineer': 'Backend',
  'stripe-subscriptions-webhooks': 'Backend', 'supabase-auth-ssr': 'Backend',
  'tanstack-query-next-actions': 'Backend', trpc: 'Backend',
  'typescript-pro': 'Backend', 'vercel-ai-sdk-streaming': 'Backend',
  'websocket-engineer': 'Backend',

  // Data
  database: 'Data', 'database-optimizer': 'Data', 'ml-pipeline': 'Data',
  mongodb: 'Data', 'odoo-api-query': 'Data', 'odoo-crm-lead': 'Data',
  'pandas-pro': 'Data', 'postgres-pro': 'Data', 'rag-architect': 'Data',
  'redis-development': 'Data', 'sql-pro': 'Data',

  // DevOps
  'audit-website': 'DevOps', 'chaos-engineer': 'DevOps', 'ci-cd': 'DevOps',
  'cloud-architect': 'DevOps', coolify: 'DevOps', 'devops-engineer': 'DevOps',
  docker: 'DevOps', github: 'DevOps', 'github-actions': 'DevOps',
  'kubernetes-specialist': 'DevOps', 'monitoring-expert': 'DevOps',
  'monitoring-nextjs': 'DevOps', n8n: 'DevOps', performance: 'DevOps',
  'project-automation': 'DevOps', 'project-health-check': 'DevOps',
  'quality-gates': 'DevOps', 'sentry-nextjs': 'DevOps', 'sre-engineer': 'DevOps',
  'terraform-engineer': 'DevOps', 'turborepo-monorepo': 'DevOps',

  // Testing
  'playwright-expert': 'Testing', 'skill-eval': 'Testing',
  'test-driven-development': 'Testing', 'test-master': 'Testing',
  testing: 'Testing', 'vitest-next-conventions': 'Testing',

  // Marketing
  'ab-testing': 'Marketing', 'ad-creative': 'Marketing', analytics: 'Marketing',
  'analytics-tracking': 'Marketing', 'churn-prevention': 'Marketing',
  'cold-email': 'Marketing', 'competitor-alternatives': 'Marketing',
  'content-strategy': 'Marketing', 'copy-editing': 'Marketing',
  copywriting: 'Marketing', 'cro-patterns': 'Marketing',
  'email-sequence': 'Marketing', 'form-cro': 'Marketing',
  'free-tool-strategy': 'Marketing', 'landing-architecture': 'Marketing',
  'launch-strategy': 'Marketing', 'marketing-ideas': 'Marketing',
  'marketing-psychology': 'Marketing', 'onboarding-cro': 'Marketing',
  'paid-ads': 'Marketing', 'paywall-upgrade-cro': 'Marketing',
  'popup-cro': 'Marketing', 'pricing-strategy': 'Marketing',
  'product-marketing-context': 'Marketing', 'referral-program': 'Marketing',
  revops: 'Marketing', 'sales-enablement': 'Marketing',
  'signup-flow-cro': 'Marketing', 'social-content': 'Marketing',

  // SEO
  'ai-seo': 'SEO', 'programmatic-seo': 'SEO', 'schema-markup': 'SEO',
  seo: 'SEO', 'seo-audit': 'SEO', 'seo-competitor-pages': 'SEO',
  'seo-content': 'SEO', 'seo-for-devs': 'SEO', 'seo-geo': 'SEO',
  'seo-hreflang': 'SEO', 'seo-images': 'SEO', 'seo-page': 'SEO',
  'seo-plan': 'SEO', 'seo-programmatic': 'SEO', 'seo-schema': 'SEO',
  'seo-sitemap-advanced': 'SEO', 'seo-technical': 'SEO',
  'site-architecture': 'SEO', sitemap: 'SEO',

  // CMS & content pipelines
  'agent-browser': 'CMS', cms: 'CMS', payload: 'CMS',
  'salesforce-developer': 'CMS', scraping: 'CMS', 'shopify-expert': 'CMS',
  'shopify-apps': 'CMS', 'shopify-core': 'CMS', 'shopify-functions': 'CMS',
  'shopify-storefront': 'CMS', 'shopify-themes': 'CMS',
  'website-cloning': 'CMS', 'wordpress-pro': 'CMS',

  // Process (workflows, code review, meta-skills)
  'atlassian-mcp': 'Process', brainstorming: 'Process',
  'code-documenter': 'Process', 'code-reviewer': 'Process',
  'debugging-wizard': 'Process', 'dispatching-parallel-agents': 'Process',
  'executing-plans': 'Process', 'feature-forge': 'Process',
  'finishing-a-development-branch': 'Process',
  'receiving-code-review': 'Process', 'requesting-code-review': 'Process',
  'skill-creator': 'Process', 'skill-syncer': 'Process',
  'skill-template-2.0': 'Process', 'subagent-driven-development': 'Process',
  'systematic-debugging': 'Process', 'the-fool': 'Process',
  'using-git-worktrees': 'Process', 'validate-skills': 'Process',
  'verification-before-completion': 'Process', 'writing-plans': 'Process',
  'writing-skills': 'Process',

  // Lifecycle (session/memory bootstraps)
  'capture-learning': 'Lifecycle', 'codegraph-context': 'Lifecycle',
  'load-learnings': 'Lifecycle', 'post-session-review': 'Lifecycle',
  'using-superpowers': 'Lifecycle',

  // Legal
  gdpr: 'Legal', iubenda: 'Legal', 'legal-templates': 'Legal',

  // Media (files, video, audio, AI gen)
  'ai-video-generation': 'Media', ffmpeg: 'Media', 'file-handling': 'Media',
  media: 'Media', remotion: 'Media', 'tts-voiceover': 'Media',
  'video-producer': 'Media',

  // System (meta/registry)
  AGENTS: 'System', CLAUDE: 'System', 'SKILLS-MAP': 'System',
  '_routing-index': 'System', 'pending-review': 'System',
}

export function detectCategory(name: string): string {
  if (name.startsWith('agent:')) return 'Agents'
  if (name.startsWith('command:')) return 'Commands'
  if (CATEGORY_MAP[name]) return CATEGORY_MAP[name]
  if (name.startsWith('seo-')) return 'SEO'
  if (name.includes('cro') || name.includes('marketing') || name.includes('strategy')) return 'Marketing'
  return 'Other'
}

function parseFrontmatter(content: string): { name?: string; description?: string; [key: string]: any } {
  // Normalise line endings first. Every pattern below is anchored on \n, so a
  // CRLF file (any Windows-authored skill) failed the opening `^---\n` match and
  // silently lost its ENTIRE frontmatter — the skill then fell back to its
  // directory name and a placeholder "Domain skill: <name>" description, which
  // strips the trigger keywords skill_route matches on and makes it effectively
  // unroutable. Silent, and invisible unless you diff the DB against the file.
  const normalised = content.replace(/\r\n/g, '\n')

  const match = normalised.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}

  const yaml = match[1]
  const result: Record<string, string> = {}

  for (const line of yaml.split('\n')) {
    const kv = line.match(/^(\w[\w-]*):\s*(.+)$/)
    if (kv) {
      result[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim()
    }
  }

  // Handle multi-line description
  const descMatch = yaml.match(/description:\s*>\s*\n([\s\S]*?)(?=\n\w|\n---|\n$)/)
  if (descMatch) {
    result.description = descMatch[1].replace(/\n\s*/g, ' ').trim()
  }

  return result
}

function walkDir(dir: string, callback: (file: string, name: string, skillDir?: string) => void): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (isDirectoryEntry(entry, full)) {
      // Look for SKILL.md or AGENT.md in subdirectory
      for (const mdFile of ['SKILL.md', 'AGENT.md']) {
        const mdPath = path.join(full, mdFile)
        if (fs.existsSync(mdPath)) {
          callback(mdPath, entry.name, full)
        }
      }
    } else if (entry.name.endsWith('.md')) {
      // A loose .md is a skill only if it declares frontmatter. Skill zones also
      // hold docs (.agents/skills/ has AGENTS.md, CLAUDE.md, SKILLS-MAP.md) that
      // would otherwise land in the catalog named after the file.
      if (!/^\uFEFF?---\r?\n/.test(fs.readFileSync(full, 'utf-8').slice(0, 8))) continue
      callback(full, entry.name.replace('.md', ''))
    }
  }
}

// The container links each lifecycle skill directory into .agents/skills/ as a
// symlink, and Dirent.isDirectory() is false for a symlink — follow it.
function isDirectoryEntry(entry: fs.Dirent, full: string): boolean {
  if (entry.isDirectory()) return true
  if (!entry.isSymbolicLink()) return false
  try {
    return fs.statSync(full).isDirectory()
  } catch {
    return false
  }
}

const SUPPORT_FILE_MAX_BYTES = 256 * 1024
const SUPPORT_FILES_MAX_TOTAL_BYTES = 2 * 1024 * 1024
const BINARY_SNIFF_BYTES = 8192

/**
 * Every file in a skill directory other than its entry file (SKILL.md / AGENT.md):
 * formats, templates, references/. Skips dotfiles, binary files and files over
 * SUPPORT_FILE_MAX_BYTES; stops once the skill would exceed
 * SUPPORT_FILES_MAX_TOTAL_BYTES. Paths are relative with '/' separators.
 */
function collectSupportFiles(skillDir: string, entryFile: string): SkillFileInput[] {
  const files: SkillFileInput[] = []
  let total = 0
  let capped = false

  const walk = (dir: string, rel: string): void => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))
    } catch (err) {
      // Permission-denied or otherwise unreadable subdirectory: skip it, never
      // abort the whole catalog import over one bad directory.
      console.warn(
        `[import-skills] support files for "${path.basename(skillDir)}": cannot read directory "${rel || '.'}" — ${(err as Error).message}`,
      )
      return
    }
    for (const entry of entries) {
      if (capped) return
      if (entry.name.startsWith('.')) continue
      const full = path.join(dir, entry.name)
      const relPath = rel ? `${rel}/${entry.name}` : entry.name
      let stat: fs.Stats
      try {
        stat = fs.statSync(full)
      } catch {
        continue
      }
      if (stat.isDirectory()) {
        walk(full, relPath)
        continue
      }
      if (!stat.isFile() || relPath === entryFile) continue
      if (stat.size > SUPPORT_FILE_MAX_BYTES) continue
      let buf: Buffer
      try {
        buf = fs.readFileSync(full)
      } catch (err) {
        // Permission-denied, or removed in the race between readdir and read:
        // skip this one file, never abort the whole catalog import.
        console.warn(
          `[import-skills] support files for "${path.basename(skillDir)}": cannot read "${relPath}" — ${(err as Error).message}`,
        )
        continue
      }
      if (buf.subarray(0, BINARY_SNIFF_BYTES).includes(0)) continue
      if (total + buf.length > SUPPORT_FILES_MAX_TOTAL_BYTES) {
        capped = true
        return
      }
      total += buf.length
      files.push({ path: relPath, content: buf.toString('utf-8'), bytes: buf.length })
    }
  }

  walk(skillDir, '')
  if (capped) {
    console.warn(`[import-skills] support files for "${path.basename(skillDir)}" exceed 2 MB — the rest were skipped.`)
  }
  return files
}

export interface ImportSkillsOptions {
  /**
   * Full-sync mode. After upserting the filesystem catalog, soft-deprecate any
   * ACTIVE skill that is no longer present in the discovered set — treating the
   * filesystem bundle as the complete source of truth. Off by default because
   * the additive path is safe for incremental/boot imports; enable only when you
   * want the DB to exactly mirror the files (e.g. an intentional catalog sync).
   *
   * Protections: never touches System/Lifecycle categories, and only flips
   * `active` rows (leaves `pending` drafts and already-`deprecated` rows alone).
   * Reversible: sets status='deprecated', it does not delete.
   *
   * Additionally guarded by PRUNE_MAX_FRACTION — a prune that would wipe most of
   * the catalog is refused unless `force` is set.
   */
  prune?: boolean

  /**
   * Override the PRUNE_MAX_FRACTION blast-radius guard. Only meaningful together
   * with `prune`. Use when a large removal genuinely is intended and the bundle
   * path has been verified — never as a reflex to make a refused prune go away.
   */
  force?: boolean

  /**
   * Recovery mode — the exact inverse of `prune`. Flip back to `active` any
   * `deprecated` skill that IS present in the discovered bundle.
   *
   * This undoes an erroneous `--full` run (the failure the PRUNE_MAX_FRACTION
   * guard now prevents) without resurrecting anything else: a skill genuinely
   * retired by deleting its files stays deprecated, because it will not appear
   * in the discovery set. `pending` rows are never touched — those are
   * security-gate quarantines awaiting human review, not prune casualties.
   * Skills in `SUPERSEDED_BY_PLUGIN` are skipped: they are always in the
   * bundle but retired on purpose.
   */
  reactivate?: boolean
}

/**
 * Maximum share of the eligible ACTIVE catalog a single `--full` prune may
 * deprecate before it is treated as a misconfiguration rather than an intent.
 * Sized so ordinary curation passes (removing a handful of retired skills) run
 * unimpeded, while a wrong-path run that would gut the catalog is stopped.
 */
const PRUNE_MAX_FRACTION = 0.25

/**
 * Absolute floor below which the fraction guard does not apply. In a small
 * catalog a share is meaningless — dropping 1 of 2 skills is a legitimate 50%
 * prune — so the guard only engages once enough rows are at stake for a wrong
 * path to be the likelier explanation than deliberate curation.
 */
const PRUNE_GUARD_MIN_SKILLS = 10

/**
 * Security-gate input: SKILL.md followed by each support file introduced by its
 * path, so a malicious template or script counts toward the verdict. The stored
 * content stays SKILL.md alone.
 */
function scanText(content: string, files: SkillFileInput[]): string {
  return [content, ...files.map((f) => `--- file: ${f.path} ---\n${f.content}`)].join('\n\n')
}

/**
 * Process skills whose Claude Code copy now ships as the superpowers plugin
 * (`superpowers:<name>`). Their SkillBrain rows are deprecated on purpose so
 * routing stops suggesting the stale forks, but the files stay in
 * `.agents/skills/` for Codex — so they are always "present in the bundle".
 * `--reactivate` must skip them, or a recovery run would silently resurrect
 * the forks. See docs/superpowers/specs/2026-09-14-superpowers-integration-design.md.
 */
export const SUPERSEDED_BY_PLUGIN: ReadonlySet<string> = new Set([
  'brainstorming',
  'dispatching-parallel-agents',
  'executing-plans',
  'finishing-a-development-branch',
  'receiving-code-review',
  'requesting-code-review',
  'subagent-driven-development',
  'systematic-debugging',
  'test-driven-development',
  'using-git-worktrees',
  'using-superpowers',
  'verification-before-completion',
  'writing-plans',
  'writing-skills',
])

export async function importSkills(
  workspacePath: string,
  opts: ImportSkillsOptions = {},
): Promise<{ skills: number; agents: number; commands: number; pruned: number; reactivated: number; blocked: number }> {
  const db = openDb(workspacePath)
  const store = new SkillsStore(db)

  const now = new Date().toISOString()
  const skills: Skill[] = []
  // Support files per final skill name. Filled alongside `skills` in walk order,
  // so the same last-wins precedence as the dedupe below applies.
  const supportFiles = new Map<string, SkillFileInput[]>()
  let agentCount = 0
  let commandCount = 0

  // Import domain skills from .claude/skill/ with .opencode/ fallback
  const domainDir = pickDir(workspacePath, 'skill')
  walkDir(domainDir, (filePath, name, skillDir) => {
    if (name === 'INDEX') return // skip INDEX.md
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    supportFiles.set(fm.name || name, skillDir ? collectSupportFiles(skillDir, path.basename(filePath)) : [])
    skills.push({
      name: fm.name || name,
      category: detectCategory(name),
      description: fm.description || `Domain skill: ${name}`,
      content,
      type: 'domain',
      tags: extractTags(name, content),
      lines: content.split('\n').length,
      updatedAt: now,
    })
  })

  // Import lifecycle/process skills from .agents/skills/
  // Category is resolved by detectCategory(name) so language/tech skills
  // (typescript-pro, vue-expert, etc.) don't get bucketed under "Process"
  // just because they live in this directory.
  const agentsSkillDir = path.join(workspacePath, '.agents', 'skills')
  walkDir(agentsSkillDir, (filePath, name, skillDir) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    const type: SkillType = isLifecycleSkill(name) ? 'lifecycle' : 'process'
    const resolvedName = (fm.name as string) || name
    supportFiles.set(resolvedName, skillDir ? collectSupportFiles(skillDir, path.basename(filePath)) : [])
    skills.push({
      name: resolvedName,
      category: detectCategory(resolvedName),
      description: fm.description || `${type} skill: ${name}`,
      content,
      type,
      tags: extractTags(name, content),
      lines: content.split('\n').length,
      updatedAt: now,
    })
  })

  // Import agents from .claude/agents/ with .opencode/ fallback
  const agentsDir = pickDir(workspacePath, 'agents')
  walkDir(agentsDir, (filePath, name, skillDir) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    supportFiles.set(`agent:${name}`, skillDir ? collectSupportFiles(skillDir, path.basename(filePath)) : [])
    skills.push({
      name: `agent:${name}`,
      category: 'Agents',
      description: fm.description || `Agent: ${name}`,
      content,
      type: 'agent',
      tags: [name, 'agent', fm.model || 'sonnet'].filter(Boolean),
      lines: content.split('\n').length,
      updatedAt: now,
    })
    agentCount++
  })

  // Also import .claude/agent/*.md (flat agent files) with .opencode/ fallback
  const agentFlatDir = pickDir(workspacePath, 'agent')
  if (fs.existsSync(agentFlatDir)) {
    for (const entry of fs.readdirSync(agentFlatDir)) {
      if (!entry.endsWith('.md')) continue
      const filePath = path.join(agentFlatDir, entry)
      const name = entry.replace(/^\d+-/, '').replace('.md', '')
      const content = fs.readFileSync(filePath, 'utf-8')
      const fm = parseFrontmatter(content)
      if (!skills.find((s) => s.name === `agent:${name}`)) {
        skills.push({
          name: `agent:${name}`,
          category: 'Agents',
          description: fm.description || `Agent: ${name}`,
          content,
          type: 'agent',
          tags: [name, 'agent'].filter(Boolean),
          lines: content.split('\n').length,
          updatedAt: now,
        })
        agentCount++
      }
    }
  }

  // Import commands from .claude/command/ with .opencode/ fallback
  const commandDir = pickDir(workspacePath, 'command')
  if (fs.existsSync(commandDir)) {
    for (const entry of fs.readdirSync(commandDir)) {
      if (!entry.endsWith('.md')) continue
      const filePath = path.join(commandDir, entry)
      const name = entry.replace('.md', '')
      const content = fs.readFileSync(filePath, 'utf-8')
      skills.push({
        name: `command:${name}`,
        category: 'Commands',
        description: `Slash command: /${name}`,
        content,
        type: 'command',
        tags: [name, 'command'],
        lines: content.split('\n').length,
        updatedAt: now,
      })
      commandCount++
    }
  }

  // Import INDEX.md as a special skill
  const indexPath = path.join(domainDir, 'INDEX.md')
  if (fs.existsSync(indexPath)) {
    const content = fs.readFileSync(indexPath, 'utf-8')
    skills.push({
      name: '_routing-index',
      category: 'System',
      description: 'Master routing table — maps tasks to skills',
      content,
      type: 'domain',
      tags: ['routing', 'index', 'system'],
      lines: content.split('\n').length,
      updatedAt: now,
    })
  }

  // Collapse same-name skills discovered in more than one zone before they reach
  // the gate and the DB. A name can legitimately appear in both `.claude/skill/`
  // (domain) and `.agents/skills/` (lifecycle/process) — the bundle ships ~29 such
  // pairs — and upsertBatch would otherwise write the row twice, so whichever copy
  // happened to be walked last silently decided the skill's type and category.
  //
  // Last-wins is kept (zones are walked domain → lifecycle/process, so the
  // `.agents/skills/` copy is canonical) because that is the precedence the
  // existing catalog was built with; changing it would silently retype live
  // skills. The point here is that the collapse is now explicit and reported
  // rather than an accident of iteration order.
  const deduped: Skill[] = []
  const indexByName = new Map<string, number>()
  const shadowed: string[] = []
  for (const skill of skills) {
    const existing = indexByName.get(skill.name)
    if (existing === undefined) {
      indexByName.set(skill.name, deduped.length)
      deduped.push(skill)
    } else {
      if (deduped[existing].type !== skill.type) shadowed.push(`${skill.name} (${deduped[existing].type} → ${skill.type})`)
      deduped[existing] = skill
    }
  }
  if (shadowed.length > 0) {
    console.warn(
      `[import-skills] ${shadowed.length} skill(s) found in multiple zones — kept the last copy walked: ${shadowed.join(', ')}`,
    )
  }

  // Security gate: static-only scan of every skill's content before it lands in
  // the DB (Task 7). BLOCK verdicts are quarantined to status='pending' — see
  // ./skill-gate.ts for the full policy. Static-only here (no `llm` opt passed):
  // this is a bulk import path with no per-user credentials to resolve
  // synchronously — deeper LLM-judge scans are exposed on-demand via the
  // skill_scan MCP tool instead (Task 8), not run on every ingestion write.
  const gated = await Promise.all(
    deduped.map(async (s) => {
      const verdict = await applyGate({ ...s, content: scanText(s.content, supportFiles.get(s.name) ?? []) })
      return { ...verdict, content: s.content }
    }),
  )
  const blocked = gated.filter((s) => s.riskRecommendation === 'BLOCK').length
  if (blocked > 0) {
    // No silent gating: surface the count so an operator watching import logs
    // (or the CLI/dashboard summary) knows some skills were quarantined.
    console.warn(`[import-skills] security gate quarantined ${blocked} skill(s) to pending (BLOCK verdict) — review at the dashboard.`)
  }

  // Batch insert
  store.upsertBatch(gated)

  // Replace every imported skill's support-file set. An empty set clears files
  // deleted upstream; loose .md skills, commands, flat agents and the routing
  // index never have any.
  db.transaction(() => {
    for (const s of deduped) store.replaceFiles(s.name, supportFiles.get(s.name) ?? [])
  })()

  // Recovery: restore skills that a bad prune deprecated but the bundle still has.
  let reactivated = 0
  if (opts.reactivate) {
    const names = deduped.map((s) => s.name).filter((n) => !SUPERSEDED_BY_PLUGIN.has(n))
    const superseded = deduped.length - names.length
    const upd = db.prepare(`UPDATE skills SET status = 'active', updated_at = ? WHERE name = ? AND status = 'deprecated'`)
    const nowIso = new Date().toISOString()
    const tx = db.transaction((ns: string[]) => {
      let n = 0
      for (const name of ns) n += upd.run(nowIso, name).changes
      return n
    })
    reactivated = tx(names)
    console.warn(`[import-skills] --reactivate: restored ${reactivated} deprecated skill(s) present in the bundle back to active.`)
    if (superseded > 0) {
      console.warn(`[import-skills] --reactivate: left ${superseded} plugin-superseded skill(s) untouched (SUPERSEDED_BY_PLUGIN).`)
    }
  }

  // Optional full-sync: deprecate active skills that vanished from the bundle.
  let pruned = 0
  if (opts.prune) {
    const discovered = new Set(deduped.map((s) => s.name))
    const activeNames = (db
      .prepare(`SELECT name FROM skills WHERE status = 'active' AND category NOT IN ('System','Lifecycle')`)
      .all() as { name: string }[]).map((r) => r.name)
    const toPrune = activeNames.filter((n) => !discovered.has(n))

    // Safety guard: a discovery set that is empty — or drastically smaller than
    // the catalog it is about to prune — almost always means the bundle path was
    // wrong (e.g. `import-skills /data` without the .opencode/.agents symlinks
    // that entrypoint.sh sets up, or a partially-populated bundle), NOT an intent
    // to deprecate the whole catalog.
    //
    // The old guard only refused on `skills.length === 0`, which let a
    // catastrophically PARTIAL discovery through: a run that found 17 of ~293
    // skills sailed past the check and soft-deleted the other ~266, taking
    // production routing down to the handful of survivors (System/Lifecycle are
    // exempt above, which is exactly the fingerprint that incident left behind).
    // Refuse whenever the prune would remove more than PRUNE_MAX_FRACTION of the
    // eligible active catalog; `force` is the deliberate, explicit override.
    const eligible = activeNames.length
    const fraction = eligible === 0 ? 0 : toPrune.length / eligible

    if (deduped.length === 0) {
      console.warn(
        '[import-skills] --full: 0 skills discovered — skipping prune to avoid deprecating the whole catalog. Check the workspace path.',
      )
    } else if (toPrune.length >= PRUNE_GUARD_MIN_SKILLS && fraction > PRUNE_MAX_FRACTION && !opts.force) {
      console.warn(
        `[import-skills] --full: refusing to prune ${toPrune.length}/${eligible} active skills ` +
          `(${Math.round(fraction * 100)}% > ${Math.round(PRUNE_MAX_FRACTION * 100)}% limit) from a discovery set of ` +
          `${deduped.length}. This looks like a wrong or partial bundle path, not an intentional catalog removal. ` +
          `Verify the path, then re-run with --force if the removal really is intended.`,
      )
    } else if (toPrune.length > 0) {
      const nowIso = new Date().toISOString()
      const upd = db.prepare(`UPDATE skills SET status = 'deprecated', updated_at = ? WHERE name = ?`)
      const tx = db.transaction((names: string[]) => { for (const n of names) upd.run(nowIso, n) })
      tx(toPrune)
      pruned = toPrune.length
    }
  }

  closeDb(db)

  const domainCount = deduped.filter((s) => s.type === 'domain').length
  return { skills: domainCount, agents: agentCount, commands: commandCount, pruned, reactivated, blocked }
}

function isLifecycleSkill(name: string): boolean {
  return ['codegraph-context', 'capture-learning', 'load-learnings', 'post-session-review', 'using-superpowers'].includes(name)
}

export interface RecategorizeResult {
  scanned: number
  updated: number
  changes: { name: string; from: string; to: string }[]
  finalDistribution: { category: string; count: number }[]
}

/**
 * Recategorize all skills in DB to match the current CATEGORY_MAP.
 * Idempotent: only UPDATEs rows whose resolved category differs.
 * Pass dryRun=true to preview without writing.
 */
export function recategorizeSkills(workspacePath: string, opts: { dryRun?: boolean } = {}): RecategorizeResult {
  const db = openDb(workspacePath)
  try {
    const rows = db.prepare('SELECT name, category FROM skills').all() as { name: string; category: string }[]
    const changes: { name: string; from: string; to: string }[] = []
    for (const row of rows) {
      const newCat = detectCategory(row.name)
      if (newCat !== row.category) changes.push({ name: row.name, from: row.category, to: newCat })
    }

    if (!opts.dryRun && changes.length > 0) {
      const stmt = db.prepare('UPDATE skills SET category = ?, updated_at = ? WHERE name = ?')
      const now = new Date().toISOString()
      const tx = db.transaction((items: typeof changes) => {
        for (const u of items) stmt.run(u.to, now, u.name)
      })
      tx(changes)
    }

    const finalDistribution = db
      .prepare('SELECT category, COUNT(*) as count FROM skills GROUP BY category ORDER BY count DESC')
      .all() as { category: string; count: number }[]

    return { scanned: rows.length, updated: opts.dryRun ? 0 : changes.length, changes, finalDistribution }
  } finally {
    closeDb(db)
  }
}

function extractTags(name: string, content: string): string[] {
  const tags = [name]
  // Extract from frontmatter tags if present
  const tagMatch = content.match(/tags:\s*\[([^\]]+)\]/)
  if (tagMatch) {
    tags.push(...tagMatch[1].split(',').map((t) => t.trim().replace(/["']/g, '')))
  }
  return [...new Set(tags)].slice(0, 5)
}

// CLI entry point
if (process.argv[1]?.endsWith('import-skills.js')) {
  const args = process.argv.slice(2)
  const prune = args.includes('--full') || args.includes('--prune')
  const workspace = args.find((a) => !a.startsWith('--')) || process.cwd()
  console.log(`Importing skills from: ${workspace}${prune ? ' (full-sync: prune enabled)' : ''}`)
  importSkills(workspace, { prune }).then((result) => {
    console.log(`✅ Import complete:`)
    console.log(`   Skills: ${result.skills}`)
    console.log(`   Agents: ${result.agents}`)
    console.log(`   Commands: ${result.commands}`)
    if (prune) console.log(`   Pruned (deprecated): ${result.pruned}`)
    if (result.blocked > 0) console.log(`   ⚠️  Quarantined to pending (security gate BLOCK): ${result.blocked}`)
  })
}
