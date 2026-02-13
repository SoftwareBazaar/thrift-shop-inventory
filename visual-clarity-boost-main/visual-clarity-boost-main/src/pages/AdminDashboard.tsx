import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Package, Store, ShoppingCart, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const revenueData = [
  { day: "Mon", revenue: 4200 },
  { day: "Tue", revenue: 3800 },
  { day: "Wed", revenue: 5100 },
  { day: "Thu", revenue: 4600 },
  { day: "Fri", revenue: 6200 },
  { day: "Sat", revenue: 7800 },
  { day: "Sun", revenue: 3200 },
];

const recentSales = [
  { id: 1, stall: "Stall A", items: "T-Shirts x3", amount: "KSh 1,500", payment: "Cash", time: "2:30 PM" },
  { id: 2, stall: "Stall B", items: "Jeans x1", amount: "KSh 800", payment: "M-Pesa", time: "1:45 PM" },
  { id: 3, stall: "Stall A", items: "Shoes x2", amount: "KSh 2,400", payment: "Cash", time: "12:10 PM" },
  { id: 4, stall: "Stall C", items: "Dresses x2", amount: "KSh 1,800", payment: "Credit", time: "11:30 AM" },
  { id: 5, stall: "Stall B", items: "Jackets x1", amount: "KSh 1,200", payment: "M-Pesa", time: "10:15 AM" },
];

const lowStock = [
  { item: "Men's Polo Shirts", sku: "MPS-042", qty: 3, stall: "Stall A" },
  { item: "Women's Sandals", sku: "WS-018", qty: 1, stall: "Stall B" },
  { item: "Kids Shorts", sku: "KS-091", qty: 2, stall: "Stall C" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of today's business activity" />

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value="KSh 34,900"
          change="+12.5% from yesterday"
          trend="up"
          icon={<DollarSign className="h-4 w-4" />}
        />
        <MetricCard
          title="Stock Value"
          value="KSh 245,000"
          change="-2.1% this week"
          trend="down"
          icon={<Package className="h-4 w-4" />}
        />
        <MetricCard
          title="Active Stalls"
          value="6"
          change="All operational"
          trend="flat"
          icon={<Store className="h-4 w-4" />}
        />
        <MetricCard
          title="Today's Sales"
          value="47"
          change="+8 from yesterday"
          trend="up"
          icon={<ShoppingCart className="h-4 w-4" />}
        />
      </div>

      {/* Chart + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Weekly Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                  <Tooltip />
                  <Bar dataKey="revenue" fill="hsl(217, 91%, 60%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lowStock.map((item) => (
              <div key={item.sku} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.item}</p>
                  <p className="text-xs text-muted-foreground">{item.sku} · {item.stall}</p>
                </div>
                <StatusBadge status={item.qty <= 1 ? "danger" : "warning"}>
                  {item.qty} left
                </StatusBadge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent Sales */}
      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Stall</TableHead>
                <TableHead className="text-xs">Items</TableHead>
                <TableHead className="text-xs">Amount</TableHead>
                <TableHead className="text-xs">Payment</TableHead>
                <TableHead className="text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="text-sm">{sale.stall}</TableCell>
                  <TableCell className="text-sm">{sale.items}</TableCell>
                  <TableCell className="text-sm font-medium">{sale.amount}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={sale.payment === "Cash" ? "success" : sale.payment === "Credit" ? "warning" : "info"}
                    >
                      {sale.payment}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sale.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
