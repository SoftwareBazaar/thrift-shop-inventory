/**
 * Apply supabase-withdrawal-source.sql using env SUPABASE_ACCESS_TOKEN
 * Usage: SUPABASE_ACCESS_TOKEN=xxx node apply-withdrawal-source.js
 */
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'droplfoogapyhlyvkmob';

if (!TOKEN) {
  console.error('Set SUPABASE_ACCESS_TOKEN environment variable');
  process.exit(1);
}

async function runSql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

(async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'supabase-withdrawal-source.sql'), 'utf8');
  await runSql(sql);
  console.log('Migration applied successfully');
})().catch(e => { console.error(e.message); process.exit(1); });
