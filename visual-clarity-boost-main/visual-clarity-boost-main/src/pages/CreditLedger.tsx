import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search, DollarSign } from "lucide-react";

const credits = [
  { id: 1, customer: "Jane Mwangi", phone: "0712 345 678", amount: "KSh 1,800", paid: "KSh 0", balance: "KSh 1,800", due: "2025-02-20", status: "Outstanding" },
  { id: 2, customer: "Peter Ochieng", phone: "0798 765 432", amount: "KSh 2,400", paid: "KSh 1,000", balance: "KSh 1,400", due: "2025-02-10", status: "Overdue" },
  { id: 3, customer: "Mary Wanjiku", phone: "0723 456 789", amount: "KSh 900", paid: "KSh 900", balance: "KSh 0", due: "2025-02-15", status: "Paid" },
  { id: 4, customer: "John Kamau", phone: "0701 234 567", amount: "KSh 3,200", paid: "KSh 500", balance: "KSh 2,700", due: "2025-02-08", status: "Overdue" },
  { id: 5, customer: "Alice Njeri", phone: "0745 678 901", amount: "KSh 1,500", paid: "KSh 0", balance: "KSh 1,500", due: "2025-02-25", status: "Outstanding" },
];

export default function CreditLedger() {
  return (
    <div className="space-y-4">
      <PageHeader title="Credit Sales Ledger" description="Track outstanding customer credits" />

      <Card className="border border-border">
        <CardContent className="p-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by customer name..." className="pl-9 h-9" />
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Customer</TableHead>
                <TableHead className="text-xs">Phone</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs text-right">Paid</TableHead>
                <TableHead className="text-xs text-right">Balance</TableHead>
                <TableHead className="text-xs">Due Date</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credits.map((c) => (
                <TableRow key={c.id} className={c.status === "Overdue" ? "bg-destructive/5" : ""}>
                  <TableCell className="text-sm font-medium">{c.customer}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.phone}</TableCell>
                  <TableCell className="text-sm text-right">{c.amount}</TableCell>
                  <TableCell className="text-sm text-right">{c.paid}</TableCell>
                  <TableCell className="text-sm font-medium text-right">{c.balance}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{c.due}</TableCell>
                  <TableCell>
                    <StatusBadge
                      status={c.status === "Paid" ? "success" : c.status === "Overdue" ? "danger" : "warning"}
                    >
                      {c.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {c.status !== "Paid" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <DollarSign className="h-3 w-3 mr-1" /> Record Payment
                      </Button>
                    )}
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
