import { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { OnlineIndicator } from "./OnlineIndicator";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  CreditCard,
  BarChart3,
  Users,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Store,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const adminNav = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Inventory", icon: Package, path: "/inventory" },
  { label: "Record Sale", icon: ShoppingCart, path: "/record-sale" },
  { label: "Sales History", icon: Receipt, path: "/sales-history" },
  { label: "Credit Ledger", icon: CreditCard, path: "/credit-ledger" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Users", icon: Users, path: "/users" },
  { label: "Feedback", icon: MessageSquare, path: "/feedback" },
];

export function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-16" : "w-56"
        )}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 px-4 h-14 border-b border-sidebar-border">
          <Store className="h-5 w-5 text-sidebar-primary shrink-0" />
          {!collapsed && <span className="font-semibold text-sm truncate">Thrift Shop</span>}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {adminNav.map((item) => {
            const active = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-1.5 rounded text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between px-6 shrink-0">
          <div className="text-sm font-medium text-muted-foreground">
            Admin Panel
          </div>
          <div className="flex items-center gap-4">
            <OnlineIndicator online />
            <div className="flex items-center gap-2 text-sm">
              <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center text-xs text-primary-foreground font-medium">
                AD
              </div>
              <span className="text-foreground font-medium">Admin</span>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
