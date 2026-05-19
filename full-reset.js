// FULL RESET SCRIPT
// Paste this into your browser console (F12) to clear all local data and fix the stall IDs

async function fullReset() {
    console.log('🧹 Starting full application reset...');

    // 1. Clear Local Storage (Auth, Cached Credentials, etc.)
    localStorage.clear();
    console.log('✅ LocalStorage cleared');

    // 2. Clear Session Storage
    sessionStorage.clear();
    console.log('✅ SessionStorage cleared');

    // 3. Delete IndexedDB (Offline Data)
    const dbs = await window.indexedDB.databases();
    for (const db of dbs) {
        if (db.name) {
            await new Promise((resolve) => {
                const deleteRequest = window.indexedDB.deleteDatabase(db.name);
                deleteRequest.onsuccess = () => {
                    console.log(`✅ IndexedDB "${db.name}" deleted`);
                    resolve(true);
                };
                deleteRequest.onerror = () => {
                    console.error(`❌ Failed to delete IndexedDB "${db.name}"`);
                    resolve(false);
                };
            });
        }
    }

    // 4. Clear Cookies (Optional but helpful)
    document.cookie.split(";").forEach(function (c) {
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    console.log('✅ Cookies cleared');

    console.log('\n🚀 RESET COMPLETE! The page will now reload.');
    console.log('Please login again. Use:');
    console.log('- kelvin / @Sta123$ (Stall 1)');
    console.log('- manuel / @Sta123$ (Stall 2)');

    setTimeout(() => {
        window.location.reload();
    }, 2000);
}

fullReset();
