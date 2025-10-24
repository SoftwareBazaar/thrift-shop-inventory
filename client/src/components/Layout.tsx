import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Inventory', href: '/inventory', icon: '📦' },
    { name: 'Sales', href: '/sales', icon: '💰' },
    { name: 'Feedback', href: '/feedback', icon: '💬' },
    { name: 'Reports', href: '/reports', icon: '📈' },
    ...(user?.role === 'admin' ? [{ name: 'Users', href: '/users', icon: '👥' }] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--neutral-50) 100%)'}}>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 sidebar-enhanced transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-between h-16 px-4 border-b" style={{borderColor: 'var(--neutral-200)'}}>
          <h1 className="text-xl font-bold" style={{color: 'var(--primary-800)'}}>Thrift Shop</h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden hover:opacity-70"
            style={{color: 'var(--primary-600)'}}
          >
            ✕
          </button>
        </div>
        
        <nav className="mt-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`nav-item flex items-center px-4 py-3 text-sm font-medium ${
                isActive(item.href) ? 'active' : ''
              }`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="mr-3 text-lg">{item.icon}</span>
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <button
              onClick={logout}
              className="ml-2 p-2 text-gray-400 hover:text-gray-600"
              title="Logout"
            >
              🚪
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:ml-64">
        {/* Top bar */}
        <div className="header-enhanced">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden hover:opacity-70"
              style={{color: 'var(--primary-600)'}}
            >
              ☰
            </button>
            <div className="flex items-center space-x-4">
              <span className="text-sm" style={{color: 'var(--primary-700)'}}>
                Welcome back, {user?.full_name}
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
