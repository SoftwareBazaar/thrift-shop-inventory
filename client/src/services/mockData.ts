// Mock data service for offline demonstration
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
  quantity_sold: number;
  unit_price: number;
  total_amount: number;
  sale_type: 'cash' | 'credit' | 'mobile';
  date_time: string;
  recorded_by: number;
  recorded_by_name: string;
  stall_name: string;
  customer_name?: string;
  customer_contact?: string;
  payment_status?: string;
  balance_due?: number;
}

export interface SaleInput {
  item_id: number | string;
  stall_id: number | string;
  quantity_sold: number;
  unit_price: number;
  sale_type: 'cash' | 'credit' | 'mobile';
  recorded_by: number;
  total_amount?: number;
  customer_name?: string;
  customer_contact?: string;
  payment_status?: string;
  balance_due?: number;
}

export interface InventoryItem {
  item_id: number;
  item_name: string;
  category: string;
  initial_stock: number;
  current_stock: number;
  unit_price: number;
  date_added: string;
  sku?: string;
  total_allocated: number;
  total_added: number;
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

// Mock Users Data - Start with only admin user
export const mockUsers: User[] = [
  {
    user_id: 1,
    username: 'admin',
    full_name: 'System Administrator',
    role: 'admin',
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
  if (!localStorage.getItem('thrift_shop_users')) {
    setStorageData('users', mockUsers);
  }
  if (!localStorage.getItem('thrift_shop_stalls')) {
    setStorageData('stalls', mockStalls);
  }
  if (!localStorage.getItem('thrift_shop_items')) {
    setStorageData('items', mockInventory);
  }
  if (!localStorage.getItem('thrift_shop_sales')) {
    setStorageData('sales', mockSales);
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
  getInventory: async (): Promise<{ items: InventoryItem[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    const items = getStorageData<InventoryItem[]>('items', mockInventory);
    return { items };
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
    const item = items.find(i => i.item_id === parseInt(saleData.item_id));
    if (!item) {
      throw new Error('Item not found');
    }

    // Get user info for recorded_by_name
    const users = getStorageData<User[]>('users', mockUsers);
    const user = users.find(u => u.user_id === saleData.recorded_by);
    
    // Get stall info
    const stalls = getStorageData<Stall[]>('stalls', mockStalls);
    const stall = stalls.find(s => s.stall_id === saleData.stall_id);
    
    const newSale: Sale = {
      sale_id: Math.max(...sales.map(s => s.sale_id), 0) + 1,
      item_name: item.item_name,
      category: item.category,
      quantity_sold: saleData.quantity_sold,
      unit_price: saleData.unit_price,
      total_amount: saleData.quantity_sold * saleData.unit_price,
      sale_type: saleData.sale_type,
      date_time: new Date().toISOString(),
      recorded_by: saleData.recorded_by,
      recorded_by_name: user ? user.full_name : 'Unknown',
      stall_name: stall ? stall.stall_name : 'Unknown',
      customer_name: saleData.customer_name,
      customer_contact: saleData.customer_contact,
      payment_status: saleData.sale_type === 'credit' ? 'unpaid' : undefined,
      balance_due: saleData.sale_type === 'credit' ? saleData.total_amount : undefined
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

  getSalesSummary: async (period: string): Promise<Analytics> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockAnalytics;
  },

  // Analytics API
  getAnalytics: async (): Promise<Analytics> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return mockAnalytics;
  }
};
