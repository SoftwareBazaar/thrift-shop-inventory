// Utility to sync localStorage data to IndexedDB for offline access
// This ensures that distributions and other data are available offline

import { offlineStorage } from './offlineStorage';

interface StockDistribution {
    distribution_id: number;
    item_id: number;
    stall_id: number;
    quantity_allocated: number;
    date_distributed: string;
    distributed_by: number;
}

interface InventoryItem {
    item_id: number;
    item_name: string;
    category: string;
    initial_stock: number;
    current_stock: number;
    unit_price: number;
    buying_price?: number;
    date_added: string;
    sku?: string;
    total_allocated: number;
    total_added: number;
    stall_id?: number;
}

interface Sale {
    sale_id: number;
    item_name: string;
    category: string;
    item_id?: number;
    stall_id?: number;
    quantity_sold: number;
    unit_price: number;
    total_amount: number;
    sale_type: 'cash' | 'credit' | 'mobile' | 'split';
    date_time: string;
    recorded_by: number;
    recorded_by_name: string;
    stall_name: string;
}

// Sync localStorage data to IndexedDB
export const syncLocalStorageToIndexedDB = async () => {
    console.log('[Sync] Starting localStorage to IndexedDB sync...');

    try {
        // Sync items
        const itemsStr = localStorage.getItem('thrift_shop_items');
        if (itemsStr) {
            const items: InventoryItem[] = JSON.parse(itemsStr);
            console.log(`[Sync] Syncing ${items.length} items to IndexedDB`);
            for (const item of items) {
                await offlineStorage.saveItem(item);
            }
        }

        // Sync sales
        const salesStr = localStorage.getItem('thrift_shop_sales');
        if (salesStr) {
            const sales: Sale[] = JSON.parse(salesStr);
            console.log(`[Sync] Syncing ${sales.length} sales to IndexedDB`);
            for (const sale of sales) {
                await offlineStorage.saveSale(sale);
            }
        }

        // Sync distributions - THIS IS CRITICAL FOR THE FIX
        const distributionsStr = localStorage.getItem('thrift_shop_stock_distributions');
        if (distributionsStr) {
            const distributions: StockDistribution[] = JSON.parse(distributionsStr);
            console.log(`[Sync] Syncing ${distributions.length} distributions to IndexedDB`);
            for (const dist of distributions) {
                await offlineStorage.saveDistribution(dist);
            }
        }

        console.log('[Sync] Successfully synced all data from localStorage to IndexedDB');
    } catch (error) {
        console.error('[Sync] Error syncing localStorage to IndexedDB:', error);
    }
};

// Initialize sync on app load
export const initializeOfflineSync = async () => {
    await offlineStorage.init();
    await syncLocalStorageToIndexedDB();

    // Set up periodic sync every 30 seconds to catch new data
    setInterval(() => {
        syncLocalStorageToIndexedDB();
    }, 30000);
};
