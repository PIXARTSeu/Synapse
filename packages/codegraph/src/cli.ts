#!/usr/bin/env node
/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */


import { Command } from 'commander'
import { analyzeCommand } from './cli/commands/analyze.js'
import { statusCommand } from './cli/commands/status.js'
import { cleanCommand } from './cli/commands/clean.js'
import { listCommand } from './cli/commands/list.js'
import { setQuiet } from './utils/logger.js'

const program = new Command()

program
  .name('codegraph')
  .description('Code intelligence knowledge graph — analyze, query, and understand your codebase')
  .version('0.1.0')

program
  .command('analyze')
  .description('Index a repository and build the knowledge graph')
  .argument('[path]', 'Path to repository', '.')
  .option('--force', 'Force full re-index')
  .option('--skip-git', 'Index non-git folders')
  .option('--no-progress', 'Suppress progress output')
  .action(async (targetPath: string, options: any) => {
    try {
      if (options.noProgress) setQuiet(true)
      await analyzeCommand(targetPath, options)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Fatal: ${msg}`)
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show index status for a repository')
  .argument('[path]', 'Path to repository', '.')
  .action((targetPath: string) => {
    statusCommand(targetPath)
  })

program
  .command('clean')
  .description('Remove index for a repository')
  .argument('[path]', 'Path to repository', '.')
  .action((targetPath: string) => {
    cleanCommand(targetPath)
  })

program
  .command('list')
  .description('List all indexed repositories')
  .action(() => {
    listCommand()
  })

program
  .command('migrate-learnings')
  .description('Migrate learnings.md files into the Memory Graph database')
  .argument('[path]', 'Path to workspace root', '.')
  .action(async (targetPath: string) => {
    try {
      const { migrate } = await import('@skillbrain/storage')
      const result = migrate(targetPath)
      console.log(`✅ Migration complete:`)
      console.log(`   Migrated: ${result.migrated}`)
      console.log(`   Skipped: ${result.skipped}`)
      console.log(`   Edges created: ${result.edges}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Migration failed: ${msg}`)
      process.exit(1)
    }
  })

program
  .command('import-skills')
  .description('Import skills, agents, and commands from filesystem into SQLite')
  .argument('[path]', 'Path to workspace root', '.')
  .option('--full', 'Full-sync: also deprecate active skills no longer present in the bundle (protects System/Lifecycle)')
  .action(async (targetPath: string, opts: { full?: boolean }) => {
    try {
      const { importSkills } = await import('@skillbrain/storage')
      const result = importSkills(targetPath, { prune: !!opts.full })
      console.log(`✅ Import complete:`)
      console.log(`   Skills: ${result.skills}`)
      console.log(`   Agents: ${result.agents}`)
      console.log(`   Commands: ${result.commands}`)
      if (opts.full) console.log(`   Pruned (deprecated): ${result.pruned}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Import failed: ${msg}`)
      process.exit(1)
    }
  })

program
  .command('backfill-skill-usage')
  .description('Backfill skill_usage + memory_skill_edges from existing memories (idempotent)')
  .argument('[path]', 'Workspace root (defaults to SKILLBRAIN_ROOT or .)', '')
  .option('--dry', 'Preview without writing')
  .action(async (targetPath: string, opts: { dry?: boolean }) => {
    try {
      const root = targetPath || process.env.SKILLBRAIN_ROOT || '.'
      const { backfillSkillUsage } = await import('@skillbrain/storage')
      const r = backfillSkillUsage(root, { dryRun: opts.dry })
      console.log(`[backfill] scanned ${r.scannedMemories} memories (dryRun=${!!opts.dry})`)
      console.log(`→ ${r.memoriesWithSkill} memories carry a skill signal`)
      console.log(`→ ${r.skillUsageInserted} new skill_usage rows (action=applied)`)
      console.log(`→ ${r.edgesCreated} new memory→skill edges`)
      if (!opts.dry) console.log(`→ Recomputed counters on ${r.countersRecomputed} skills`)
      if (r.unknownSkills.length > 0) {
        console.log(`\n⚠️ ${r.unknownSkills.length} skill name(s) referenced by memories but not in skills table (typos? deleted skills?):`)
        for (const u of r.unknownSkills.slice(0, 10)) console.log(`  · ${u.skill}  (${u.count} memories)`)
        if (r.unknownSkills.length > 10) console.log(`  ... and ${r.unknownSkills.length - 10} more`)
      }
      if (r.perSkill.length > 0) {
        console.log(`\nTop skills by backfilled applied events:`)
        for (const s of r.perSkill.slice(0, 15)) console.log(`  ${s.skill.padEnd(35)} ${s.applied}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Backfill failed: ${msg}`)
      process.exit(1)
    }
  })

program
  .command('recategorize-skills')
  .description('Recategorize all skills in DB to match the current category map (idempotent)')
  .argument('[path]', 'Workspace root (defaults to SKILLBRAIN_ROOT or .)', '')
  .option('--dry', 'Preview changes without writing')
  .action(async (targetPath: string, opts: { dry?: boolean }) => {
    try {
      const root = targetPath || process.env.SKILLBRAIN_ROOT || '.'
      const { recategorizeSkills } = await import('@skillbrain/storage')
      const result = recategorizeSkills(root, { dryRun: opts.dry })
      console.log(`[recategorize] scanned ${result.scanned} skills (dryRun=${!!opts.dry})`)
      console.log(`→ ${result.changes.length} skills with category drift`)
      if (opts.dry) {
        for (const c of result.changes.slice(0, 30)) {
          console.log(`  ${c.name.padEnd(40)} ${c.from} → ${c.to}`)
        }
        if (result.changes.length > 30) console.log(`  ... and ${result.changes.length - 30} more`)
        console.log('(dry run — no DB writes)')
      } else {
        console.log(`✅ Applied ${result.updated} updates`)
      }
      console.log('\n=== Final category distribution ===')
      for (const s of result.finalDistribution) console.log(`  ${s.category.padEnd(15)} ${s.count}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Recategorize failed: ${msg}`)
      process.exit(1)
    }
  })

program
  .command('mcp-proxy')
  .description('Start stdio→HTTP proxy (connects local Claude Code/Desktop to remote MCP server)')
  .action(async () => {
    try {
      const { startProxy } = await import('./mcp/proxy.js')
      await startProxy()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Proxy failed: ${msg}`)
      process.exit(1)
    }
  })

program
  .command('mcp')
  .description('Start MCP server (stdio by default, or HTTP with --http)')
  .option('--http', 'Start HTTP server instead of stdio')
  .option('--port <port>', 'HTTP port (default: 3737)', '3737')
  .option('--auth-token <token>', 'Bearer token for HTTP auth (or CODEGRAPH_AUTH_TOKEN env)')
  .action(async (options: { http?: boolean; port?: string; authToken?: string }) => {
    try {
      if (options.http) {
        const { startHttpServer } = await import('./mcp/http-server.js')
        const port = parseInt(options.port || process.env.PORT || '3737', 10)
        const authToken = options.authToken || process.env.CODEGRAPH_AUTH_TOKEN
        await startHttpServer(port, authToken)
      } else {
        const { startMcpServer } = await import('./mcp/server.js')
        await startMcpServer()
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[codegraph] Fatal: ${msg}`)
      process.exit(1)
    }
  })

program.parse()
