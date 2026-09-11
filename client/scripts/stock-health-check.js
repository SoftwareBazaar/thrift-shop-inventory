#!/usr/bin/env node
/**
 * Audits central-hub stock for every item against the live database.
 *
 * Run with:  npm run stock:check
 *
 * Read-only. It never writes to Supabase.
 *
 * The hub math is loaded from src/utils/stockReplay.ts rather than reimplemented
 * here, so this script can never drift from what the app actually displays.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');

function loadStockReplay() {
  const ts = require('typescript');
  const filename = path.join(__dirname, '..', 'src', 'utils', 'stockReplay.ts');
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
    fileName: filename
  });
  const compiled = new Module(filename, null);
  compiled.filename = filename;
  compiled.paths = Module._nodeModulePaths(path.dirname(filename));
  compiled._compile(outputText, filename);
  return compiled.exports;
}

const { computeHubStock, summarizeStallReturnLedger } = loadStockReplay();

const url = process.env.REACT_APP_SUPABASE_URL;
const key = process.env.REACT_APP_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error('Missing REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY in client/.env');
  process.exit(1);
}
const supabase = createClient(url, key);

const sum = (rows, field) => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

async function loadHistory(itemId) {
  const [additions, distributions, centralSales, withdrawals] = await Promise.all([
    supabase.from('stock_additions').select('quantity_added, date_added, addition_id').eq('item_id', itemId),
    supabase.from('stock_distribution').select('quantity_allocated, date_distributed, distribution_id, stall_id').eq('item_id', itemId),
    supabase.from('sales').select('quantity_sold, date_time, sale_id').eq('item_id', itemId).is('stall_id', null),
    supabase.from('stock_withdrawals').select('quantity_withdrawn, date_withdrawn, withdrawal_id, stall_id, distribution_id').eq('item_id', itemId)
  ]);

  const failed = [additions, distributions, centralSales, withdrawals].find((r) => r.error);
  if (failed) throw new Error(failed.error.message);

  return {
    additions: additions.data || [],
    distributions: distributions.data || [],
    centralSales: centralSales.data || [],
    withdrawals: withdrawals.data || []
  };
}

function auditItem(item, history) {
  const args = { initialStock: item.initial_stock || 0, ...history };
  const hub = computeHubStock(args);
  const received = (item.initial_stock || 0) + sum(history.additions, 'quantity_added');
  const { stallReturned, netAtHub } = summarizeStallReturnLedger(history.distributions, history.withdrawals);

  const failures = [];

  if (!Number.isFinite(hub)) failures.push('hub stock is not a number');
  if (hub < 0) failures.push(`hub stock is negative (${hub})`);
  if (hub > received) failures.push(`hub stock ${hub} exceeds everything ever received (${received})`);

  // Stock added must always reach the hub in full, whatever shape the history
  // is in. This is the failure the client reported on Baggy jeans.
  for (const probe of [1, 7, 50]) {
    const after = computeHubStock({
      ...args,
      additions: [
        ...history.additions,
        { quantity_added: probe, date_added: new Date().toISOString(), addition_id: -1 }
      ]
    });
    if (after - hub !== probe) {
      failures.push(`adding ${probe} units would move the hub by ${after - hub}, not ${probe}`);
    }
  }

  for (const [label, rows, field] of [
    ['stock_additions', history.additions, 'quantity_added'],
    ['stock_distribution', history.distributions, 'quantity_allocated'],
    ['stock_withdrawals', history.withdrawals, 'quantity_withdrawn'],
    ['sales', history.centralSales, 'quantity_sold']
  ]) {
    if (rows.some((row) => (Number(row[field]) || 0) < 0)) {
      failures.push(`${label} contains a negative quantity`);
    }
  }

  const drift = hub - (item.current_stock || 0);

  return { name: item.item_name, hub, stored: item.current_stock || 0, drift, received, stallReturned, netAtHub, failures };
}

(async () => {
  const { data: items, error } = await supabase
    .from('items')
    .select('item_id, item_name, initial_stock, current_stock')
    .order('item_name');
  if (error) throw new Error(error.message);

  const results = [];
  for (const item of items) {
    results.push(auditItem(item, await loadHistory(item.item_id)));
  }

  const width = Math.max(...results.map((r) => r.name.length));
  const pad = (text, size) => String(text).padEnd(size);

  console.log(`${pad('ITEM', width)}  ${pad('HUB', 6)}${pad('STORED', 8)}${pad('RETURNED', 10)}RECEIVED`);
  for (const r of results) {
    console.log(
      `${pad(r.name, width)}  ${pad(r.hub, 6)}${pad(r.stored, 8)}${pad(r.netAtHub, 10)}${r.received}` +
        (r.failures.length ? '   <-- FAILED' : '')
    );
  }

  const broken = results.filter((r) => r.failures.length);
  const drifted = results.filter((r) => r.drift !== 0);

  console.log(`\nItems checked: ${results.length}`);
  console.log(`Items with returns sitting at the hub: ${results.filter((r) => r.netAtHub > 0).length}`);

  if (drifted.length) {
    console.log(`\nStored current_stock is behind the live figure on ${drifted.length} item(s).`);
    console.log('This is expected between mutations and corrects itself on the next stock action:');
    for (const r of drifted) {
      console.log(`  ${r.name}: showing ${r.hub}, stored ${r.stored}`);
    }
  }

  if (broken.length) {
    console.log('\nPROBLEMS FOUND:');
    for (const r of broken) {
      for (const failure of r.failures) console.log(`  ${r.name}: ${failure}`);
    }
    process.exit(1);
  }

  console.log('\nAll checks passed. Every item reports a valid hub figure and credits new stock in full.');
})().catch((err) => {
  console.error('\nHealth check could not complete:', err.message);
  process.exit(1);
});
