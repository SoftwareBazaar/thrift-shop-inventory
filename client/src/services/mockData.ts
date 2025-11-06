// Mock data service for offline demonstration
// NOTE: In production, this is automatically replaced by databaseService.ts
// when Supabase credentials are configured
export interface User {
  user_id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  stall_id?: number;
  status: string;
  created_date: string;
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
  cash_amount?: number | null;
  mobile_amount?: number | null;
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
  topSellingItems: Array<{item_name: string; total_sold: number; revenue: number}>;
  userPerformance: Array<{user_name: string; sales: number; revenue: number}>;
  dailySales: Array<{date: string; sales: number; revenue: number}>;
  commissionData: Array<{user_name: string; sales: number; commission: number}>;
}

// Mock Users Data - Start with admin and assigned users
export const mockUsers: User[] = [
  {
    user_id: 1,
    username: 'admin',
    full_name: 'System Administrator',
    role: 'admin',
    status: 'active',
    created_date: '2024-01-01'
  },
  {
    user_id: 2,
    username: 'kelvin',
    full_name: 'Kelvin',
    role: 'user',
    stall_id: 316,
    status: 'active',
    created_date: '2024-01-01'
  },
  {
    user_id: 3,
    username: 'manuel',
    full_name: 'Manuel',
    role: 'user',
    stall_id: 309,
    status: 'active',
    created_date: '2024-01-01'
  }
];

