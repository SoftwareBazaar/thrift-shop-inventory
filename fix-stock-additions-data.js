/**
 * Fix Stock Additions Data Issue
 * 
 * Issue: Some items have incorrect total_added values in the database
 * Example: Pants shows 93 but should be 67 (based on actual additions)
 * 
 * Solution: Recalculate total_added from stock_additions table
 * 
 * This script:
 * 1. Queries all items
 * 2. For each item, sums the actual stock_additions
 * 3. Compares with current total_added
 * 4. Updates if different
 * 5. Logs all changes
 */

const supabase = require('./lib/supabase');

async function fixStockAdditionsData() {
  console.log('🔧 Starting Stock Additions Data Fix...\n');

  try {
    // Get all items
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select('item_id, item_name, total_added');

    if (itemsError) throw itemsError;

    console.log(`Found ${items.length} items to check\n`);

    let itemsFixed = 0;
    let totalDifference = 0;
    const changes = [];

    // For each item, calculate actual total_added
    for (const item of items) {
      // Get all stock additions for this item
      const { data: additions, error: addError } = await supabase
        .from('stock_additions')
        .select('quantity_added')
        .eq('item_id', item.item_id);

      if (addError) {
        console.error(`❌ Error fetching additions for ${item.item_name}:`, addError);
        continue;
      }

      // Calculate actual total
      const actualTotal = additions.reduce((sum, add) => sum + (add.quantity_added || 0), 0);

      // Check if it matches
      if (actualTotal !== item.total_added) {
        console.log(`⚠️  ${item.item_name} (ID: ${item.item_id})`);
        console.log(`   Current total_added: ${item.total_added}`);
        console.log(`   Actual total: ${actualTotal}`);
        console.log(`   Difference: ${actualTotal - item.total_added}\n`);

        // Update the item
        const { error: updateError } = await supabase
          .from('items')
          .update({ total_added: actualTotal })
          .eq('item_id', item.item_id);

        if (updateError) {
          console.error(`   ❌ Failed to update:`, updateError);
        } else {
          console.log(`   ✅ Updated to ${actualTotal}\n`);
          itemsFixed++;
          totalDifference += (actualTotal - item.total_added);
          changes.push({
            item_id: item.item_id,
            item_name: item.item_name,
            old_value: item.total_added,
            new_value: actualTotal,
            difference: actualTotal - item.total_added
          });
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`Items fixed: ${itemsFixed}`);
    console.log(`Total difference: ${totalDifference}`);

    if (changes.length > 0) {
      console.log('\n📝 Changes Made:');
      changes.forEach(change => {
        console.log(`  • ${change.item_name}: ${change.old_value} → ${change.new_value} (${change.difference > 0 ? '+' : ''}${change.difference})`);
      });
    }

    console.log('\n✅ Stock Additions Data Fix Complete!');
    return { itemsFixed, totalDifference, changes };

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

// Run the fix
fixStockAdditionsData()
  .then(result => {
    console.log('\n🎉 Fix completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  });
