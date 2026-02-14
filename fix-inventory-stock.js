// Script to recalculate and fix current_stock for all inventory items
// This uses the same formula as getInventory admin stock calculation

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    console.error(`   SUPABASE_URL: ${supabaseUrl ? 'Found' : 'Missing'}`);
    console.error(`   SUPABASE_SERVICE_ROLE_KEY: ${supabaseKey ? 'Found' : 'Missing'}`);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixInventoryStock() {
    console.log('🔧 Starting inventory stock recalculation...\n');

    try {
        // Get all items
        const { data: items, error: itemsError } = await supabase
            .from('items')
            .select('*')
            .order('item_name');

        if (itemsError) throw itemsError;

        console.log(`Found ${items.length} items to process\n`);

        let fixedCount = 0;
        let skippedCount = 0;

        for (const item of items) {
            const initialStock = Number(item.initial_stock || 0);

            // Get stock additions
            const { data: stockAdditions } = await supabase
                .from('stock_additions')
                .select('quantity_added')
                .eq('item_id', item.item_id);

            const totalAdded = (stockAdditions || []).reduce(
                (sum, a) => sum + (a.quantity_added || 0), 0
            );

            // Get distributions
            const { data: distributions } = await supabase
                .from('stock_distribution')
                .select('quantity_allocated')
                .eq('item_id', item.item_id);

            const totalDistributed = (distributions || []).reduce(
                (sum, d) => sum + (d.quantity_allocated || 0), 0
            );

            // Get central sales (where stall_id is null)
            const { data: centralSales } = await supabase
                .from('sales')
                .select('quantity_sold')
                .eq('item_id', item.item_id)
                .is('stall_id', null);

            const totalCentralSold = (centralSales || []).reduce(
                (sum, s) => sum + (s.quantity_sold || 0), 0
            );

            // Get withdrawals
            const { data: withdrawals } = await supabase
                .from('stock_withdrawals')
                .select('quantity_withdrawn')
                .eq('item_id', item.item_id);

            const totalWithdrawn = (withdrawals || []).reduce(
                (sum, w) => sum + (w.quantity_withdrawn || 0), 0
            );

            // Calculate correct stock using the complete formula
            const totalReceived = initialStock + totalAdded;
            const correctStock = Math.max(0, totalReceived - totalDistributed - totalCentralSold - totalWithdrawn);

            // Check if update is needed
            const currentStockInDb = Number(item.current_stock || 0);
            const totalAddedInDb = Number(item.total_added || 0);
            const totalAllocatedInDb = Number(item.total_allocated || 0);

            const needsUpdate =
                currentStockInDb !== correctStock ||
                totalAddedInDb !== totalAdded ||
                totalAllocatedInDb !== totalDistributed;

            if (needsUpdate) {
                console.log(`📦 ${item.item_name}:`);
                console.log(`   Initial: ${initialStock}`);
                console.log(`   Total Added: ${totalAddedInDb} → ${totalAdded}`);
                console.log(`   Total Received: ${totalReceived}`);
                console.log(`   Distributed: ${totalAllocatedInDb} → ${totalDistributed}`);
                console.log(`   Central Sales: ${totalCentralSold}`);
                console.log(`   Withdrawn: ${totalWithdrawn}`);
                console.log(`   Current Stock: ${currentStockInDb} → ${correctStock}`);

                // Update the item
                const { error: updateError } = await supabase
                    .from('items')
                    .update({
                        current_stock: correctStock,
                        total_added: totalAdded,
                        total_allocated: totalDistributed
                    })
                    .eq('item_id', item.item_id);

                if (updateError) {
                    console.log(`   ❌ Error: ${updateError.message}\n`);
                } else {
                    console.log(`   ✅ Fixed!\n`);
                    fixedCount++;
                }
            } else {
                skippedCount++;
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log(`✅ Fixed: ${fixedCount} items`);
        console.log(`⏭️  Skipped (already correct): ${skippedCount} items`);
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

fixInventoryStock();
