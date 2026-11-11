import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AFFILIATE_TIERS } from "@/lib/affiliate-tiers";
import { toast } from "@/hooks/use-toast";
import type { AffiliateRecordData, AffiliateInvitationData } from "./types";

interface UseUserAffiliateParams {
  userId: string;
  userName: string;
  userEmail?: string;
  primaryClinicId?: string;
  onAffiliateStatusChange?: () => void;
}

export function useUserAffiliate({
  userId,
  userName,
  userEmail,
  primaryClinicId,
  onAffiliateStatusChange,
}: UseUserAffiliateParams) {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [affiliate, setAffiliate] = useState<AffiliateRecordData | null>(null);
  const [invitation, setInvitation] = useState<AffiliateInvitationData | null>(null);

  const loadAffiliateStatus = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    try {
      // 1. Busca se já é afiliado
      const { data: affData, error: affErr } = await (supabase as any)
        .from("affiliates")
        .select(
          "id, user_id, clinic_id, tier, minimum_tier_floor, status, coupon_code, referral_slug, active_referrals_count, total_sales_count, lifetime_commission_cents, created_at"
        )
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (affErr) {
        console.warn("[useUserAffiliate] Erro ao buscar affiliates:", affErr);
      }

      if (affData) {
        setAffiliate(affData as AffiliateRecordData);
        setInvitation(null);
        return;
      }

      setAffiliate(null);

      // 2. Se não for afiliado, busca convite pendente
      let invQuery = (supabase as any)
        .from("affiliate_invitations")
        .select("*")
        .eq("status", "pending")
        .is("deleted_at", null);

      if (userEmail && userEmail.trim().length > 0) {
        invQuery = invQuery.or(`invited_user_id.eq.${userId},invited_email.eq.${userEmail}`);
      } else {
        invQuery = invQuery.eq("invited_user_id", userId);
      }

      const { data: invData, error: invErr } = await invQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invErr) {
        console.warn("[useUserAffiliate] Erro ao buscar convite:", invErr);
      }

      setInvitation((invData as AffiliateInvitationData) || null);
    } catch (err) {
      console.error("[useUserAffiliate] Falha ao carregar status:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail]);

  useEffect(() => {
    void loadAffiliateStatus();
  }, [loadAffiliateStatus]);

  // Ação Master: Confirmar e Ativar Afiliação Manualmente
  const confirmInvitation = async () => {
    if (!invitation) return;
    setActionLoading(true);

    try {
      // 1. Tentar RPC oficial de resposta de convite
      try {
        await (supabase as any).rpc("respond_affiliate_invitation", {
          _invitation_id: invitation.id,
          _response: "accepted",
        });
      } catch (rpcErr) {
        console.warn("[useUserAffiliate] RPC respond_affiliate_invitation aviso:", rpcErr);
      }

      // 2. Garantir atualização do convite para accepted
      await (supabase as any)
        .from("affiliate_invitations")
        .update({
          status: "accepted",
          invited_user_id: userId,
          responded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", invitation.id);

      // 3. Verificar se o registro em affiliates já existe
      const { data: existingAff } = await (supabase as any)
        .from("affiliates")
        .select("id")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .maybeSingle();

      if (!existingAff) {
        const cleanName = (userName || "PARCEIRO")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase();
        const codePrefix = cleanName.slice(0, 8) || "AFILIADO";
        const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
        const couponCode = `${codePrefix}${rand}`;

        const slugPrefix =
          (userName || "parceiro")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
            .slice(0, 20) || "afiliado";
        const referralSlug = `${slugPrefix}-${Math.random().toString(36).substring(2, 6)}`;

        const targetTier = invitation.floor_tier || "bronze";
        const isCustom = invitation.metadata?.is_custom;
        const customComms = invitation.metadata?.custom_commissions;
        const tierDef =
          AFFILIATE_TIERS.find((t) => t.tier === targetTier) || AFFILIATE_TIERS[0];

        const firstMonth =
          isCustom && customComms?.first_month_percent != null
            ? Number(customComms.first_month_percent)
            : tierDef.firstMonthCommissionPercent;

        const recurring =
          isCustom && customComms?.recurring_percent != null
            ? Number(customComms.recurring_percent)
            : tierDef.recurringCommissionPercent;

        const asaasAccountId =
          invitation.metadata?.asaas_account_id ||
          `pending_${userId.replace(/-/g, "").substring(0, 16)}`;

        const { error: insertErr } = await (supabase as any).from("affiliates").insert({
          user_id: userId,
          clinic_id: invitation.clinic_id || primaryClinicId || null,
          coupon_code: couponCode,
          referral_slug: referralSlug,
          asaas_account_id: asaasAccountId,
          status: "active",
          tier: targetTier,
          minimum_tier_floor: targetTier,
          first_month_commission_percent: firstMonth,
          recurring_commission_percent: recurring,
        });

        if (insertErr) {
          throw insertErr;
        }
      }

      toast({
        title: "Afiliação ativada!",
        description: `O convite foi confirmado e ${userName} agora é um afiliado ativo.`,
      });

      onAffiliateStatusChange?.();
      await loadAffiliateStatus();
    } catch (err: any) {
      console.error("[useUserAffiliate] Erro ao confirmar afiliação:", err);
      toast({
        title: "Erro ao confirmar afiliação",
        description: err?.message || "Não foi possível confirmar o convite do afiliado.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  return {
    loading,
    actionLoading,
    affiliate,
    invitation,
    loadAffiliateStatus,
    confirmInvitation,
  };
}
