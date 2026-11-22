import type { AuthContextType, PlatformRole } from "@/hooks/auth/authTypes";

export const PLATFORM_FEATURE_FLAG_KEYS = [
  "marketing",
  "agenda",
  "simulation",
  "debug",
  "directory",
  "forms",
  "feedbacks",
  "releases",
  "tags",
  "feature_flags",
  "governance",
  "billing",
  "logs",
] as const;

export type PlatformFeatureFlagKey = (typeof PLATFORM_FEATURE_FLAG_KEYS)[number];

export interface PlatformFeatureFlagDefinition {
  key: PlatformFeatureFlagKey;
  label: string;
  description: string;
  group: "modules" | "tools";
}

export const PLATFORM_FEATURE_FLAG_DEFINITIONS: PlatformFeatureFlagDefinition[] = [
  {
    key: "marketing",
    label: "Marketing & Auto-Lead",
    description: "Afiliados, campanhas e captura automática de leads.",
    group: "modules",
  },
  {
    key: "agenda",
    label: "Agenda de Reuniões",
    description: "Gestão de reuniões de onboarding, demos e chamadas.",
    group: "modules",
  },
  {
    key: "simulation",
    label: "Simulação (Preview)",
    description: "Simular clínicas, papéis operacionais e planos na interface.",
    group: "tools",
  },
  {
    key: "debug",
    label: "Painel de Debug",
    description: "Acesso ao diagnóstico em tempo real e atalho Ctrl+Alt+D / Cmd+Ctrl+D.",
    group: "tools",
  },
  {
    key: "directory",
    label: "Diretório Mestre",
    description: "Busca e gestão de clínicas, usuários e pacientes.",
    group: "modules",
  },
  {
    key: "forms",
    label: "Biblioteca de Formulários",
    description: "Moderação global e modelos de anamnese da comunidade.",
    group: "modules",
  },
  {
    key: "feedbacks",
    label: "Feedbacks & Avaliações",
    description: "Gestão de avaliações, feedbacks e NPS da plataforma.",
    group: "modules",
  },
  {
    key: "releases",
    label: "Notas de Novidades",
    description: "Publicação de changelog e atualizações para clínicas.",
    group: "modules",
  },
  {
    key: "tags",
    label: "Gestão de Tags",
    description: "Padronização de tags para organização de clínicas.",
    group: "modules",
  },
  {
    key: "feature_flags",
    label: "Feature Flags Globais",
    description: "Controle de ativação e rollout de funcionalidades.",
    group: "modules",
  },
  {
    key: "governance",
    label: "Governança & Segurança",
    description: "Políticas globais, auditoria e controles administrativos.",
    group: "modules",
  },
  {
    key: "billing",
    label: "Faturamento & Webhooks",
    description: "Gestão master de cobranças, assinaturas Asaas e webhooks.",
    group: "modules",
  },
  {
    key: "logs",
    label: "Erros & Logs",
    description: "Monitoramento de falhas de runtime e logs do sistema.",
    group: "modules",
  },
];

export const ALL_TRUE_PLATFORM_FEATURE_FLAGS: Record<string, boolean> = Object.fromEntries(
  PLATFORM_FEATURE_FLAG_KEYS.map((key) => [key, true])
);

export const EMPTY_PLATFORM_FEATURE_FLAGS: Record<string, boolean> = Object.fromEntries(
  PLATFORM_FEATURE_FLAG_KEYS.map((key) => [key, false])
);

export const LEGACY_MARKETING_PLATFORM_FLAGS: Record<string, boolean> = {
  marketing: true,
  agenda: true,
  simulation: true,
  debug: true,
};

export const NAV_ID_TO_PLATFORM_FLAG: Record<string, PlatformFeatureFlagKey> = {
  directory: "directory",
  affiliates: "marketing",
  agenda: "agenda",
  forms: "forms",
  "forms-library": "forms",
  feedbacks: "feedbacks",
  news: "releases",
  tags: "tags",
  flags: "feature_flags",
  governance: "governance",
  billing: "billing",
  errors: "logs",
};

