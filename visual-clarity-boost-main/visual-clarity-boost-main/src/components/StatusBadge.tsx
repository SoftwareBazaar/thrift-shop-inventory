import { cn } from "@/lib/utils";

type StatusType = "success" | "warning" | "danger" | "info" | "neutral";

interface StatusBadgeProps {
  status: StatusType;
  children: React.ReactNode;
  className?: string;
}

const statusStyles: Record<StatusType, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-accent/10 text-accent border-accent/20",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border",
        statusStyles[status],
        className
      )}
    >
      {children}
    </span>
  );
}
