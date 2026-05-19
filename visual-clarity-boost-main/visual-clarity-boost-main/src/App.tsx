import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/AppShell";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import StallDashboard from "./pages/StallDashboard";
import Inventory from "./pages/Inventory";
import RecordSale from "./pages/RecordSale";
import SalesHistory from "./pages/SalesHistory";
import CreditLedger from "./pages/CreditLedger";
import Reports from "./pages/Reports";
import UsersManagement from "./pages/UsersManagement";
import Feedback from "./pages/Feedback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<AppShell />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="stall-dashboard" element={<StallDashboard />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="record-sale" element={<RecordSale />} />
            <Route path="sales-history" element={<SalesHistory />} />
            <Route path="credit-ledger" element={<CreditLedger />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="feedback" element={<Feedback />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