// Mock Stalls Data - Real stalls for testing
export const mockStalls: Stall[] = [
  {
    stall_id: 316,
    stall_name: 'Stall 316',
    user_id: 2,
    location: 'Stall 316',
    manager: 'Kelvin',
    status: 'active'
  },
  {
    stall_id: 309,
    stall_name: 'Stall 309',
    user_id: 3,
    location: 'Stall 309',
    manager: 'Manuel',
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

  createUser: async (userData: Omit<User, 'user_id' | 'created_date'> & { password: string }): Promise<{ user: User }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getStorageData<User[]>('users', mockUsers);
    const newUser: User = {
      user_id: Math.max(...users.map(u => u.user_id), 0) + 1,
      ...userData,
      created_date: new Date().toISOString()
    };
    users.push(newUser);
    setStorageData('users', users);
    return { user: newUser };
  },

  updateUser: async (userId: number, userData: Partial<User>): Promise<{ user: User }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const users = getStorageData<User[]>('users', mockUsers);
    const userIndex = users.findIndex(u => u.user_id === userId);
    if (userIndex === -1) {
      throw new Error('User not found');
    }
    users[userIndex] = { ...users[userIndex], ...userData };
    setStorageData('users', users);
    return { user: users[userIndex] };
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
          
          // Calculate stock before the most recent distribution
          // Initial stock = previous stock (before latest distribution)
          const mostRecentDistribution = stallDistributions.length > 0 
            ? stallDistributions[stallDistributions.length - 1] 
            : null;
          
          let stockBeforeLastDistribution = 0;
          
          if (mostRecentDistribution && stallDistributions.length > 1) {
            // Calculate distributions before the most recent one
            const previousDistributions = stallDistributions.slice(0, -1);
            const totalPreviousDistributed = previousDistributions.reduce(
              (sum, d) => sum + d.quantity_allocated, 0
            );
            
            // Calculate sales that happened before the most recent distribution
            const lastDistributionDate = new Date(mostRecentDistribution.date_distributed);
            const salesBeforeLastDistribution = stallSales.filter(
              s => new Date(s.date_time) < lastDistributionDate
            );
            const totalSalesBeforeLast = salesBeforeLastDistribution.reduce(
              (sum, s) => sum + s.quantity_sold, 0
            );
            
            // Stock before last distribution = previous distributions - sales before last distribution
            stockBeforeLastDistribution = Math.max(0, totalPreviousDistributed - totalSalesBeforeLast);
          } else if (mostRecentDistribution && stallDistributions.length === 1) {
            // First distribution: initial stock is 0
            stockBeforeLastDistribution = 0;
          }
          
          // Calculate total sales from this stall
          const totalSoldFromStall = stallSales.reduce(
            (sum, s) => sum + s.quantity_sold, 0
          );
          
          // Current stock = total distributed - total sold
          const remainingStock = Math.max(0, totalDistributedToStall - totalSoldFromStall);
          
          // Get the most recent distribution amount
          const mostRecentDistributionAmount = mostRecentDistribution 
            ? mostRecentDistribution.quantity_allocated 
            : 0;
          
          return {
            ...item,
            current_stock: remainingStock,
            // Initial stock = previous stock (before latest distribution)
            // Added stock = most recent distribution amount only
            initial_stock: stockBeforeLastDistribution,
            total_added: mostRecentDistributionAmount
          };
        })
        .filter((item): item is InventoryItem => item !== null);
      
      return { items: filteredItems };
    }
    
    // For admin users: stock = initial_stock + total_added (distributions do NOT reduce admin's displayed stock)
    const itemsWithAdminStock = items.map(item => {
      const initialStock = item.initial_stock || 0;
      const totalAdded = item.total_added || 0;
      const adminStock = initialStock + totalAdded;
      
      return {
        ...item,
        current_stock: adminStock,
        initial_stock: initialStock,
        total_added: totalAdded
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
    const itemIndex = items.findIndex(i => i.item_id === itemId);
    if (itemIndex === -1) {
      throw new Error('Item not found');
    }
    // Update the item with new data
    items[itemIndex] = { 
      ...items[itemIndex], 
      ...itemData,
      // Preserve existing fields that shouldn't be changed
      item_id: items[itemIndex].item_id,
      date_added: items[itemIndex].date_added,
      initial_stock: itemData.initial_stock !== undefined ? itemData.initial_stock : items[itemIndex].initial_stock,
      current_stock: itemData.current_stock !== undefined ? itemData.current_stock : items[itemIndex].current_stock,
      total_allocated: items[itemIndex].total_allocated,
      total_added: itemData.total_added !== undefined ? itemData.total_added : items[itemIndex].total_added,
      buying_price: items[itemIndex].buying_price
    };
    setStorageData('items', items);
    return { item: items[itemIndex] };
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
    
    // Find the item to get its details
    const itemId = typeof saleData.item_id === 'number' ? saleData.item_id : parseInt(saleData.item_id.toString());
    const item = items.find(i => i.item_id === itemId);
    if (!item) {
      throw new Error('Item not found');
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
      quantity_sold: saleData.quantity_sold,
      unit_price: saleData.unit_price,
      total_amount: saleData.quantity_sold * saleData.unit_price,
      sale_type: saleData.sale_type,
      date_time: new Date().toISOString(),
      recorded_by: saleData.recorded_by,
      recorded_by_name: user ? user.full_name : 'Unknown',
      stall_name: stall ? stall.stall_name : (stallId === null ? 'Admin Sale' : 'Unknown'),
      customer_name: saleData.customer_name,
      customer_contact: saleData.customer_contact,
      payment_status: saleData.sale_type === 'credit' ? 'unpaid' : undefined,
      balance_due: saleData.sale_type === 'credit' ? saleData.total_amount : undefined,
      cash_amount: saleData.cash_amount || null,
      mobile_amount: saleData.mobile_amount || null
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

  updateSale: async (saleId: number, saleData: Partial<Sale>): Promise<{ sale: Sale }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const sales = getStorageData<Sale[]>('sales', mockSales);
    const saleIndex = sales.findIndex(s => s.sale_id === saleId);
    if (saleIndex === -1) {
      throw new Error('Sale not found');
    }
    // Update sale with new data, preserving existing fields
    const updatedRecordedBy = saleData.recorded_by !== undefined ? saleData.recorded_by : sales[saleIndex].recorded_by;
    // Find the user name for the updated recorded_by
    const users = getStorageData<User[]>('users', mockUsers);
    const recordedByUser = users.find(u => u.user_id === updatedRecordedBy);
    const recordedByName = recordedByUser ? recordedByUser.full_name : sales[saleIndex].recorded_by_name;
    
    sales[saleIndex] = { 
      ...sales[saleIndex], 
      ...saleData,
      // Preserve fields that shouldn't change
      sale_id: sales[saleIndex].sale_id,
      item_name: sales[saleIndex].item_name,
      category: sales[saleIndex].category,
      date_time: sales[saleIndex].date_time,
      recorded_by: updatedRecordedBy,
      recorded_by_name: recordedByName,
      stall_name: sales[saleIndex].stall_name,
      customer_name: sales[saleIndex].customer_name,
      customer_contact: sales[saleIndex].customer_contact,
      buying_price: sales[saleIndex].buying_price
    };
    setStorageData('sales', sales);
    return { sale: sales[saleIndex] };
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
  }
};
