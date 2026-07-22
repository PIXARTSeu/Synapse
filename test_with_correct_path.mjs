import { openDb, closeDb } from './packages/storage/dist/db.js'

const db = openDb('.')  // Current directory is the repo root

console.log('Testing with correct path...')

// Test 1: Can we read skills table?
const skillCount = db.prepare('SELECT COUNT(*) as c FROM skills').get()
console.log(`1. Skills count: ${skillCount.c}`)

// Test 2: Can we read FTS table count?
const ftsCount = db.prepare('SELECT COUNT(*) as c FROM skills_fts').get()
console.log(`2. FTS count: ${ftsCount.c}`)

// Test 3: Simple FTS query without JOIN
try {
  const result = db.prepare(`SELECT COUNT(*) as c FROM skills_fts WHERE skills_fts MATCH 'nextjs'`).get()
  console.log(`3. FTS MATCH 'nextjs' count: ${result.c}`)
} catch (e) {
  console.error(`3. Error:`, e.message)
}

// Test 4: FTS with parameter
try {
  const result = db.prepare(`SELECT COUNT(*) as c FROM skills_fts WHERE skills_fts MATCH ?`).get('nextjs')
  console.log(`4. FTS MATCH (param) 'nextjs' count: ${result.c}`)
} catch (e) {
  console.error(`4. Error:`, e.message)
}

// Test 5: FTS with OR query
try {
  const result = db.prepare(`SELECT COUNT(*) as c FROM skills_fts WHERE skills_fts MATCH '"add" OR "nextjs" OR "setup"'`).get()
  console.log(`5. FTS MATCH direct query count: ${result.c}`)
} catch (e) {
  console.error(`5. Error:`, e.message)
}

// Test 6: FTS with OR query as parameter
try {
  const result = db.prepare(`SELECT COUNT(*) as c FROM skills_fts WHERE skills_fts MATCH ?`).get('"add" OR "nextjs" OR "setup"')
  console.log(`6. FTS MATCH (param) '"add" OR "nextjs" OR "setup"' count: ${result.c}`)
} catch (e) {
  console.error(`6. Error:`, e.message)
}

// Test 7: Simple search like skills-store does
console.log('\n--- Testing search() logic ---')
const query = 'add nextjs setup'
const tokens = query
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]/g, ' ')
  .toLowerCase()
  .split(/\s+/)
  .filter((w) => w.length > 1)

const ftsQuery = tokens.map((w) => `"${w}"`).join(' OR ')
console.log('FTS Query:', ftsQuery)

try {
  const result = db.prepare(`
    SELECT s.name
    FROM skills_fts fts
    JOIN skills s ON s.rowid = fts.rowid
    WHERE skills_fts MATCH ? AND s.status = 'active'
    LIMIT 10
  `).all(ftsQuery)
  console.log(`Results: ${result.length} skills`)
  for (const r of result.slice(0, 3)) {
    console.log(`  - ${r.name}`)
  }
} catch (e) {
  console.error('Error:', e.message)
}

closeDb(db)
