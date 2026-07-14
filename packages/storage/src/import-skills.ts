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
import { SkillsStore, type Skill, type SkillType } from './skills-store.js'
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
  'Expo UI Jetpack Compose': 'Mobile', 'Expo UI SwiftUI': 'Mobile',
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
  const match = content.match(/^---\n([\s\S]*?)\n---/)
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

function walkDir(dir: string, callback: (file: string, name: string) => void): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      // Look for SKILL.md or AGENT.md in subdirectory
      for (const mdFile of ['SKILL.md', 'AGENT.md']) {
        const mdPath = path.join(full, mdFile)
        if (fs.existsSync(mdPath)) {
          callback(mdPath, entry.name)
        }
      }
    } else if (entry.name.endsWith('.md')) {
      callback(full, entry.name.replace('.md', ''))
    }
  }
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
   */
  prune?: boolean
}

export async function importSkills(
  workspacePath: string,
  opts: ImportSkillsOptions = {},
): Promise<{ skills: number; agents: number; commands: number; pruned: number; blocked: number }> {
  const db = openDb(workspacePath)
  const store = new SkillsStore(db)

  const now = new Date().toISOString()
  const skills: Skill[] = []
  let agentCount = 0
  let commandCount = 0

  // Import domain skills from .claude/skill/ with .opencode/ fallback
  const domainDir = pickDir(workspacePath, 'skill')
  walkDir(domainDir, (filePath, name) => {
    if (name === 'INDEX') return // skip INDEX.md
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
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
  walkDir(agentsSkillDir, (filePath, name) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
    const type: SkillType = isLifecycleSkill(name) ? 'lifecycle' : 'process'
    const resolvedName = (fm.name as string) || name
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
  walkDir(agentsDir, (filePath, name) => {
    const content = fs.readFileSync(filePath, 'utf-8')
    const fm = parseFrontmatter(content)
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

  // Security gate: static-only scan of every skill's content before it lands in
  // the DB (Task 7). BLOCK verdicts are quarantined to status='pending' — see
  // ./skill-gate.ts for the full policy. Static-only here (no `llm` opt passed):
  // this is a bulk import path with no per-user credentials to resolve
  // synchronously — deeper LLM-judge scans are exposed on-demand via the
  // skill_scan MCP tool instead (Task 8), not run on every ingestion write.
  const gated = await Promise.all(skills.map((s) => applyGate(s)))
  const blocked = gated.filter((s) => s.riskRecommendation === 'BLOCK').length
  if (blocked > 0) {
    // No silent gating: surface the count so an operator watching import logs
    // (or the CLI/dashboard summary) knows some skills were quarantined.
    console.warn(`[import-skills] security gate quarantined ${blocked} skill(s) to pending (BLOCK verdict) — review at the dashboard.`)
  }

  // Batch insert
  store.upsertBatch(gated)

  // Optional full-sync: deprecate active skills that vanished from the bundle.
  let pruned = 0
  if (opts.prune && skills.length === 0) {
    // Safety guard: an empty discovered set almost always means the bundle path
    // was wrong (e.g. `import-skills /data` without the .opencode/.agents symlinks
    // that entrypoint.sh sets up), NOT an intent to deprecate the entire catalog.
    // Refuse to prune — otherwise a misconfigured path silently wipes every skill.
    console.warn('[import-skills] --full: 0 skills discovered — skipping prune to avoid deprecating the whole catalog. Check the workspace path.')
  } else if (opts.prune) {
    const discovered = new Set(skills.map((s) => s.name))
    const activeNames = (db
      .prepare(`SELECT name FROM skills WHERE status = 'active' AND category NOT IN ('System','Lifecycle')`)
      .all() as { name: string }[]).map((r) => r.name)
    const toPrune = activeNames.filter((n) => !discovered.has(n))
    if (toPrune.length > 0) {
      const nowIso = new Date().toISOString()
      const upd = db.prepare(`UPDATE skills SET status = 'deprecated', updated_at = ? WHERE name = ?`)
      const tx = db.transaction((names: string[]) => { for (const n of names) upd.run(nowIso, n) })
      tx(toPrune)
      pruned = toPrune.length
    }
  }

  closeDb(db)

  const domainCount = skills.filter((s) => s.type === 'domain').length
  return { skills: domainCount, agents: agentCount, commands: commandCount, pruned, blocked }
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
