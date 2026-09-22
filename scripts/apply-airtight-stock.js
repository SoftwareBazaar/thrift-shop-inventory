#!/usr/bin/env node
/**
 * Applies server/migrations/004_airtight_stock.sql to the live database.
 *
 * Tries, in order:
 *   1. DATABASE_URL / SUPABASE_DB_URL
 *   2. Direct Postgres with SUPABASE_DB_PASSWORD + project ref from SUPABASE_URL
 *   3. Supabase Management API if SUPABASE_ACCESS_TOKEN is set
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', 'client', '.env') });

const sqlPath = path.join(__dirname, '..', 'server', 'migrations', '004_airtight_stock.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const projectRef = (() => {
  const match = supabaseUrl.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return match ? match[1] : process.env.SUPABASE_PROJECT_REF;
})();

function buildConnectionString() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.SUPABASE_DB_URL) return process.env.SUPABASE_DB_URL;

  const password = process.env.SUPABASE_DB_PASSWORD || process.env.BACKUP_DB_PASSWORD;
  if (!password || !projectRef) return null;

  const encoded = encodeURIComponent(password);
  return `postgresql://postgres.${projectRef}:${encoded}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;
}

async function applyWithPg(connectionString) {
  const { Client } = require('pg');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

async function applyWithManagementApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token || !projectRef) return false;

  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Management API ${response.status}: ${body}`);
  }
  return true;
}

(async () => {
  const connectionString = buildConnectionString();

  if (connectionString) {
    console.log('Applying airtight stock migration via Postgres…');
    await applyWithPg(connectionString);
    console.log('Migration applied.');
    return;
  }

  if (process.env.SUPABASE_ACCESS_TOKEN && projectRef) {
    console.log('Applying airtight stock migration via Supabase Management API…');
    await applyWithManagementApi();
    console.log('Migration applied.');
    return;
  }

  console.error('No database connection is configured.');
  console.error('Set DATABASE_URL, or SUPABASE_DB_PASSWORD (the database password from');
  console.error('Supabase → Project Settings → Database), then run this script again.');
  process.exit(2);
})().catch((error) => {
  console.error('Migration failed:', error.message || error);
  process.exit(1);
});
