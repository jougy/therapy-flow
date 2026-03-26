import type { Database } from "@/integrations/supabase/types";

export type MembershipLike = Pick<
  Database["public"]["Tables"]["clinic_memberships"]["Row"],
  "account_role" | "created_at" | "id" | "is_active" | "membership_status" | "operational_role" | "user_id"
>;

const OCCUPIED_STATUSES: Array<MembershipLike["membership_status"]> = ["active", "invited"];
const ROLE_PRIORITY: Record<NonNullable<MembershipLike["operational_role"]>, number> = {
  owner: 0,
  admin: 1,
  professional: 2,
  assistant: 3,
};

const MEMBERSHIP_STATUS_META: Record<MembershipLike["membership_status"], { className: string; label: string }> = {
  active: { className: "bg-emerald-500", label: "Ativo" },
  inactive: { className: "bg-slate-400", label: "Inativo" },
  invited: { className: "bg-sky-500", label: "Convidado" },
  suspended: { className: "bg-amber-500", label: "Suspenso" },
};

export const countOccupiedSubaccounts = (memberships: MembershipLike[]) =>
  memberships.filter(
    (membership) =>
      membership.account_role !== "account_owner" &&
      membership.is_active &&
      OCCUPIED_STATUSES.includes(membership.membership_status)
  ).length;

export const getSubaccountCapacity = (limit: number, memberships: MembershipLike[]) => {
  const occupied = countOccupiedSubaccounts(memberships);
  const available = Math.max(limit - occupied, 0);

  return {
    available,
    limit,
    occupied,
    reached: occupied >= limit,
  };
};

export const sortMembershipsForDisplay = (memberships: MembershipLike[]) =>
  [...memberships].sort((left, right) => {
    if (left.account_role === "account_owner" && right.account_role !== "account_owner") {
      return -1;
    }

    if (right.account_role === "account_owner" && left.account_role !== "account_owner") {
      return 1;
    }

    const roleDelta = ROLE_PRIORITY[left.operational_role] - ROLE_PRIORITY[right.operational_role];
    if (roleDelta !== 0) {
      return roleDelta;
    }

    return left.created_at.localeCompare(right.created_at);
  });

export const getMembershipStatusMeta = (status: MembershipLike["membership_status"]) => MEMBERSHIP_STATUS_META[status];

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
