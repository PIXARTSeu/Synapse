import { openDb, closeDb } from './packages/storage/dist/db.js'

const db = openDb('.codegraph')

// Try the exact parameter query
const ftsQuery = '"add" OR "nextjs" OR "setup"'
console.log('FTS Query:', ftsQuery)
console.log()

// Test via better-sqlite3 prepared stmt
const searchFts = db.prepare(`
  SELECT s.name, fts.rank
  FROM skills_fts fts
  JOIN skills s ON s.rowid = fts.rowid
  WHERE skills_fts MATCH ? AND s.status = 'active'
  ORDER BY fts.rank
  LIMIT 15
`)

try {
  console.log('Executing with parameter binding...')
  const rows = searchFts.all(ftsQuery)
  console.log(`Result: ${rows.length} rows`)
  if (rows.length === 0) {
    console.log('⚠️ Got 0 results from parameter binding!')
    
    // Try without parameter (direct SQL)
    console.log('\nNow trying direct SQL (no parameter):')
    const rows2 = db.prepare(`
      SELECT s.name, fts.rank
      FROM skills_fts fts
      JOIN skills s ON s.rowid = fts.rowid
      WHERE skills_fts MATCH '"add" OR "nextjs" OR "setup"' AND s.status = 'active'
      ORDER BY fts.rank
      LIMIT 15
    `).all()
    console.log(`Direct SQL result: ${rows2.length} rows`)
    for (const r of rows2.slice(0, 3)) {
      console.log(`  - ${r.name}`)
    }
  } else {
    for (const r of rows) {
      console.log(`  - ${r.name}`)
    }
  }
} catch (e) {
  console.error('Error:', e.message)
}

closeDb(db)
