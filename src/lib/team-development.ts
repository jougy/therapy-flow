import type { MembershipStatus, OperationalRole, SubscriptionPlan } from "@/lib/rbac";

export type DevelopmentStatus =
  | "onboarding"
  | "em_evolucao"
  | "consolidado"
  | "precisa_supervisao"
  | "em_pausa";

export type DevelopmentLevel =
  | "estagiario"
  | "junior"
  | "pleno"
  | "senior"
  | "referencia";

export type TeamDevelopmentChecklistInput = {
  birthDate: string | null;
  email: string | null;
  fullName: string | null;
  hasTemporaryPassword: boolean;
  onboardingFlowRead: boolean;
  onboardingInitialTraining: boolean;
  phone: string | null;
  professionalLicense: string | null;
  socialName: string | null;
};

export type TeamDevelopmentMemberSummaryInput = {
  developmentStatus: DevelopmentStatus;
  membershipStatus: MembershipStatus | null;
  operationalRole: OperationalRole;
};

const DEVELOPMENT_STATUS_META: Record<DevelopmentStatus, { className: string; label: string }> = {
  consolidado: { className: "bg-emerald-500", label: "Consolidado" },
  em_evolucao: { className: "bg-sky-500", label: "Em evolucao" },
  em_pausa: { className: "bg-slate-400", label: "Em pausa" },
  onboarding: { className: "bg-violet-500", label: "Onboarding" },
  precisa_supervisao: { className: "bg-amber-500", label: "Precisa de supervisao" },
};

const DEVELOPMENT_LEVEL_META: Record<DevelopmentLevel, { className: string; label: string }> = {
  estagiario: { className: "bg-fuchsia-500", label: "Estagiario" },
  junior: { className: "bg-cyan-500", label: "Junior" },
  pleno: { className: "bg-blue-500", label: "Pleno" },
  referencia: { className: "bg-sky-500", label: "Referencia interna" },
  senior: { className: "bg-indigo-500", label: "Senior" },
};
const UNKNOWN_DEVELOPMENT_STATUS_META = {
  className: "bg-slate-400",
  label: "Status desconhecido",
};
const UNKNOWN_DEVELOPMENT_LEVEL_META = {
  className: "bg-slate-400",
  label: "Nivel desconhecido",
};

export const shouldShowTeamDevelopmentSection = (
  subscriptionPlan: SubscriptionPlan | null | undefined,
  canReadAnalytics: boolean,
  operationalRole: OperationalRole
) => subscriptionPlan === "clinic" && (canReadAnalytics || operationalRole === "professional");

export const getDevelopmentStatusMeta = (status: DevelopmentStatus | string | null | undefined) =>
  (status ? DEVELOPMENT_STATUS_META[status as DevelopmentStatus] : null) ?? UNKNOWN_DEVELOPMENT_STATUS_META;

export const getDevelopmentLevelMeta = (level: DevelopmentLevel | string | null | undefined) =>
  (level ? DEVELOPMENT_LEVEL_META[level as DevelopmentLevel] : null) ?? UNKNOWN_DEVELOPMENT_LEVEL_META;

export const getDevelopmentStatusScore = (status: DevelopmentStatus) => {
  switch (status) {
    case "onboarding":
      return 30;
    case "em_evolucao":
      return 60;
    case "precisa_supervisao":
      return 40;
    case "em_pausa":
      return 20;
    case "consolidado":
      return 100;
    default:
      return 0;
  }
};

export const getDevelopmentDashboardTone = (status: DevelopmentStatus) => {
  switch (status) {
    case "consolidado":
      return "healthy" as const;
    case "em_evolucao":
      return "progress" as const;
    case "precisa_supervisao":
      return "warning" as const;
    case "em_pausa":
      return "muted" as const;
    case "onboarding":
      return "highlight" as const;
    default:
      return "muted" as const;
  }
};

export const buildOnboardingChecklist = (input: TeamDevelopmentChecklistInput) => {
  const items = [
    {
      id: "first_access",
      label: "Primeiro acesso realizado",
      completed: Boolean(input.email),
    },
    {
      id: "profile_completed",
      label: "Perfil minimo preenchido",
      completed: Boolean(input.email && input.fullName),
    },
    {
      id: "password_defined",
      label: "Senha definitiva configurada",
      completed: !input.hasTemporaryPassword,
    },
    {
      id: "flow_read",
      label: "Leitura do fluxo interno",
      completed: input.onboardingFlowRead,
    },
    {
      id: "initial_training",
      label: "Treinamento inicial concluido",
      completed: input.onboardingInitialTraining,
    },
  ];

  return {
    completedCount: items.filter((item) => item.completed).length,
    items,
    totalCount: items.length,
  };
};

export const buildTeamDevelopmentSummary = (members: TeamDevelopmentMemberSummaryInput[]) => {
  const activeMembers = members.filter((member) => member.membershipStatus === "active");

  return {
    activeTotal: activeMembers.length,
    byRole: {
      admin: activeMembers.filter((member) => member.operationalRole === "admin").length,
      assistant: activeMembers.filter((member) => member.operationalRole === "assistant").length,
      owner: activeMembers.filter((member) => member.operationalRole === "owner").length,
      professional: activeMembers.filter((member) => member.operationalRole === "professional").length,
    },
    inOnboarding: activeMembers.filter((member) => member.developmentStatus === "onboarding").length,
    needsAttention: activeMembers.filter((member) => member.developmentStatus === "precisa_supervisao").length,
    onTrack: activeMembers.filter((member) =>
      ["consolidado", "em_evolucao"].includes(member.developmentStatus)
    ).length,
  };
};
