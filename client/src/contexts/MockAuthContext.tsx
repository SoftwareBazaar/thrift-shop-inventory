import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  user_id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  stall_id?: number;
  status: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demonstration
const mockUsers: User[] = [
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

export const MockAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<void> => {
    setLoading(true);
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Find user in mock data
      const foundUser = mockUsers.find(u => u.username === username);
      
      if (!foundUser) {
        throw new Error('User not found');
      }
      
      // Simple password check (for demo purposes)
      const validPasswords: { [key: string]: string } = {
        'admin': 'admin123',
        'john': 'admin123',
        'geoffrey': 'admin123'
      };
      
      if (validPasswords[username] !== password) {
        throw new Error('Invalid password');
      }
      
      // Generate mock token
      const mockToken = `mock_token_${Date.now()}_${username}`;
      
      // Save to localStorage
      localStorage.setItem('token', mockToken);
      localStorage.setItem('user', JSON.stringify(foundUser));
      
      setToken(mockToken);
      setUser(foundUser);
      
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
