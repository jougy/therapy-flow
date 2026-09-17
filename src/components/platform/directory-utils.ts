import type { DetailKind, PlatformDirectoryItem } from "./types";

export interface EntityTheme {
  iconBg: string;
  iconText: string;
  badgeClass: string;
  cardBorderHover: string;
  cardBg?: string;
  pillBorder?: string;
}

export interface ClinicMembershipSummary {
  clinic_id?: string;
  clinic_name?: string;
  route_key?: string;
  account_role?: string;
  operational_role?: string;
  membership_status?: string;
  is_active?: boolean;
  clinic_status?: string;
  is_owner?: boolean;
  status?: string;
}

export const getEntityTheme = (
  itemType: DetailKind,
  isOwner?: boolean,
  isPending?: boolean
): EntityTheme => {
  if (isPending) {
    return {
      iconBg: "bg-amber-500/15",
      iconText: "text-amber-700 dark:text-amber-300",
      badgeClass: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-400/40",
      cardBorderHover: "hover:border-amber-400/60",
      cardBg: "border-amber-400/40 bg-amber-500/[0.03] dark:border-amber-500/30",
      pillBorder: "border-amber-500/30",
    };
  }

  if (itemType === "clinic") {
    return {
      iconBg: "bg-sky-500/15",
      iconText: "text-sky-700 dark:text-sky-300",
      badgeClass: "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-400/40",
      cardBorderHover: "hover:border-sky-400/60",
      pillBorder: "border-sky-500/30",
    };
  }

  if (itemType === "account" && isOwner) {
    return {
      iconBg: "bg-purple-500/15",
      iconText: "text-purple-700 dark:text-purple-300",
      badgeClass: "bg-purple-500/15 text-purple-800 dark:text-purple-200 border-purple-400/40",
      cardBorderHover: "hover:border-purple-400/60",
      pillBorder: "border-purple-500/30",
    };
  }

  if (itemType === "account") {
    return {
      iconBg: "bg-indigo-500/15",
      iconText: "text-indigo-700 dark:text-indigo-300",
      badgeClass: "bg-indigo-500/15 text-indigo-800 dark:text-indigo-200 border-indigo-400/40",
      cardBorderHover: "hover:border-indigo-400/60",
      pillBorder: "border-indigo-500/30",
    };
  }

  // Pacientes (patient)
  return {
    iconBg: "bg-emerald-500/15",
    iconText: "text-emerald-700 dark:text-emerald-300",
    badgeClass: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-400/40",
    cardBorderHover: "hover:border-emerald-400/60",
    pillBorder: "border-emerald-500/30",
  };
};

export const isStatusActive = (s: string | null | undefined): boolean =>
  String(s ?? "").toLowerCase() === "active";

export const isStatusPaused = (s: string | null | undefined): boolean => {
  const val = String(s ?? "").toLowerCase();
  return (
    val === "paused" ||
    val === "temporarily_paused" ||
    val === "inactive" ||
    val === "suspended"
  );
};

export function consolidateDirectoryItems(rawList: PlatformDirectoryItem[]): PlatformDirectoryItem[] {
  const consolidatedMap = new Map<string, PlatformDirectoryItem>();

  for (let i = 0; i < rawList.length; i++) {
    const item = rawList[i];
    // Se for clínica ou paciente, ou registro não-account, mantém chave única sem agregação
    if (item.item_type !== "account") {
      consolidatedMap.set(`${item.item_type}:${item.item_id}`, item);
      continue;
    }

    const clinicsList: ClinicMembershipSummary[] = Array.isArray(item.metadata?.clinics)
      ? (item.metadata.clinics as ClinicMembershipSummary[])
      : [];

    let pausedFromList = 0;
    let activeFromList = 0;
    for (let j = 0; j < clinicsList.length; j++) {
      const c = clinicsList[j];
      const statusVal = c?.status ?? c?.membership_status ?? c?.clinic_status;
      if (isStatusActive(statusVal)) {
        activeFromList++;
      } else if (isStatusPaused(statusVal)) {
        pausedFromList++;
      }
    }

    const isSelfActive = isStatusActive(item.status);
    const isSelfPaused = isStatusPaused(item.status);

    const existingKey = `account:${item.item_id}`;
    const existing = consolidatedMap.get(existingKey);

    if (!existing) {
      const isItemOwner = Boolean(
        item.metadata?.is_owner ?? (item.metadata?.account_role === "account_owner")
      );

      const pausedCount = Math.max(
        typeof item.metadata?.paused_clinics_count === "number"
          ? (item.metadata.paused_clinics_count as number)
          : 0,
        pausedFromList,
        isSelfPaused ? 1 : 0
      );

      const hasActive = isSelfActive || activeFromList > 0;
      // Se o usuário tem pelo menos uma clínica ativa, seu status principal é ativo
      const finalStatus = hasActive ? "active" : item.status;
      const hasMixed =
        (finalStatus === "active" && pausedCount > 0) ||
        Boolean(item.metadata?.has_mixed_statuses);

      consolidatedMap.set(existingKey, {
        ...item,
        status: finalStatus,
        metadata: {
          ...item.metadata,
          is_owner: isItemOwner,
          clinics_count: item.metadata?.clinics_count ?? (item.clinic_name ? 1 : 0),
          paused_clinics_count: pausedCount,
          has_mixed_statuses: hasMixed,
        },
      });
    } else {
      // Já existe um registro para este usuário: consolida clínicas e papéis
      const prevCount = (existing.metadata?.clinics_count as number) || 1;
      const isItemOwner = Boolean(
        existing.metadata?.is_owner ||
          item.metadata?.is_owner ||
          item.metadata?.account_role === "account_owner"
      );

      // Regra de precedência estrita: se o item existente ou o novo tiver status ativo, permanece ativo
      const hasActive =
        isStatusActive(existing.status) || isSelfActive || activeFromList > 0;
      const finalStatus = hasActive ? "active" : (item.status || existing.status);

      const prevPausedCount = (existing.metadata?.paused_clinics_count as number) || 0;
      const additionalPaused = pausedFromList > 0 ? pausedFromList : (isSelfPaused ? 1 : 0);
      const newPausedCount = prevPausedCount + additionalPaused;

      const hasMixedStatuses = Boolean(
        existing.metadata?.has_mixed_statuses ||
          item.metadata?.has_mixed_statuses ||
          (hasActive && newPausedCount > 0) ||
          (existing.status !== item.status)
      );

      const existingClinics = Array.isArray(existing.metadata?.clinics)
        ? (existing.metadata.clinics as ClinicMembershipSummary[])
        : [];
      const mergedClinics =
        clinicsList.length > 0
          ? existingClinics.length > 0
            ? [...existingClinics, ...clinicsList]
            : clinicsList
          : existingClinics.length > 0
          ? existingClinics
          : undefined;

      consolidatedMap.set(existingKey, {
        ...existing,
        status: finalStatus,
        metadata: {
          ...existing.metadata,
          ...item.metadata,
          ...(mergedClinics ? { clinics: mergedClinics } : {}),
          is_owner: isItemOwner,
          clinics_count: prevCount + 1,
          paused_clinics_count: newPausedCount,
          has_mixed_statuses: hasMixedStatuses,
        },
      });
    }
  }

  return Array.from(consolidatedMap.values());
}
