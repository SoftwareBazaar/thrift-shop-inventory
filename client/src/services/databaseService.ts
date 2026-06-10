// Database Service - Uses Supabase with real-time sync, falls back to mockData
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockApi, type User, type Sale, type Stall, type SaleInput, type InventoryItem as Item } from './mockData';
import { syncOfflineUserProfile } from '../utils/offlineCredentials';
import { derivePasswordHash } from '../utils/passwordUtils';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Export interfaces for compatibility
export type { User, Sale, Stall, Item, SaleInput };

const SALES_PAGE_SIZE = 1000;

export type SalesAggregates = {
  byItem: Record<number, number>;
  byItemStall: Record<string, number>;
};

type SalesQuantityRow = {
  item_id: number;
  stall_id: number | null;
  quantity_sold: number;
};

const buildSalesAggregates = (rows: SalesQuantityRow[]): SalesAggregates => {
  const byItem: Record<number, number> = {};
  const byItemStall: Record<string, number> = {};

  for (const row of rows) {
    const itemId = Number(row.item_id);
    const qty = Number(row.quantity_sold) || 0;
    byItem[itemId] = (byItem[itemId] || 0) + qty;
    const stallKey = `${itemId}-${row.stall_id ?? 'null'}`;
    byItemStall[stallKey] = (byItemStall[stallKey] || 0) + qty;
  }

  return { byItem, byItemStall };
};

const fetchAllSalesQuantityRows = async (): Promise<SalesQuantityRow[]> => {
  const rows: SalesQuantityRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await (supabase as any)
      .from('sales')
      .select('item_id, stall_id, quantity_sold')
      .order('sale_id', { ascending: true })
      .range(from, from + SALES_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data || []) as SalesQuantityRow[];
    rows.push(...page);

    if (page.length < SALES_PAGE_SIZE) break;
    from += SALES_PAGE_SIZE;
  }

  return rows;
};

const mapSaleRow = (sale: any): Sale => {
  const credit = Array.isArray(sale.credit_sales) ? sale.credit_sales[0] : sale.credit_sales;

  return {
    ...sale,
    recorded_by_name: sale.users?.full_name || 'Unknown',
    stall_name: sale.stalls?.stall_name || 'Unknown',
    item_name: sale.items?.item_name || 'Unknown',
    category: sale.items?.category || 'Unknown',
    customer_name: credit?.customer_name ?? sale.customer_name,
    customer_contact: credit?.customer_contact ?? sale.customer_contact,
    payment_status: credit?.payment_status ?? sale.payment_status,
    balance_due: credit?.balance_due ?? sale.balance_due,
    amount_paid: credit?.amount_paid ?? sale.amount_paid,
    due_date: credit?.due_date ?? sale.due_date,
    notes: credit?.notes ?? sale.notes
  };
};

// Real-time subscription channels
let inventoryChannel: RealtimeChannel | null = null;
let salesChannel: RealtimeChannel | null = null;
let usersChannel: RealtimeChannel | null = null;

// Callbacks for real-time updates
const updateCallbacks: {
  inventory?: (items: Item[]) => void;
  sales?: (sales: Sale[]) => void;
  users?: (users: User[]) => void;
} = {};

// Setup real-time subscriptions
export const setupRealtimeSubscriptions = (callbacks: {
  inventory?: (items: Item[]) => void;
  sales?: (sales: Sale[]) => void;
  users?: (users: User[]) => void;
}) => {
  if (!isSupabaseConfigured()) {
    console.log('📝 Supabase not configured, using polling instead');
    return () => { }; // Return cleanup function
  }

  updateCallbacks.inventory = callbacks.inventory;
  updateCallbacks.sales = callbacks.sales;
  updateCallbacks.users = callbacks.users;

  // Subscribe to inventory changes
  inventoryChannel = (supabase as any)
    .channel('inventory-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'items' },
      async () => {
        console.log('📡 Real-time: Inventory changed');
        // Fire window event for components to listen
        window.dispatchEvent(new Event('inventory-updated'));
        if (callbacks.inventory) {
          const { data } = await (supabase as any)
            .from('items')
            .select('*')
            .order('date_added', { ascending: false });
          if (data) callbacks.inventory(data as Item[]);
        }
      }
    )
    .subscribe();

  // Subscribe to sales changes
  salesChannel = (supabase as any)
    .channel('sales-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'sales' },
      async () => {
        console.log('📡 Real-time: Sales changed');
        // Fire window event for components to listen
        window.dispatchEvent(new Event('sales-updated'));
        if (callbacks.sales) {
          const { data } = await (supabase as any)
            .from('sales')
            .select('*, users:recorded_by(full_name)')
            .order('date_time', { ascending: false });
          if (data) {
            const sales = data.map((sale: any) => ({
              ...sale,
              recorded_by_name: sale.users?.full_name || 'Unknown'
            }));
            callbacks.sales(sales as Sale[]);
          }
        }
      }
    )
    .subscribe();

  // Subscribe to users changes
  usersChannel = (supabase as any)
    .channel('users-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      async () => {
        console.log('📡 Real-time: Users changed');
        // Fire window event for components to listen
        window.dispatchEvent(new Event('users-updated'));
        if (callbacks.users) {
          const { data } = await (supabase as any)
            .from('users')
            .select('*')
            .order('created_date', { ascending: false });
          if (data) callbacks.users(data as User[]);
        }
      }
    )
    .subscribe();

  // Cleanup function
  return () => {
    inventoryChannel?.unsubscribe();
    salesChannel?.unsubscribe();
    usersChannel?.unsubscribe();
  };
};

// Detects "function does not exist" errors so we can fall back gracefully
// when the atomic SQL functions haven't been installed in Supabase yet.
const isMissingFunctionError = (error: any): boolean => {
  if (!error) return false;
  const code = error.code || '';
  const message = String(error.message || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /could not find the function|function .* does not exist/i.test(message)
  );
};

