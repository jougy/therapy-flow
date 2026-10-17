import {
  Award,
  Building2,
  CheckCircle2,
  LayoutDashboard,
  Megaphone,
  PlusCircle,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-react";
import type { AccessibleClinic } from "@/hooks/useAuth";
import type { ChartConfig } from "@/components/ui/chart";
import type {
  AttendanceRange,
  DashboardSession,
  PersonalSection,
  ReleaseNoteCategory,
} from "./selecionarClinicaTypes";

export const roleLabel: Record<string, string> = {
  account_owner: "Dono da conta",
  admin: "Admin",
  assistant: "Assistente",
  estagiario: "Estagiário",
  owner: "Owner",
  professional: "Profissional",
};

export const sectionItems: Array<{
  icon: typeof Building2;
  label: string;
  value: PersonalSection;
}> = [
  { icon: Building2, label: "Clínicas", value: "clinics" },
  { icon: LayoutDashboard, label: "Minhas Estatísticas", value: "dashboard" },
  { icon: Award, label: "Meu Portfólio", value: "portfolio" },
  { icon: Megaphone, label: "Novidades", value: "news" },
  { icon: Settings, label: "Configurações", value: "settings" },
];

export const categoryLabels: Record<ReleaseNoteCategory, string> = {
  added: "Adicionado",
  changed: "Alterado",
  fixed: "Reparado",
  removed: "Removido",
};

export const categoryIcons: Record<ReleaseNoteCategory, typeof CheckCircle2> = {
  added: PlusCircle,
  changed: RefreshCw,
  fixed: CheckCircle2,
  removed: Trash2,
};

export const categoryOrder: ReleaseNoteCategory[] = ["added", "changed", "fixed", "removed"];

export const attendanceRangeLabels: Record<AttendanceRange, string> = {
  week: "Semana",
  month: "Mês",
  year: "Ano",
};

export const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const dashboardChartColors = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];

export const attendanceChartConfig = {
  atendimentos: {
    color: "#0ea5e9",
    label: "Atendimentos",
  },
} satisfies ChartConfig;

export const isReleaseNoteCategory = (value: unknown): value is ReleaseNoteCategory =>
  value === "fixed" || value === "added" || value === "changed" || value === "removed";

export const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const getAccessLabel = (clinicOption: AccessibleClinic) =>
  clinicOption.membership.account_role === "account_owner"
    ? roleLabel.account_owner
    : roleLabel[clinicOption.membership.operational_role] ?? "Colaborador";

export const formatLastSeen = (value: string | null | undefined) => {
  if (!value) {
    return "agora";
  }

  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (minutes <= 1) {
    return "agora";
  }

  return `${minutes} min`;
};

export const toLocalDay = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const getStartOfWeek = (reference: Date) => {
  const result = toLocalDay(reference);
  const weekday = result.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  result.setDate(result.getDate() + diff);
  return result;
};

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export const getDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const formatShortDay = (date: Date) => `${weekdayLabels[date.getDay()]} ${String(date.getDate()).padStart(2, "0")}`;

export const isCompletedAttendance = (session: DashboardSession) =>
  session.status !== "rascunho" && session.status !== "cancelado";
