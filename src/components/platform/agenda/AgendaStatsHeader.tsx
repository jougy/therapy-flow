import React from "react";
import { Clock, CheckCircle2, CalendarClock, CalendarRange, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OnboardingMeeting } from "./types";
import { isSameMonth } from "date-fns";

interface AgendaStatsHeaderProps {
  meetings: OnboardingMeeting[];
  onFilterClick?: (status: string) => void;
  activeStatusFilter?: string;
}

export const AgendaStatsHeader: React.FC<AgendaStatsHeaderProps> = ({
  meetings,
  onFilterClick,
  activeStatusFilter,
}) => {
  const now = new Date();

  const upcomingCount = meetings.filter(
    (m) => m.status === "scheduled" && new Date(m.scheduled_at).getTime() >= now.getTime()
  ).length;

  const completedCount = meetings.filter((m) => m.status === "completed").length;
  const rescheduledCount = meetings.filter((m) => m.status === "rescheduled").length;
  const currentMonthCount = meetings.filter((m) => isSameMonth(new Date(m.scheduled_at), now)).length;

  const stats = [
    {
      id: "scheduled",
      title: "Próximas Reuniões",
      value: upcomingCount,
      description: "Agendadas a realizar",
      icon: Clock,
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-500/10 dark:bg-sky-500/20",
      border: "border-sky-200/60 dark:border-sky-800/60",
      activeRing: activeStatusFilter === "scheduled",
    },
    {
      id: "completed",
      title: "Concluídas",
      value: completedCount,
      description: "Reuniões realizadas",
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 dark:bg-emerald-500/20",
      border: "border-emerald-200/60 dark:border-emerald-800/60",
      activeRing: activeStatusFilter === "completed",
    },
    {
      id: "rescheduled",
      title: "Remarcadas",
      value: rescheduledCount,
      description: "Novas datas definidas",
      icon: CalendarClock,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 dark:bg-amber-500/20",
      border: "border-amber-200/60 dark:border-amber-800/60",
      activeRing: activeStatusFilter === "rescheduled",
    },
    {
      id: "month_total",
      title: "Total do Mês",
      value: currentMonthCount,
      description: "Volume total de agendamentos",
      icon: CalendarRange,
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 dark:bg-indigo-500/20",
      border: "border-indigo-200/60 dark:border-indigo-800/60",
      activeRing: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const isClickable = stat.id !== "month_total" && Boolean(onFilterClick);

        return (
          <Card
            key={stat.id}
            onClick={() => isClickable && onFilterClick?.(stat.activeRing ? "all" : stat.id)}
            className={cn(
              "relative overflow-hidden border transition-all duration-200 select-none",
              stat.border,
              isClickable && "cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]",
              stat.activeRing && "ring-2 ring-primary ring-offset-2 bg-primary/5 dark:bg-primary/10"
            )}
          >
            <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider truncate">
                  {stat.title}
                </p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                    {stat.value}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate hidden sm:block">
                  {stat.description}
                </p>
              </div>

              <div
                className={cn(
                  "flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl",
                  stat.bg,
                  stat.color
                )}
              >
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
