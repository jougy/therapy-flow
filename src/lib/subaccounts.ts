import type { Database } from "@/integrations/supabase/types";

export type MembershipLike = Pick<
  Database["public"]["Tables"]["clinic_memberships"]["Row"],
  "account_role" | "created_at" | "id" | "is_active" | "membership_status" | "operational_role" | "user_id"
>;
export type SecuritySessionLike = Pick<
  Database["public"]["Tables"]["user_security_sessions"]["Row"],
  "clinic_id" | "ended_at" | "last_seen_at" | "session_key" | "user_id"
>;
type TeamProfileLike = {
  email?: string | null;
  full_name?: string | null;
  job_title?: string | null;
  last_seen_at?: string | null;
};
type TeamSortKey = "created_at_desc" | "last_seen_desc" | "name_asc" | "role_priority";
type TeamRoleFilter = MembershipLike["operational_role"] | "all";
type TeamStatusFilter = MembershipLike["membership_status"] | "all" | "online";
type TeamVisibleRow = {
  activityStatus: { className: string; label: string };
  isOnline: boolean;
  membership: MembershipLike;
  profile: TeamProfileLike | null;
};

const ROLE_PRIORITY: Record<NonNullable<MembershipLike["operational_role"]>, number> = {
  owner: 0,
  admin: 1,
  professional: 2,
  assistant: 3,
  estagiario: 4,
};
const ACTIVE_SECURITY_SESSION_WINDOW_MS = 15 * 60 * 1000;

const MEMBERSHIP_STATUS_META: Record<MembershipLike["membership_status"], { className: string; label: string }> = {
  active: { className: "bg-emerald-500", label: "Ativo" },
  inactive: { className: "bg-slate-400", label: "Inativo" },
  invited: { className: "bg-sky-500", label: "Convidado" },
  suspended: { className: "bg-amber-500", label: "Suspenso" },
};
const ONLINE_STATUS_META = { className: "bg-sky-500", label: "Online" };
const UNKNOWN_MEMBERSHIP_STATUS_META = {
  className: "bg-slate-400",
  label: "Status desconhecido",
};

const normalizeTeamSearch = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export const isSecuritySessionActive = (
  session: SecuritySessionLike,
  now = new Date()
) => {
  if (session.ended_at) {
    return false;
  }

  const lastSeenAt = new Date(session.last_seen_at).getTime();
  if (Number.isNaN(lastSeenAt)) {
    return false;
  }

  return now.getTime() - lastSeenAt <= ACTIVE_SECURITY_SESSION_WINDOW_MS;
};

export const countActiveConcurrentAccesses = (
  sessions: SecuritySessionLike[],
  now = new Date()
) => sessions.filter((session) => isSecuritySessionActive(session, now)).length;

export const getConcurrentAccessCapacity = (
  limit: number,
  sessions: SecuritySessionLike[],
  now = new Date()
) => {
  const occupied = countActiveConcurrentAccesses(sessions, now);
  const available = Math.max(limit - occupied, 0);

  return {
    available,
    limit,
    occupied,
    reached: occupied >= limit,
  };
};

export const shouldShowTeamSettingsSection = (subscriptionPlan: "solo" | "clinic" | null | undefined) =>
  subscriptionPlan === "clinic";

export const shouldShowTeamAnalyticsSection = (
  subscriptionPlan: "solo" | "clinic" | null | undefined,
  canReadAnalytics: boolean
) => subscriptionPlan === "clinic" && canReadAnalytics;

export const sortMembershipsForDisplay = (memberships: MembershipLike[]) =>
  [...memberships].sort((left, right) => {
    if (left.account_role === "account_owner" && right.account_role !== "account_owner") {
      return -1;
    }

    if (right.account_role === "account_owner" && left.account_role !== "account_owner") {
      return 1;
    }

    const leftRolePriority = ROLE_PRIORITY[left.operational_role] ?? Number.MAX_SAFE_INTEGER;
    const rightRolePriority = ROLE_PRIORITY[right.operational_role] ?? Number.MAX_SAFE_INTEGER;
    const roleDelta = leftRolePriority - rightRolePriority;
    if (roleDelta !== 0) {
      return roleDelta;
    }

    return left.created_at.localeCompare(right.created_at);
  });

export const getMembershipStatusMeta = (status: MembershipLike["membership_status"] | string | null | undefined) =>
  (status ? MEMBERSHIP_STATUS_META[status as MembershipLike["membership_status"]] : null) ?? UNKNOWN_MEMBERSHIP_STATUS_META;

export const getCollaboratorActivityStatusMeta = (
  status: MembershipLike["membership_status"] | string | null | undefined,
  isOnline: boolean
) => (isOnline ? ONLINE_STATUS_META : getMembershipStatusMeta(status));

export const formatLastSeenAt = (value: string | null) => {
  if (!value) {
    return "Nunca acessou";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

export const buildVisibleTeamMembershipRows = ({
  memberships,
  onlineUserIds,
  profileMap,
  roleFilter,
  searchTerm,
  sortKey,
  statusFilter,
}: {
  memberships: MembershipLike[];
  onlineUserIds: Set<string>;
  profileMap: Map<string, TeamProfileLike>;
  roleFilter: TeamRoleFilter;
  searchTerm: string;
  sortKey: TeamSortKey;
  statusFilter: TeamStatusFilter;
}): TeamVisibleRow[] => {
  const normalizedSearch = normalizeTeamSearch(searchTerm);

  const rows = memberships
    .map<TeamVisibleRow>((membership) => {
      const profile = profileMap.get(membership.user_id) ?? null;
      const isOnline = onlineUserIds.has(membership.user_id);

      return {
        activityStatus: getCollaboratorActivityStatusMeta(membership.membership_status, isOnline),
        isOnline,
        membership,
        profile,
      };
    })
    .filter((row) => {
      if (roleFilter !== "all" && row.membership.operational_role !== roleFilter) {
        return false;
      }

      if (statusFilter === "online" && !row.isOnline) {
        return false;
      }

      if (statusFilter !== "all" && statusFilter !== "online" && row.membership.membership_status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = normalizeTeamSearch(
        [
          row.profile?.full_name,
          row.profile?.email,
          row.profile?.job_title,
          row.membership.operational_role,
          row.activityStatus.label,
        ].join(" ")
      );

      return haystack.includes(normalizedSearch);
    });

  return [...rows].sort((left, right) => {
    switch (sortKey) {
      case "name_asc":
        return (left.profile?.full_name ?? left.profile?.email ?? left.membership.user_id).localeCompare(
          right.profile?.full_name ?? right.profile?.email ?? right.membership.user_id,
          "pt-BR"
        );
      case "last_seen_desc":
        return (right.profile?.last_seen_at ?? "").localeCompare(left.profile?.last_seen_at ?? "");
      case "created_at_desc":
        return right.membership.created_at.localeCompare(left.membership.created_at);
      case "role_priority":
      default: {
        const leftPriority = ROLE_PRIORITY[left.membership.operational_role] ?? Number.MAX_SAFE_INTEGER;
        const rightPriority = ROLE_PRIORITY[right.membership.operational_role] ?? Number.MAX_SAFE_INTEGER;
        const priorityDelta = leftPriority - rightPriority;
        if (priorityDelta !== 0) {
          return priorityDelta;
        }

        return left.membership.created_at.localeCompare(right.membership.created_at);
      }
    }
  });
};