// Recompute an item's denormalized totals from the history tables and persist
// them. Single source of truth for stock math:
//   current_stock = initial_stock + SUM(additions) - SUM(distributions)
//                   - central sales (stall_id IS NULL) - withdrawals
// Prefers the atomic DB-side function; falls back to client-side math.
const recomputeItemTotals = async (itemId: number): Promise<Item> => {
  const { data: rpcItem, error: rpcError } = await (supabase as any)
    .rpc('recalc_item_stock', { p_item_id: itemId });

  if (!rpcError && rpcItem) {
    return (Array.isArray(rpcItem) ? rpcItem[0] : rpcItem) as Item;
  }

  if (rpcError && !isMissingFunctionError(rpcError)) {
    console.warn('[Recompute Totals] RPC failed, falling back to client math:', rpcError);
  }

  const { data: item, error: itemError } = await (supabase as any)
    .from('items')
    .select('*')
    .eq('item_id', itemId)
    .single();

  if (itemError || !item) {
    throw new Error('Item not found.');
  }

  const [{ data: additions }, { data: distributions }, { data: centralSales }, { data: withdrawals }] = await Promise.all([
    (supabase as any).from('stock_additions').select('quantity_added').eq('item_id', itemId),
    (supabase as any).from('stock_distribution').select('quantity_allocated').eq('item_id', itemId),
    (supabase as any).from('sales').select('quantity_sold').eq('item_id', itemId).is('stall_id', null),
    (supabase as any).from('stock_withdrawals').select('quantity_withdrawn').eq('item_id', itemId)
  ]);

  const totalAdded = (additions || []).reduce((sum: number, a: any) => sum + (a.quantity_added || 0), 0);
  const totalAllocated = (distributions || []).reduce((sum: number, d: any) => sum + (d.quantity_allocated || 0), 0);
  const totalCentralSold = (centralSales || []).reduce((sum: number, s: any) => sum + (s.quantity_sold || 0), 0);
  const totalWithdrawn = (withdrawals || []).reduce((sum: number, w: any) => sum + (w.quantity_withdrawn || 0), 0);

  const currentStock = Math.max(
    0,
    (item.initial_stock || 0) + totalAdded - totalAllocated - totalCentralSold - totalWithdrawn
  );

  const { data: updated, error: updateError } = await (supabase as any)
    .from('items')
    .update({
      total_added: totalAdded,
      total_allocated: totalAllocated,
      current_stock: currentStock
    })
    .eq('item_id', itemId)
    .select()
    .single();

  if (updateError) throw updateError;
  return updated as Item;
};

const getCurrentUserId = (): number => {
  try {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    return currentUser.user_id || 1;
  } catch {
    return 1;
  }
};

