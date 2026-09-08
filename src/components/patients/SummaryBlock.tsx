import React, { type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface SummaryField {
  label: string;
  value?: string | null | ReactNode;
  fallback?: string;
  action?: ReactNode;
  fullWidth?: boolean;
}

export interface SummaryBlockProps {
  title: string;
  description?: string;
  values: SummaryField[];
  badge?: ReactNode;
  headerAction?: ReactNode;
  className?: string;
}

export const SummaryBlock: React.FC<SummaryBlockProps> = ({
  title,
  description,
  values,
  badge,
  headerAction,
  className,
}) => {
  return (
    <Card className={cn("border-border/70 shadow-sm", className)}>
      <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            {badge}
          </div>
          {description ? (
            <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {headerAction ? <div>{headerAction}</div> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          {values.map((item, index) => {
            const hasValue =
              item.value !== null &&
              item.value !== undefined &&
              (typeof item.value === "string" ? item.value.trim().length > 0 : true);

            return (
              <div
                key={`${item.label}-${index}`}
                className={cn(
                  "rounded-2xl bg-muted/20 px-4 py-3 flex flex-col justify-between transition-colors hover:bg-muted/30",
                  item.fullWidth ? "md:col-span-2" : ""
                )}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {item.label}
                  </p>
                  <div className="mt-1 text-sm leading-6">
                    {hasValue ? (
                      typeof item.value === "string" || typeof item.value === "number" ? (
                        <p className="whitespace-pre-line text-foreground font-medium">{String(item.value)}</p>
                      ) : (
                        item.value
                      )
                    ) : (
                      <span className="text-muted-foreground/60 italic font-normal">
                        {item.fallback || "—"}
                      </span>
                    )}
                  </div>
                </div>
                {item.action ? (
                  <div className="mt-2.5 pt-2 border-t border-border/40">{item.action}</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
