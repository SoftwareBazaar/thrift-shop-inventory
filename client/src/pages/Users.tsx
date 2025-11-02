import React, { useState, useEffect } from 'react';
import { mockApi } from '../services/mockData';

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
  location?: string;
  user_id?: number;
  manager?: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showStallModal, setShowStallModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [showEditStallModal, setShowEditStallModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingStall, setEditingStall] = useState<Stall | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    full_name: '',
    role: 'user' as 'admin' | 'user',
    stall_id: ''
  });
  const [newStall, setNewStall] = useState({
    stall_name: '',
    location: '',
    user_id: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchStalls();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await mockApi.getUsers();
      setUsers(response.users);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStalls = async () => {
    try {
      const response = await mockApi.getStalls();
      setStalls(response.stalls);
    } catch (error) {
      console.error('Error fetching stalls:', error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const stallId = newUser.stall_id ? parseInt(newUser.stall_id as any) : undefined;
      await mockApi.createUser({
        username: newUser.username,
        password: newUser.password,
        full_name: newUser.full_name,
        role: newUser.role,
        stall_id: stallId,
        status: 'active'
      });
      setShowAddModal(false);
      setNewUser({ username: '', password: '', full_name: '', role: 'user', stall_id: '' });
      fetchUsers();
      alert('User created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create user');
    }
  };

  const handleCreateStall = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Find assigned user details
      const assignedUser = newStall.user_id ? users.find(u => u.user_id === parseInt(newStall.user_id as any)) : null;
      await mockApi.createStall({
        stall_name: newStall.stall_name,
        user_id: newStall.user_id ? parseInt(newStall.user_id as any) : 0,
        location: newStall.location,
        manager: assignedUser ? assignedUser.full_name : '',
        status: 'active'
      });
      setShowStallModal(false);
      setNewStall({ stall_name: '', location: '', user_id: '' });
      fetchStalls();
      alert('Stall created successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to create stall');
    }
  };

  const toggleUserStatus = async (userId: number, currentStatus: string) => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      fetchUsers();
    } catch (error: any) {
      alert(error.response?.data?.message || 'Failed to update user status');
    }
  };

  const openEditUserModal = (user: User) => {
    setEditingUser(user);
    setShowEditUserModal(true);
  };

  const openEditStallModal = (stall: Stall) => {
    setEditingStall(stall);
    setShowEditStallModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      await mockApi.updateUser(editingUser.user_id, {
        username: editingUser.username,
        full_name: editingUser.full_name,
        role: editingUser.role,
        stall_id: editingUser.stall_id,
        status: editingUser.status
      });
      setShowEditUserModal(false);
      setEditingUser(null);
      fetchUsers();
      alert('User updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Failed to update user');
    }
  };

  const handleUpdateStall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStall) return;
    try {
      const stallData: any = { 
        stall_name: editingStall.stall_name,
        status: editingStall.status
      };
      
      // Find assigned user if exists
      const assignedUser = users.find(u => u.full_name === editingStall.assigned_user);
      if (assignedUser) {
        stallData.user_id = assignedUser.user_id;
        stallData.manager = assignedUser.full_name;
      }
      
      await mockApi.updateStall(editingStall.stall_id, stallData);
      setShowEditStallModal(false);
      setEditingStall(null);
      fetchStalls();
      alert('Stall updated successfully!');
    } catch (error: any) {
      alert(error.response?.data?.message || error.message || 'Failed to update stall');
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
      <div className="table-enhanced bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-600 to-indigo-600">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Stall
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(userItem.created_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-3">
                      <button
                        onClick={() => openEditUserModal(userItem)}
                        className="text-blue-600 hover:text-blue-900"
                        style={{ color: 'var(--primary-600)' }}
                      >
                        Edit
                      </button>
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stalls Table */}
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Stalls</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-blue-600 to-indigo-600">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Stall Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Assigned User
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {stalls.map((stall) => (
                <tr key={stall.stall_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stall.stall_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {stall.manager || stall.assigned_user || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => openEditStallModal(stall)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Edit
                    </button>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  required
                  value={newStall.location}
                  onChange={(e) => setNewStall(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Chuka Town Center, Ndagani Market"
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
                  {users.filter(u => u.role === 'user').map(user => (
                    <option key={user.user_id} value={user.user_id}>{user.full_name} ({user.stall_id ? 'Currently assigned' : 'Available'})</option>
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

      {/* Edit User Modal */}
      {showEditUserModal && editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit User</h3>
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editingUser.full_name}
                  onChange={(e) => setEditingUser({ ...editingUser, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as 'admin' | 'user' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowEditUserModal(false); setEditingUser(null); }}
                  className="px-4 py-2 hover:opacity-70"
                  style={{color: 'var(--neutral-600)'}}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Stall Modal */}
      {showEditStallModal && editingStall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Stall</h3>
            <form onSubmit={handleUpdateStall} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stall Name</label>
                <input
                  type="text"
                  required
                  value={editingStall.stall_name}
                  onChange={(e) => setEditingStall({ ...editingStall, stall_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned User</label>
                <select
                  value={editingStall.manager || editingStall.assigned_user || ''}
                  onChange={(e) => {
                    const selectedUser = users.find(u => u.full_name === e.target.value);
                    setEditingStall({ 
                      ...editingStall, 
                      manager: e.target.value,
                      assigned_user: e.target.value,
                      user_id: selectedUser?.user_id || 0
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- No user assigned --</option>
                  {users.filter(u => u.role === 'user').map((user) => (
                    <option key={user.user_id} value={user.full_name}>
                      {user.full_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => { setShowEditStallModal(false); setEditingStall(null); }}
                  className="px-4 py-2 hover:opacity-70"
                  style={{color: 'var(--neutral-600)'}}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                >
                  Save Changes
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
