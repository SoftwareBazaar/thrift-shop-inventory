// Mock data service for offline demonstration
export interface User {
  user_id: number;
  username: string;
  full_name: string;
  role: string;
  stall_id?: number;
  status: string;
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
  quantity_sold: number;
  unit_price: number;
  total_amount: number;
  sale_type: string;
  date_time: string;
  recorded_by: number;
  recorded_by_name: string;
  stall_name: string;
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

// Mock Users Data
export const mockUsers: User[] = [
  {
    user_id: 1,
    username: 'admin',
    full_name: 'System Administrator',
    role: 'admin',
    status: 'active'
  },
  {
    user_id: 2,
    username: 'john',
    full_name: 'John - Stall Manager',
    role: 'user',
    stall_id: 1,
    status: 'active'
  },
  {
    user_id: 3,
    username: 'geoffrey',
    full_name: 'Geoffrey - Sales Associate',
    role: 'user',
    stall_id: 2,
    status: 'active'
  }
];

// Mock Stalls Data
export const mockStalls: Stall[] = [
  {
    stall_id: 1,
    stall_name: 'Chuka Town',
    user_id: 2,
    location: 'Chuka Town Center',
    manager: 'John - Stall Manager',
    status: 'active'
  },
  {
    stall_id: 2,
    stall_name: 'Ndagani',
    user_id: 3,
    location: 'Ndagani Market',
    manager: 'Geoffrey - Sales Associate',
    status: 'active'
  }
];

// Mock Inventory Data
export const mockInventory: InventoryItem[] = [
  {
    item_id: 1,
    item_name: 'Vintage Jeans',
    category: 'Clothing',
    initial_stock: 50,
    current_stock: 35,
    unit_price: 25.00,
    date_added: '2024-01-15',
    sku: 'VJ001',
    total_allocated: 15,
    total_added: 0
  },
  {
    item_id: 2,
    item_name: 'Classic T-Shirt',
    category: 'Clothing',
    initial_stock: 30,
    current_stock: 18,
    unit_price: 15.00,
    date_added: '2024-01-16',
    sku: 'CT001',
    total_allocated: 12,
    total_added: 0
  },
  {
    item_id: 3,
    item_name: 'Designer Handbag',
    category: 'Accessories',
    initial_stock: 20,
    current_stock: 8,
    unit_price: 45.00,
    date_added: '2024-01-17',
    sku: 'DH001',
    total_allocated: 12,
    total_added: 0
  },
  {
    item_id: 4,
    item_name: 'Vintage Watch',
    category: 'Accessories',
    initial_stock: 15,
    current_stock: 5,
    unit_price: 80.00,
    date_added: '2024-01-18',
    sku: 'VW001',
    total_allocated: 10,
    total_added: 0
  }
];

// Mock Sales Data
export const mockSales: Sale[] = [
  {
    sale_id: 1,
    item_name: 'Vintage Jeans',
    quantity_sold: 2,
    unit_price: 25.00,
    total_amount: 50.00,
    sale_type: 'cash',
    date_time: '2024-01-20T10:30:00Z',
    recorded_by: 2,
    recorded_by_name: 'John - Stall Manager',
    stall_name: 'Chuka Town'
  },
  {
    sale_id: 2,
    item_name: 'Classic T-Shirt',
    quantity_sold: 1,
    unit_price: 15.00,
    total_amount: 15.00,
    sale_type: 'cash',
    date_time: '2024-01-20T11:15:00Z',
    recorded_by: 2,
    recorded_by_name: 'John - Stall Manager',
    stall_name: 'Chuka Town'
  },
  {
    sale_id: 3,
    item_name: 'Designer Handbag',
    quantity_sold: 1,
    unit_price: 45.00,
    total_amount: 45.00,
    sale_type: 'credit',
    date_time: '2024-01-20T14:20:00Z',
    recorded_by: 3,
    recorded_by_name: 'Geoffrey - Sales Associate',
    stall_name: 'Ndagani'
  },
  {
    sale_id: 4,
    item_name: 'Vintage Watch',
    quantity_sold: 1,
    unit_price: 80.00,
    total_amount: 80.00,
    sale_type: 'cash',
    date_time: '2024-01-20T16:45:00Z',
    recorded_by: 3,
    recorded_by_name: 'Geoffrey - Sales Associate',
    stall_name: 'Ndagani'
  }
];

// Mock Analytics Data
export const mockAnalytics: Analytics = {
  totalRevenue: 190.00,
  totalSales: 4,
  totalUnits: 5,
  averageSale: 47.50,
  topSellingItems: [
    { item_name: 'Vintage Jeans', total_sold: 2, revenue: 50.00 },
    { item_name: 'Vintage Watch', total_sold: 1, revenue: 80.00 },
    { item_name: 'Designer Handbag', total_sold: 1, revenue: 45.00 },
    { item_name: 'Classic T-Shirt', total_sold: 1, revenue: 15.00 }
  ],
  userPerformance: [
    { user_name: 'John - Stall Manager', sales: 2, revenue: 65.00 },
    { user_name: 'Geoffrey - Sales Associate', sales: 2, revenue: 125.00 }
  ],
  dailySales: [
    { date: '2024-01-20', sales: 4, revenue: 190.00 },
    { date: '2024-01-19', sales: 3, revenue: 120.00 },
    { date: '2024-01-18', sales: 2, revenue: 85.00 }
  ],
  commissionData: [
    { user_name: 'John - Stall Manager', sales: 2, commission: 3.25 },
    { user_name: 'Geoffrey - Sales Associate', sales: 2, commission: 6.25 }
  ]
};

// Mock API functions
export const mockApi = {
  // Users API
  getUsers: async (): Promise<{ users: User[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
    return { users: mockUsers };
  },

  // Stalls API
  getStalls: async (): Promise<{ stalls: Stall[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { stalls: mockStalls };
  },

  // Inventory API
  getInventory: async (): Promise<{ items: InventoryItem[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { items: mockInventory };
  },

  // Sales API
  getSales: async (): Promise<{ sales: Sale[] }> => {
    await new Promise(resolve => setTimeout(resolve, 500));
    return { sales: mockSales };
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
