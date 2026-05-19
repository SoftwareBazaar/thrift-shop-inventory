

# Thrift Shop Management System — UI/UX Templates

## Overview
Create professional, data-heavy UI templates for a Thrift Shop management system using a **Navy/Blue** color palette with a **utilitarian, enterprise-style** design. These pages will serve as visual references to adapt into the existing CRA codebase.

**Design principles:** Dense data display, functional layouts, clear typography hierarchy, minimal decorative elements. No AI-themed aesthetics — just clean, business software.

---

## Color System
- **Primary:** Deep Navy (#1e293b / slate-800 range)
- **Accent:** Blue (#3b82f6) for actions and highlights
- **Success/Warning/Danger:** Green, Amber, Red for status indicators
- **Backgrounds:** Light grays and whites for data-dense readability

---

## Pages to Build

### 1. Login Page
- Centered card with logo/brand area, email & password fields
- "Stay Logged In" checkbox, clean form validation states
- Minimal branding — no splash imagery, just professional and fast

### 2. App Shell / Layout
- **Fixed sidebar** with icon + text navigation, collapsible to icon-only
- Sections: Dashboard, Inventory, Sales, Credit Ledger, Reports, Users, Feedback
- **Top header bar** with user info, online/offline status indicator, and logout
- Role-based menu items (Admin vs Stall Manager)

### 3. Admin Dashboard
- **Metric cards row:** Total Revenue, Stock Value, Active Stalls, Today's Sales — each with trend indicators
- **Revenue chart** (recharts line/bar chart) with date range selector
- **Recent Sales table** — compact, sortable, showing stall, amount, payment type, time
- **Low Stock Alerts** section

### 4. User/Stall Dashboard
- Same card layout but filtered to the assigned stall
- Today's sales summary, inventory health at-a-glance
- Quick action buttons: Record Sale, View Inventory

### 5. Inventory Page
- **Search bar + filters** (category, stall, stock status)
- **Dense data table** with columns: Item, SKU, Category, Qty, Price, Stall, Status
- Inline status badges (In Stock, Low, Out)
- Action buttons: Add Item, Distribute to Stall, Edit, bulk actions
- Admin vs User mode toggles visibility of certain actions

### 6. Record Sale Page
- Clean form layout: item search/select, quantity, pricing auto-calc
- **Payment method selector:** Cash / Mobile / Split with appropriate fields
- **Credit sale toggle** expanding customer contact and due date fields
- Order summary sidebar/section with totals

### 7. Sales History Page
- Filterable table: Date, Items, Total, Payment Type, Stall, Status
- Date range picker, search by item/customer
- Export buttons (Excel, PDF)

### 8. Credit Sales Ledger
- Table of outstanding credits: Customer, Amount Owed, Due Date, Status
- Overdue highlighting in red
- Action to record partial payments with payment history per entry

### 9. Reports Page (Admin)
- Date range and stall selectors
- Summary cards: Revenue, Profit, Loss
- Charts: Revenue over time, sales by stall, top items
- Export to Excel/PDF buttons

### 10. Users Management (Admin)
- Table of users: Name, Role, Assigned Stall, Status
- Add/Edit user dialog with role selection and stall assignment

---

## Shared Components
- **Offline/Online indicator** badge in the header
- **Consistent table component** with sorting, pagination, and responsive scroll
- **Form patterns** with validation states and clear labels
- **Status badges** with semantic colors
- **Page headers** with breadcrumbs and action buttons