// Database API - Uses Supabase if configured, otherwise mockData
export const dbApi = {
  // Users
  getUsers: async () => {
    if (!isSupabaseConfigured()) {
      return mockApi.getUsers();
    }

    try {
      const { data, error } = await (supabase as any)
        .from('users')
        .select('*')
        .order('created_date', { ascending: false });

      if (error) throw error;

      // Sync offline profiles for all users to ensure password changes are propagated
      if (data) {
        data.forEach((user: any) => {
          syncOfflineUserProfile({
            user_id: user.user_id,
            username: user.username,
            full_name: user.full_name,
            role: user.role,
            stall_id: user.stall_id,
            status: user.status,
            created_date: user.created_date,
            phone_number: user.phone_number ?? null,
            email: user.email ?? null,
            password_hash: user.password_hash
          });
        });
      }

      return { users: data as User[] };
    } catch (error) {
      console.error('Error fetching users:', error);
      return mockApi.getUsers(); // Fallback
    }
  },

  createUser: async (userData: any) => {
    if (!isSupabaseConfigured()) {
      return mockApi.createUser(userData as any);
    }

    try {
      // Map password to password_hash for Supabase
      const insertData = { ...userData };
      if (insertData.password) {
        // Generate the verifier used by the offline auth system
        insertData.password_hash = await derivePasswordHash(insertData.username, insertData.password);
        delete insertData.password;
      }

      console.log('[Create User] Inserting user into Supabase:', { ...insertData, password_hash: '***' });

      const { data, error } = await (supabase as any)
        .from('users')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('[Create User] Supabase error:', error);
        throw error;
      }

      if (data) {
        syncOfflineUserProfile({
          user_id: data.user_id,
          username: data.username,
          full_name: data.full_name,
          role: data.role,
          stall_id: data.stall_id,
          status: data.status,
          created_date: data.created_date,
          phone_number: data.phone_number ?? null,
          email: data.email ?? null,
          password_hash: data.password_hash // Include hash for sync
        });
      }

      return { user: data as User };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  updateUser: async (userId: number, userData: Partial<User>) => {
    if (!isSupabaseConfigured()) {
      return mockApi.updateUser(userId, userData as any);
    }

    try {
      const updateData = { ...userData };

      // Handle password update if provided
      if ((updateData as any).password) {
        // We need the username to derive the hash
        const { data: userRecord } = await (supabase as any)
          .from('users')
          .select('username')
          .eq('user_id', userId)
          .single();

        if (userRecord?.username) {
          console.log(`[Update User] Derived password hash for ${userRecord.username}`);
          updateData.password_hash = await derivePasswordHash(userRecord.username, (updateData as any).password);
        } else {
          console.warn('[Update User] Could not fetch username for hashing. Password update skipped.');
        }
        delete (updateData as any).password;
      }

      const { data, error } = await (supabase as any)
        .from('users')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        syncOfflineUserProfile({
          user_id: data.user_id,
          username: data.username,
          full_name: data.full_name,
          role: data.role,
          stall_id: data.stall_id,
          status: data.status,
          created_date: data.created_date,
          phone_number: data.phone_number ?? null,
          email: data.email ?? null,
          password_hash: data.password_hash // Include hash for sync
        });
      }

      return { user: data as User };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  },

  deleteUser: async (userId: number) => {
    if (!isSupabaseConfigured()) {
      return mockApi.deleteUser(userId);
    }

    try {
      const { error } = await (supabase as any)
        .from('users')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  },

  deleteItem: async (itemId: number) => {
    if (!isSupabaseConfigured()) {
      return mockApi.deleteItem(itemId);
    }

    try {
      const { error } = await (supabase as any)
        .from('items')
        .delete()
        .eq('item_id', itemId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  },

  getStockAdditions: async (itemId: number) => {
    if (!isSupabaseConfigured()) {
      return { additions: [] };
    }

    try {
      const { data, error } = await (supabase as any)
        .from('stock_additions')
        .select('*')
        .eq('item_id', itemId)
        .order('date_added', { ascending: false });

      if (error) throw error;
      return { additions: data || [] };
    } catch (error) {
      console.error('Error fetching stock additions:', error);
      throw error;
    }
  },

  deleteStockAddition: async (additionId: number) => {
    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    try {
      const { data: addition, error: fetchError } = await (supabase as any)
        .from('stock_additions')
        .select('*')
        .eq('addition_id', additionId)
        .single();

      if (fetchError || !addition) throw new Error('Stock addition record not found');

      const { item_id } = addition;

      const { error: deleteError } = await (supabase as any)
        .from('stock_additions')
        .delete()
        .eq('addition_id', additionId);

      if (deleteError) throw deleteError;

      // Recompute totals from history (includes central sales + withdrawals)
      await recomputeItemTotals(item_id);

      return { success: true };
    } catch (error) {
      console.error('Error deleting stock addition:', error);
      throw error;
    }
  },

  getStockWithdrawals: async (itemId: number) => {
    if (!isSupabaseConfigured()) {
      return { withdrawals: [] };
    }

    try {
      const { data: withdrawals, error } = await (supabase as any)
        .from('stock_withdrawals')
        .select('*')
        .eq('item_id', itemId)
        .order('date_withdrawn', { ascending: false });

      if (error) throw error;
      return { withdrawals: withdrawals || [] };
    } catch (error) {
      console.error('Error fetching stock withdrawals:', error);
      return { withdrawals: [] };
    }
  },

  deleteStockWithdrawal: async (withdrawalId: number) => {
    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    try {
      const { data: withdrawal, error: fetchError } = await (supabase as any)
        .from('stock_withdrawals')
        .select('*')
        .eq('withdrawal_id', withdrawalId)
        .single();

      if (fetchError || !withdrawal) throw new Error('Stock withdrawal record not found');

      const { item_id } = withdrawal;

      const { error: deleteError } = await (supabase as any)
        .from('stock_withdrawals')
        .delete()
        .eq('withdrawal_id', withdrawalId);

      if (deleteError) throw deleteError;

      // Recompute totals from history (restores the withdrawn quantity)
      await recomputeItemTotals(item_id);

      return { success: true };
    } catch (error) {
      console.error('Error deleting stock withdrawal:', error);
      throw error;
    }
  },

  // Inventory
  getInventory: async (stallId?: number) => {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, using mock data for inventory');
      return mockApi.getInventory(stallId);
    }

    // Ensure stallId is a number if provided
    const numericStallId = stallId != null ? Number(stallId) : undefined;
    const isInvalidStallId = numericStallId != null && (isNaN(numericStallId) || numericStallId <= 0);

    if (isInvalidStallId) {
      console.error(`[Get Inventory] Invalid stallId provided:`, stallId);
      return { items: [] };
    }

    console.log(`[Get Inventory] Fetching inventory${numericStallId ? ` for stall ${numericStallId}` : ' (admin view)'}`);

    try {
      let query = (supabase as any)
        .from('items')
        .select('*');

      if (numericStallId) {
        // Get items distributed to this stall
        console.log(`[Get Inventory] Querying distributions for stall ${numericStallId}...`);
        const { data: distributions, error: distError } = await (supabase as any)
          .from('stock_distribution')
          .select('item_id, quantity_allocated')
          .eq('stall_id', numericStallId);

        if (distError) {
          console.error(`[Get Inventory] Error fetching distributions for stall ${numericStallId}:`, distError);
          // Don't throw, maybe fallback to offline or return empty
        }

        const itemIds = (distributions as any)?.map((d: any) => d.item_id).filter((id: any) => id != null) || [];
        console.log(`[Get Inventory] Stall ${numericStallId} - Found ${itemIds.length} distributions, item_ids:`, itemIds);

        if (itemIds.length > 0) {
          query = (query as any).in('item_id', itemIds);
          console.log(`[Get Inventory] Querying items from 'items' table where item_id IN:`, itemIds);
        } else {
          console.log(`[Get Inventory] No items distributed to stall ${numericStallId} (no records found in stock_distribution)`);
          return { items: [] };
        }
      }

      const { data, error } = await (query as any).order('date_added', { ascending: false });

      if (error) {
        console.error(`[Get Inventory] Error fetching items:`, error);
        throw error;
      }

      console.log(`[Get Inventory] Fetched ${data?.length || 0} items from database`);

      // Calculate current stock based on distributions and sales
      console.log(`[Get Inventory] Processing ${data?.length || 0} items, stallId: ${numericStallId}`);
      const items = await Promise.all((data || []).map(async (item: any) => {
        if (numericStallId !== undefined) {
          console.log(`[Get Inventory] Processing item ${item.item_id} (${item.item_name}) for stall ${numericStallId}`);
          // For specific stall: calculate distributed - sold for that stall
          // Get all distributions sorted by date
          const { data: distributions } = await (supabase as any)
            .from('stock_distribution')
            .select('quantity_allocated, date_distributed')
            .eq('item_id', item.item_id)
            .eq('stall_id', numericStallId)
            .order('date_distributed', { ascending: true });

          const sortedDistributions = (distributions || []).sort((a: any, b: any) =>
            new Date(a.date_distributed).getTime() - new Date(b.date_distributed).getTime()
          );

          const totalDistributed = sortedDistributions.reduce((sum: number, d: any) => sum + d.quantity_allocated, 0);

          // Get all sales for this item at this stall
          const { data: sales } = await (supabase as any)
            .from('sales')
            .select('quantity_sold, date_time')
            .eq('item_id', item.item_id)
            .eq('stall_id', numericStallId);

          const totalSold = (sales || []).reduce((sum: number, s: any) => sum + s.quantity_sold, 0) || 0;

          // Calculate initial_stock and total_added based on distribution history
          // Initial stock = stock the user had at the time of the most recent distribution
          // Total added = quantity from the most recent distribution
          let initialStock = 0;
          let totalAdded = 0;

          if (sortedDistributions.length > 0) {
            const mostRecentDistribution = sortedDistributions[sortedDistributions.length - 1];
            totalAdded = mostRecentDistribution.quantity_allocated;

            if (sortedDistributions.length === 1) {
              // First distribution: initial = 0 (no stock before first distribution)
              initialStock = 0;
            } else {
              // For subsequent distributions: calculate stock at the time of the most recent distribution
              // This is: all previous distributions minus all sales up to that point
              const previousDistributions = sortedDistributions.slice(0, -1);
              const totalPreviousDistributed = previousDistributions.reduce(
                (sum: number, d: any) => sum + d.quantity_allocated, 0
              );

              // Calculate all sales that happened strictly before the most recent distribution
              // We use < (not <=) to ensure we get the stock at the moment before the new distribution
              const lastDistributionDate = new Date(mostRecentDistribution.date_distributed);
              const salesBeforeDistribution = (sales || []).filter(
                (s: any) => new Date(s.date_time) < lastDistributionDate
              );
              const totalSalesBeforeDistribution = salesBeforeDistribution.reduce(
                (sum: number, s: any) => sum + s.quantity_sold, 0
              );

              // Initial stock = stock the user had at that moment (before the new distribution)
              // This represents their "present stock" at the time they received the new stock
              // This is: previous distributions - sales before that point
              initialStock = Math.max(0, totalPreviousDistributed - totalSalesBeforeDistribution);
            }
          }

          // Current stock = total distributed - total sold
          const currentStock = Math.max(0, totalDistributed - totalSold);

          console.log(`[User Stock Calc] Item: ${item.item_name}, Stall: ${stallId}, Distributions: ${sortedDistributions.length}, initialStock: ${initialStock}, totalAdded: ${totalAdded}, currentStock: ${currentStock}`);

          // IMPORTANT: Explicitly create new object with calculated values
          // DO NOT use spread operator on item - it might include the original initial_stock
          const userItem = {
            item_id: item.item_id,
            stall_id: numericStallId, // Explicitly include stall_id for offline storage filtering
            item_name: item.item_name,
            category: item.category,
            sku: item.sku,
            unit_price: item.unit_price,
            buying_price: item.buying_price,
            date_added: item.date_added,
            current_stock: currentStock,
            initial_stock: initialStock, // Use calculated value (0 for first distribution)
            total_added: totalAdded,
            total_allocated: totalDistributed // For compatibility
          };

          console.log(`[User Stock Calc] Returning item:`, {
            item_id: userItem.item_id,
            item_name: userItem.item_name,
            original_initial_stock: item.initial_stock,
            calculated_initial_stock: userItem.initial_stock,
            total_added: userItem.total_added,
            current_stock: userItem.current_stock,
            distributions_count: sortedDistributions.length
          });

          // CRITICAL: Verify the calculated value is actually in the returned object
          if (userItem.initial_stock !== initialStock) {
            console.error(`[ERROR] initial_stock mismatch! Calculated: ${initialStock}, Returned: ${userItem.initial_stock}`);
          }

          // Force set the value one more time to be absolutely sure
          userItem.initial_stock = initialStock;
          userItem.total_added = totalAdded;

          console.log(`[User Stock Calc] FINAL VERIFICATION - initial_stock: ${userItem.initial_stock}, total_added: ${userItem.total_added}`);

          return userItem;
        } else {
          // For admin view: calculate actual available stock (initial + additions - total sold)
          const initialStock = item.initial_stock != null ? Number(item.initial_stock) : 0;
          const existingCurrentStock = item.current_stock != null ? Number(item.current_stock) : 0;

          // Sum stock additions
          const { data: stockAdditions } = await (supabase as any)
            .from('stock_additions')
            .select('quantity_added')
            .eq('item_id', item.item_id);

          const totalAdded = (stockAdditions as any)?.reduce((sum: number, a: any) => sum + (a.quantity_added || 0), 0) || 0;

          // Sum distribution quantities
          const { data: itemDistributions, error: distError } = await (supabase as any)
            .from('stock_distribution')
            .select('quantity_allocated')
            .eq('item_id', item.item_id);

          if (distError) {
            console.warn('[Admin Stock Calc] Failed to fetch distributions for item', item.item_id, distError);
          }

          const totalDistributed = (itemDistributions as any)?.reduce(
            (sum: number, distribution: any) => sum + (distribution.quantity_allocated || 0),
            0
          ) || 0;

          // Sum sales quantities (for this item specifically from central hub, where stall_id is null)
          const { data: centralSales } = await (supabase as any)
            .from('sales')
            .select('quantity_sold')
            .eq('item_id', item.item_id)
            .is('stall_id', null);

          const totalCentralSold = (centralSales as any)?.reduce(
            (sum: number, sale: any) => sum + (sale.quantity_sold || 0),
            0
          ) || 0;

          // Sum withdrawal quantities (withdrawals ARE deducted from stock)
          const { data: withdrawals } = await (supabase as any)
            .from('stock_withdrawals')
            .select('quantity_withdrawn')
            .eq('item_id', item.item_id);

          const totalWithdrawn = (withdrawals as any)?.reduce(
            (sum: number, w: any) => sum + (w.quantity_withdrawn || 0),
            0
          ) || 0;

          // Formula: Correct Received = Initial + Sum of additions
          const totalReceived = initialStock + totalAdded;

          // Admin Stock (Available in central hub) = Total Received - Total Distributed - Total Hub Sales - Total Withdrawn
          const adminStock = Math.max(0, totalReceived - totalDistributed - totalCentralSold - totalWithdrawn);

          // Update the items table to match reality if it got out of sync
          if (existingCurrentStock !== adminStock || item.total_added !== totalAdded || item.total_allocated !== totalDistributed) {
            console.log(`[Admin Stock Sync] Syncing totals for ${item.item_name}: Stock: ${adminStock}, Added: ${totalAdded}, Allocated: ${totalDistributed}`);
            try {
              await (supabase as any)
                .from('items')
                .update({
                  current_stock: adminStock,
                  total_added: totalAdded,
                  total_allocated: totalDistributed
                })
                .eq('item_id', item.item_id);
            } catch (updateError) {
              console.warn(`[Admin Stock Sync] Failed for ${item.item_name}:`, updateError);
            }
          }

          console.log(`[Admin Stock Calc] ${item.item_name} breakdown:
            Initial: ${initialStock}
            Additions: ${totalAdded}
            Total Received: ${totalReceived}
            ---
            Distributed: ${totalDistributed}
            Hub Sales: ${totalCentralSold}
            Withdrawn: ${totalWithdrawn}
            ---
            Result Central Stock: ${adminStock}`);

          return {
            ...item,
            current_stock: adminStock,
            initial_stock: initialStock,
            total_added: totalAdded,
            total_allocated: totalDistributed
          };
        }
      }));

      return { items };
    } catch (error) {
      console.error('Error fetching inventory:', error);
      return mockApi.getInventory(numericStallId); // Fallback
    }
  },

  createItem: async (itemData: any) => {
    if (!isSupabaseConfigured()) {
      console.warn('⚠️ Supabase not configured, using mock data');
      return mockApi.createItem(itemData as any);
    }

    try {
      // Ensure initial_stock is a number
      const itemToInsert = {
        ...itemData,
        initial_stock: Number(itemData.initial_stock) || 0,
        current_stock: Number(itemData.current_stock) || Number(itemData.initial_stock) || 0
      };

      console.log('[Create Item] Inserting item:', itemToInsert);

      const { data, error } = await (supabase as any)
        .from('items')
        .insert([itemToInsert])
        .select()
        .single();

      if (error) {
        console.error('[Create Item] Supabase error:', error);
        throw error;
      }

      console.log('[Create Item] Item created successfully:', data);

      // Note: We don't create stock_additions for initial_stock
      // initial_stock is the starting stock, and stock_additions tracks additional stock added later
      // Admin Stock = initial_stock + total_added (from stock_additions) - total_distributed

      return { item: data as Item };
    } catch (error) {
      console.error('Error creating item:', error);
      throw error;
    }
  },

  updateItem: async (itemId: number, itemData: any) => {
    if (!isSupabaseConfigured()) {
      return mockApi.updateItem(itemId, itemData as any);
    }

    try {
      const numericItemId = typeof itemId === 'number' ? itemId : parseInt(itemId as any, 10);
      if (!Number.isFinite(numericItemId)) {
        throw new Error('Invalid item reference.');
      }

      const { data: existingItem, error: fetchError } = await (supabase as any)
        .from('items')
        .select('item_id, item_name, category, unit_price, initial_stock, total_added, current_stock, total_allocated')
        .eq('item_id', numericItemId)
        .single();

      if (fetchError || !existingItem) {
        throw new Error('Item not found.');
      }

      const updateData: Record<string, any> = {};

      if (itemData.item_name !== undefined) {
        updateData.item_name = String(itemData.item_name).trim();
      }

      if (itemData.category !== undefined) {
        updateData.category = String(itemData.category).trim();
      }

      if (itemData.unit_price !== undefined) {
        const unitPrice = Number(itemData.unit_price);
        if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
          throw new Error('Selling price must be greater than zero.');
        }
        updateData.unit_price = unitPrice;
      }

      if (itemData.buying_price !== undefined) {
        const buyingPrice = Number(itemData.buying_price);
        if (!Number.isFinite(buyingPrice) || buyingPrice < 0) {
          throw new Error('Buying price must be zero or greater.');
        }
        updateData.buying_price = buyingPrice;
      }

      if (itemData.initial_stock !== undefined || itemData.total_added !== undefined) {
        const initialStock = itemData.initial_stock !== undefined ? Number(itemData.initial_stock) : Number(existingItem.initial_stock || 0);
        const currentTotalAdded = Number(existingItem.total_added || 0);
        let newTotalAdded = currentTotalAdded;

        if (itemData.total_added !== undefined) {
          newTotalAdded = Number(itemData.total_added);
          if (!Number.isFinite(newTotalAdded)) {
            throw new Error('Invalid total added value.');
          }

          const quantityToAdd = newTotalAdded - currentTotalAdded;
          if (quantityToAdd > 0) {
            const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            const { error: insertError } = await (supabase as any)
              .from('stock_additions')
              .insert([{
                item_id: numericItemId,
                quantity_added: quantityToAdd,
                added_by: currentUser.user_id || 1
              }]);

            if (insertError) {
              console.error('Error creating stock_additions record:', insertError);
              throw new Error(insertError.message || 'Failed to record added stock.');
            }
          }
          updateData.total_added = newTotalAdded;
        }

        // Formula: Current Stock = Initial + Total Added - Total Distributed - Central Sales - Withdrawals
        const totalDistributed = Number(existingItem.total_allocated || 0);

        // Query central sales (sales from central hub where stall_id is null)
        const { data: centralSales } = await (supabase as any)
          .from('sales')
          .select('quantity_sold')
          .eq('item_id', numericItemId)
          .is('stall_id', null);

        const totalCentralSold = (centralSales as any)?.reduce(
          (sum: number, sale: any) => sum + (sale.quantity_sold || 0),
          0
        ) || 0;

        // Query withdrawals (these ARE deducted from available stock)
        const { data: withdrawals } = await (supabase as any)
          .from('stock_withdrawals')
          .select('quantity_withdrawn')
          .eq('item_id', numericItemId);

        const totalWithdrawn = (withdrawals as any)?.reduce(
          (sum: number, w: any) => sum + (w.quantity_withdrawn || 0),
          0
        ) || 0;

        // Complete formula: withdrawals reduce available stock
        const newCurrentStock = Math.max(0, initialStock + newTotalAdded - totalDistributed - totalCentralSold - totalWithdrawn);
        updateData.current_stock = newCurrentStock;
      }

      if (Object.keys(updateData).length === 0) {
        return { item: existingItem as Item };
      }

      const { data, error } = await (supabase as any)
        .from('items')
        .update(updateData)
        .eq('item_id', numericItemId)
        .select()
        .single();

      if (error) throw error;
      return { item: data as Item };
    } catch (error) {
      console.error('Error updating item:', error);
      throw new Error((error as any)?.message || 'Failed to update item.');
    }
  },

  // Add stock using the exact quantity the user typed (delta), never a
  // recomputed cumulative total. This prevents stale on-screen data from
  // shrinking/inflating additions when multiple people use the system.
  addStock: async (itemId: number, quantity: number) => {
    if (!isSupabaseConfigured()) {
      const inventory = await mockApi.getInventory();
      const mockItem = (inventory.items || []).find((i: any) => i.item_id === itemId);
      return mockApi.updateItem(itemId, {
        total_added: ((mockItem as any)?.total_added || 0) + quantity
      } as any);
    }

    const numericItemId = typeof itemId === 'number' ? itemId : parseInt(itemId as any, 10);
    const quantityToAdd = Number(quantity);

    if (!Number.isFinite(numericItemId)) {
      throw new Error('Invalid item reference.');
    }
    if (!Number.isInteger(quantityToAdd) || quantityToAdd <= 0) {
      throw new Error('Quantity to add must be a whole number greater than zero.');
    }

    const addedBy = getCurrentUserId();

    try {
      // Preferred path: atomic, row-locked DB function
      const { data, error } = await (supabase as any).rpc('add_stock_atomic', {
        p_item_id: numericItemId,
        p_quantity: quantityToAdd,
        p_added_by: addedBy
      });

      if (!error && data) {
        const item = (Array.isArray(data) ? data[0] : data) as Item;
        console.log('[Add Stock] Atomic RPC success:', { itemId: numericItemId, quantityToAdd, current_stock: (item as any).current_stock });
        return { item };
      }

      if (error && !isMissingFunctionError(error)) {
        throw error;
      }

      // Fallback (atomic function not installed yet): insert the history row
      // with the user's exact quantity, then recompute totals from history.
      console.warn('[Add Stock] add_stock_atomic not installed, using fallback path');

      const { error: insertError } = await (supabase as any)
        .from('stock_additions')
        .insert([{
          item_id: numericItemId,
          quantity_added: quantityToAdd,
          added_by: addedBy
        }]);

      if (insertError) {
        throw new Error(insertError.message || 'Failed to record added stock.');
      }

      const item = await recomputeItemTotals(numericItemId);
      return { item };
    } catch (error) {
      console.error('Error adding stock:', error);
      throw new Error((error as any)?.message || 'Failed to add stock.');
    }
  },

  distributeStock: async (distributionData: {
    item_id: number;
    distributions: Array<{ stall_id: number; quantity: number }>;
    notes?: string;
  }): Promise<{ distributions: Array<{ item_id: number; stall_id: number; quantity_allocated: number; date_distributed: string }> }> => {
    if (!isSupabaseConfigured()) {
      // Call mockApi with the correct signature - it expects (itemId, distribution)
      // We'll call it for each distribution
      for (const dist of distributionData.distributions) {
        await (mockApi.distributeStock as any)(distributionData.item_id, {
          stall_id: dist.stall_id,
          quantity_allocated: dist.quantity
        });
      }
      return {
        distributions: distributionData.distributions.map(d => ({
          item_id: distributionData.item_id,
          stall_id: d.stall_id,
          quantity_allocated: d.quantity,
          date_distributed: new Date().toISOString()
        }))
      };
    }

    try {
      const distributedBy = getCurrentUserId();

      const validDistributions = distributionData.distributions
        .filter(dist => (dist.quantity || 0) > 0 && dist.stall_id);

      const totalToDistribute = validDistributions.reduce((sum, dist) => sum + (dist.quantity || 0), 0);
      if (totalToDistribute <= 0) {
        throw new Error('Distribution quantity must be greater than zero.');
      }

      // Preferred path: atomic, row-locked DB function (validates stock
      // against history inside one transaction).
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('distribute_stock_atomic_v2', {
        p_item_id: distributionData.item_id,
        p_distributions: validDistributions.map(d => ({ stall_id: d.stall_id, quantity: d.quantity })),
        p_distributed_by: distributedBy,
        p_notes: distributionData.notes || ''
      });

      if (!rpcError) {
        console.log('[Distribute Stock] Atomic RPC success:', rpcData);
        return { distributions: rpcData || [] };
      }

      if (!isMissingFunctionError(rpcError)) {
        console.error('[Distribute Stock] Atomic RPC error:', rpcError);
        throw new Error(rpcError.message || 'Failed to distribute stock.');
      }

      // Fallback (atomic function not installed yet): recompute available
      // stock from history first so a stale items.current_stock can never
      // block or over-allow a distribution.
      console.warn('[Distribute Stock] distribute_stock_atomic_v2 not installed, using fallback path');

      const freshItem = await recomputeItemTotals(distributionData.item_id);
      const currentStock = Number((freshItem as any).current_stock || 0);
      if (currentStock < totalToDistribute) {
        throw new Error(`Insufficient stock! Available: ${currentStock}, Requested: ${totalToDistribute}`);
      }

      const distributions = validDistributions.map(dist => ({
        item_id: distributionData.item_id,
        stall_id: dist.stall_id,
        quantity_allocated: dist.quantity,
        date_distributed: new Date().toISOString(),
        distributed_by: distributedBy,
        notes: distributionData.notes || ''
      }));

      const { data, error } = await (supabase as any)
        .from('stock_distribution')
        .insert(distributions)
        .select();

      if (error) {
        console.error('[Distribute Stock] Supabase error:', error);
        throw error;
      }

      await recomputeItemTotals(distributionData.item_id);

      console.log('[Distribute Stock] Success:', data);
      return { distributions: data };
    } catch (error) {
      console.error('Error distributing stock:', error);
      throw error;
    }
  },

  getDistributions: async (itemId?: number) => {
    if (!isSupabaseConfigured()) {
      return (mockApi as any).getDistributions(itemId);
    }

    try {
      let query = (supabase as any)
        .from('stock_distribution')
        .select(`
          *,
          stalls:stall_id(stall_name),
          users:distributed_by(full_name)
        `);

      if (itemId) {
        query = query.eq('item_id', itemId);
      }

      const { data, error } = await query.order('date_distributed', { ascending: false });

      if (error) throw error;

      const distributions = (data || []).map((dist: any) => ({
        ...dist,
        stall_name: dist.stalls?.stall_name || 'Unknown',
        distributed_by_name: dist.users?.full_name || 'Unknown'
      }));

      return { distributions };
    } catch (error) {
      console.error('Error fetching distributions:', error);
      throw error;
    }
  },

  updateDistribution: async (distributionId: number, quantity: number, stallId: number) => {
    if (!isSupabaseConfigured()) {
      return (mockApi as any).updateDistribution(distributionId, quantity, stallId);
    }

    try {
      // 1. Get the existing distribution to know the difference
      const { data: existingDist, error: fetchError } = await (supabase as any)
        .from('stock_distribution')
        .select('*')
        .eq('distribution_id', distributionId)
        .single();

      if (fetchError || !existingDist) throw new Error('Distribution not found');

      const itemId = existingDist.item_id;
      const oldQuantity = existingDist.quantity_allocated;
      const quantityDiff = quantity - oldQuantity;

      // 2. Validate against freshly recomputed stock (not a stale cached value)
      const freshItem = await recomputeItemTotals(itemId);

      if (quantityDiff > Number((freshItem as any).current_stock || 0)) {
        throw new Error(`Insufficient stock! Available: ${(freshItem as any).current_stock}, Requested additional: ${quantityDiff}`);
      }

      // 3. Update distribution
      const { data, error: updateDistError } = await (supabase as any)
        .from('stock_distribution')
        .update({
          quantity_allocated: quantity,
          stall_id: stallId,
          date_distributed: new Date().toISOString() // Update date to reflect edit
        })
        .eq('distribution_id', distributionId)
        .select()
        .single();

      if (updateDistError) throw updateDistError;

      // 4. Recompute item totals from history
      await recomputeItemTotals(itemId);

      return { distribution: data };
    } catch (error) {
      console.error('Error updating distribution:', error);
      throw error;
    }
  },

  deleteDistribution: async (distributionId: number) => {
    if (!isSupabaseConfigured()) {
      return (mockApi as any).deleteDistribution(distributionId);
    }

    try {
      // 1. Get the existing distribution
      const { data: existingDist, error: fetchError } = await (supabase as any)
        .from('stock_distribution')
        .select('*')
        .eq('distribution_id', distributionId)
        .single();

      if (fetchError || !existingDist) throw new Error('Distribution not found');

      const itemId = existingDist.item_id;

      // 2. Delete the distribution
      const { error: deleteError } = await (supabase as any)
        .from('stock_distribution')
        .delete()
        .eq('distribution_id', distributionId);

      if (deleteError) throw deleteError;

      // 3. Recompute item totals from history (returns stock to central hub)
      await recomputeItemTotals(itemId);

      return { success: true };
    } catch (error) {
      console.error('Error deleting distribution:', error);
      throw error;
    }
  },

  // Withdraw partial or full quantity from a user's distribution
  withdrawFromDistribution: async (distributionId: number, quantityToWithdraw: number) => {
    if (!isSupabaseConfigured()) {
      return (mockApi as any).withdrawFromDistribution(distributionId, quantityToWithdraw);
    }

    try {
      // 1. Get the existing distribution
      const { data: existingDist, error: fetchError } = await (supabase as any)
        .from('stock_distribution')
        .select('*')
        .eq('distribution_id', distributionId)
        .single();

      if (fetchError || !existingDist) throw new Error('Distribution not found');

      const itemId = existingDist.item_id;
      const currentQuantity = existingDist.quantity_allocated;

      // Validate quantity
      if (quantityToWithdraw <= 0) {
        throw new Error('Withdrawal quantity must be greater than 0');
      }

      if (quantityToWithdraw > currentQuantity) {
        throw new Error(`Cannot withdraw ${quantityToWithdraw} items. Only ${currentQuantity} items are distributed to this user.`);
      }

      // 2. Update or delete the distribution based on quantity
      if (quantityToWithdraw === currentQuantity) {
        // Full withdrawal - delete the distribution
        const { error: deleteError } = await (supabase as any)
          .from('stock_distribution')
          .delete()
          .eq('distribution_id', distributionId);

        if (deleteError) throw deleteError;
      } else {
        // Partial withdrawal - update the distribution
        const newQuantity = currentQuantity - quantityToWithdraw;
        const { error: updateError } = await (supabase as any)
          .from('stock_distribution')
          .update({ quantity_allocated: newQuantity })
          .eq('distribution_id', distributionId);

        if (updateError) throw updateError;
      }

      // 3. Recompute item totals from history (returns stock to central hub)
      const freshItem = await recomputeItemTotals(itemId);
      console.log(`[Withdraw from Distribution] Returned ${quantityToWithdraw} items to central. New central stock: ${(freshItem as any).current_stock}`);

      return {
        success: true,
        withdrawnQuantity: quantityToWithdraw,
        remainingDistribution: quantityToWithdraw === currentQuantity ? 0 : currentQuantity - quantityToWithdraw
      };
    } catch (error) {
      console.error('Error withdrawing from distribution:', error);
      throw error;
    }
  },


  // Sales aggregates (all rows — avoids Supabase 1000-row default limit on inventory totals)
  getSalesAggregates: async (): Promise<SalesAggregates> => {
    if (!isSupabaseConfigured()) {
      return mockApi.getSalesAggregates();
    }

    try {
      const rows = await fetchAllSalesQuantityRows();
      return buildSalesAggregates(rows);
    } catch (error) {
      console.error('Error fetching sales aggregates:', error);
      return mockApi.getSalesAggregates();
    }
  },

  // Sales
  getSales: async () => {
    if (!isSupabaseConfigured()) {
      return mockApi.getSales();
    }

    try {
      const allRows: any[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await (supabase as any)
          .from('sales')
          .select(`
            *,
            users:recorded_by(full_name),
            stalls:stall_id(stall_name),
            items:item_id(item_name, category),
            credit_sales:credit_sales(sale_id, customer_name, customer_contact, payment_status, balance_due, amount_paid, due_date, notes)
          `)
          .order('date_time', { ascending: false })
          .range(from, from + SALES_PAGE_SIZE - 1);

        if (error) throw error;

        const page = data || [];
        allRows.push(...page);
        if (page.length < SALES_PAGE_SIZE) break;
        from += SALES_PAGE_SIZE;
      }

      const sales = allRows.map(mapSaleRow);

      return { sales: sales as Sale[] };
    } catch (error) {
      console.error('Error fetching sales:', error);
      return mockApi.getSales(); // Fallback
    }
  },

  createSale: async (saleData: SaleInput) => {
    if (!isSupabaseConfigured()) {
      return mockApi.createSale(saleData);
    }

    try {
      if (!saleData.quantity_sold || saleData.quantity_sold <= 0) {
        throw new Error('Quantity must be greater than zero.');
      }

      if (saleData.unit_price === undefined || saleData.unit_price === null || saleData.unit_price < 0) {
        throw new Error('Selling price must be zero or greater.');
      }

      // Calculate total_amount if not provided
      const totalAmount = saleData.total_amount || (saleData.quantity_sold * saleData.unit_price);
      const itemId = typeof saleData.item_id === 'number' ? saleData.item_id : parseInt(saleData.item_id.toString(), 10);
      const stallId = saleData.stall_id === null || saleData.stall_id === undefined
        ? null
        : (typeof saleData.stall_id === 'number' ? saleData.stall_id : parseInt(saleData.stall_id.toString(), 10));

      if (saleData.sale_type === 'split') {
        const cashAmount = saleData.cash_amount ?? 0;
        const mobileAmount = saleData.mobile_amount ?? 0;

        if (cashAmount <= 0 || mobileAmount <= 0) {
          throw new Error('Split payment amounts must be greater than zero.');
        }

        if (Math.abs((cashAmount + mobileAmount) - totalAmount) > 0.5) {
          throw new Error('Split payment totals must equal the negotiated total.');
        }
      }

      const saleToInsert = {
        item_id: itemId,
        stall_id: stallId,
        quantity_sold: saleData.quantity_sold,
        unit_price: saleData.unit_price,
        total_amount: totalAmount,
        sale_type: saleData.sale_type,
        cash_amount: saleData.sale_type === 'split' ? (saleData.cash_amount ?? null) : null,
        mobile_amount: saleData.sale_type === 'split' ? (saleData.mobile_amount ?? null) : null,
        recorded_by: saleData.recorded_by
      };

      const { data, error } = await (supabase as any)
        .from('sales')
        .insert([saleToInsert])
        .select()
        .single();

      if (error) throw error;

      if (saleData.sale_type === 'credit') {
        const amountPaid = saleData.amount_paid ?? 0;
        const paymentStatus = saleData.payment_status
          ?? (amountPaid >= totalAmount ? 'fully_paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid');

        const { error: creditError } = await (supabase as any)
          .from('credit_sales')
          .insert([{
            sale_id: data.sale_id,
            customer_name: saleData.customer_name || 'Customer',
            customer_contact: saleData.customer_contact || 'N/A',
            total_credit_amount: totalAmount,
            amount_paid: amountPaid,
            payment_status: paymentStatus,
            due_date: saleData.due_date || null,
            notes: saleData.notes || null
          }]);

        if (creditError) throw creditError;
      }

      return { sale: data as Sale };
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  },

  updateSale: async (saleId: number, saleData: any) => {
    if (!isSupabaseConfigured()) {
      // Mock implementation
      return { sale: { ...saleData, sale_id: saleId } as Sale };
    }

    try {
      const { data: existingSale, error: existingError } = await (supabase as any)
        .from('sales')
        .select('*')
        .eq('sale_id', saleId)
        .single();

      if (existingError) throw existingError;

      const quantity = saleData.quantity_sold !== undefined ? saleData.quantity_sold : existingSale.quantity_sold;
      const unitPrice = saleData.unit_price !== undefined ? saleData.unit_price : existingSale.unit_price;
      const saleType = saleData.sale_type || existingSale.sale_type;

      if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be greater than zero.');
      }

      if (!unitPrice || unitPrice <= 0) {
        throw new Error('Selling price must be greater than zero.');
      }

      const totalAmount = saleData.total_amount !== undefined
        ? saleData.total_amount
        : quantity * unitPrice;

      const stallId = saleData.stall_id === undefined
        ? existingSale.stall_id
        : (saleData.stall_id === null
          ? null
          : (typeof saleData.stall_id === 'number' ? saleData.stall_id : parseInt(saleData.stall_id.toString(), 10)));

      const itemId = saleData.item_id === undefined
        ? existingSale.item_id
        : (typeof saleData.item_id === 'number' ? saleData.item_id : parseInt(saleData.item_id.toString(), 10));

      if (saleType === 'split') {
        const cashAmount = saleData.cash_amount ?? existingSale.cash_amount ?? 0;
        const mobileAmount = saleData.mobile_amount ?? existingSale.mobile_amount ?? 0;

        if (cashAmount <= 0 || mobileAmount <= 0) {
          throw new Error('Split payment amounts must be greater than zero.');
        }

        if (Math.abs((cashAmount + mobileAmount) - totalAmount) > 0.5) {
          throw new Error('Split payment totals must equal the negotiated total.');
        }
      }

      const updatePayload: any = {
        item_id: itemId,
        stall_id: stallId,
        quantity_sold: quantity,
        unit_price: unitPrice,
        total_amount: totalAmount,
        sale_type: saleType,
        cash_amount: saleType === 'split' ? (saleData.cash_amount ?? existingSale.cash_amount ?? null) : null,
        mobile_amount: saleType === 'split' ? (saleData.mobile_amount ?? existingSale.mobile_amount ?? null) : null,
        recorded_by: saleData.recorded_by ?? existingSale.recorded_by
      };

      const { data, error } = await (supabase as any)
        .from('sales')
        .update(updatePayload)
        .eq('sale_id', saleId)
        .select()
        .single();

      if (error) throw error;

      const { data: existingCreditRows, error: existingCreditError } = await (supabase as any)
        .from('credit_sales')
        .select('*')
        .eq('sale_id', saleId)
        .limit(1);

      if (existingCreditError) throw existingCreditError;

      const existingCredit = Array.isArray(existingCreditRows) ? existingCreditRows[0] : null;

      if (saleType === 'credit') {
        const amountPaid = saleData.amount_paid ?? existingCredit?.amount_paid ?? 0;
        const paymentStatus = saleData.payment_status
          ?? (amountPaid >= totalAmount ? 'fully_paid' : amountPaid > 0 ? 'partially_paid' : 'unpaid');

        const creditPayload: any = {
          customer_name: saleData.customer_name ?? existingCredit?.customer_name ?? 'Customer',
          customer_contact: saleData.customer_contact ?? existingCredit?.customer_contact ?? 'N/A',
          total_credit_amount: totalAmount,
          amount_paid: amountPaid,
          payment_status: paymentStatus,
          due_date: saleData.due_date ?? existingCredit?.due_date ?? null,
          notes: saleData.notes ?? existingCredit?.notes ?? null
        };

        if (existingCredit) {
          await (supabase as any)
            .from('credit_sales')
            .update(creditPayload)
            .eq('sale_id', saleId);
        } else {
          await (supabase as any)
            .from('credit_sales')
            .insert([{ sale_id: saleId, ...creditPayload }]);
        }
      } else if (existingCredit) {
        await (supabase as any)
          .from('credit_sales')
          .delete()
          .eq('sale_id', saleId);
      }

      return { sale: data as Sale };
    } catch (error) {
      console.error('Error updating sale:', error);
      throw error;
    }
  },

  deleteSale: async (saleId: number) => {
    if (!isSupabaseConfigured()) {
      return (mockApi as any).deleteSale(saleId);
    }

    try {
      console.log(`[Delete Sale] Deleting sale ID: ${saleId}`);

      // Explicitly delete from credit_sales first if it exists
      // though CASCADE should handle it if set up in DB
      await (supabase as any)
        .from('credit_sales')
        .delete()
        .eq('sale_id', saleId);

      const { error } = await (supabase as any)
        .from('sales')
        .delete()
        .eq('sale_id', saleId);

      if (error) throw error;

      console.log(`[Delete Sale] Successfully deleted sale ID: ${saleId}`);
      return { success: true };
    } catch (error) {
      console.error('Error deleting sale:', error);
      throw error;
    }
  },

  bulkDeleteSales: async (saleIds: number[]) => {
    if (!isSupabaseConfigured()) {
      for (const id of saleIds) {
        await (mockApi as any).deleteSale(id);
      }
      return { success: true };
    }

    try {
      console.log(`[Bulk Delete Sales] Deleting sale IDs:`, saleIds);

      await (supabase as any)
        .from('credit_sales')
        .delete()
        .in('sale_id', saleIds);

      const { error } = await (supabase as any)
        .from('sales')
        .delete()
        .in('sale_id', saleIds);

      if (error) throw error;

      console.log(`[Bulk Delete Sales] Successfully deleted ${saleIds.length} sales`);
      return { success: true };
    } catch (error) {
      console.error('Error bulk deleting sales:', error);
      throw error;
    }
  },

  createWithdrawal: async (withdrawalData: {
    item_id: number;
    quantity_withdrawn: number;
    reason: string;
    withdrawn_by: number;
    notes?: string;
  }) => {
    if (!isSupabaseConfigured()) {
      return (mockApi as any).createWithdrawal(withdrawalData);
    }

    try {
      const quantity = Number(withdrawalData.quantity_withdrawn);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error('Withdrawal quantity must be a whole number greater than zero.');
      }

      const withdrawnBy = withdrawalData.withdrawn_by || getCurrentUserId();

      // Preferred path: atomic, row-locked DB function
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc('withdraw_stock_atomic', {
        p_item_id: withdrawalData.item_id,
        p_quantity: quantity,
        p_reason: withdrawalData.reason || 'General withdrawal',
        p_withdrawn_by: withdrawnBy,
        p_notes: withdrawalData.notes || null
      });

      if (!rpcError) {
        console.log('[Create Withdrawal] Atomic RPC success:', rpcData);
        return {
          withdrawal: {
            item_id: withdrawalData.item_id,
            quantity_withdrawn: quantity,
            reason: withdrawalData.reason,
            withdrawn_by: withdrawnBy,
            notes: withdrawalData.notes || null,
            date_withdrawn: new Date().toISOString()
          }
        };
      }

      if (!isMissingFunctionError(rpcError)) {
        console.error('[Create Withdrawal] Atomic RPC error:', rpcError);
        throw new Error(rpcError.message || 'Failed to create withdrawal');
      }

      // Fallback (atomic function not installed yet): validate against
      // freshly recomputed stock, insert the history row, recompute totals.
      console.warn('[Create Withdrawal] withdraw_stock_atomic not installed, using fallback path');

      const freshItem = await recomputeItemTotals(withdrawalData.item_id);
      const available = Number((freshItem as any).current_stock || 0);
      if (available < quantity) {
        throw new Error(`Insufficient stock. Available: ${available}, Requested: ${quantity}`);
      }

      const { data: inserted, error: insertError } = await (supabase as any)
        .from('stock_withdrawals')
        .insert([{
          item_id: withdrawalData.item_id,
          quantity_withdrawn: quantity,
          reason: withdrawalData.reason || 'General withdrawal',
          withdrawn_by: withdrawnBy,
          notes: withdrawalData.notes || null
        }])
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message || 'Failed to create withdrawal');
      }

      await recomputeItemTotals(withdrawalData.item_id);

      return { withdrawal: inserted };
    } catch (error) {
      console.error('Error creating withdrawal:', error);
      throw error;
    }
  },


  // Stalls
  getStalls: async () => {
    if (!isSupabaseConfigured()) {
      return mockApi.getStalls();
    }

    try {
      const { data, error } = await (supabase as any)
        .from('stalls')
        .select('*')
        .order('stall_name', { ascending: true });

      if (error) throw error;
      return { stalls: data as Stall[] };
    } catch (error) {
      console.error('Error fetching stalls:', error);
      return mockApi.getStalls(); // Fallback
    }
  },

  createStall: async (stallData: any) => {
    if (!isSupabaseConfigured()) {
      return mockApi.createStall(stallData as any);
    }

    try {
      // Filter stallData to only include what's in the database schema
      const { stall_name, user_id, status } = stallData;
      const filteredData = {
        stall_name,
        user_id: user_id ? (typeof user_id === 'number' ? user_id : parseInt(user_id)) : null,
        status: status || 'active'
      };

      const { data, error } = await (supabase as any)
        .from('stalls')
        .insert([filteredData])
        .select()
        .single();

      if (error) throw error;
      return { stall: data as Stall };
    } catch (error) {
      console.error('Error creating stall:', error);
      throw error;
    }
  },

  updateStall: async (stallId: number, stallData: Partial<Stall>) => {
    if (!isSupabaseConfigured()) {
      return mockApi.updateStall(stallId, stallData as any);
    }

    try {
      const { data, error } = await (supabase as any)
        .from('stalls')
        .update(stallData)
        .eq('stall_id', stallId)
        .select()
        .single();

      if (error) throw error;
      return { stall: data as Stall };
    } catch (error) {
      console.error('Error updating stall:', error);
      throw error;
    }
  },

  deleteStall: async (stallId: number) => {
    if (!isSupabaseConfigured()) {
      return mockApi.deleteStall(stallId);
    }

    try {
      const { error } = await (supabase as any)
        .from('stalls')
        .delete()
        .eq('stall_id', stallId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting stall:', error);
      throw error;
    }
  }
};

// Export as default for easy migration
export default dbApi;
