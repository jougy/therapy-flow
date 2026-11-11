import React from "react";
import { Card } from "@/components/ui/card";

export const formatPercentage = (value: number) => `${Math.round(Number.isFinite(value) ? value : 0)}%`;

const sanitizeDashboardSegmentValue = (value: number) => (Number.isFinite(value) && value > 0 ? value : 0);

export type DashboardSegment = {
  color: string;
  label: string;
  value: number;
};

export interface DashboardProportionCardProps {
  formatSegmentValue?: (value: number) => string;
  segments: DashboardSegment[];
  subtitle: string;
  title: string;
  value: string;
}

export const DashboardProportionCard = ({
  formatSegmentValue,
  segments,
  subtitle,
  title,
  value,
}: DashboardProportionCardProps) => {
  const normalizedSegments = segments
    .map((segment) => ({ ...segment, value: sanitizeDashboardSegmentValue(segment.value) }))
    .filter((segment) => segment.value > 0);
  const total = normalizedSegments.reduce((sum, segment) => sum + segment.value, 0);
  const visibleSegments = total > 0 ? normalizedSegments : [{ color: "#d6d3d1", label: "Sem dados", value: 1 }];
  const visibleTotal = visibleSegments.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">{title}</p>
      <p className="mt-2 text-4xl font-semibold leading-none text-foreground sm:text-5xl">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-4 flex h-7 overflow-hidden rounded-full bg-muted">
        {visibleSegments.map((segment) => {
          const width = `${Math.max(4, (segment.value / visibleTotal) * 100)}%`;

          return (
            <div
              key={segment.label}
              className="h-full"
              style={{ backgroundColor: segment.color, width }}
              title={`${segment.label}: ${segment.value}`}
            />
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {normalizedSegments.length > 0 ? (
          normalizedSegments.map((segment) => (
            <span key={segment.label} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
              {segment.label}:{" "}
              {formatSegmentValue
                ? `${formatSegmentValue(segment.value)} (${formatPercentage((segment.value / total) * 100)})`
                : formatPercentage((segment.value / total) * 100)}
            </span>
          ))
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            Sem dados suficientes
          </span>
        )}
      </div>
    </Card>
  );
};
