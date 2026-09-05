import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

export type DirectoryKind = "all" | "clinic" | "owner" | "account" | "patient" | "pending_account";
export type DirectoryStatusFilter = "all" | "active" | "pending" | "expiring_soon" | "expired" | "banned" | "paused";
export type DetailKind = "clinic" | "account" | "patient";
export type SupportRole = "owner" | "admin" | "professional" | "assistant" | "estagiario";

export interface PlatformTagItem {
  id: string;
  name: string;
  color?: string | null;
}

export type PlatformDirectoryItem = {
  clinic_id: string | null;
  clinic_name: string | null;
  created_at?: string | null;
  item_id: string;
  item_type: DetailKind;
  metadata: Record<string, unknown> | null;
  primary_document: string | null;
  secondary_document: string | null;
  status: string | null;
  subtitle: string | null;
  title: string;
  updated_at: string | null;
};

export type PlatformAuditEvent = {
  actor_email?: string | null;
  actor_name?: string | null;
  clinic_id?: string | null;
  clinic_name?: string | null;
  created_at: string;
  event_type: string;
  id: string;
  metadata?: Record<string, unknown> | null;
  reason?: string | null;
};

export type PlatformClinicDetail = {
  clinic?: Record<string, unknown>;
  counts?: Record<string, number>;
  memberships?: Array<Record<string, unknown>>;
  owner?: Record<string, unknown> | null;
  patients?: Array<Record<string, unknown>>;
};

export type PlatformClinicFormsSummary = {
  base?: {
    field_count?: number;
    section_count?: number;
    schema?: AnamnesisTemplateSchema;
    updated_at?: string | null;
  };
  templates?: Array<{
    description?: string | null;
    field_count?: number;
    id: string;
    name: string;
    schema?: AnamnesisTemplateSchema;
    section_count?: number;
    updated_at?: string | null;
    usage_count?: number;
  }>;
};

export type FeatureFlag = {
  clinic_id: string | null;
  clinic_name: string | null;
  description: string | null;
  expires_at: string | null;
  id: string;
  is_active_now: boolean;
  key: string;
  reason: string | null;
  scope: "global" | "clinic";
  starts_at: string | null;
  updated_at: string;
  value: unknown;
};

export type PersonDetail = {
  clinic?: Record<string, unknown>;
  counts?: Record<string, number>;
  invitation?: Record<string, unknown>;
  is_pending_registration?: boolean;
  memberships?: Array<Record<string, unknown>>;
  patient?: Record<string, unknown>;
  profile?: Record<string, unknown>;
  recent_sessions?: Array<Record<string, unknown>>;
  type?: "account" | "patient";
};

export type AccountOperation =
  | "create_subaccount"
  | "update_clinic_access"
  | "update_owner_access"
  | "update_subaccount_access"
  | "delete_subaccount"
  | "create_patient"
  | "update_patient"
  | "delete_patient"
  | "resend_invitation"
  | "confirm_user_email_manually"
  | "delete_user_attempt";
