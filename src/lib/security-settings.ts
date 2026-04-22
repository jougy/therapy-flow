export type SecurityEventType =
  | "password_changed"
  | "session_started"
  | "other_sessions_signed_out"
  | "security_alerts_updated"
  | "subaccount_created"
  | "subaccount_password_reset"
  | "subaccount_role_changed"
  | "subaccount_status_changed"
  | string;

export type SecurityEventMeta = {
  description: string;
  label: string;
  tone: "admin" | "default" | "muted" | "warning";
};

export type SecurityPostureInput = {
  lastPasswordChangedAt: string | null;
  lastSeenAt: string | null;
  passwordTemporary: boolean;
};

const SECURITY_EVENT_META: Record<string, SecurityEventMeta> = {
  other_sessions_signed_out: {
    description: "As outras sessoes da conta foram encerradas.",
    label: "Outras sessoes encerradas",
    tone: "default",
  },
  password_changed: {
    description: "A senha da conta foi alterada.",
    label: "Senha alterada",
    tone: "default",
  },
  security_alerts_updated: {
    description: "As preferencias de alerta de seguranca foram atualizadas.",
    label: "Alertas atualizados",
    tone: "muted",
  },
  session_started: {
    description: "Uma nova sessao foi registrada para esta conta.",
    label: "Novo acesso",
    tone: "default",
  },
  subaccount_created: {
    description: "Uma nova subconta foi criada na clinica.",
    label: "Subconta criada",
    tone: "admin",
  },
  subaccount_password_reset: {
    description: "A senha de uma subconta foi redefinida por um administrador.",
    label: "Senha de subconta redefinida",
    tone: "admin",
  },
  subaccount_role_changed: {
    description: "A hierarquia operacional de uma subconta foi alterada.",
    label: "Hierarquia alterada",
    tone: "admin",
  },
  subaccount_status_changed: {
    description: "O status de atividade de uma subconta foi alterado.",
    label: "Status de subconta alterado",
    tone: "admin",
  },
};

const SECURITY_EVENT_FALLBACK: SecurityEventMeta = {
  description: "Evento de seguranca registrado.",
  label: "Evento de seguranca",
  tone: "muted",
};

export const shouldShowAdminSecuritySection = (
  subscriptionPlan: "clinic" | "solo" | null | undefined,
  canManageTeam: boolean
) => subscriptionPlan === "clinic" && canManageTeam;

export const getSecurityEventMeta = (eventType: SecurityEventType): SecurityEventMeta =>
  SECURITY_EVENT_META[eventType] ?? SECURITY_EVENT_FALLBACK;

export const getSecurityPostureMeta = ({ lastPasswordChangedAt, lastSeenAt, passwordTemporary }: SecurityPostureInput) => {
  if (passwordTemporary) {
    return {
      description: "A senha atual ainda e provisoria e deve ser trocada.",
      label: "Senha provisoria",
      tone: "warning" as const,
    };
  }

  if (lastSeenAt) {
    const daysSinceLastSeen = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLastSeen >= 30) {
      return {
        description: "A conta nao acessa a plataforma ha bastante tempo.",
        label: "Acesso desatualizado",
        tone: "muted" as const,
      };
    }
  }

  if (!lastPasswordChangedAt) {
    return {
      description: "Ainda nao existe uma troca de senha registrada nesta conta.",
      label: "Sem troca registrada",
      tone: "muted" as const,
    };
  }

  return {
    description: "A conta possui uma senha definitiva e acesso recente.",
    label: "Protecao basica em dia",
    tone: "default" as const,
  };
};

export const parseSecurityUserAgent = (userAgent: string | null | undefined) => {
  const normalized = userAgent ?? "";
  const browser = normalized.includes("Firefox/")
    ? "Firefox"
    : normalized.includes("Edg/")
      ? "Edge"
      : normalized.includes("Chrome/")
        ? "Chrome"
        : normalized.includes("Safari/")
          ? "Safari"
          : "Navegador";

  const platform = normalized.includes("Windows")
    ? "Windows"
    : normalized.includes("Mac OS X")
      ? "macOS"
      : normalized.includes("Android")
        ? "Android"
        : normalized.includes("iPhone") || normalized.includes("iPad")
          ? "iOS"
          : normalized.includes("Linux")
            ? "Linux"
            : "Dispositivo";

  return { browser, platform };
};

export const formatSecurityEventTimestamp = (value: string | null) => {
  if (!value) {
    return "Sem registro";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const SECURITY_SESSION_STORAGE_KEY = "therapy-flow-security-session-key";

const generateSecuritySessionKey = () => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const createSecuritySessionKey = async () => {
  if (typeof window === "undefined") {
    return generateSecuritySessionKey();
  }

  const existingKey = window.sessionStorage.getItem(SECURITY_SESSION_STORAGE_KEY);
  if (existingKey) {
    return existingKey;
  }

  const nextKey = generateSecuritySessionKey();
  window.sessionStorage.setItem(SECURITY_SESSION_STORAGE_KEY, nextKey);
  return nextKey;
};

export const clearSecuritySessionKey = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(SECURITY_SESSION_STORAGE_KEY);
};
