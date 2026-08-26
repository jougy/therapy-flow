import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart as RechartsPieChart,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowLeft, BarChart3, ClipboardEdit, ClipboardList, FileText, Hexagon, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { StatusPolygonRadar } from "@/components/anamnesis/StatusPolygonRadar";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { toast } from "@/hooks/use-toast";
import { fetchPatientByRef, getPatientPath } from "@/lib/patient-routing";
import { isAnamnesisTemplateSchema, type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import {
  buildPatientAnamnesisDashboard,
  type PatientAnamnesisChartType,
  type PatientAnamnesisDashboard,
  type PatientAnamnesisDashboardMetric,
  type PatientAnamnesisDashboardSession,
  type PatientAnamnesisDashboardTemplate,
} from "@/lib/patient-anamnesis-dashboard";

type Patient = Pick<Database["public"]["Tables"]["patients"]["Row"], "age" | "id" | "name" | "phone" | "registration_complete">;
type TemplateRow = Pick<Database["public"]["Tables"]["anamnesis_form_templates"]["Row"], "id" | "name" | "schema">;

const chartConfig = {
  value: {
    color: "#0ea5e9",
    label: "Respostas",
  },
} satisfies ChartConfig;

const chartLabels: Record<PatientAnamnesisChartType, string> = {
  area: "Área",
  bar: "Barras",
  line: "Linha",
  pie: "Pizza",
  proportion: "Proporção",
  radar: "Polígono (Radar)",
};

const formatNumber = (value: number | undefined) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
};

const buildNumberDistribution = (metric: PatientAnamnesisDashboardMetric) => {
  const counts = new Map<string, { label: string; value: number }>();

  (metric.numberData ?? []).forEach((point) => {
    const label = formatNumber(point.value);
    const current = counts.get(label) ?? { label, value: 0 };
    counts.set(label, { ...current, value: current.value + 1 });
  });

  return Array.from(counts.values())
    .sort((left, right) => Number(left.label.replace(",", ".")) - Number(right.label.replace(",", ".")))
    .map((item, index) => ({
      color: ["#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#64748b", "#ec4899"][index % 8],
      id: item.label,
      label: item.label,
      value: item.value,
    }));
};

const getStorageKey = (clinicId: string | null | undefined, patientId: string | undefined) =>
  clinicId && patientId ? `therapy-flow:patient-anamnesis-dashboard:v1:${clinicId}:${patientId}` : null;

const readChartPreferences = (storageKey: string | null) => {
  if (!storageKey || typeof window === "undefined") {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, PatientAnamnesisChartType>
      : {};
  } catch {
    return {};
  }
};

const getMetricChart = (
  metric: PatientAnamnesisDashboardMetric,
  preferences: Record<string, PatientAnamnesisChartType>,
) => {
  const preferred = preferences[metric.key];
  return preferred && metric.allowedCharts.includes(preferred) ? preferred : metric.defaultChart;
};

