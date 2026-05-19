/**
 * 🧨 SYSTEM-WIDE WIPE SCRIPT (FIXED VERSION)
 * -----------------------------------------
 * This script clears all business data and prepares for real recording.
 */

(async () => {
    console.log('🧨 Starting Fixed SYSTEM-WIDE WIPE...');

    // 1. Load Supabase
    if (typeof supabase === 'undefined') {
        await new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    const client = window.supabase.createClient(
        'https://droplfoogapyhlyvkmob.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyb3BsZm9vZ2FweWhseXZrbW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzA0ODIsImV4cCI6MjA3NzgwNjQ4Mn0.fFBLMn-WBytJoL1xcVr2yL7JDnRTLx-dbXGD_cq0xl0'
    );

    // 2. Wipe Tables in correct order (Dependencies first)
    // Primary keys verified from init.sql
    const tableConfigs = [
        { name: 'activity_log', pk: 'log_id' },
        { name: 'credit_sales', pk: 'credit_id' },
        { name: 'sales', pk: 'sale_id' },
        { name: 'stock_distribution', pk: 'distribution_id' },
        { name: 'stock_additions', pk: 'addition_id' },
        { name: 'items', pk: 'item_id' }
    ];

    console.log('🗂️ Wiping data tables...');
    for (const config of tableConfigs) {
        try {
            console.log(`🧹 Clearing ${config.name}...`);
            const { error } = await client
                .from(config.name)
                .delete()
                .neq(config.pk, -1);

            if (error) throw error;
            console.log(`✅ ${config.name} cleared.`);
        } catch (e) {
            console.warn(`⚠️ Could not clear ${config.name}:`, e.message);
        }
    }

    // 3. Reset User Stalls
    console.log('👥 Resetting user permissions...');
    await client.from('users').update({ stall_id: 1 }).eq('username', 'kelvin');
    await client.from('users').update({ stall_id: 2 }).eq('username', 'manuel');

    // 4. Local browser cleanup
    console.log('🧹 Clearing browser cache...');
    localStorage.clear();
    sessionStorage.clear();

    // Clear IndexedDB
    try {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
            if (db.name) window.indexedDB.deleteDatabase(db.name);
        }
    } catch (e) { }

    console.log('✨ SYSTEM RESET COMPLETE!');
    console.log('Reloading in 2 seconds...');

    setTimeout(() => {
        window.location.reload();
    }, 2000);
})();
