import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface User {
  user_id: number;
  username: string;
  full_name: string;
  role: 'admin' | 'user';
  stall_id?: number;
  status: string;
  created_date: string;
  stall_name?: string;
}

interface Stall {
  stall_id: number;
  stall_name: string;
  status: string;
  assigned_user?: string;
  username?: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStallModal, setShowStallModal] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'user' as 'admin' | 'user',
    stall_id: ''
  });
  const [newStall, setNewStall] = useState({
    stall_name: '',
    user_id: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchStalls();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStalls = async () => {
    try {
      const response = await axios.get('/api/users/stalls/list');
      setStalls(response.data.stalls);
    } catch (error) {
      console.error('Error fetching stalls:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/auth/register', {
        ...newUser,
        stall_id: newUser.stall_id ? parseInt(newUser.stall_id) : null
      });
      setShowAddModal(false);
      setNewUser({ username: '', password: '', full_name: '', role: 'user', stall_id: '' });
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleCreateStall = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('/api/users/stalls', {
        ...newStall,
        user_id: newStall.user_id ? parseInt(newStall.user_id) : null
      });
      setShowStallModal(false);
      setNewStall({ stall_name: '', user_id: '' });
      fetchStalls();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create stall');
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: string) => {
    try {
      await axios.put(`/api/users/${userId}`, {
        status: currentStatus === 'active' ? 'inactive' : 'active'
      });
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update user status');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold" style={{color: 'var(--primary-800)'}}>User Management</h1>
          <p style={{color: 'var(--neutral-600)'}}>Manage users and stalls</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-primary"
          >
            Add User
          </button>
          <button
            onClick={() => setShowStallModal(true)}
            className="btn-accent"
          >
            Add Stall
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-enhanced">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y" style={{borderColor: 'var(--neutral-200)'}}>
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Stall
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((userItem) => (
                <tr key={userItem.user_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{userItem.full_name}</div>
                      <div className="text-sm text-gray-500">{userItem.username}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      userItem.role === 'admin' 
                        ? 'status-info' 
                        : 'status-info'
                    }`}>
                      {userItem.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm" style={{color: 'var(--neutral-700)'}}>
                    {userItem.stall_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      userItem.status === 'active' 
                        ? 'status-success' 
                        : 'status-error'
                    }`}>
                      {userItem.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(userItem.created_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => toggleUserStatus(userItem.user_id, userItem.status)}
                      className={`hover:opacity-70 ${
                        userItem.status === 'active' 
                          ? 'text-red-600 hover:text-red-900' 
                          : 'text-green-600 hover:text-green-900'
                      }`}
                      style={{
                        color: userItem.status === 'active' ? 'var(--error)' : 'var(--success)'
                      }}
                    >
                      {userItem.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stalls Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Stalls</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stall Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stalls.map((stall) => (
                <tr key={stall.stall_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stall.stall_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stall.assigned_user || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      stall.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {stall.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={newUser.full_name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, full_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value as 'admin' | 'user' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stall (Optional)</label>
                <select
                  value={newUser.stall_id}
                  onChange={(e) => setNewUser(prev => ({ ...prev, stall_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No stall assigned</option>
                  {stalls.map(stall => (
                    <option key={stall.stall_id} value={stall.stall_id}>{stall.stall_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 hover:opacity-70"
                  style={{color: 'var(--neutral-600)'}}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stall Modal */}
      {showStallModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Stall</h3>
            <form onSubmit={handleCreateStall} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stall Name</label>
                <input
                  type="text"
                  required
                  value={newStall.stall_name}
                  onChange={(e) => setNewStall(prev => ({ ...prev, stall_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assign User (Optional)</label>
                <select
                  value={newStall.user_id}
                  onChange={(e) => setNewStall(prev => ({ ...prev, user_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No user assigned</option>
                  {users.filter(u => u.role === 'user' && !u.stall_id).map(user => (
                    <option key={user.user_id} value={user.user_id}>{user.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowStallModal(false)}
                  className="px-4 py-2 hover:opacity-70"
                  style={{color: 'var(--neutral-600)'}}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent"
                >
                  Create Stall
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
