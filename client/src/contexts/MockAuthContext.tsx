import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { mockApi, User } from '../services/mockData';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  changePassword: (username: string, oldPassword: string, newPassword: string) => Promise<boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper functions for password management
const getPasswordsStorage = (): { [key: string]: string } => {
  const stored = localStorage.getItem('user_passwords');
  return stored ? JSON.parse(stored) : {};
};

const setPasswordForUser = (username: string, password: string) => {
  const passwords = getPasswordsStorage();
  passwords[username] = password;
  localStorage.setItem('user_passwords', JSON.stringify(passwords));
};

const getPasswordForUser = (username: string): string | null => {
  const passwords = getPasswordsStorage();
  return passwords[username] || null;
};

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
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get users from mockApi (includes localStorage sync)
      const usersResponse = await mockApi.getUsers();
      const foundUser = usersResponse.users.find(u => u.username.toLowerCase() === username.toLowerCase());
      
      if (!foundUser) {
        throw new Error('User not found');
      }

      // Check password
      const storedPassword = getPasswordForUser(username);
      if (!storedPassword) {
        // First-time login - set default password
        setPasswordForUser(username, 'admin123');
        if (password !== 'admin123') {
          throw new Error('Invalid password');
        }
      } else if (storedPassword !== password) {
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

  const changePassword = async (username: string, oldPassword: string, newPassword: string): Promise<boolean> => {
    try {
      const storedPassword = getPasswordForUser(username);
      if (!storedPassword || storedPassword !== oldPassword) {
        return false;
      }
      setPasswordForUser(username, newPassword);
      return true;
    } catch (error) {
      console.error('Change password error:', error);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    changePassword,
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
