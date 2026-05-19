import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

interface OnlineIndicatorProps {
  online?: boolean;
  className?: string;
}

export function OnlineIndicator({ online = true, className }: OnlineIndicatorProps) {
  return (
    <div className={cn("flex items-center gap-1.5 text-xs font-medium", className)}>
      {online ? (
        <>
          <Wifi className="h-3.5 w-3.5 text-success" />
          <span className="text-success">Online</span>
        </>
      ) : (
        <>
          <WifiOff className="h-3.5 w-3.5 text-destructive" />
          <span className="text-destructive">Offline</span>
        </>
      )}
    </div>
  );
}