const MetricStats = ({ metric }: { metric: PatientAnamnesisDashboardMetric }) => {
  if (metric.isRadarGroup) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Atendimentos</p>
            <p className="font-semibold">{metric.count}</p>
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Média Geral</p>
            <p className="font-semibold">{formatNumber(metric.average)}</p>
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Mínimo</p>
            <p className="font-semibold">{formatNumber(metric.min)}</p>
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Máximo</p>
            <p className="font-semibold">{formatNumber(metric.max)}</p>
          </div>
        </div>
        {metric.radarItems && metric.radarItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {metric.radarItems.map((item, idx) => (
              <span
                key={item.id}
                className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2.5 py-1 text-xs"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      metric.seriesKeys?.[idx]?.color ??
                      ["#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#64748b", "#ec4899"][idx % 8],
                  }}
                />
                <span className="font-medium text-muted-foreground">{item.label}:</span>
                <span className="font-bold text-foreground">{item.value}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (metric.kind !== "number") {
    return (
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-muted/30 px-3 py-2">
          <p className="text-xs text-muted-foreground">Respostas</p>
          <p className="font-semibold">{metric.count}</p>
        </div>
        {metric.kind === "table" ? (
          <div className="rounded-lg bg-muted/30 px-3 py-2">
            <p className="text-xs text-muted-foreground">Linhas</p>
            <p className="font-semibold">{metric.tableRowCount ?? 0}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
      <div className="rounded-lg bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">Respostas</p>
        <p className="font-semibold">{metric.count}</p>
      </div>
      <div className="rounded-lg bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">Média</p>
        <p className="font-semibold">{formatNumber(metric.average)}</p>
      </div>
      <div className="rounded-lg bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">Mínimo</p>
        <p className="font-semibold">{formatNumber(metric.min)}</p>
      </div>
      <div className="rounded-lg bg-muted/30 px-3 py-2">
        <p className="text-xs text-muted-foreground">Máximo</p>
        <p className="font-semibold">{formatNumber(metric.max)}</p>
      </div>
    </div>
  );
};

const MetricChart = ({
  chart,
  metric,
}: {
  chart: PatientAnamnesisChartType;
  metric: PatientAnamnesisDashboardMetric;
}) => {
  // Handle aggregated radar section (status polygon & multi-series)
  if (metric.isRadarGroup) {
    if (chart === "radar") {
      return (
        <StatusPolygonRadar
          series={metric.radarSeries}
          items={metric.radarItems}
          showLegend={true}
          height={280}
        />
      );
    }

    const multiConfig: ChartConfig = {};
    (metric.seriesKeys ?? []).forEach((key) => {
      multiConfig[key.id] = {
        color: key.color,
        label: key.label,
      };
    });

    if (chart === "bar") {
      return (
        <div className="space-y-4">
          <ChartContainer config={multiConfig} className="h-64 w-full sm:h-72">
            <BarChart data={metric.multiSeriesData} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {(metric.seriesKeys ?? []).map((key) => (
                <Bar key={key.id} dataKey={key.id} name={key.label} fill={key.color} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          </ChartContainer>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-1">
            {(metric.seriesKeys ?? []).map((key) => (
              <div key={key.id} className="flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: key.color }} />
                <span className="text-muted-foreground">{key.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (chart === "area") {
      return (
        <div className="space-y-4">
          <ChartContainer config={multiConfig} className="h-64 w-full sm:h-72">
            <AreaChart data={metric.multiSeriesData} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              {(metric.seriesKeys ?? []).map((key) => (
                <Area
                  key={key.id}
                  type="monotone"
                  dataKey={key.id}
                  name={key.label}
                  stroke={key.color}
                  fill={key.color}
                  fillOpacity={0.2}
                />
              ))}
            </AreaChart>
          </ChartContainer>
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-1">
            {(metric.seriesKeys ?? []).map((key) => (
              <div key={key.id} className="flex items-center gap-1.5 font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: key.color }} />
                <span className="text-muted-foreground">{key.label}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (chart === "proportion" || chart === "pie") {
      const categoryData = metric.categoryData ?? [];
      const total = categoryData.reduce((sum, item) => sum + item.value, 0);

      if (chart === "pie") {
        return (
          <ChartContainer config={multiConfig} className="h-64 w-full sm:h-72">
            <RechartsPieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              <Pie data={categoryData} dataKey="value" nameKey="label" innerRadius={48} outerRadius={88} paddingAngle={2}>
                {categoryData.map((item) => (
                  <Cell key={item.id} fill={item.color} />
                ))}
              </Pie>
            </RechartsPieChart>
          </ChartContainer>
        );
      }

      return (
        <div className="space-y-4">
          <div className="flex h-8 overflow-hidden rounded-full bg-muted">
            {categoryData.map((item) => {
              const percent = total > 0 ? (item.value / total) * 100 : 0;
              return (
                <div
                  key={item.id}
                  className="h-full min-w-1 transition-all"
                  style={{
                    backgroundColor: item.color,
                    width: `${Math.max(percent, item.value > 0 ? 2 : 0)}%`,
                  }}
                  title={`${item.label}: ${item.value} (${Math.round(percent)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {categoryData.map((item) => {
              const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <span key={item.id} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>
                    {item.label}: {item.value} ({percent}%)
                  </span>
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    // Default to multi-line chart
    return (
      <div className="space-y-4">
        <ChartContainer config={multiConfig} className="h-64 w-full sm:h-72">
          <LineChart data={metric.multiSeriesData} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            {(metric.seriesKeys ?? []).map((key) => (
              <Line
                key={key.id}
                type="monotone"
                dataKey={key.id}
                name={key.label}
                stroke={key.color}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        </ChartContainer>
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs pt-1">
          {(metric.seriesKeys ?? []).map((key) => (
            <div key={key.id} className="flex items-center gap-1.5 font-medium">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: key.color }} />
              <span className="text-muted-foreground">{key.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (metric.kind === "number" && metric.numberData) {
    if (chart === "proportion" || chart === "pie") {
      const distributionData = buildNumberDistribution(metric);
      const total = distributionData.reduce((sum, item) => sum + item.value, 0);

      if (chart === "pie") {
        return (
          <ChartContainer config={chartConfig} className="h-56 w-full sm:h-64">
            <RechartsPieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
              <Pie data={distributionData} dataKey="value" nameKey="label" innerRadius={48} outerRadius={88} paddingAngle={2}>
                {distributionData.map((item) => (
                  <Cell key={item.id} fill={item.color} />
                ))}
              </Pie>
            </RechartsPieChart>
          </ChartContainer>
        );
      }

      return (
        <div className="space-y-4">
          <div className="flex h-8 overflow-hidden rounded-full bg-muted">
            {distributionData.map((item) => {
              const percent = total > 0 ? (item.value / total) * 100 : 0;

              return (
                <div
                  key={item.id}
                  className="h-full min-w-1 transition-all"
                  style={{
                    backgroundColor: item.color,
                    width: `${Math.max(percent, item.value > 0 ? 2 : 0)}%`,
                  }}
                  title={`${item.label}: ${item.value} (${Math.round(percent)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {distributionData.map((item) => {
              const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;

              return (
                <span key={item.id} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.label}: {item.value} ({percent}%)</span>
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    if (chart === "bar") {
      return (
        <ChartContainer config={chartConfig} className="h-56 w-full sm:h-64">
          <BarChart data={metric.numberData} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartContainer>
      );
    }

    if (chart === "area") {
      return (
        <ChartContainer config={chartConfig} className="h-56 w-full sm:h-64">
          <AreaChart data={metric.numberData} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area type="monotone" dataKey="value" stroke="var(--color-value)" fill="var(--color-value)" fillOpacity={0.28} />
          </AreaChart>
        </ChartContainer>
      );
    }

    return (
      <ChartContainer config={chartConfig} className="h-56 w-full sm:h-64">
        <LineChart data={metric.numberData} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2.5} dot />
        </LineChart>
      </ChartContainer>
    );
  }

  if (metric.kind === "category" && metric.categoryData) {
    if (chart === "proportion") {
      const total = metric.categoryData.reduce((sum, item) => sum + item.value, 0);

      return (
        <div className="space-y-4">
          <div className="flex h-8 overflow-hidden rounded-full bg-muted">
            {metric.categoryData.map((item) => {
              const percent = total > 0 ? (item.value / total) * 100 : 0;

              return (
                <div
                  key={item.id}
                  className="h-full min-w-1 transition-all"
                  style={{
                    backgroundColor: item.color,
                    width: `${Math.max(percent, item.value > 0 ? 2 : 0)}%`,
                  }}
                  title={`${item.label}: ${item.value} (${Math.round(percent)}%)`}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            {metric.categoryData.map((item) => {
              const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;

              return (
                <span key={item.id} className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span>{item.label}: {item.value} ({percent}%)</span>
                </span>
              );
            })}
          </div>
        </div>
      );
    }

    if (chart === "pie") {
      return (
        <ChartContainer config={chartConfig} className="h-56 w-full sm:h-64">
          <RechartsPieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <Pie data={metric.categoryData} dataKey="value" nameKey="label" innerRadius={48} outerRadius={88} paddingAngle={2}>
              {metric.categoryData.map((item) => (
                <Cell key={item.id} fill={item.color} />
              ))}
            </Pie>
          </RechartsPieChart>
        </ChartContainer>
      );
    }

    return (
      <ChartContainer config={chartConfig} className="h-56 w-full sm:h-64">
        <BarChart data={metric.categoryData} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {metric.categoryData.map((item) => (
              <Cell key={item.id} fill={item.color} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    );
  }

  if (metric.kind === "text" || metric.kind === "date") {
    return (
      <div className="space-y-3">
        {(metric.textEntries ?? []).map((entry) => (
          <div key={`${entry.sessionId}-${entry.value}`} className="rounded-lg border bg-muted/20 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">{entry.label}</p>
            <p className="mt-1 line-clamp-4 whitespace-pre-line text-sm leading-6">{entry.value}</p>
          </div>
        ))}
      </div>
    );
  }

  if (metric.kind === "table") {
    return (
      <div className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        Tabela registrada em {metric.count} atendimento{metric.count !== 1 ? "s" : ""}, com {metric.tableRowCount ?? 0} linha{metric.tableRowCount !== 1 ? "s" : ""} preenchida{metric.tableRowCount !== 1 ? "s" : ""}.
      </div>
    );
  }

  return null;
};

const MetricCard = ({
  metric,
  onChartChange,
  selectedChart,
}: {
  metric: PatientAnamnesisDashboardMetric;
  onChartChange: (metricKey: string, chart: PatientAnamnesisChartType) => void;
  selectedChart: PatientAnamnesisChartType;
}) => (
  <Card className="min-w-0 overflow-hidden">
    <CardHeader className="gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
      <div className="min-w-0 space-y-1">
        <CardTitle className="break-words text-base leading-snug">{metric.fieldLabel}</CardTitle>
        <CardDescription>
          {metric.kind === "number" ? "Evolução numérica" : metric.kind === "category" ? "Distribuição de respostas" : metric.kind === "text" ? "Últimas respostas" : metric.kind === "date" ? "Datas registradas" : "Resumo da tabela"}
        </CardDescription>
      </div>
      {metric.allowedCharts.length > 1 ? (
        <Select value={selectedChart} onValueChange={(value) => onChartChange(metric.key, value as PatientAnamnesisChartType)}>
          <SelectTrigger className="h-10 w-full shrink-0 sm:w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {metric.allowedCharts.map((chart) => (
              <SelectItem key={chart} value={chart}>{chartLabels[chart]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </CardHeader>
    <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
      <MetricStats metric={metric} />
      <MetricChart chart={selectedChart} metric={metric} />
    </CardContent>
  </Card>
);

export const PatientAnamnesisDashboardContent = ({
  chartPreferences,
  dashboard,
  onChartChange,
  onSelectedTemplateIdChange,
  selectedTemplateId,
}: {
  chartPreferences: Record<string, PatientAnamnesisChartType>;
  dashboard: PatientAnamnesisDashboard;
  onChartChange: (metricKey: string, chart: PatientAnamnesisChartType) => void;
  onSelectedTemplateIdChange: (templateId: string) => void;
  selectedTemplateId: string;
}) => {
  const visibleGroups = selectedTemplateId === "all"
    ? dashboard.groups
    : dashboard.groups.filter((group) => group.templateId === selectedTemplateId);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <CardTitle className="text-lg">Fichas analisadas</CardTitle>
            <CardDescription>Todo o histórico do paciente, incluindo rascunhos e atendimentos concluídos.</CardDescription>
          </div>
          <Select value={selectedTemplateId} onValueChange={onSelectedTemplateIdChange}>
            <SelectTrigger className="h-10 w-full shrink-0 sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as fichas</SelectItem>
              {dashboard.groups.map((group) => (
                <SelectItem key={group.key} value={group.templateId}>{group.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
      </Card>

      {visibleGroups.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-10 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhuma resposta de anamnese encontrada.</p>
            <p className="mt-1 text-sm text-muted-foreground">Quando houver fichas preenchidas, os gráficos aparecerão automaticamente aqui.</p>
          </CardContent>
        </Card>
      ) : (
        visibleGroups.map((group) => (
          <section key={group.key} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
            </div>
            {group.sections.map((section) => (
              <div key={section.key} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{section.title}</h3>
                <div className="grid min-w-0 gap-4 xl:grid-cols-2">
                  {section.metrics.map((metric) => (
                    <MetricCard
                      key={metric.key}
                      metric={metric}
                      selectedChart={getMetricChart(metric, chartPreferences)}
                      onChartChange={onChartChange}
                    />
                  ))}
                </div>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
};

const PacienteAnamnesisDashboard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clinic, clinicId } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const storageKey = getStorageKey(clinicId, id);
  const [baseSchema, setBaseSchema] = useState<AnamnesisTemplateSchema>([]);
  const [chartPreferences, setChartPreferences] = useState<Record<string, PatientAnamnesisChartType>>({});
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("all");
  const [sessions, setSessions] = useState<PatientAnamnesisDashboardSession[]>([]);
  const [templates, setTemplates] = useState<PatientAnamnesisDashboardTemplate[]>([]);

  useEffect(() => {
    setChartPreferences(readChartPreferences(storageKey));
  }, [storageKey]);

  const fetchData = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);

    try {
      const patientRes = await fetchPatientByRef(id, clinicId);
      if (patientRes.error || !patientRes.data) {
        toast({ title: "Erro", description: "Paciente não encontrado.", variant: "destructive" });
        navigate(clinicHomePath);
        return;
      }

      const realPatientId = patientRes.data.id;
      const [clinicRes, sessionsRes, templatesRes] = await Promise.all([
        clinicId ? supabase.from("clinics").select("anamnesis_base_schema").eq("id", clinicId).single() : Promise.resolve({ data: null, error: null }),
        supabase
          .from("sessions")
          .select("id, anamnesis, anamnesis_form_response, anamnesis_template_id, complexity_score, pain_score, session_date, status")
          .eq("patient_id", realPatientId)
          .in("status", ["concluído", "rascunho"])
          .order("session_date", { ascending: true }),
        clinicId ? supabase.from("anamnesis_form_templates").select("id, name, schema").eq("clinic_id", clinicId).eq("is_active", true) : Promise.resolve({ data: [], error: null }),
      ]);

      if (sessionsRes.error) {
        toast({ title: "Erro ao carregar fichas", description: sessionsRes.error.message, variant: "destructive" });
      }

      if (templatesRes.error) {
        toast({ title: "Erro ao carregar modelos", description: templatesRes.error.message, variant: "destructive" });
      }

      setPatient(patientRes.data);
      setBaseSchema(isAnamnesisTemplateSchema(clinicRes.data?.anamnesis_base_schema) ? clinicRes.data.anamnesis_base_schema : []);
      setSessions((sessionsRes.data ?? []) as SessionSummary[]);
      setTemplates((templatesRes.data ?? []) as AnamnesisTemplate[]);
    } catch (err) {
      console.error("Erro ao carregar painel de anamnese:", err);
      toast({ title: "Erro", description: "Não foi possível carregar os dados de anamnese.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clinicHomePath, clinicId, id, navigate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const dashboard = useMemo(
    () => buildPatientAnamnesisDashboard({ baseSchema, sessions, templates }),
    [baseSchema, sessions, templates],
  );

  const handleChartChange = (metricKey: string, chart: PatientAnamnesisChartType) => {
    const next = { ...chartPreferences, [metricKey]: chart };
    setChartPreferences(next);

    if (storageKey) {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    }
  };

  if (!isFeatureEnabled("dashboards_patient")) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:p-6">
        <Button type="button" variant="ghost" className="w-fit gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Acesso restrito</CardTitle>
            <CardDescription>O dashboard de paciente está desabilitado nas configurações da clínica.</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (loading || !patient) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" className="-ml-3 w-fit px-3" onClick={() => navigate(getPatientPath(patient))}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao paciente
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Dashboard de Anamnese</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{patient.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{dashboard.totalSessions} atendimento{dashboard.totalSessions !== 1 ? "s" : ""}</Badge>
            <Badge variant="outline">{dashboard.totalAnsweredFields} campo{dashboard.totalAnsweredFields !== 1 ? "s" : ""} com resposta</Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(clinicHomePath ? `${clinicHomePath}/configuracoes?secao=forms` : `/configuracoes?secao=forms`)}>
            <ClipboardList className="mr-2 h-4 w-4 text-primary" />
            Gerenciar Formulários
          </Button>
          <Button variant="outline" onClick={() => navigate(getPatientPath(patient, "resumo"))}>
            <FileText className="mr-2 h-4 w-4" />
            Resumo
          </Button>
          <Button variant="outline" onClick={() => navigate(getPatientPath(patient, "cadastro"))}>
            <ClipboardEdit className="mr-2 h-4 w-4" />
            Cadastro
          </Button>
        </div>
      </div>

      <PatientAnamnesisDashboardContent
        chartPreferences={chartPreferences}
        dashboard={dashboard}
        onChartChange={handleChartChange}
        onSelectedTemplateIdChange={setSelectedTemplateId}
        selectedTemplateId={selectedTemplateId}
      />
    </motion.div>
  );
};

export default PacienteAnamnesisDashboard;
