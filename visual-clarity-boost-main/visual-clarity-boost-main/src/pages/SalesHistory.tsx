import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, FileSpreadsheet } from "lucide-react";

const salesData = [
  { id: 1, date: "2025-02-13", items: "Polo Shirt x2, Belt x1", total: "KSh 1,400", payment: "Cash", stall: "Stall A", status: "Completed" },
  { id: 2, date: "2025-02-13", items: "Jeans x1", total: "KSh 800", payment: "M-Pesa", stall: "Stall B", status: "Completed" },
  { id: 3, date: "2025-02-12", items: "Dress x2", total: "KSh 1,800", payment: "Credit", stall: "Stall C", status: "Pending" },
  { id: 4, date: "2025-02-12", items: "Sneakers x1", total: "KSh 750", payment: "Cash", stall: "Stall B", status: "Completed" },
  { id: 5, date: "2025-02-11", items: "Jacket x1, Shorts x2", total: "KSh 1,800", payment: "M-Pesa", stall: "Stall A", status: "Completed" },
  { id: 6, date: "2025-02-11", items: "Sandals x3", total: "KSh 1,950", payment: "Split", stall: "Stall C", status: "Completed" },
];

export default function SalesHistory() {
  return (
    <div className="space-y-4">
      <PageHeader title="Sales History" description="View and export past transactions">
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="h-3.5 w-3.5 mr-1" /> Excel
        </Button>
        <Button variant="outline" size="sm">
          <Download className="h-3.5 w-3.5 mr-1" /> PDF
        </Button>
      </PageHeader>

      <Card className="border border-border">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by item or customer..." className="pl-9 h-9" />
            </div>
            <Input type="date" className="w-[150px] h-9" />
            <Input type="date" className="w-[150px] h-9" />
            <Select>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Payment" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="split">Split</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-xs">Items</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs">Payment</TableHead>
                <TableHead className="text-xs">Stall</TableHead>
                <TableHead className="text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesData.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell className="text-sm text-muted-foreground">{sale.date}</TableCell>
                  <TableCell className="text-sm">{sale.items}</TableCell>
                  <TableCell className="text-sm font-medium text-right">{sale.total}</TableCell>
                  <TableCell>
                    <StatusBadge status={sale.payment === "Cash" ? "success" : sale.payment === "Credit" ? "warning" : "info"}>
                      {sale.payment}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm">{sale.stall}</TableCell>
                  <TableCell>
                    <StatusBadge status={sale.status === "Completed" ? "success" : "warning"}>
                      {sale.status}
                    </StatusBadge>
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
