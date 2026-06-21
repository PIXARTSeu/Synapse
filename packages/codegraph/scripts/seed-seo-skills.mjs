#!/usr/bin/env node
/*
 * Synapse — seed/refresh the SEO skill set into a graph.db.
 *
 * Propagates the SEO skills merged from claude-seo (MIT) — 11 enriched + 6 new + 3
 * reference — into a target database. Use it to push them to a server whose DB you
 * can't reach over MCP (e.g. the Coolify production container):
 *
 *   node packages/codegraph/scripts/seed-seo-skills.mjs [SKILLBRAIN_ROOT]
 *
 * SKILLBRAIN_ROOT defaults to "/data" (prod layout → /data/.codegraph/graph.db).
 * Pass "." to seed the local workspace DB.
 *
 * Run it AFTER deploying the code that contains migration 035 + the stable-rowid
 * upsert, so FTS stays consistent. It opens the DB (which applies pending migrations),
 * backs it up, upserts every skill in ./seed-seo-skills/, and rebuilds FTS as a
 * belt-and-suspenders. Existing skills keep their status/confidence/usage (the upsert
 * preserves them); brand-new ones default to status=active, confidence=5.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb, closeDb, SkillsStore } from '@skillbrain/storage'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SEED_DIR = path.join(__dirname, 'seed-seo-skills')
const ROOT = process.argv[2] || '/data'

function parseFrontmatter(content, fallbackName) {
  const fm = content.match(/^---\n([\s\S]*?)\n---/)
  const block = fm ? fm[1] : ''
  const pick = (key) => {
    const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''
  }
  return {
    name: (pick('name') || fallbackName).trim(),
    description: pick('description'),
  }
}

async function main() {
  if (!fs.existsSync(SEED_DIR)) {
    console.error(`Seed dir not found: ${SEED_DIR}`)
    process.exit(1)
  }
  const files = fs.readdirSync(SEED_DIR).filter((f) => f.endsWith('.md')).sort()
  if (files.length === 0) {
    console.error('No .md skill files in seed dir.')
    process.exit(1)
  }

  const dbPath = path.join(ROOT, '.codegraph', 'graph.db')
  console.log(`==> Target DB: ${dbPath}`)
  console.log(`==> Seeding ${files.length} SEO skills`)

  // openDb applies pending migrations (incl. 035 FTS triggers) before we touch anything.
  const db = openDb(ROOT)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${dbPath}.bak-pre-seo-seed-${stamp}`
  await db.backup(backup)
  console.log(`==> Backup: ${backup}`)

  const store = new SkillsStore(db)
  const now = new Date().toISOString()
  let inserted = 0
  let updated = 0

  for (const file of files) {
    const content = fs.readFileSync(path.join(SEED_DIR, file), 'utf-8')
    const fallback = file.replace(/\.md$/, '')
    const { name, description } = parseFrontmatter(content, fallback)
    const existed = !!store.get(name)
    store.upsert(
      {
        name,
        category: 'SEO',
        description: description || name,
        content,
        type: 'domain',
        tags: Array.from(new Set(['seo', ...name.split('-')])),
        lines: content.split('\n').length,
        updatedAt: now,
        // status omitted → preserve existing on update, default 'active' on insert
      },
      { reason: 'seo-skills-merge (claude-seo)' },
    )
    if (existed) { updated++; console.log(`   ~ updated  ${name}`) }
    else { inserted++; console.log(`   + inserted ${name}`) }
  }

  // Belt-and-suspenders: ensure the FTS index is consistent.
  try { db.prepare(`INSERT INTO skills_fts(skills_fts) VALUES('rebuild')`).run() } catch { /* ok */ }

  const total = db.prepare(`SELECT COUNT(*) AS n FROM skills WHERE status='active'`).get().n
  closeDb(db)

  console.log(`\n==> Done. inserted=${inserted} updated=${updated}. Active skills now: ${total}.`)
  console.log(`    Rollback if needed: cp '${backup}' '${dbPath}'  (stop the server first)`)
}

main().catch((err) => { console.error(err); process.exit(1) })
