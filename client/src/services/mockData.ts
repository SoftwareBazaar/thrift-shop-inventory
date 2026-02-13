// Mock data service for offline demonstration
// NOTE: In production, this is automatically replaced by databaseService.ts
// when Supabase credentials are configured
import { upsertOfflineCredentialFromPassword, syncOfflineUserProfile } from '../utils/offlineCredentials';

export interface User {
  user_id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  stall_id?: number;
  status: string;
  created_date: string;
  phone_number?: string | null;
  email?: string | null;
  recovery_hint?: string | null;
  password_hash?: string | null;
  secret_word?: string | null;
}

export interface Stall {
  stall_id: number;
  stall_name: string;
  user_id: number;
  location: string;
  manager: string;
  status: string;
}

export interface Sale {
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
  customer_name?: string;
  customer_contact?: string;
  buying_price?: number;
  payment_status?: string;
  balance_due?: number;
  cash_amount?: number | null;
  mobile_amount?: number | null;
  due_date?: string | null;
  notes?: string | null;
  amount_paid?: number | null;
}

export interface SaleInput {
  item_id: number | string;
  stall_id: number | string | null;
  quantity_sold: number;
  unit_price: number;
  sale_type: 'cash' | 'credit' | 'mobile' | 'split';
  recorded_by: number;
  total_amount?: number;
  customer_name?: string;
  customer_contact?: string;
  payment_status?: string;
  balance_due?: number;
  amount_paid?: number | null;
  cash_amount?: number | null;
  mobile_amount?: number | null;
  due_date?: string | null;
  notes?: string | null;
}

export interface InventoryItem {
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
  stall_id?: number; // Added for offline filtering
}

export interface StockDistribution {
  distribution_id: number;
  item_id: number;
  stall_id: number;
  quantity_allocated: number;
  date_distributed: string;
  distributed_by: number;
}

export interface Analytics {
  totalRevenue: number;
  totalSales: number;
  totalUnits: number;
  averageSale: number;
  topSellingItems: Array<{ item_name: string; total_sold: number; revenue: number }>;
  userPerformance: Array<{ user_name: string; sales: number; revenue: number }>;
  dailySales: Array<{ date: string; sales: number; revenue: number }>;
  commissionData: Array<{ user_name: string; sales: number; commission: number }>;
}

// Mock Users Data - Start with admin and assigned users
export const mockUsers: User[] = [
  {
    user_id: 1,
    username: 'admin',
    full_name: 'System Administrator',
    role: 'admin',
    status: 'active',
    created_date: '2024-01-01',
    phone_number: '+254700000000',
    email: 'admin@example.com',
    recovery_hint: 'Primary admin contact'
  },
  {
    user_id: 4,
    username: 'kelvin',
    full_name: 'Kelvin',
    role: 'user',
    stall_id: 1,
    status: 'active',
    created_date: '2024-01-01',
    phone_number: '+254711111111',
    email: 'kelvin@example.com',
    recovery_hint: 'Kelvin stall 1 phone'
  },
  {
    user_id: 5,
    username: 'manuel',
    full_name: 'Emmanuel',
    role: 'user',
    stall_id: 2,
    status: 'active',
    created_date: '2024-01-01',
    phone_number: '+254722222222',
    email: 'manuel@example.com',
    recovery_hint: 'Manuel stall 2 phone'
  }
];

// Mock Stalls Data - Real stalls for testing
export const mockStalls: Stall[] = [
  {
    stall_id: 1,
    stall_name: 'Stall 316,317',
    user_id: 4,
    location: 'Location 316',
    manager: 'Kelvin',
    status: 'active'
  },
  {
    stall_id: 2,
    stall_name: 'Stall 307',
    user_id: 5,
    location: 'Location 309',
    manager: 'Emmanuel',
    status: 'active'
  }
];

// Mock Inventory Data - Empty for fresh start
export const mockInventory: InventoryItem[] = [];

// Mock Sales Data - Empty for fresh start
export const mockSales: Sale[] = [];

// Mock Analytics Data - Empty for fresh start
export const mockAnalytics: Analytics = {
  totalRevenue: 0,
  totalSales: 0,
  totalUnits: 0,
  averageSale: 0,
  topSellingItems: [],
  userPerformance: [],
  dailySales: [],
  commissionData: []
};

