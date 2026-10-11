import React, { useState } from "react";
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Building, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { OnboardingMeeting, CalendarGranularity, MeetingStatus } from "./types";
import { MEETING_STATUS_CONFIG } from "./types";
import { formatPhoneDisplay } from "./agenda-utils";

interface MeetingCalendarViewProps {
  meetings: OnboardingMeeting[];
  onSelectMeeting: (meeting: OnboardingMeeting) => void;
  onOpenCreate: () => void;
}

export const MeetingCalendarView: React.FC<MeetingCalendarViewProps> = ({
  meetings,
  onSelectMeeting,
  onOpenCreate,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [granularity, setGranularity] = useState<CalendarGranularity>("month");

  // Navigation handlers
  const handlePrev = () => {
    if (granularity === "day") setCurrentDate((d) => subDays(d, 1));
    else if (granularity === "week") setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subMonths(d, 1));
  };

  const handleNext = () => {
    if (granularity === "day") setCurrentDate((d) => addDays(d, 1));
    else if (granularity === "week") setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addMonths(d, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Header title
  const getHeaderTitle = () => {
    if (granularity === "day") {
      const formatted = format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    }
    if (granularity === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, "d 'de' MMM", { locale: ptBR })} - ${format(end, "d 'de' MMM, yyyy", { locale: ptBR })}`;
    }
    const formatted = format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  // Meetings for a given day
  const getMeetingsForDay = (day: Date) => {
    return meetings.filter((m) => {
      try {
        return isSameDay(parseISO(m.scheduled_at), day);
      } catch {
        return false;
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar: Date Navigation, Granularity Switcher & New Button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-card p-3 rounded-xl border">
        {/* Navigation & Title */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToday}
            className="text-xs font-semibold h-8 px-3"
          >
            Hoje
          </Button>

          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-sm sm:text-base font-bold text-foreground truncate pl-1">
            {getHeaderTitle()}
          </h2>
        </div>

        {/* Granularity & Create */}
        <div className="flex items-center gap-2 justify-between sm:justify-end">
          <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setGranularity("day")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                granularity === "day"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Dia
            </button>
            <button
              type="button"
              onClick={() => setGranularity("week")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                granularity === "week"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setGranularity("month")}
              className={cn(
                "px-3 py-1 text-xs font-medium rounded-md transition-all",
                granularity === "month"
                  ? "bg-background text-foreground shadow-2xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mês
            </button>
          </div>

          <Button
            size="sm"
            onClick={onOpenCreate}
            className="text-xs gap-1.5 h-8 font-medium shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo</span>
          </Button>
        </div>
      </div>

      {/* View Contents */}
      {granularity === "month" && (
        <MonthCalendarGrid
          currentDate={currentDate}
          getMeetingsForDay={getMeetingsForDay}
          onSelectMeeting={onSelectMeeting}
          onSelectDay={(day) => {
            setCurrentDate(day);
            setGranularity("day");
          }}
        />
      )}

      {granularity === "week" && (
        <WeekCalendarGrid
          currentDate={currentDate}
          getMeetingsForDay={getMeetingsForDay}
          onSelectMeeting={onSelectMeeting}
        />
      )}

      {granularity === "day" && (
        <DayCalendarGrid
          currentDate={currentDate}
          meetings={getMeetingsForDay(currentDate)}
          onSelectMeeting={onSelectMeeting}
        />
      )}
    </div>
  );
};

/* -------------------- Month Grid Component -------------------- */
interface MonthCalendarGridProps {
  currentDate: Date;
  getMeetingsForDay: (day: Date) => OnboardingMeeting[];
  onSelectMeeting: (meeting: OnboardingMeeting) => void;
  onSelectDay: (day: Date) => void;
}

const MonthCalendarGrid: React.FC<MonthCalendarGridProps> = ({
  currentDate,
  getMeetingsForDay,
  onSelectMeeting,
  onSelectDay,
}) => {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const weekDays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <Card className="overflow-hidden border shadow-xs">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-xs font-semibold text-muted-foreground">
        {weekDays.map((dayName) => (
          <div key={dayName} className="py-2.5">
            {dayName}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 divide-x divide-y border-b border-r">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentToday = isToday(day);
          const dayMeetings = getMeetingsForDay(day);

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 transition-colors cursor-pointer hover:bg-muted/30 flex flex-col justify-between",
                !isCurrentMonth && "bg-muted/10 text-muted-foreground/50",
                isCurrentToday && "bg-primary/5 dark:bg-primary/10"
              )}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center",
                    isCurrentToday
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/60"
                  )}
                >
                  {format(day, "d")}
                </span>

                {dayMeetings.length > 0 && (
                  <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {dayMeetings.length}
                  </span>
                )}
              </div>

              {/* Meeting Badges */}
              <div className="mt-1 space-y-1 flex-1 overflow-y-auto max-h-[70px] scrollbar-none">
                {dayMeetings.slice(0, 3).map((meeting) => {
                  const cfg = MEETING_STATUS_CONFIG[meeting.status] || MEETING_STATUS_CONFIG.scheduled;
                  const time = format(parseISO(meeting.scheduled_at), "HH:mm");

                  return (
                    <div
                      key={meeting.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMeeting(meeting);
                      }}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] font-medium truncate flex items-center gap-1 transition-transform hover:scale-[1.02]",
                        cfg.badgeClass
                      )}
                      title={`${meeting.lead_name} (${time}) - ${cfg.label}`}
                    >
                      <span className="font-mono font-bold">{time}</span>
                      <span className="truncate">{meeting.lead_name}</span>
                    </div>
                  );
                })}

                {dayMeetings.length > 3 && (
                  <div className="text-[10px] text-muted-foreground text-center font-medium">
                    +{dayMeetings.length - 3} mais
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

/* -------------------- Week Grid Component -------------------- */
interface WeekCalendarGridProps {
  currentDate: Date;
  getMeetingsForDay: (day: Date) => OnboardingMeeting[];
  onSelectMeeting: (meeting: OnboardingMeeting) => void;
}

const WeekCalendarGrid: React.FC<WeekCalendarGridProps> = ({
  currentDate,
  getMeetingsForDay,
  onSelectMeeting,
}) => {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  return (
    <Card className="overflow-x-auto border shadow-xs">
      <div className="min-w-[700px] grid grid-cols-7 divide-x">
        {days.map((day) => {
          const isCurrentToday = isToday(day);
          const dayMeetings = getMeetingsForDay(day);

          return (
            <div key={day.toISOString()} className="flex flex-col min-h-[360px]">
              {/* Day Header */}
              <div
                className={cn(
                  "p-2.5 text-center border-b bg-muted/30",
                  isCurrentToday && "bg-primary/10 text-primary font-bold"
                )}
              >
                <p className="text-[11px] font-semibold text-muted-foreground uppercase">
                  {format(day, "EEE", { locale: ptBR })}
                </p>
                <p className={cn("text-base font-extrabold", isCurrentToday ? "text-primary" : "text-foreground")}>
                  {format(day, "d MMM", { locale: ptBR })}
                </p>
              </div>

              {/* Day Meetings List */}
              <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                {dayMeetings.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-3 text-[11px] text-muted-foreground/60 italic">
                    Sem reuniões
                  </div>
                ) : (
                  dayMeetings.map((meeting) => {
                    const cfg = MEETING_STATUS_CONFIG[meeting.status] || MEETING_STATUS_CONFIG.scheduled;
                    const time = format(parseISO(meeting.scheduled_at), "HH:mm");

                    return (
                      <div
                        key={meeting.id}
                        onClick={() => onSelectMeeting(meeting)}
                        className={cn(
                          "rounded-lg p-2 text-xs border transition-all cursor-pointer hover:shadow-xs space-y-1",
                          cfg.badgeClass
                        )}
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span className="font-mono">{time}</span>
                          <span className="text-[10px] uppercase">{meeting.duration_minutes || 15}m</span>
                        </div>
                        <p className="font-semibold text-foreground truncate">{meeting.lead_name}</p>
                        {meeting.clinic_name && (
                          <p className="text-[10px] text-muted-foreground truncate">{meeting.clinic_name}</p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

/* -------------------- Day Grid Component -------------------- */
interface DayCalendarGridProps {
  currentDate: Date;
  meetings: OnboardingMeeting[];
  onSelectMeeting: (meeting: OnboardingMeeting) => void;
}

const DayCalendarGrid: React.FC<DayCalendarGridProps> = ({
  currentDate,
  meetings,
  onSelectMeeting,
}) => {
  // Sort meetings chronologically
  const sortedMeetings = [...meetings].sort(
    (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  return (
    <Card className="border shadow-xs">
      <CardHeader className="p-4 sm:p-5 border-b bg-muted/20">
        <CardTitle className="text-base sm:text-lg font-bold flex items-center justify-between">
          <span>Reuniões do Dia</span>
          <Badge variant="secondary" className="font-mono">
            {sortedMeetings.length} {sortedMeetings.length === 1 ? "reunião" : "reuniões"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 sm:p-5 space-y-3">
        {sortedMeetings.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="font-medium text-sm">Nenhuma reunião agendada para este dia.</p>
            <p className="text-xs text-muted-foreground/80">Use o botão "Novo" acima para agendar um horário.</p>
          </div>
        ) : (
          sortedMeetings.map((meeting) => {
            const cfg = MEETING_STATUS_CONFIG[meeting.status] || MEETING_STATUS_CONFIG.scheduled;
            const time = format(parseISO(meeting.scheduled_at), "HH:mm");

            return (
              <div
                key={meeting.id}
                onClick={() => onSelectMeeting(meeting)}
                className={cn(
                  "p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-all hover:shadow-xs",
                  cfg.borderClass,
                  "border-l-4 bg-card hover:bg-muted/20"
                )}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm sm:text-base text-primary">{time}</span>
                    <h4 className="font-semibold text-foreground text-sm sm:text-base">{meeting.lead_name}</h4>
                  </div>
                  {meeting.clinic_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5" />
                      <span>{meeting.clinic_name}</span>
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground font-mono">{formatPhoneDisplay(meeting.phone)}</p>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-xs", cfg.badgeClass)}>
                    {cfg.label}
                  </Badge>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};
