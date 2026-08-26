import React, { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export interface StatusPolygonItem {
  id?: string;
  label: string;
  max?: number;
  min?: number;
  value: number;
}

export interface StatusPolygonSeries {
  color: string;
  data: Record<string, number>;
  id: string;
  name: string;
}

export interface StatusPolygonRadarProps {
  accentColor?: string;
  className?: string;
  height?: number | string;
  items?: StatusPolygonItem[];
  maxScale?: number;
  series?: StatusPolygonSeries[];
  showLegend?: boolean;
  title?: string;
}

export const StatusPolygonRadar: React.FC<StatusPolygonRadarProps> = ({
  accentColor = "#0ea5e9",
  className = "",
  height = 280,
  items = [],
  maxScale,
  series,
  showLegend = false,
  title,
}) => {
  // If multi-series mode is provided
  const isMultiSeries = Array.isArray(series) && series.length > 0;

  const chartConfig = useMemo<ChartConfig>(() => {
    if (isMultiSeries && series) {
      const config: ChartConfig = {};
      series.forEach((s) => {
        config[s.id] = {
          color: s.color,
          label: s.name,
        };
      });
      return config;
    }

    return {
      value: {
        color: accentColor,
        label: "Nível",
      },
    };
  }, [isMultiSeries, series, accentColor]);

  // Determine dynamic max scale across items or series
  const computedMax = useMemo(() => {
    if (typeof maxScale === "number" && maxScale > 0) {
      return maxScale;
    }

    let foundMax = 10;
    if (items.length > 0) {
      items.forEach((item) => {
        if (typeof item.max === "number" && item.max > 0) {
          foundMax = Math.max(foundMax, item.max);
        }
        if (typeof item.value === "number") {
          foundMax = Math.max(foundMax, item.value);
        }
      });
    }

    if (series) {
      series.forEach((s) => {
        Object.values(s.data).forEach((v) => {
          if (typeof v === "number") {
            foundMax = Math.max(foundMax, v);
          }
        });
      });
    }

    return foundMax > 0 ? foundMax : 10;
  }, [maxScale, items, series]);

  // Prepare recharts data
  const data = useMemo(() => {
    if (isMultiSeries && series) {
      // Collect all attribute labels from items or series keys
      const labelSet = new Set<string>();
      items.forEach((item) => labelSet.add(item.label));
      series.forEach((s) => {
        Object.keys(s.data).forEach((k) => labelSet.add(k));
      });

      return Array.from(labelSet).map((label) => {
        const row: Record<string, unknown> = { attribute: label };
        series.forEach((s) => {
          row[s.id] = typeof s.data[label] === "number" ? s.data[label] : 0;
        });
        return row;
      });
    }

    return items.map((item) => ({
      attribute: item.label,
      fullMark: item.max ?? computedMax,
      value: typeof item.value === "number" && Number.isFinite(item.value) ? item.value : 0,
    }));
  }, [isMultiSeries, series, items, computedMax]);

  if (items.length === 0 && (!series || series.length === 0)) {
    return (
      <div className={`flex flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground ${className}`}>
        <p className="font-medium">Nenhum atributo no polígono</p>
        <p className="mt-1 text-xs">Adicione campos numéricos ou slidebars para criar os vértices do polígono.</p>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col items-center justify-center ${className}`}>
      {title && <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>}

      <ChartContainer config={chartConfig} className="w-full" style={{ height: typeof height === "number" ? `${height}px` : height }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="72%" data={data}>
            <PolarGrid gridType="polygon" stroke="currentColor" strokeOpacity={0.15} />
            <PolarAngleAxis
              dataKey="attribute"
              tick={{ fill: "currentColor", fontSize: 11, fontWeight: 500, opacity: 0.8 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, computedMax]}
              tick={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />

            {isMultiSeries && series ? (
              series.map((s, idx) => (
                <Radar
                  key={s.id}
                  name={s.name}
                  dataKey={s.id}
                  stroke={s.color}
                  fill={s.color}
                  fillOpacity={0.2 + idx * 0.1}
                  strokeWidth={2}
                  dot={{ fill: s.color, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))
            ) : (
              <Radar
                name="Nível"
                dataKey="value"
                stroke={accentColor}
                fill={accentColor}
                fillOpacity={0.35}
                strokeWidth={2.5}
                dot={{ fill: accentColor, r: 3.5 }}
                activeDot={{ r: 6 }}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>
      </ChartContainer>

      {showLegend && isMultiSeries && series && (
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-xs">
          {series.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-muted-foreground">{s.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