// Helper functions to manage localStorage data
const getStorageData = <T>(key: string, defaultData: T): T => {
  try {
    const stored = localStorage.getItem(`thrift_shop_${key}`);
    return stored ? JSON.parse(stored) : defaultData;
  } catch {
    return defaultData;
  }
};

const setStorageData = <T>(key: string, data: T): void => {
  try {
    localStorage.setItem(`thrift_shop_${key}`, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving to localStorage:`, error);
  }
};

// Initialize data in localStorage if not present
const initStorage = () => {
  try {
    // Always ensure demo users exist (admin, kelvin, manuel)
    const existingUsers = localStorage.getItem('thrift_shop_users');
    let users: User[] = [];

    if (existingUsers) {
      try {
        users = JSON.parse(existingUsers);
      } catch {
        users = [];
      }
    }

    // Ensure demo users always exist
    let needsUpdate = false;

    for (const demoUser of mockUsers) {
      const exists = users.find(u => u.username.toLowerCase() === demoUser.username.toLowerCase());
      if (!exists) {
        // Add missing demo user
        users.push(demoUser);
        needsUpdate = true;
      } else {
        // Update existing demo user to ensure correct data
        const index = users.findIndex(u => u.username.toLowerCase() === demoUser.username.toLowerCase());
        if (index !== -1) {
          users[index] = { ...users[index], ...demoUser };
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate || users.length === 0) {
      localStorage.setItem('thrift_shop_users', JSON.stringify(users.length > 0 ? users : mockUsers));
    }

    // Always ensure stalls are initialized
    const existingStalls = localStorage.getItem('thrift_shop_stalls');
    if (!existingStalls || JSON.parse(existingStalls).length === 0) {
      localStorage.setItem('thrift_shop_stalls', JSON.stringify(mockStalls));
    }

    // Only initialize empty if not present
    if (!localStorage.getItem('thrift_shop_items')) {
      localStorage.setItem('thrift_shop_items', JSON.stringify(mockInventory));
    }
    if (!localStorage.getItem('thrift_shop_sales')) {
      localStorage.setItem('thrift_shop_sales', JSON.stringify(mockSales));
    }
    if (!localStorage.getItem('thrift_shop_stock_additions')) {
      localStorage.setItem('thrift_shop_stock_additions', JSON.stringify([]));
    }
    if (!localStorage.getItem('thrift_shop_stock_withdrawals')) {
      localStorage.setItem('thrift_shop_stock_withdrawals', JSON.stringify([]));
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
    // Force reset on error
    localStorage.setItem('thrift_shop_users', JSON.stringify(mockUsers));
    localStorage.setItem('thrift_shop_stalls', JSON.stringify(mockStalls));
    localStorage.setItem('thrift_shop_items', JSON.stringify(mockInventory));
    localStorage.setItem('thrift_shop_sales', JSON.stringify(mockSales));
  }
};

// Initialize on module load
initStorage();

// Mock API functions
export const mockApi = {
  // Users API
  getUsers: async (): Promise<{ users: User[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    const users = getStorageData<User[]>('users', mockUsers);
    return { users };
  },

  createUser: async (
    userData: Omit<User, 'user_id' | 'created_date'> & { password: string }
  ): Promise<{ user: User }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getStorageData<User[]>('users', mockUsers);
    const { password, ...profile } = userData;
    const newUser: User = {
      user_id: Math.max(...users.map(u => u.user_id), 0) + 1,
      ...profile,
      created_date: new Date().toISOString(),
      phone_number: profile.phone_number ?? null,
      email: profile.email ?? null,
      recovery_hint: profile.recovery_hint ?? null
    };
    users.push(newUser);
    setStorageData('users', users);

    if (password) {
      await upsertOfflineCredentialFromPassword(
        {
          user_id: newUser.user_id,
          username: newUser.username,
          full_name: newUser.full_name,
          role: newUser.role,
          stall_id: newUser.stall_id,
          status: newUser.status,
          created_date: newUser.created_date,
          phone_number: newUser.phone_number ?? null,
          email: newUser.email ?? null
        },
        password,
        {
          phone: newUser.phone_number ?? undefined,
          email: newUser.email ?? undefined,
          hint: newUser.recovery_hint ?? undefined
        },
        'manual'
      );
    }

    return { user: newUser };
  },

  updateUser: async (userId: number, userData: Partial<User>): Promise<{ user: User }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getStorageData<User[]>('users', mockUsers);
    const userIndex = users.findIndex(u => u.user_id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    users[userIndex] = {
      ...users[userIndex],
      ...userData,
      phone_number: userData.phone_number ?? users[userIndex].phone_number ?? null,
      email: userData.email ?? users[userIndex].email ?? null,
      recovery_hint: userData.recovery_hint ?? users[userIndex].recovery_hint ?? null
    };
    setStorageData('users', users);
    syncOfflineUserProfile({
      user_id: users[userIndex].user_id,
      username: users[userIndex].username,
      full_name: users[userIndex].full_name,
      role: users[userIndex].role,
      stall_id: users[userIndex].stall_id,
      status: users[userIndex].status,
      created_date: users[userIndex].created_date,
      phone_number: users[userIndex].phone_number ?? null,
      email: users[userIndex].email ?? null
    });
    return { user: users[userIndex] };
  },

  deleteUser: async (userId: number): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getStorageData<User[]>('users', mockUsers);
    const filteredUsers = users.filter(u => u.user_id !== userId);
    setStorageData('users', filteredUsers);
    return { success: true };
  },

  // Stalls API
  getStalls: async (): Promise<{ stalls: Stall[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const stalls = getStorageData<Stall[]>('stalls', mockStalls);
    return { stalls };
  },

  createStall: async (stallData: Omit<Stall, 'stall_id'>): Promise<{ stall: Stall }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const stalls = getStorageData<Stall[]>('stalls', mockStalls);
    const newStall: Stall = {
      stall_id: Math.max(...stalls.map(s => s.stall_id), 0) + 1,
      ...stallData
    };
    stalls.push(newStall);
    setStorageData('stalls', stalls);
    return { stall: newStall };
  },

  updateStall: async (stallId: number, stallData: Partial<Stall>): Promise<{ stall: Stall }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const stalls = getStorageData<Stall[]>('stalls', mockStalls);
    const stallIndex = stalls.findIndex(s => s.stall_id === stallId);
    if (stallIndex === -1) {
      throw new Error('Stall not found');
    }
    stalls[stallIndex] = { ...stalls[stallIndex], ...stallData };
    setStorageData('stalls', stalls);
    return { stall: stalls[stallIndex] };
  },

  deleteStall: async (stallId: number): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const stalls = getStorageData<Stall[]>('stalls', mockStalls);
    const filteredStalls = stalls.filter(s => s.stall_id !== stallId);
    setStorageData('stalls', filteredStalls);
    return { success: true };
  },

  // Inventory API
  getInventory: async (stallId?: number): Promise<{ items: InventoryItem[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const items = getStorageData<InventoryItem[]>('items', mockInventory);
    const distributions = getStorageData<StockDistribution[]>('stock_distributions', []);
    const sales = getStorageData<Sale[]>('sales', []);
    const stalls = getStorageData<Stall[]>('stalls', []);

    // If stallId is provided (for non-admin users), filter to show only distributed stock
    if (stallId !== undefined) {
      const filteredItems = items
        .map(item => {
          // Get all distributions to this stall for this item, sorted by date
          const stallDistributions = distributions
            .filter(d => d.item_id === item.item_id && d.stall_id === stallId)
            .sort((a, b) => new Date(a.date_distributed).getTime() - new Date(b.date_distributed).getTime());

          const totalDistributedToStall = stallDistributions.reduce(
            (sum, d) => sum + d.quantity_allocated, 0
          );

          // If no stock distributed to this stall, exclude this item
          if (totalDistributedToStall === 0) {
            return null;
          }

          // Calculate sales from this stall for this item
          // Get stall name from stall_id to match with sales
          const stall = stalls.find(s => s.stall_id === stallId);
          const stallSales = stall ? sales.filter(
            s => s.item_id === item.item_id && s.stall_name === stall.stall_name
          ) : [];

          const totalSold = stallSales.reduce((sum, s) => sum + s.quantity_sold, 0);

          // Calculate initial_stock and total_added based on distribution history
          // Initial stock = stock the user had at the time of the most recent distribution
          // Total added = quantity from the most recent distribution
          let initialStock = 0;
          let totalAdded = 0;

          if (stallDistributions.length > 0) {
            const mostRecentDistribution = stallDistributions[stallDistributions.length - 1];
            totalAdded = mostRecentDistribution.quantity_allocated;

            if (stallDistributions.length === 1) {
              // First distribution: initial = 0 (no stock before first distribution)
              initialStock = 0;
            } else {
              // For subsequent distributions: calculate stock at the time of the most recent distribution
              // This is: all previous distributions minus all sales up to that point
              const previousDistributions = stallDistributions.slice(0, -1);
              const totalPreviousDistributed = previousDistributions.reduce(
                (sum, d) => sum + d.quantity_allocated, 0
              );

              // Calculate all sales that happened strictly before the most recent distribution
              // We use < (not <=) to ensure we get the stock at the moment before the new distribution
              const lastDistributionDate = new Date(mostRecentDistribution.date_distributed);
              const salesBeforeDistribution = stallSales.filter(
                s => new Date(s.date_time) < lastDistributionDate
              );
              const totalSalesBeforeDistribution = salesBeforeDistribution.reduce(
                (sum, s) => sum + s.quantity_sold, 0
              );

              // Initial stock = stock the user had at that moment (before the new distribution)
              // This represents their "present stock" at the time they received the new stock
              // This is: previous distributions - sales before that point
              initialStock = Math.max(0, totalPreviousDistributed - totalSalesBeforeDistribution);
            }
          }

          const currentStock = Math.max(0, totalDistributedToStall - totalSold);

          // IMPORTANT: Explicitly create new object WITHOUT original initial_stock
          // Remove initial_stock from item before spreading to ensure calculated value is used
          const { initial_stock: _, total_added: __, current_stock: ___, total_allocated: ____, ...itemWithoutStockFields } = item;
          const userItem: InventoryItem = {
            ...itemWithoutStockFields,
            current_stock: currentStock,
            initial_stock: initialStock, // Use calculated value (0 for first distribution)
            total_added: totalAdded,
            total_allocated: totalDistributedToStall,
            stall_id: stallId // Explicitly include stall_id for offline filtering
          };

          console.log(`[Mock User Stock] Item: ${userItem.item_name}, Stall: ${stallId}, initialStock: ${initialStock}, totalAdded: ${totalAdded}, currentStock: ${currentStock}`);

          return userItem;
        })
        .filter((item): item is InventoryItem => item !== null);

      return { items: filteredItems };
    }

    // For admin users: show actual current stock (initial + additions - distributions - sales)
    const itemsWithAdminStock = items.map(item => {
      const initialStock = item.initial_stock || 0;
      const totalAdded = item.total_added || 0;

      // Calculate total distributed to all stalls
      const totalDistributed = distributions
        .filter(d => d.item_id === item.item_id)
        .reduce((sum, d) => sum + d.quantity_allocated, 0);

      // Calculate total sold (all sales for this item)
      const totalSold = sales
        .filter(sale => sale.item_id === item.item_id)
        .reduce((sum, sale) => sum + sale.quantity_sold, 0);

      const withdrawals = getStorageData<any[]>('stock_withdrawals', []);
      const totalWithdrawn = withdrawals
        .filter(w => w.item_id === item.item_id)
        .reduce((sum, w) => sum + w.quantity_withdrawn, 0);

      // Admin's remaining stock = initial + added - distributed - sales - withdrawn
      const adminStock = Math.max(0, initialStock + totalAdded - totalDistributed - totalSold - totalWithdrawn);

      return {
        ...item,
        current_stock: adminStock,
        initial_stock: initialStock,
        total_added: totalAdded,
        total_allocated: totalDistributed
      };
    });

    return { items: itemsWithAdminStock };
  },

  createItem: async (itemData: Omit<InventoryItem, 'item_id' | 'date_added' | 'total_allocated' | 'total_added'>): Promise<{ item: InventoryItem }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const items = getStorageData<InventoryItem[]>('items', mockInventory);
    const newItem: InventoryItem = {
      item_id: Math.max(...items.map(i => i.item_id), 0) + 1,
      ...itemData,
      total_allocated: 0,
      total_added: 0,
      date_added: new Date().toISOString()
    };
    items.push(newItem);
    setStorageData('items', items);
    return { item: newItem };
  },

  updateItem: async (itemId: number, itemData: Partial<InventoryItem>): Promise<{ item: InventoryItem }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const items = getStorageData<InventoryItem[]>('items', mockInventory);
    const stockAdditions = getStorageData<any[]>('stock_additions', []);
    const itemIndex = items.findIndex(i => i.item_id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }

    const currentItem = items[itemIndex];

    if (itemData.unit_price !== undefined) {
      const unitPrice = Number(itemData.unit_price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error('Selling price must be greater than zero.');
      }
    }

    if (itemData.initial_stock !== undefined) {
      const initialStock = Number(itemData.initial_stock);
      if (!Number.isFinite(initialStock) || initialStock < 0) {
        throw new Error('Initial stock must be zero or greater.');
      }
    }

    if (itemData.current_stock !== undefined) {
      const currentStock = Number(itemData.current_stock);
      if (!Number.isFinite(currentStock) || currentStock < 0) {
        throw new Error('Current stock cannot be negative.');
      }
    }

    if (itemData.total_added !== undefined) {
      const newTotalAdded = Number(itemData.total_added);
      const currentTotalAdded = Number(currentItem.total_added || 0);
      if (!Number.isFinite(newTotalAdded) || newTotalAdded < currentTotalAdded) {
        throw new Error('Cannot reduce added stock. Use distributions or edit the item instead.');
      }

      const quantityToAdd = newTotalAdded - currentTotalAdded;
      if (quantityToAdd > 0) {
        currentItem.current_stock = Math.max(0, (currentItem.current_stock || 0) + quantityToAdd);
        stockAdditions.push({
          addition_id: Date.now(),
          item_id: itemId,
          quantity_added: quantityToAdd,
          date_added: new Date().toISOString(),
          added_by: 1
        });
      }
      currentItem.total_added = newTotalAdded;
    }

    setStorageData('stock_additions', stockAdditions);

    // Update the item with new data
    items[itemIndex] = {
      ...currentItem,
      ...itemData,
      // Preserve existing fields that shouldn't be changed
      item_id: currentItem.item_id,
      date_added: currentItem.date_added,
      initial_stock: itemData.initial_stock !== undefined ? Number(itemData.initial_stock) : currentItem.initial_stock,
      current_stock: itemData.total_added !== undefined
        ? currentItem.current_stock
        : (itemData.current_stock !== undefined ? Number(itemData.current_stock) : currentItem.current_stock),
      total_allocated: currentItem.total_allocated,
      total_added: itemData.total_added !== undefined ? Number(itemData.total_added) : currentItem.total_added,
      buying_price: currentItem.buying_price
    };
    setStorageData('items', items);
    return { item: items[itemIndex] };
  },

  deleteItem: async (itemId: number): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const items = getStorageData<InventoryItem[]>('items', mockInventory);
    const filteredItems = items.filter(i => i.item_id !== itemId);
    setStorageData('items', filteredItems);
    return { success: true };
  },

  // Sales API
  getSales: async (): Promise<{ sales: Sale[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const sales = getStorageData<Sale[]>('sales', mockSales);
    return { sales };
  },

  createSale: async (saleData: SaleInput): Promise<{ sale: Sale }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const sales = getStorageData<Sale[]>('sales', mockSales);
    const items = getStorageData<InventoryItem[]>('items', mockInventory);

    if (!saleData.quantity_sold || saleData.quantity_sold <= 0) {
      throw new Error('Quantity must be greater than zero.');
    }

    if (saleData.unit_price === undefined || saleData.unit_price === null || saleData.unit_price < 0) {
      throw new Error('Selling price must be zero or greater.');
    }

    // Find the item to get its details
    const itemId = typeof saleData.item_id === 'number' ? saleData.item_id : parseInt(saleData.item_id.toString());
    const item = items.find(i => i.item_id === itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    if (item.current_stock < saleData.quantity_sold) {
      throw new Error('Insufficient stock available.');
    }

    const negotiatedTotal = saleData.total_amount ?? (saleData.quantity_sold * saleData.unit_price);

    if (saleData.sale_type === 'split') {
      const cashAmount = saleData.cash_amount ?? 0;
      const mobileAmount = saleData.mobile_amount ?? 0;

      if (cashAmount <= 0 || mobileAmount <= 0) {
        throw new Error('Cash and mobile amounts must be greater than zero for split sales.');
      }

      if (Math.abs((cashAmount + mobileAmount) - negotiatedTotal) > 0.5) {
        throw new Error('Split payment totals must equal the negotiated total.');
      }
    }

    // Get user info for recorded_by_name
    const users = getStorageData<User[]>('users', mockUsers);
    const user = users.find(u => u.user_id === saleData.recorded_by);

    // Get stall info (stall_id can be null for admin sales)
    const stallId = saleData.stall_id === null || saleData.stall_id === undefined
      ? null
      : (typeof saleData.stall_id === 'number' ? saleData.stall_id : parseInt(saleData.stall_id.toString()));
    const stalls = getStorageData<Stall[]>('stalls', mockStalls);
    const stall = stallId ? stalls.find(s => s.stall_id === stallId) : null;

    const newSale: Sale = {
      sale_id: Math.max(...sales.map(s => s.sale_id), 0) + 1,
      item_id: itemId,
      item_name: item.item_name,
      category: item.category,
      stall_id: stallId ?? undefined,
      quantity_sold: saleData.quantity_sold,
      unit_price: saleData.unit_price,
      total_amount: negotiatedTotal,
      sale_type: saleData.sale_type,
      cash_amount: saleData.sale_type === 'split' ? saleData.cash_amount || null : null,
      mobile_amount: saleData.sale_type === 'split' ? saleData.mobile_amount || null : null,
      date_time: new Date().toISOString(),
      recorded_by: saleData.recorded_by,
      recorded_by_name: user ? user.full_name : 'Unknown',
      stall_name: stall ? stall.stall_name : (stallId === null ? 'Admin Sale' : 'Unknown'),
      customer_name: saleData.customer_name,
      customer_contact: saleData.customer_contact,
      payment_status: saleData.sale_type === 'credit' ? 'unpaid' : undefined,
      balance_due: saleData.sale_type === 'credit' ? (saleData.quantity_sold * saleData.unit_price) : undefined,
      due_date: saleData.due_date || null,
      notes: saleData.notes || null,
      amount_paid: saleData.sale_type === 'credit' ? 0 : null
    };

    sales.push(newSale);
    setStorageData('sales', sales);

    // Update item stock
    item.current_stock -= saleData.quantity_sold;
    if (item.current_stock < 0) item.current_stock = 0;
    const allItems = getStorageData<InventoryItem[]>('items', mockInventory);
    const updatedItems = allItems.map(i => i.item_id === item.item_id ? item : i);
    setStorageData('items', updatedItems);

    return { sale: newSale };
  },

  createWithdrawal: async (withdrawalParams: {
    item_id: number;
    quantity_withdrawn: number;
    reason: string;
    withdrawn_by: number;
    notes?: string;
  }): Promise<{ withdrawal: any }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const withdrawals = getStorageData<any[]>('stock_withdrawals', []);
    const items = getStorageData<InventoryItem[]>('items', mockInventory);

    const item = items.find(i => i.item_id === withdrawalParams.item_id);
    if (!item) throw new Error('Item not found');

    const newWithdrawal = {
      withdrawal_id: Date.now(),
      ...withdrawalParams,
      date_withdrawn: new Date().toISOString()
    };

    withdrawals.push(newWithdrawal);
    setStorageData('stock_withdrawals', withdrawals);

    // Update item stock if needed (getInventory usually recalcs but let's be safe)
    item.current_stock = Math.max(0, item.current_stock - withdrawalParams.quantity_withdrawn);
    setStorageData('items', items);

    return { withdrawal: newWithdrawal };
  },

  updateSale: async (saleId: number, saleData: Partial<Sale>): Promise<{ sale: Sale }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const sales = getStorageData<Sale[]>('sales', mockSales);
    const items = getStorageData<InventoryItem[]>('items', mockInventory);
    const stalls = getStorageData<Stall[]>('stalls', mockStalls);
    const saleIndex = sales.findIndex(s => s.sale_id === saleId);
    if (saleIndex === -1) {
      throw new Error('Sale not found');
    }
    const existingSale = sales[saleIndex];

    const newItemId = saleData.item_id !== undefined ? saleData.item_id : existingSale.item_id;
    const newQuantity = saleData.quantity_sold !== undefined ? saleData.quantity_sold : existingSale.quantity_sold;
    const newUnitPrice = saleData.unit_price !== undefined ? saleData.unit_price : existingSale.unit_price;
    const newSaleType = saleData.sale_type !== undefined ? saleData.sale_type : existingSale.sale_type;
    const newStallId = saleData.stall_id !== undefined ? saleData.stall_id : existingSale.stall_id;

    // Update stock levels
    if (newItemId !== existingSale.item_id) {
      const previousItemIndex = items.findIndex(i => i.item_id === existingSale.item_id);
      if (previousItemIndex !== -1) {
        items[previousItemIndex].current_stock += existingSale.quantity_sold;
      }

      const newItemIndex = items.findIndex(i => i.item_id === newItemId);
      if (newItemIndex !== -1) {
        items[newItemIndex].current_stock = Math.max(
          0,
          items[newItemIndex].current_stock - newQuantity
        );
      }
    } else if (newQuantity !== existingSale.quantity_sold) {
      const itemIndex = items.findIndex(i => i.item_id === existingSale.item_id);
      if (itemIndex !== -1) {
        const difference = newQuantity - existingSale.quantity_sold;
        items[itemIndex].current_stock = Math.max(
          0,
          items[itemIndex].current_stock - difference
        );
      }
    }

    const newItem = items.find(i => i.item_id === newItemId);
    const newStall = newStallId ? stalls.find(s => s.stall_id === newStallId) : null;

    const updatedSale: Sale = {
      ...existingSale,
      ...saleData,
      item_id: newItemId,
      stall_id: newStallId,
      quantity_sold: newQuantity,
      unit_price: newUnitPrice,
      total_amount: newQuantity * newUnitPrice,
      sale_type: newSaleType,
      cash_amount: newSaleType === 'split' ? (saleData.cash_amount ?? existingSale.cash_amount ?? null) : null,
      mobile_amount: newSaleType === 'split' ? (saleData.mobile_amount ?? existingSale.mobile_amount ?? null) : null,
      item_name: newItem ? newItem.item_name : existingSale.item_name,
      category: newItem ? newItem.category : existingSale.category,
      stall_name: newStall ? newStall.stall_name : existingSale.stall_name,
      customer_name: newSaleType === 'credit' ? (saleData.customer_name ?? existingSale.customer_name) : undefined,
      customer_contact: newSaleType === 'credit' ? (saleData.customer_contact ?? existingSale.customer_contact) : undefined,
      due_date: newSaleType === 'credit' ? (saleData.due_date ?? existingSale.due_date ?? null) : null,
      notes: newSaleType === 'credit' ? (saleData.notes ?? existingSale.notes ?? null) : null,
      payment_status: newSaleType === 'credit' ? (existingSale.payment_status || 'unpaid') : undefined,
      balance_due: newSaleType === 'credit' ? (newQuantity * newUnitPrice) - (existingSale.amount_paid || 0) : undefined,
      amount_paid: newSaleType === 'credit' ? existingSale.amount_paid || 0 : null
    };

    sales[saleIndex] = updatedSale;
    setStorageData('sales', sales);
    setStorageData('items', items);
    return { sale: updatedSale };
  },

  getSalesSummary: async (period: string): Promise<Analytics> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockAnalytics;
  },

  // Analytics API
  getAnalytics: async (): Promise<Analytics> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockAnalytics;
  },

  // Distribution API
  distributeStock: async (itemId: number, distribution: { stall_id: number; quantity_allocated: number }): Promise<void> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const items = getStorageData<InventoryItem[]>('items', mockInventory);
    const item = items.find(i => i.item_id === itemId);

    if (!item) {
      throw new Error('Item not found');
    }

    // Get existing distributions to calculate total already distributed
    const distributions = getStorageData<StockDistribution[]>('stock_distributions', []);
    const existingDistributions = distributions.filter(d => d.item_id === itemId);
    const totalAlreadyDistributed = existingDistributions.reduce(
      (sum, d) => sum + d.quantity_allocated, 0
    );

    // Calculate total available stock (initial + added - already distributed)
    const totalAvailableStock = item.initial_stock + item.total_added - totalAlreadyDistributed;

    if (totalAvailableStock < distribution.quantity_allocated) {
      throw new Error(`Insufficient stock! Available: ${totalAvailableStock}, Requested: ${distribution.quantity_allocated}`);
    }

    // Update item stock (subtract from main stock for tracking purposes)
    // Note: Admin will still see initial_stock + total_added in display
    item.current_stock -= distribution.quantity_allocated;
    item.total_allocated += distribution.quantity_allocated;

    setStorageData('items', items);

    // Create stock_distribution record
    const newDistribution: StockDistribution = {
      distribution_id: Math.max(...distributions.map(d => d.distribution_id), 0) + 1,
      item_id: itemId,
      stall_id: distribution.stall_id,
      quantity_allocated: distribution.quantity_allocated,
      date_distributed: new Date().toISOString(),
      distributed_by: 1 // Assuming admin user_id is 1, in real system use req.user.user_id
    };
    distributions.push(newDistribution);
    setStorageData('stock_distributions', distributions);
  },

  getDistributions: async (itemId?: number): Promise<{ distributions: any[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const distributions = getStorageData<StockDistribution[]>('stock_distributions', []);
    const stalls = getStorageData<Stall[]>('stalls', mockStalls);
    const users = getStorageData<User[]>('users', mockUsers);

    let filteredDist = itemId
      ? distributions.filter(d => d.item_id === itemId)
      : distributions;

    const enrichedDist = filteredDist.map(d => {
      const stall = stalls.find(s => s.stall_id === d.stall_id);
      const user = users.find(u => u.user_id === d.distributed_by);
      return {
        ...d,
        stall_name: stall ? stall.stall_name : 'Unknown Stall',
        distributed_by_name: user ? user.full_name : 'Unknown Admin'
      };
    });

    return { distributions: enrichedDist.sort((a, b) => new Date(b.date_distributed).getTime() - new Date(a.date_distributed).getTime()) };
  },

  updateDistribution: async (distributionId: number, quantity: number, stallId: number): Promise<{ distribution: any }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const distributions = getStorageData<StockDistribution[]>('stock_distributions', []);
    const items = getStorageData<InventoryItem[]>('items', mockInventory);

    const distIndex = distributions.findIndex(d => d.distribution_id === distributionId);
    if (distIndex === -1) throw new Error('Distribution not found');

    const dist = distributions[distIndex];
    const itemId = dist.item_id;
    const oldQty = dist.quantity_allocated;
    const qtyDiff = quantity - oldQty;

    const item = items.find(i => i.item_id === itemId);
    if (!item) throw new Error('Item not found');

    if (qtyDiff > item.current_stock) {
      throw new Error(`Insufficient stock! Available: ${item.current_stock}, Requested additional: ${qtyDiff}`);
    }

    // Update item stock
    item.current_stock -= qtyDiff;
    item.total_allocated += qtyDiff;

    // Update distribution
    distributions[distIndex] = {
      ...dist,
      quantity_allocated: quantity,
      stall_id: stallId,
      date_distributed: new Date().toISOString()
    };

    setStorageData('items', items);
    setStorageData('stock_distributions', distributions);

    return { distribution: distributions[distIndex] };
  },

  deleteDistribution: async (distributionId: number): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const distributions = getStorageData<StockDistribution[]>('stock_distributions', []);
    const items = getStorageData<InventoryItem[]>('items', mockInventory);

    const distIndex = distributions.findIndex(d => d.distribution_id === distributionId);
    if (distIndex === -1) throw new Error('Distribution not found');

    const dist = distributions[distIndex];
    const itemId = dist.item_id;
    const qty = dist.quantity_allocated;

    const item = items.find(i => i.item_id === itemId);
    if (item) {
      item.current_stock += qty;
      item.total_allocated -= qty;
    }

    const filteredDist = distributions.filter(d => d.distribution_id !== distributionId);

    setStorageData('items', items);
    setStorageData('stock_distributions', filteredDist);

    return { success: true };
  },

  deleteSale: async (saleId: number): Promise<{ success: boolean }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const sales = getStorageData<Sale[]>('sales', mockSales);
    const items = getStorageData<InventoryItem[]>('items', mockInventory);

    const saleToDelete = sales.find(s => s.sale_id === saleId);
    if (!saleToDelete) {
      throw new Error('Sale not found');
    }

    // Restore item stock
    const item = items.find(i => i.item_id === saleToDelete.item_id);
    if (item) {
      item.current_stock += saleToDelete.quantity_sold;
    }

    const filteredSales = sales.filter(s => s.sale_id !== saleId);
    setStorageData('sales', filteredSales);
    setStorageData('items', items);

    return { success: true };
  }
};
