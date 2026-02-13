import { MetricCard } from "@/components/MetricCard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { DollarSign, Package, ShoppingCart, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";

const inventoryHealth = [
  { category: "Tops", inStock: 45, low: 3, out: 1 },
  { category: "Bottoms", inStock: 32, low: 5, out: 0 },
  { category: "Shoes", inStock: 18, low: 2, out: 2 },
  { category: "Accessories", inStock: 60, low: 0, out: 0 },
];

export default function StallDashboard() {
  return (
    <div className="space-y-6">
      <PageHeader title="Stall A — Dashboard" description="Your stall's daily overview">
        <Link to="/record-sale">
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <ShoppingCart className="h-4 w-4 mr-1" /> Record Sale
          </Button>
        </Link>
        <Link to="/inventory">
          <Button variant="outline">
            <Package className="h-4 w-4 mr-1" /> View Inventory
          </Button>
        </Link>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard title="Today's Sales" value="KSh 8,400" change="+15% from yesterday" trend="up" icon={<DollarSign className="h-4 w-4" />} />
        <MetricCard title="Items Sold" value="23" change="+5 from yesterday" trend="up" icon={<ShoppingCart className="h-4 w-4" />} />
        <MetricCard title="Low Stock Items" value="10" change="Action needed" trend="down" icon={<AlertTriangle className="h-4 w-4" />} />
      </div>

      <Card className="border border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Inventory Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {inventoryHealth.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm font-medium">{cat.category}</span>
                <div className="flex gap-2">
                  <StatusBadge status="success">{cat.inStock} in stock</StatusBadge>
                  {cat.low > 0 && <StatusBadge status="warning">{cat.low} low</StatusBadge>}
                  {cat.out > 0 && <StatusBadge status="danger">{cat.out} out</StatusBadge>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
