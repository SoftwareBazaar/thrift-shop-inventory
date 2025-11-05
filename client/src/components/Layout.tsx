import React, { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/MockAuthContext';

const Layout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const { user, logout, changePassword } = useAuth();
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Inventory', href: '/inventory', icon: '📦' },
    { name: 'Sales', href: '/sales', icon: '💰' },
    ...(user?.role === 'admin' ? [
      { name: 'Reports', href: '/reports', icon: '📈' },
      { name: 'Users', href: '/users', icon: '👥' }
    ] : []),
  ];

  const isActive = (path: string) => location.pathname === path;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess(false);

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    if (!user) return;

    const success = await changePassword(user.username, passwordForm.oldPassword, passwordForm.newPassword);
    if (success) {
      setPasswordSuccess(true);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess(false);
      }, 2000);
    } else {
      setPasswordError('Incorrect current password');
    }
  };

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--neutral-50) 100%)'}}>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 sidebar-enhanced transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-center h-20 border-b" style={{borderColor: 'var(--neutral-200)'}}>
          <img 
            src="/sta-logo.png.png" 
            alt="Street Thrift Apparel Logo" 
            className="h-16 sm:h-20 w-auto object-contain px-2"
          />
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute right-4 hover:opacity-70"
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
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowPasswordModal(true)}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Change Password"
              >
                🔒
              </button>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Logout"
              >
                🚪
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            
            {passwordSuccess ? (
              <div className="text-green-600 mb-4">✓ Password changed successfully!</div>
            ) : (
              <form onSubmit={handlePasswordChange}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <input
                    type="password"
                    value={passwordForm.oldPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                {passwordError && (
                  <div className="text-red-600 mb-4 text-sm">{passwordError}</div>
                )}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                      setPasswordError('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Change Password
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

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
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <span className="text-sm truncate" style={{color: 'var(--primary-700)'}}>
                Welcome back, <span className="hidden sm:inline">{user?.full_name}</span><span className="sm:hidden">{user?.full_name?.split(' ')[0] || user?.full_name}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <main className="p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
