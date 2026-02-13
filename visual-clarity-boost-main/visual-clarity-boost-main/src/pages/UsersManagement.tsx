import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";

const users = [
  { id: 1, name: "Admin User", email: "admin@thriftshop.com", role: "Admin", stall: "—", status: "Active" },
  { id: 2, name: "Jane Mwangi", email: "jane@thriftshop.com", role: "Stall Manager", stall: "Stall A", status: "Active" },
  { id: 3, name: "Peter Ochieng", email: "peter@thriftshop.com", role: "Stall Manager", stall: "Stall B", status: "Active" },
  { id: 4, name: "Mary Wanjiku", email: "mary@thriftshop.com", role: "Stall Manager", stall: "Stall C", status: "Inactive" },
];

function UserDialog({ trigger }: { trigger: React.ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Add / Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Full Name</Label>
            <Input placeholder="Full name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" placeholder="user@thriftshop.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Role</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Stall Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Assigned Stall</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Select stall" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="a">Stall A</SelectItem>
                <SelectItem value="b">Stall B</SelectItem>
                <SelectItem value="c">Stall C</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90">Save User</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersManagement() {
  return (
    <div className="space-y-4">
      <PageHeader title="Users Management" description="Manage team members and stall assignments">
        <UserDialog
          trigger={
            <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Plus className="h-3.5 w-3.5 mr-1" /> Add User
            </Button>
          }
        />
      </PageHeader>

      <Card className="border border-border">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Name</TableHead>
                <TableHead className="text-xs">Email</TableHead>
                <TableHead className="text-xs">Role</TableHead>
                <TableHead className="text-xs">Stall</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="text-sm font-medium">{user.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.role === "Admin" ? "info" : "neutral"}>
                      {user.role}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-sm">{user.stall}</TableCell>
                  <TableCell>
                    <StatusBadge status={user.status === "Active" ? "success" : "danger"}>
                      {user.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <UserDialog
                      trigger={
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-accent">
                          <Pencil className="h-3 w-3 mr-1" /> Edit
                        </Button>
                      }
                    />
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
