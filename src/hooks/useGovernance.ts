import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PunishmentType =
  | "sync_throttle"
  | "warning_modal"
  | "read_only_mode"
  | "revoke_print_export"
  | "temporary_suspension"
  | "permanent_ban";

export interface ActivePunishmentItem {
  punishment_id: string;
  punishment_type: PunishmentType;
  applied_at: string;
  expires_at: string | null;
  reason: string;
  is_manual: boolean;
  applied_by_name: string;
}

export function useGovernance() {
  const { user } = useAuth();
  const [activePunishments, setActivePunishments] = useState<ActivePunishmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchActiveGovernance = useCallback(async () => {
    if (!user?.id) {
      setActivePunishments([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_user_active_governance", {
        _user_id: user.id,
      });

      if (error) {
        console.warn("[Governance] Failed to load user active governance:", error.message);
        return;
      }

      setActivePunishments((data || []) as ActivePunishmentItem[]);
    } catch (err) {
      console.warn("[Governance] Error in fetchActiveGovernance:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void fetchActiveGovernance();
  }, [fetchActiveGovernance]);

  const isSyncThrottled = activePunishments.some((p) => p.punishment_type === "sync_throttle");
  const isWarningModal = activePunishments.some((p) => p.punishment_type === "warning_modal");
  const isReadOnly = activePunishments.some((p) => p.punishment_type === "read_only_mode");
  const isPrintExportRevoked = activePunishments.some((p) => p.punishment_type === "revoke_print_export");
  const suspensionItem = activePunishments.find(
    (p) => p.punishment_type === "temporary_suspension" || p.punishment_type === "permanent_ban"
  );

  const isSuspended = Boolean(suspensionItem);
  const suspensionReason = suspensionItem?.reason || null;

  return {
    activePunishments,
    isSyncThrottled,
    isWarningModal,
    isReadOnly,
    isPrintExportRevoked,
    isSuspended,
    suspensionReason,
    loading,
    refetchGovernance: fetchActiveGovernance,
  };
}
