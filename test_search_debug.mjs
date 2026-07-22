import { openDb, closeDb } from './packages/storage/dist/db.js'
import { SkillsStore } from './packages/storage/dist/skills-store.js'

const db = openDb('.codegraph')
const store = new SkillsStore(db)

// Manually reproduce search() with error handling
const query = 'add nextjs setup'
const tokens = query
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/[_-]/g, ' ')
  .toLowerCase()
  .split(/\s+/)
  .filter((w) => w.length > 1)

const ftsQuery = tokens.map((w) => `"${w}"`).join(' OR ')

console.log('Query:', query)
console.log('Tokens:', tokens)
console.log('FTS Query:', ftsQuery)

try {
  const searchFts = db.prepare(`
    SELECT s.*, fts.rank
    FROM skills_fts fts
    JOIN skills s ON s.rowid = fts.rowid
    WHERE skills_fts MATCH ? AND s.status = 'active'
    ORDER BY fts.rank
    LIMIT ?
  `)
  
  console.log('\nExecuting query with limit=15...')
  const rows = searchFts.all(ftsQuery, 15)
  console.log(`Got ${rows.length} results`)
  for (const r of rows.slice(0, 5)) {
    console.log(`  - ${r.name}`)
  }
} catch (e) {
  console.error('Error during FTS query:', e.message)
  console.error(e.stack)
}

closeDb(db)
