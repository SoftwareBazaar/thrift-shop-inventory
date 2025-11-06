import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MockAuthProvider } from './contexts/MockAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Layout from './components/Layout';
import AddItem from './pages/AddItem';
import RecordSale from './pages/RecordSale';
import CreditSales from './pages/CreditSales';
import { setupRealtime } from './services/dataService';
import { isSupabaseConfigured } from './lib/supabase';
import './App.css';

function App() {
  // Set up real-time subscriptions if Supabase is configured
  useEffect(() => {
    if (isSupabaseConfigured()) {
      console.log('🔄 Setting up real-time subscriptions...');
      
      const cleanup = setupRealtime({
        inventory: (items) => {
          // Dispatch event for inventory updates
          window.dispatchEvent(new CustomEvent('inventory-updated', { detail: items }));
        },
        sales: (sales) => {
          // Dispatch event for sales updates
          window.dispatchEvent(new CustomEvent('sales-updated', { detail: sales }));
        },
        users: (users) => {
          // Dispatch event for users updates
          window.dispatchEvent(new CustomEvent('users-updated', { detail: users }));
        }
      });

      return () => {
        console.log('🛑 Cleaning up real-time subscriptions...');
        cleanup();
      };
    } else {
      console.log('📝 Supabase not configured, using polling for data sync');
    }
  }, []);

  return (
    <ErrorBoundary>
      <MockAuthProvider>
        <Router>
          <div className="App">
            <ErrorBoundary>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                }>
                  <Route path="/dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
                  <Route path="/inventory" element={<ErrorBoundary><Inventory /></ErrorBoundary>} />
                  <Route path="/add-item" element={<ErrorBoundary><AddItem /></ErrorBoundary>} />
                  <Route path="/sales" element={<ErrorBoundary><Sales /></ErrorBoundary>} />
                  <Route path="/record-sale" element={<ErrorBoundary><RecordSale /></ErrorBoundary>} />
                  <Route path="/credit-sales" element={<ErrorBoundary><CreditSales /></ErrorBoundary>} />
                  <Route path="/reports" element={<ProtectedRoute requireAdmin><ErrorBoundary><Reports /></ErrorBoundary></ProtectedRoute>} />
                  <Route path="/users" element={<ProtectedRoute requireAdmin><ErrorBoundary><Users /></ErrorBoundary></ProtectedRoute>} />
                </Route>
              </Routes>
            </ErrorBoundary>
          </div>
        </Router>
      </MockAuthProvider>
    </ErrorBoundary>
  );
}

export default App;