export type InviteSummary = {
  clinic_name: string;
  email: string;
  existing_user: boolean;
  expires_at: string;
  job_title: string | null;
  operational_role: string;
  specialty: string | null;
  status: "pending" | "accepted" | "cancelled" | "expired";
  clinic_route_key?: string | null;
  role_key?: string | null;
};

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador(a)",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário(a)",
};

export const PENDING_INVITE_STORAGE_KEY = "pending_clinic_invitation_token";
