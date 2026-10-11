import { LucideIcon, Clock, CheckCircle2, CalendarClock, XCircle, UserX } from "lucide-react";

export type MeetingStatus = "scheduled" | "completed" | "canceled" | "rescheduled" | "no_show";

export interface OnboardingMeeting {
  id: string;
  lead_name: string;
  email?: string | null;
  phone: string;
  clinic_name?: string | null;
  scheduled_at: string;
  duration_minutes: number;
  status: MeetingStatus;
  google_calendar_url?: string | null;
  meet_url?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingStatusConfig {
  label: string;
  shortLabel: string;
  colorClass: string;
  badgeClass: string;
  borderClass: string;
  icon: LucideIcon;
}

export const MEETING_STATUS_CONFIG: Record<MeetingStatus, MeetingStatusConfig> = {
  scheduled: {
    label: "Agendada",
    shortLabel: "Agendada",
    colorClass: "text-sky-600 dark:text-sky-400",
    badgeClass: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800",
    borderClass: "border-l-sky-500",
    icon: Clock,
  },
  completed: {
    label: "Concluída",
    shortLabel: "Concluída",
    colorClass: "text-emerald-600 dark:text-emerald-400",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    borderClass: "border-l-emerald-500",
    icon: CheckCircle2,
  },
  rescheduled: {
    label: "Remarcada",
    shortLabel: "Remarcada",
    colorClass: "text-amber-600 dark:text-amber-400",
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    borderClass: "border-l-amber-500",
    icon: CalendarClock,
  },
  canceled: {
    label: "Cancelada",
    shortLabel: "Cancelada",
    colorClass: "text-rose-600 dark:text-rose-400",
    badgeClass: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    borderClass: "border-l-rose-500",
    icon: XCircle,
  },
  no_show: {
    label: "Não Compareceu",
    shortLabel: "Não compareceu",
    colorClass: "text-purple-600 dark:text-purple-400",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    borderClass: "border-l-purple-500",
    icon: UserX,
  },
};

export type AgendaViewMode = "list" | "calendar";
export type CalendarGranularity = "day" | "week" | "month";
