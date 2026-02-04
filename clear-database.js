// ⚠️ WARNING: DATABASE WIPE SCRIPT
// This script will delete ALL data from your Supabase database except users and stalls.
// Use this to start fresh with clean inventory and distributions.

import { supabase } from './lib/supabase';

async function wipeDatabase() {
    console.log('🧨 Starting database wipe...');

    const tables = [
        'activity_log',
        'credit_sales',
        'sales',
        'stock_distribution',
        'stock_additions',
        'items'
    ];

    for (const table of tables) {
        console.log(`🧹 Clearing table: ${table}...`);
        const { error } = await supabase
            .from(table)
            .delete()
            .neq('item_id', -1); // Deletes everything (where id is not -1)

        if (error) {
            console.error(`❌ Error clearing ${table}:`, error.message);
        } else {
            console.log(`✅ Table ${table} cleared!`);
        }
    }

    // 2. Reset items stock values in the items table (if delete didn't work for some reason)
    console.log('📦 Database is now empty for items and transactions.');

    // 3. IMPORTANT: Reset stall IDs for Kelvin and Manuel in the users table to be SURE
    console.log('👤 Updating users to correct stall IDs...');

    const { error: userError1 } = await supabase
        .from('users')
        .update({ stall_id: 1 })
        .eq('username', 'kelvin');

    const { error: userError2 } = await supabase
        .from('users')
        .update({ stall_id: 2 })
        .eq('username', 'manuel');

    if (userError1 || userError2) {
        console.error('❌ Error updating user stall IDs');
    } else {
        console.log('✅ Kelvin is now Stall 1, Manuel is Stall 2 in Supabase.');
    }

    console.log('\n✨ DATABASE WIPE COMPLETE! You can now start adding items fresh.');
}

wipeDatabase();
