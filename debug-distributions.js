// Debug script to check localStorage distributions
// Run this in browser console (F12) to see what data exists

console.log('=== DEBUGGING DISTRIBUTION DATA ===\n');

// Check localStorage for distributions
const distributionsStr = localStorage.getItem('thrift_shop_stock_distributions');
console.log('1. LocalStorage distributions:', distributionsStr);

if (distributionsStr) {
    const distributions = JSON.parse(distributionsStr);
    console.log('   Found', distributions.length, 'distributions:');
    distributions.forEach(d => {
        console.log(`   - Item ${d.item_id} → Stall ${d.stall_id}: ${d.quantity_allocated} units`);
    });
} else {
    console.log('   ❌ NO DISTRIBUTIONS IN LOCALSTORAGE!');
}

// Check items
const itemsStr = localStorage.getItem('thrift_shop_items');
if (itemsStr) {
    const items = JSON.parse(itemsStr);
    console.log('\n2. LocalStorage items:', items.length, 'items found');
    items.forEach(item => {
        console.log(`   - ${item.item_name}: current_stock=${item.current_stock}, total_allocated=${item.total_allocated}`);
    });
} else {
    console.log('\n2. ❌ NO ITEMS IN LOCALSTORAGE!');
}

// Check IndexedDB (async)
console.log('\n3. Checking IndexedDB...');
const request = indexedDB.open('ThriftShopDB', 1);

request.onsuccess = function (event) {
    const db = event.target.result;

    // Check distributions in IndexedDB
    const distTransaction = db.transaction(['distributions'], 'readonly');
    const distStore = distTransaction.objectStore('distributions');
    const distRequest = distStore.getAll();

    distRequest.onsuccess = function () {
        const distributions = distRequest.result;
        console.log('   IndexedDB distributions:', distributions.length, 'found');
        distributions.forEach(d => {
            console.log(`   - Item ${d.item_id} → Stall ${d.stall_id}: ${d.quantity_allocated} units`);
        });

        if (distributions.length === 0) {
            console.log('   ❌ NO DISTRIBUTIONS IN INDEXEDDB!');
            console.log('   → This means the sync didn\'t run or failed');
        }
    };

    // Check items in IndexedDB
    const itemTransaction = db.transaction(['items'], 'readonly');
    const itemStore = itemTransaction.objectStore('items');
    const itemRequest = itemStore.getAll();

    itemRequest.onsuccess = function () {
        const items = itemRequest.result;
        console.log('\n4. IndexedDB items:', items.length, 'found');
    };
};

request.onerror = function () {
    console.log('   ❌ FAILED TO OPEN INDEXEDDB!');
};

console.log('\n=== END DEBUG ===');
console.log('Copy and paste this entire output to share with support');
