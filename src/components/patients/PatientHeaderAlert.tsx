import type { ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";

export interface PatientHeaderAlertProps {
  icon: ReactNode;
  items: string[];
  tone: "amber" | "rose";
  title: string;
  size?: "sm" | "md";
}

export const PatientHeaderAlert = ({
  icon,
  items,
  tone,
  title,
  size = "md",
}: PatientHeaderAlertProps) => {
  if (items.length === 0) {
    return null;
  }

  const toneClassName =
    tone === "rose"
      ? "border-rose-300 bg-rose-50/90 text-rose-700 hover:bg-rose-100/90 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-300"
      : "border-amber-300 bg-amber-50/90 text-amber-800 hover:bg-amber-100/90 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-300";

  const sizeClassName =
    size === "sm"
      ? "px-2.5 py-1 text-xs gap-1.5"
      : "px-3 py-1.5 text-sm gap-1.5";

  return (
    <HoverCard openDelay={80} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center rounded-full border font-medium shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none ${sizeClassName} ${toneClassName}`}
          aria-label={`${title} (${items.length})`}
        >
          {icon}
          <span>{title}</span>
          <Badge
            variant="secondary"
            className="ml-0.5 h-4.5 min-w-4.5 justify-center rounded-full px-1 text-[10px] font-bold bg-background/80"
          >
            {items.length}
          </Badge>
        </button>
      </HoverCardTrigger>
      <HoverCardContent
        align="start"
        sideOffset={6}
        className="w-72 p-3 shadow-lg z-50 pointer-events-auto"
      >
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
            {icon}
            <span>{title} ({items.length})</span>
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground max-h-60 overflow-y-auto">
            {items.map((item, index) => (
              <li key={`${item}-${index}`} className="rounded-md bg-muted/60 px-2.5 py-1.5 font-medium text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};
