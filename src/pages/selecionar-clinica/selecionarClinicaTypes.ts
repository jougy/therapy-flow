import type { ChartConfig } from "@/components/ui/chart";

export type PersonalSection = "clinics" | "dashboard" | "portfolio" | "news" | "settings";
export type ReleaseNoteCategory = "fixed" | "added" | "changed" | "removed";
export type AttendanceRange = "week" | "month" | "year";

export interface ReleaseNoteItem {
  body: string | null;
  category: ReleaseNoteCategory;
  id: string;
  release_id: string;
  sort_order: number;
  title: string;
}

export interface ReleaseNote {
  id: string;
  items: ReleaseNoteItem[];
  published_at: string;
  summary: string | null;
  title: string;
  version: string;
  version_order: number;
}

export interface DashboardSession {
  clinic_id: string | null;
  group_id: string | null;
  id: string;
  patient_id: string;
  session_date: string;
  status: string;
}

export interface DashboardGroup {
  color: string | null;
  id: string;
  name: string;
}

export interface AttendanceBucket {
  atendimentos: number;
  label: string;
  key: string;
}

export interface GroupCount {
  color: string;
  id: string;
  key: string;
  name: string;
  total: number;
}

export interface ClinicInvitation {
  clinic_id: string;
  clinic_logo_url: string | null;
  clinic_name: string;
  clinic_route_key: string;
  created_at: string;
  expires_at: string;
  invitation_id: string;
  invited_by_name: string | null;
  job_title: string | null;
  operational_role: string;
  specialty: string | null;
}

export interface ClinicSubscriptionSummary {
  status: string;
  trial_ends_at: string | null;
  is_free_trial: boolean | null;
  expires_at: string | null;
  current_period_end: string | null;
}

export interface DashboardComputedData {
  attendanceBuckets: AttendanceBucket[];
  completedSessions: DashboardSession[];
  groupChartConfig: ChartConfig;
  groupWeeks: Array<Record<string, number | string>>;
  topGroups: GroupCount[];
  totalAttendedPatients: number;
  totalAttendances: number;
}
