import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "flat";
  icon?: React.ReactNode;
  className?: string;
}

export function MetricCard({ title, value, change, trend = "flat", icon, className }: MetricCardProps) {
  return (
    <Card className={cn("border border-border", className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
          {icon && <div className="text-muted-foreground">{icon}</div>}
        </div>
        <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
        {change && (
          <div className="flex items-center gap-1 mt-1">
            {trend === "up" && <TrendingUp className="h-3 w-3 text-success" />}
            {trend === "down" && <TrendingDown className="h-3 w-3 text-destructive" />}
            {trend === "flat" && <Minus className="h-3 w-3 text-muted-foreground" />}
            <span
              className={cn(
                "text-xs font-medium",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                trend === "flat" && "text-muted-foreground"
              )}
            >
              {change}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
