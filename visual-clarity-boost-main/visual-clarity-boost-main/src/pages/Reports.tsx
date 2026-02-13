import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, TrendingUp, TrendingDown, Download, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";

const revenueOverTime = [
  { week: "W1", revenue: 28000 },
  { week: "W2", revenue: 34000 },
  { week: "W3", revenue: 31000 },
  { week: "W4", revenue: 42000 },
];

const salesByStall = [
  { stall: "Stall A", sales: 45000 },
  { stall: "Stall B", sales: 38000 },
  { stall: "Stall C", sales: 32000 },
  { stall: "Stall D", sales: 20000 },
];

const topItems = [
  { name: "Jeans", value: 35 },
  { name: "T-Shirts", value: 28 },
  { name: "Dresses", value: 20 },
  { name: "Shoes", value: 17 },
];

const COLORS = ["hsl(217, 91%, 60%)", "hsl(217, 33%, 17%)", "hsl(142, 76%, 36%)", "hsl(38, 92%, 50%)"];

export default function Reports() {
  return (
    <div className="space-y-4">
      <PageHeader title="Reports" description="Business analytics and performance">
        <Button variant="outline" size="sm"><FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel</Button>
        <Button variant="outline" size="sm"><Download className="h-3.5 w-3.5 mr-1" /> PDF</Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex gap-3">
        <Input type="date" className="w-[150px] h-9" />
        <Input type="date" className="w-[150px] h-9" />
        <Select>
          <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="All Stalls" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stalls</SelectItem>
            <SelectItem value="a">Stall A</SelectItem>
            <SelectItem value="b">Stall B</SelectItem>
            <SelectItem value="c">Stall C</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Revenue" value="KSh 135,000" change="+18% vs last month" trend="up" icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard title="Profit" value="KSh 47,250" change="+12% vs last month" trend="up" icon={<TrendingUp className="h-4 w-4" />} />
        <MetricCard title="Loss (Damaged/Missing)" value="KSh 3,200" change="-5% vs last month" trend="down" icon={<TrendingDown className="h-4 w-4" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Revenue Over Time</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="week" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(217, 91%, 60%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Sales by Stall</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesByStall}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214, 32%, 91%)" />
                  <XAxis dataKey="stall" tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(215, 16%, 47%)" />
                  <Tooltip />
                  <Bar dataKey="sales" fill="hsl(217, 33%, 17%)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top Selling Categories</CardTitle></CardHeader>
          <CardContent>
            <div className="h-56 flex items-center justify-center">
              <ResponsiveContainer width="50%" height="100%">
                <PieChart>
                  <Pie data={topItems} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {topItems.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