export const PLATFORM_ROUTE_ORDER: Array<{ flag: PlatformFeatureFlagKey; path: string }> = [
  { flag: "directory", path: "/platform/diretorio" },
  { flag: "marketing", path: "/platform/marketing" },
  { flag: "agenda", path: "/platform/agenda" },
  { flag: "forms", path: "/platform/formularios" },
  { flag: "feedbacks", path: "/platform/feedbacks" },
  { flag: "releases", path: "/platform/novidades" },
  { flag: "tags", path: "/platform/tags" },
  { flag: "feature_flags", path: "/platform/flags" },
  { flag: "governance", path: "/platform/governanca" },
  { flag: "billing", path: "/platform/faturamento" },
  { flag: "logs", path: "/platform/erros-logs" },
];

/**
 * Normaliza as feature flags vindas do banco (`platform_admins.feature_flags`).
 * - `platform_owner` possui todas as flags habilitadas.
 * - `platform_marketing` sem JSON configurado mantém o escopo legado (marketing, agenda, simulation, debug).
 */
export function normalizePlatformFeatureFlags(
  rawFlags: unknown,
  role: PlatformRole
): Record<string, boolean> {
  if (role === "platform_owner") {
    return { ...ALL_TRUE_PLATFORM_FEATURE_FLAGS };
  }

  if (rawFlags && typeof rawFlags === "object" && !Array.isArray(rawFlags)) {
    const entries = Object.entries(rawFlags as Record<string, unknown>);
    if (entries.length > 0) {
      return Object.fromEntries(entries.map(([key, value]) => [key, Boolean(value)]));
    }
  }

  if (role === "platform_marketing") {
    return { ...LEGACY_MARKETING_PLATFORM_FLAGS };
  }

  return {};
}

type PlatformFlagAuthLike = Partial<
  Pick<
    AuthContextType,
    "isPlatformOwner" | "isPlatformMarketing" | "platformRole" | "platformFeatureFlags" | "hasPlatformFlag"
  >
>;

/**
 * Resolve de forma segura se uma flag do Backoffice está liberada para o usuário autenticado.
 */
export function checkPlatformFlagFromAuth(auth: PlatformFlagAuthLike, flag: string): boolean {
  if (auth.isPlatformOwner) {
    return true;
  }

  if (typeof auth.hasPlatformFlag === "function") {
    return auth.hasPlatformFlag(flag);
  }

  if (auth.platformFeatureFlags && Object.keys(auth.platformFeatureFlags).length > 0) {
    return Boolean(auth.platformFeatureFlags[flag]);
  }

  if (auth.isPlatformMarketing || auth.platformRole === "platform_marketing") {
    return Boolean(LEGACY_MARKETING_PLATFORM_FLAGS[flag]);
  }

  return false;
}

/**
 * Retorna a primeira rota do Backoffice liberada pelas flags do usuário.
 */
export function getFirstAllowedPlatformPath(auth: PlatformFlagAuthLike): string {
  if (auth.isPlatformOwner) {
    return "/platform/diretorio";
  }

  const firstRoute = PLATFORM_ROUTE_ORDER.find((entry) => checkPlatformFlagFromAuth(auth, entry.flag));
  return firstRoute ? firstRoute.path : "/espacopessoal";
}

/**
 * Mapeia o pathname de `/platform/*` para a feature flag necessária.
 */
export function getRequiredFlagForPlatformPath(pathname: string): PlatformFeatureFlagKey | null {
  if (
    pathname.startsWith("/platform/diretorio") ||
    pathname.startsWith("/platform/clinicas") ||
    pathname.startsWith("/platform/usuarios") ||
    pathname.startsWith("/platform/pacientes")
  ) {
    return "directory";
  }
  if (pathname.startsWith("/platform/marketing") || pathname.startsWith("/platform/afiliados")) {
    return "marketing";
  }
  if (pathname.startsWith("/platform/agenda")) {
    return "agenda";
  }
  if (pathname.startsWith("/platform/formularios")) {
    return "forms";
  }
  if (pathname.startsWith("/platform/feedbacks")) {
    return "feedbacks";
  }
  if (pathname.startsWith("/platform/novidades")) {
    return "releases";
  }
  if (pathname.startsWith("/platform/tags")) {
    return "tags";
  }
  if (pathname.startsWith("/platform/flags")) {
    return "feature_flags";
  }
  if (pathname.startsWith("/platform/governanca")) {
    return "governance";
  }
  if (pathname.startsWith("/platform/faturamento")) {
    return "billing";
  }
  if (pathname.startsWith("/platform/erros-logs")) {
    return "logs";
  }
  return null;
}
