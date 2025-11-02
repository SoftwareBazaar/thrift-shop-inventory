import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MockAuthProvider } from './contexts/MockAuthContext';
import ProtectedRoute from './components/ProtectedRoute';
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
import './App.css';

function App() {
  return (
    <MockAuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/add-item" element={<AddItem />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/record-sale" element={<RecordSale />} />
              <Route path="/credit-sales" element={<CreditSales />} />
              <Route path="/reports" element={<ProtectedRoute requireAdmin><Reports /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
            </Route>
          </Routes>
        </div>
      </Router>
    </MockAuthProvider>
  );
}

export default App;