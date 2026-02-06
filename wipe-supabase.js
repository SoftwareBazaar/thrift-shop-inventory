const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

/**
 * 💣 Robust Supabase Data Wiper
 * Use this from your terminal to completely clear business data.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env for full bypass.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const tables = [
    { name: 'activity_log', pk: 'log_id' },
    { name: 'credit_sales', pk: 'credit_id' },
    { name: 'sales', pk: 'sale_id' },
    { name: 'stock_distribution', pk: 'distribution_id' },
    { name: 'stock_additions', pk: 'addition_id' },
    { name: 'items', pk: 'item_id' }
];

async function wipeDatabase() {
    console.log('🚀 Starting Robust Database Wipe...');

    for (const table of tables) {
        process.stdout.write(`🧹 Wiping ${table.name}... `);
        const { error } = await supabase
            .from(table.name)
            .delete()
            .neq(table.pk, -1);

        if (error) {
            console.log(`❌ Failed: ${error.message}`);
        } else {
            console.log('✅ Done');
        }
    }

    console.log('\n✨ Database wipe successful!');
    console.log('All transactional data has been removed.');
}

wipeDatabase().catch(err => {
    console.error('💥 Fatal Error:', err);
    process.exit(1);
});
