import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

export default function Feedback() {
  return (
    <div className="space-y-4">
      <PageHeader title="Feedback" description="Customer and staff feedback" />
      <Card className="border border-border">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          Feedback module — coming soon.
        </CardContent>
      </Card>
    </div>
  );
}
