import Database from 'better-sqlite3'

const db = new Database('.codegraph/graph.db')

const ftsQuery = '"add" OR "nextjs" OR "setup"'

console.log('FTS Query:', ftsQuery)
console.log()

// Test 1: Direct SQL (no parameter)
console.log('TEST 1: Direct SQL (no parameter binding)')
try {
  const rows = db.prepare(`
    SELECT s.name, fts.rank
    FROM skills_fts fts
    JOIN skills s ON s.rowid = fts.rowid
    WHERE skills_fts MATCH '"add" OR "nextjs" OR "setup"' AND s.status = 'active'
    ORDER BY fts.rank
    LIMIT 5
  `).all()
  console.log(`✓ Returned ${rows.length} results`)
} catch (e) {
  console.error(`✗ Error: ${e.message}`)
}

// Test 2: Parameter binding with ?
console.log('\nTEST 2: Parameter binding with ?')
try {
  const rows = db.prepare(`
    SELECT s.name, fts.rank
    FROM skills_fts fts
    JOIN skills s ON s.rowid = fts.rowid
    WHERE skills_fts MATCH ? AND s.status = 'active'
    ORDER BY fts.rank
    LIMIT 5
  `).all(ftsQuery)
  console.log(`✓ Returned ${rows.length} results`)
} catch (e) {
  console.error(`✗ Error: ${e.message}`)
}

// Test 3: Try simpler query without quotes
const simpleQuery = 'add OR nextjs OR setup'
console.log('\nTEST 3: Simpler query without quotes')
try {
  const rows = db.prepare(`
    SELECT s.name, fts.rank
    FROM skills_fts fts
    JOIN skills s ON s.rowid = fts.rowid
    WHERE skills_fts MATCH ? AND s.status = 'active'
    ORDER BY fts.rank
    LIMIT 5
  `).all(simpleQuery)
  console.log(`✓ Returned ${rows.length} results`)
  for (const r of rows) {
    console.log(`  - ${r.name}`)
  }
} catch (e) {
  console.error(`✗ Error: ${e.message}`)
}

db.close()
