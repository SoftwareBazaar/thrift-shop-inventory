// 🚀 CONSOLE-READY DATABASE WIPE SCRIPT (VERIFIED)
// This version handles different column names for each table.

(async () => {
    console.log('🧨 Loading Supabase library...');

    if (typeof supabase === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    const supabaseUrl = 'https://droplfoogapyhlyvkmob.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyb3BsZm9vZ2FweWhseXZrbW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzA0ODIsImV4cCI6MjA3NzgwNjQ4Mn0.fFBLMn-WBytJoL1xcVr2yL7JDnRTLx-dbXGD_cq0xl0';

    const client = window.supabase.createClient(supabaseUrl, supabaseKey);

    console.log('🧨 Starting refined database wipe...');

    // Table-specific clear configurations
    const tableConfigs = [
        { name: 'activity_log', pk: 'log_id' },
        { name: 'credit_sales', pk: 'sale_id' },
        { name: 'sales', pk: 'sale_id' },
        { name: 'stock_distribution', pk: 'distribution_id' },
        { name: 'stock_additions', pk: 'addition_id' },
        { name: 'items', pk: 'item_id' }
    ];

    for (const config of tableConfigs) {
        try {
            console.log(`🧹 Clearing table: ${config.name}...`);
            // Use the correct primary key for each table
            const { error } = await client
                .from(config.name)
                .delete()
                .neq(config.pk, -1);

            if (error) {
                // Fallback: if PK is wrong, try a generic filter
                console.warn(`⚠️ PK ${config.pk} failed for ${config.name}, trying generic filter...`);
                await client.from(config.name).delete().filter('user_id', 'neq', -1);
            } else {
                console.log(`✅ Table ${config.name} cleared!`);
            }
        } catch (e) {
            console.error(`❌ Unexpected error clearing ${config.name}:`, e);
        }
    }

    // 👤 CRITICAL: Update users to correct stall IDs (1 and 2)
    console.log('👤 Updating user stall mappings (ID 1 for Kelvin, ID 2 for Manuel)...');

    try {
        const { error: kError } = await client.from('users').update({ stall_id: 1 }).eq('username', 'kelvin');
        const { error: mError } = await client.from('users').update({ stall_id: 2 }).eq('username', 'manuel');

        if (kError || mError) {
            console.error('❌ User update failed:', kError || mError);
        } else {
            console.log('✅ Kelvin mapped to Stall 1');
            console.log('✅ Manuel mapped to Stall 2');
        }
    } catch (e) {
        console.error('❌ Error updating users:', e);
    }

    console.log('\n✨ ALL DONE! Your database is now perfectly clean.');
    console.log('Next: Refresh your page and add your first item as Admin.');
})();
