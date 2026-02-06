/**
 * 🧨 FRESH START - COMPLETE SYSTEM WIPE
 * ------------------------------------
 * This script clears all business data and resets the local client state.
 * It preserves the database schema, functions, and triggers.
 * 
 * INSTRUCTIONS:
 * 1. Open your application in the browser.
 * 2. Press F12 to open Developer Tools.
 * 3. Go to the "Console" tab.
 * 4. Paste this entire script and press Enter.
 */

(async () => {
    console.log('%c🧨 Starting COMPLETE SYSTEM WIPE...', 'color: red; font-size: 16px; font-weight: bold;');

    // 1. Load Supabase Library if not present
    if (typeof window.supabase === 'undefined') {
        console.log('📡 Loading Supabase SDK...');
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
            script.onload = () => {
                if (typeof window.supabase !== 'undefined') {
                    console.log('✅ Supabase SDK loaded successfully.');
                    resolve();
                } else {
                    reject(new Error('Supabase SDK loaded but "window.supabase" is missing.'));
                }
            };
            script.onerror = () => reject(new Error('Failed to load Supabase SDK from CDN.'));
            document.head.appendChild(script);
        });
    }

    // 2. Initialize Supabase Client
    const SUPABASE_URL = 'https://droplfoogapyhlyvkmob.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRyb3BsZm9vZ2FweWhseXZrbW9iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMzA0ODIsImV4cCI6MjA3NzgwNjQ4Mn0.fFBLMn-WBytJoL1xcVr2yL7JDnRTLx-dbXGD_cq0xl0';

    if (!window.supabase || !window.supabase.createClient) {
        throw new Error('Supabase library is not available. Please ensure you have internet access.');
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // 3. Define Tables to Wipe (Order respects Foreign Key constraints)
    const tablesToWipe = [
        { name: 'activity_log', pk: 'log_id' },
        { name: 'credit_sales', pk: 'credit_id' },
        { name: 'sales', pk: 'sale_id' },
        { name: 'stock_distribution', pk: 'distribution_id' },
        { name: 'stock_additions', pk: 'addition_id' },
        { name: 'items', pk: 'item_id' }
    ];

    console.log('🗂️ Wiping remote database tables...');
    for (const table of tablesToWipe) {
        try {
            console.log(`🧹 Clearing table: ${table.name}...`);
            // Delete all records where PK is not -1 (effectively all)
            const { error } = await client
                .from(table.name)
                .delete()
                .neq(table.pk, -1);

            if (error) throw error;
            console.log(`✅ ${table.name} is now empty.`);
        } catch (err) {
            console.warn(`⚠️ Warning: Could not fully clear ${table.name}:`, err.message);
        }
    }

    // 4. Reset User/Stall Mappings (Optional Cleanup)
    console.log('👥 Resetting user stall assignments...');
    try {
        await client.from('users').update({ stall_id: 1 }).eq('username', 'kelvin');
        await client.from('users').update({ stall_id: 2 }).eq('username', 'manuel');
        console.log('✅ Default users reset to standard stalls.');
    } catch (err) {
        console.warn('⚠️ Could not reset user mappings:', err.message);
    }

    // 5. Clear Local Browser State
    console.log('💾 Clearing local storage and cache...');
    localStorage.clear();
    sessionStorage.clear();

    // Attempt to delete all IndexedDB databases
    try {
        const dbs = await window.indexedDB.databases();
        for (const db of dbs) {
            if (db.name) {
                window.indexedDB.deleteDatabase(db.name);
                console.log(`✅ IndexedDB "${db.name}" deleted.`);
            }
        }
    } catch (e) {
        console.warn('⚠️ Could not clear IndexedDB:', e.message);
    }

    console.log('%c✨ SYSTEM RESET COMPLETE!', 'color: green; font-size: 16px; font-weight: bold;');
    console.log('The database is empty and the client is fresh.');
    console.log('Reloading the application in 3 seconds...');

    setTimeout(() => {
        window.location.reload();
    }, 3000);
})();
