// Script to check Supabase database for distributions
// Paste this in browser console to see what's in the database

import { supabase } from './lib/supabase';

async function checkDistributions() {
    console.log('=== CHECKING SUPABASE DATABASE ===\n');

    // Check all distributions in the database
    const { data: allDist, error: allError } = await supabase
        .from('stock_distribution')
        .select('*');

    console.log('1. ALL distributions in database:', allDist?.length || 0);
    if (allDist && allDist.length > 0) {
        console.table(allDist);
    } else {
        console.log('   ❌ NO DISTRIBUTIONS FOUND IN DATABASE!');
        if (allError) {
            console.error('   Error:', allError);
        }
    }

    // Check distributions for stall 316 (Kelvin)
    const { data: kelvinDist, error: kelvinError } = await supabase
        .from('stock_distribution')
        .select('*')
        .eq('stall_id', 316);

    console.log('\n2. Distributions for Stall 316 (Kelvin):', kelvinDist?.length || 0);
    if (kelvinDist && kelvinDist.length > 0) {
        console.table(kelvinDist);
    } else if (kelvinError) {
        console.error('   Error:', kelvinError);
    }

    // Check all items
    const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('item_id, item_name, current_stock, total_allocated');

    console.log('\n3. All items in database:', items?.length || 0);
    if (items && items.length > 0) {
        console.table(items);
    } else if (itemsError) {
        console.error('   Error:', itemsError);
    }

    console.log('\n=== END CHECK ===');
}

// Run the check
checkDistributions();
