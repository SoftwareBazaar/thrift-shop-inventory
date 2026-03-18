import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuth, PASSWORD_REQUIREMENTS, validatePasswordStrength } from '../contexts/MockAuthContext';

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordVisibility, setPasswordVisibility] = useState({ old: false, new: false, confirm: false });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { user, logout, changePassword } = useAuth();
  const location = useLocation();
  
  const handleLogout = () => {
    try {
      logout();
      // Close modal
      setShowLogoutModal(false);
      // Redirect to login
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      localStorage.clear();
      navigate('/login', { replace: true });
    }
  };

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
    setPasswordSuccess('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (!user) return;

    const strengthError = validatePasswordStrength(passwordForm.newPassword);
    if (strengthError) {
      setPasswordError(strengthError);
      return;
    }

    setPasswordLoading(true);

    try {
      const success = await changePassword(user.username, passwordForm.oldPassword, passwordForm.newPassword);
      if (success) {
        setPasswordSuccess('Password changed successfully. You will be signed out to apply the update.');
        setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setPasswordVisibility({ old: false, new: false, confirm: false });
        setTimeout(() => {
          logout();
          navigate('/login', { replace: true });
        }, 1800);
      } else {
        setPasswordError('Incorrect current password');
      }
    } catch (error: any) {
      setPasswordError(error?.message || 'Unable to change password. Please try again later.');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{background: 'linear-gradient(135deg, var(--primary-50) 0%, var(--neutral-50) 100%)'}}>
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-64 sidebar-enhanced transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } lg:translate-x-0`}>
        <div className="flex items-center justify-center h-24 sm:h-28 border-b py-2" style={{borderColor: 'var(--neutral-200)'}}>
          <img 
            src={`${process.env.PUBLIC_URL || ''}/sta-logo.png.png`}
            alt="Street Thrift Apparel Logo" 
            className="h-20 sm:h-24 md:h-28 w-auto object-contain px-2"
            style={{maxWidth: '100%', display: 'block'}}
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
          {navigation.map((item) => {
            const isCurrentlyActive = isActive(item.href);
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`nav-item flex items-center px-4 py-3 text-sm font-medium transition-colors ${
                  isCurrentlyActive ? 'active bg-blue-50 border-l-4 border-blue-600 font-semibold text-blue-700' : 'hover:bg-gray-50 text-gray-700'
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  setSidebarOpen(false);
                  navigate(item.href);
                }}
              >
                <span className="mr-3 text-lg">{item.icon}</span>
                {item.name}
                {isCurrentlyActive && (
                  <span className="ml-auto w-2 h-2 bg-blue-600 rounded-full"></span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 w-full p-4 border-t">
          <div className="flex items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{user?.full_name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setPasswordVisibility({ old: false, new: false, confirm: false });
                  setShowPasswordModal(true);
                }}
                className="p-2 text-gray-400 hover:text-gray-600"
                title="Change Password"
              >
                🔒
              </button>
              <button
                onClick={() => setShowLogoutModal(true)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                title="Logout"
              >
                🚪
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">Confirm Logout</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to log out? You will need to sign in again to access your account.</p>
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Change Password</h2>
            
            {passwordSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm p-3 rounded mb-4">
                {passwordSuccess}
              </div>
            )}

            <form onSubmit={handlePasswordChange}>
              <fieldset disabled={passwordLoading || !!passwordSuccess}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <div className="relative">
                    <input
                      type={passwordVisibility.old ? 'text' : 'password'}
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisibility(prev => ({ ...prev, old: !prev.old }))}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                    >
                      {passwordVisibility.old ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={passwordVisibility.new ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisibility(prev => ({ ...prev, new: !prev.new }))}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                    >
                      {passwordVisibility.new ? '🙈' : '👁️'}
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Minimum {PASSWORD_REQUIREMENTS.minLength} characters with at least {PASSWORD_REQUIREMENTS.minSpecial} symbol characters (e.g. !, @, #).
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={passwordVisibility.confirm ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setPasswordVisibility(prev => ({ ...prev, confirm: !prev.confirm }))}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                    >
                      {passwordVisibility.confirm ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                {passwordError && (
                  <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-3 rounded mb-4">
                    {passwordError}
                  </div>
                )}
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordModal(false);
                      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                      setPasswordError('');
                      setPasswordVisibility({ old: false, new: false, confirm: false });
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={passwordLoading || !!passwordSuccess}
                    className={`flex-1 px-4 py-2 bg-blue-600 text-white rounded-md transition-colors ${passwordLoading || passwordSuccess ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-700'}`}
                  >
                    {passwordLoading ? 'Updating...' : 'Change Password'}
                  </button>
                </div>
              </fieldset>
            </form>
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
