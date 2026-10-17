import { UsersRound, Activity, CalendarDays, Tags, Loader2, ShieldCheck } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import type { AttendanceRange, DashboardComputedData } from "./selecionarClinicaTypes";
import { attendanceRangeLabels, attendanceChartConfig } from "./selecionarClinicaUtils";

export interface PersonalDashboardTabProps {
  loadingDashboard: boolean;
  dashboardData: DashboardComputedData;
  attendanceRange: AttendanceRange;
  setAttendanceRange: (range: AttendanceRange) => void;
  isPlatformOwner: boolean;
  onNavigateToPlatform: () => void;
}

export function PersonalDashboardTab({
  loadingDashboard,
  dashboardData,
  attendanceRange,
  setAttendanceRange,
  isPlatformOwner,
  onNavigateToPlatform,
}: PersonalDashboardTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UsersRound className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Total de pacientes atendidos</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {loadingDashboard ? "..." : dashboardData.totalAttendedPatients}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Total de atendimentos</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {loadingDashboard ? "..." : dashboardData.totalAttendances}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Quantidade de atendimentos
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Volume por dia, por mês ou mês a mês no ano.</p>
            </div>
            <div className="flex w-full gap-1 rounded-lg border bg-muted/20 p-1 md:w-auto">
              {(Object.keys(attendanceRangeLabels) as AttendanceRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  className={cn(
                    "h-8 flex-1 rounded-md px-3 text-sm font-medium transition md:flex-none",
                    attendanceRange === range ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setAttendanceRange(range)}
                >
                  {attendanceRangeLabels[range]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDashboard ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : dashboardData.totalAttendances === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum atendimento concluído encontrado nas suas clínicas.
            </div>
          ) : (
            <ChartContainer config={attendanceChartConfig} className="h-64 w-full">
              <LineChart data={dashboardData.attendanceBuckets} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={attendanceRange === "month" ? 18 : 8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="atendimentos"
                  stroke="var(--color-atendimentos)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="h-4 w-4 text-primary" />
              Top 5 grupos de atendimentos
            </CardTitle>
            <p className="text-sm text-muted-foreground">Grupos mais frequentes nos atendimentos concluídos.</p>
          </CardHeader>
          <CardContent>
            {loadingDashboard ? (
              <div className="flex h-44 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : dashboardData.topGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Nenhum grupo com atendimento encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData.topGroups.map((group, index) => (
                  <div key={group.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{group.name}</p>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: group.color ?? undefined,
                            width: `${Math.max(8, Math.round((group.total / Math.max(1, dashboardData.topGroups[0].total)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <Badge variant="secondary">{group.total}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grupos recorrentes por semana do mês</CardTitle>
            <p className="text-sm text-muted-foreground">Distribuição semanal dos grupos mais recorrentes no mês atual.</p>
          </CardHeader>
          <CardContent>
            {loadingDashboard ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : dashboardData.topGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Nenhum atendimento no mês atual para comparar por semana.
              </div>
            ) : (
              <ChartContainer config={dashboardData.groupChartConfig} className="h-64 w-full">
                <BarChart data={dashboardData.groupWeeks} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {dashboardData.topGroups.map((group) => (
                    <Bar key={group.id} dataKey={group.key} fill={`var(--color-${group.key})`} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {isPlatformOwner && (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={onNavigateToPlatform}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground">Painel administrativo global</p>
              <p className="truncate text-sm text-muted-foreground">Ferramentas internas da plataforma</p>
            </div>
          </div>
          <Badge variant="secondary">platform_owner</Badge>
        </button>
      )}
    </div>
  );
}
