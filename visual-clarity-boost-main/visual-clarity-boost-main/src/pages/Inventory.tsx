import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, ArrowUpDown, Search, Filter } from "lucide-react";

const inventoryData = [
  { id: 1, item: "Men's Polo Shirt", sku: "MPS-042", category: "Tops", qty: 3, price: "KSh 500", stall: "Stall A", status: "Low" },
  { id: 2, item: "Women's Jeans", sku: "WJ-115", category: "Bottoms", qty: 24, price: "KSh 800", stall: "Stall B", status: "In Stock" },
  { id: 3, item: "Kids Shorts", sku: "KS-091", category: "Bottoms", qty: 2, price: "KSh 300", stall: "Stall C", status: "Low" },
  { id: 4, item: "Women's Sandals", sku: "WS-018", category: "Shoes", qty: 0, price: "KSh 650", stall: "Stall B", status: "Out" },
  { id: 5, item: "Leather Belt", sku: "LB-033", category: "Accessories", qty: 15, price: "KSh 400", stall: "Stall A", status: "In Stock" },
  { id: 6, item: "Denim Jacket", sku: "DJ-072", category: "Tops", qty: 8, price: "KSh 1,200", stall: "Stall C", status: "In Stock" },
  { id: 7, item: "Summer Dress", sku: "SD-056", category: "Dresses", qty: 12, price: "KSh 900", stall: "Stall A", status: "In Stock" },
  { id: 8, item: "Canvas Sneakers", sku: "CS-089", category: "Shoes", qty: 1, price: "KSh 750", stall: "Stall B", status: "Low" },
];

const statusMap: Record<string, "success" | "warning" | "danger"> = {
  "In Stock": "success",
  "Low": "warning",
  "Out": "danger",
};

export default function Inventory() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" description="Manage stock across all stalls">
        <Button variant="outline" size="sm">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Distribute
        </Button>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Item
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card className="border border-border">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select>
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="tops">Tops</SelectItem>
                <SelectItem value="bottoms">Bottoms</SelectItem>
                <SelectItem value="shoes">Shoes</SelectItem>
                <SelectItem value="accessories">Accessories</SelectItem>
                <SelectItem value="dresses">Dresses</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Stall" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stalls</SelectItem>
                <SelectItem value="a">Stall A</SelectItem>
                <SelectItem value="b">Stall B</SelectItem>
                <SelectItem value="c">Stall C</SelectItem>
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="in-stock">In Stock</SelectItem>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="out">Out</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"><Checkbox /></TableHead>
                <TableHead className="text-xs">Item</TableHead>
                <TableHead className="text-xs">SKU</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs text-right">Qty</TableHead>
                <TableHead className="text-xs text-right">Price</TableHead>
                <TableHead className="text-xs">Stall</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventoryData.map((row) => (
                <TableRow key={row.id}>
                  <TableCell><Checkbox /></TableCell>
                  <TableCell className="text-sm font-medium">{row.item}</TableCell>
                  <TableCell className="text-sm text-muted-foreground font-mono">{row.sku}</TableCell>
                  <TableCell className="text-sm">{row.category}</TableCell>
                  <TableCell className="text-sm text-right">{row.qty}</TableCell>
                  <TableCell className="text-sm text-right">{row.price}</TableCell>
                  <TableCell className="text-sm">{row.stall}</TableCell>
                  <TableCell>
                    <StatusBadge status={statusMap[row.status]}>{row.status}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-accent">Edit</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
