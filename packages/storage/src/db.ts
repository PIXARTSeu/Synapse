/*
 * Synapse — The intelligence layer for AI workflows
 * Copyright (c) 2026 Daniel De Vecchi
 *
 * Licensed under AGPL-3.0-or-later.
 * See LICENSE for details.
 *
 * Commercial license: daniel@pixarts.eu
 */

import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { runMigrations } from './migrator.js'

const DB_FILENAME = 'graph.db'
const CODEGRAPH_DIR = '.codegraph'

export function getDbPath(repoPath: string): string {
  return path.join(repoPath, CODEGRAPH_DIR, DB_FILENAME)
}

export function getCodegraphDir(repoPath: string): string {
  return path.join(repoPath, CODEGRAPH_DIR)
}

export function openDb(repoPath: string): Database.Database {
  const dir = getCodegraphDir(repoPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const dbPath = getDbPath(repoPath)
  const db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('synchronous = NORMAL')
  // Every MCP tool opens its own short-lived connection; the 24h decay job
  // UPDATEs all active skills and can collide with concurrent recordUsage()
  // writers. Without a busy_timeout that surfaces as SQLITE_BUSY with no retry —
  // wait up to 5s for the lock instead.
  db.pragma('busy_timeout = 5000')

  runMigrations(db)

  // Backfill ownership for entities that pre-date migration 010.
  // Assigns the earliest created user as default owner — runs only if any rows are unowned.
  try {
    const hasUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as any)?.c > 0
    if (hasUsers) {
      db.exec(`
        UPDATE memories SET created_by_user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
          WHERE created_by_user_id IS NULL;
        UPDATE skills SET created_by_user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
          WHERE created_by_user_id IS NULL;
        UPDATE ui_components SET created_by_user_id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1)
          WHERE created_by_user_id IS NULL;
      `)
    }
  } catch { /* users table or ownership columns not yet migrated */ }

  // Backfill skill_versions: create v1 snapshot for skills that pre-date migration 009.
  try {
    db.exec(`
      INSERT INTO skill_versions (id, skill_name, version_number, content, description, category, tags, changed_by, change_reason, created_at)
      SELECT
        'SV-' || lower(hex(randomblob(4))) || '-init',
        s.name, 1, s.content, s.description, s.category, s.tags,
        s.created_by_user_id, 'backfill', s.updated_at
      FROM skills s
      WHERE NOT EXISTS (SELECT 1 FROM skill_versions sv WHERE sv.skill_name = s.name);
    `)
  } catch { /* skill_versions table not yet migrated */ }

  return db
}

export function clearDb(db: Database.Database): void {
  db.exec(`
    DELETE FROM edges;
    DELETE FROM nodes;
    DELETE FROM files;
  `)
}

export function closeDb(db: Database.Database): void {
  db.close()
}
