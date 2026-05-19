import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Search, Plus, Minus, Trash2 } from "lucide-react";

const cartItems = [
  { id: 1, name: "Men's Polo Shirt", sku: "MPS-042", price: 500, qty: 2 },
  { id: 2, name: "Leather Belt", sku: "LB-033", price: 400, qty: 1 },
];

export default function RecordSale() {
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [isCredit, setIsCredit] = useState(false);

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Record Sale" description="Create a new sale transaction" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Item selection */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Add Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search items by name or SKU..." className="pl-9" />
              </div>

              {/* Cart items */}
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 px-3 border border-border rounded">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.sku} · KSh {item.price}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" className="h-7 w-7"><Minus className="h-3 w-3" /></Button>
                      <span className="text-sm font-medium w-6 text-center">{item.qty}</span>
                      <Button variant="outline" size="icon" className="h-7 w-7"><Plus className="h-3 w-3" /></Button>
                      <span className="text-sm font-medium w-20 text-right">KSh {item.price * item.qty}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Payment */}
          <Card className="border border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="mpesa">M-Pesa</SelectItem>
                    <SelectItem value="split">Split Payment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {paymentMethod === "mpesa" && (
                <div className="space-y-1.5">
                  <Label className="text-xs">M-Pesa Transaction Code</Label>
                  <Input placeholder="e.g. QHK7Y2M4XP" />
                </div>
              )}

              {paymentMethod === "split" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cash Amount</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">M-Pesa Amount</Label>
                    <Input type="number" placeholder="0" />
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-medium">Credit Sale</Label>
                  <p className="text-xs text-muted-foreground">Customer will pay later</p>
                </div>
                <Switch checked={isCredit} onCheckedChange={setIsCredit} />
              </div>

              {isCredit && (
                <div className="space-y-3 p-3 border border-border rounded bg-muted/30">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Customer Name</Label>
                    <Input placeholder="Full name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Phone Number</Label>
                    <Input placeholder="07XX XXX XXX" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Due Date</Label>
                    <Input type="date" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Order Summary */}
        <Card className="border border-border h-fit sticky top-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Order Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.name} x{item.qty}</span>
                <span>KSh {item.price * item.qty}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm font-semibold">
              <span>Total</span>
              <span>KSh {subtotal.toLocaleString()}</span>
            </div>
            <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 mt-2">
              Complete Sale
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
