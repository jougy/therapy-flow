import React, { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { AffiliateTier } from "@/lib/affiliate-tiers";
import { ArrowLeft, Loader2, Shield } from "lucide-react";
import { AffiliateMetricsCards } from "./affiliate-management/AffiliateMetricsCards";
import { AffiliateRegistrationSection } from "./affiliate-management/AffiliateRegistrationSection";
import { AffiliateTierSection } from "./affiliate-management/AffiliateTierSection";
import { AffiliateStatusSection } from "./affiliate-management/AffiliateStatusSection";
import { AffiliateSelectionList } from "./affiliate-management/AffiliateSelectionList";
import type { AffiliateRecord, AffiliateStatus, KycStatus } from "./affiliate-management/types";

export type { AffiliateRecord, AffiliateStatus, KycStatus };

export interface PlatformAffiliateManagementModalProps {
  affiliateId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const PlatformAffiliateManagementModal: React.FC<PlatformAffiliateManagementModalProps> = ({
  affiliateId,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { toast } = useToast();
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [affiliatesList, setAffiliatesList] = useState<AffiliateRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  const effectiveAffiliateId = affiliateId || internalSelectedId;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [affiliate, setAffiliate] = useState<AffiliateRecord | null>(null);

  // Form states
  const [tier, setTier] = useState<AffiliateTier>("bronze");
  const [minimumTierFloor, setMinimumTierFloor] = useState<AffiliateTier>("bronze");
  const [isTierManualOverride, setIsTierManualOverride] = useState(false);
  const [firstMonthPercent, setFirstMonthPercent] = useState<number>(30);
  const [recurringPercent, setRecurringPercent] = useState<number>(10);
  const [isSubscriptionWaived, setIsSubscriptionWaived] = useState(false);
  const [isWaiverManualOverride, setIsWaiverManualOverride] = useState(false);
  const [manualTierNotes, setManualTierNotes] = useState("");
  const [status, setStatus] = useState<AffiliateStatus>("active");
  const [lockedReason, setLockedReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadAllAffiliates = useCallback(async () => {
    setLoadingList(true);
    try {
      const { data, error } = await (supabase as any)
        .from("affiliates")
        .select(`
          *,
          profile:profiles!user_id (id, full_name, email, cpf)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAffiliatesList(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      console.warn("[PlatformAffiliateManagementModal] Falha ao carregar lista de afiliados:", err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadAffiliate = useCallback(async (targetId: string) => {
    if (!targetId) return;
    setLoading(true);
    setValidationError(null);
    try {
      const { data, error } = await (supabase as any)
        .from("affiliates")
        .select(`
          *,
          profile:profiles!user_id (id, full_name, email, cpf)
        `)
        .eq("id", targetId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Afiliado não encontrado.");

      setAffiliate(data);
      setTier(data.tier || "bronze");
      setMinimumTierFloor(data.minimum_tier_floor || "bronze");
      setIsTierManualOverride(Boolean(data.is_tier_manual_override));
      setFirstMonthPercent(Number(data.first_month_commission_percent) || 30);
      setRecurringPercent(Number(data.recurring_commission_percent) || 10);
      setIsSubscriptionWaived(Boolean(data.is_subscription_waived));
      setIsWaiverManualOverride(Boolean(data.is_waiver_manual_override));
      setManualTierNotes(data.manual_tier_notes || "");
      setStatus(data.status || "active");
      setLockedReason(data.locked_reason || "");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar dados do afiliado.";
      toast({ title: "Falha ao carregar", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isOpen) {
      if (affiliateId) {
        setInternalSelectedId(null);
        void loadAffiliate(affiliateId);
      } else if (internalSelectedId) {
        void loadAffiliate(internalSelectedId);
      } else {
        setAffiliate(null);
        void loadAllAffiliates();
      }
    } else {
      setInternalSelectedId(null);
      setAffiliate(null);
      setValidationError(null);
    }
  }, [isOpen, affiliateId, internalSelectedId, loadAffiliate, loadAllAffiliates]);

  const kycStatus: KycStatus = affiliate?.kyc_status || (
    status === "banned" || status === "suspended"
      ? "REJECTED"
      : affiliate?.asaas_account_id
        ? "APPROVED"
        : "PENDING"
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if ((status === "suspended" || status === "banned") && !lockedReason.trim()) {
      const msg = "O motivo é obrigatório para suspender ou banir o afiliado.";
      setValidationError(msg);
      toast({ title: "Atenção", description: msg, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const targetId = effectiveAffiliateId;
      if (!targetId) throw new Error("Nenhum parceiro selecionado.");

      const updatePayload: Record<string, unknown> = {
        tier,
        minimum_tier_floor: minimumTierFloor,
        is_tier_manual_override: isTierManualOverride,
        first_month_commission_percent: firstMonthPercent,
        recurring_commission_percent: recurringPercent,
        is_subscription_waived: isSubscriptionWaived,
        is_waiver_manual_override: isWaiverManualOverride,
        manual_tier_notes: manualTierNotes.trim() || null,
        status,
        locked_reason: (status === "suspended" || status === "banned") ? lockedReason.trim() : null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase as any)
        .from("affiliates")
        .update(updatePayload)
        .eq("id", targetId);

      if (error) throw error;

      toast({
        title: "Afiliado atualizado com sucesso!",
        description: `Dados e regras de ${affiliate?.coupon_code || "afiliado"} sincronizados.`,
      });

      onSuccess?.();
      if (!affiliateId) {
        void loadAllAffiliates();
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar alterações.";
      toast({ title: "Falha ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="platform-affiliate-management-modal"
        className="w-full max-w-2xl min-w-0 max-h-[88dvh] overflow-y-auto overscroll-contain overflow-x-hidden p-4 sm:p-6"
      >
        <DialogHeader className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary shrink-0" />
              Gestão Soberana de Afiliado
            </DialogTitle>
            {affiliate?.coupon_code && (
              <Badge variant="outline" className="font-mono text-xs">
                {affiliate.coupon_code}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Auditoria cadastral, controle soberano de comissões, isenções e governança de status.
          </DialogDescription>
        </DialogHeader>

        {!effectiveAffiliateId ? (
          <AffiliateSelectionList
            affiliates={affiliatesList}
            loading={loadingList}
            onSelect={(id) => setInternalSelectedId(id)}
          />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">Carregando dados do parceiro...</p>
          </div>
        ) : !affiliate ? (
          <div className="text-center py-8 text-sm text-destructive">
            Não foi possível carregar os dados deste afiliado.
          </div>
        ) : (
          <form noValidate onSubmit={handleSave} className="space-y-4 w-full max-w-full min-w-0">
            {!affiliateId && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setInternalSelectedId(null);
                  setAffiliate(null);
                }}
                className="h-7 text-xs gap-1 -mt-1 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar à lista de parceiros
              </Button>
            )}
            {/* 1. Métricas Agregadas */}
            <AffiliateMetricsCards affiliate={affiliate} />

            {/* 2. Dados Cadastrais & Subconta Asaas */}
            <AffiliateRegistrationSection affiliate={affiliate} kycStatus={kycStatus} />

            {/* 3 & 4. Gestão de Tier, Alíquotas e Isenção */}
            <AffiliateTierSection
              tier={tier}
              onTierChange={setTier}
              minimumTierFloor={minimumTierFloor}
              onMinimumTierFloorChange={setMinimumTierFloor}
              isTierManualOverride={isTierManualOverride}
              onIsTierManualOverrideChange={setIsTierManualOverride}
              firstMonthPercent={firstMonthPercent}
              onFirstMonthPercentChange={setFirstMonthPercent}
              recurringPercent={recurringPercent}
              onRecurringPercentChange={setRecurringPercent}
              isSubscriptionWaived={isSubscriptionWaived}
              onIsSubscriptionWaivedChange={setIsSubscriptionWaived}
              isWaiverManualOverride={isWaiverManualOverride}
              onIsWaiverManualOverrideChange={setIsWaiverManualOverride}
              manualTierNotes={manualTierNotes}
              onManualTierNotesChange={setManualTierNotes}
            />

            {/* 5. Governança de Status & Suspensão/Bloqueio */}
            <AffiliateStatusSection
              status={status}
              onStatusChange={setStatus}
              lockedReason={lockedReason}
              onLockedReasonChange={(reason) => {
                setLockedReason(reason);
                if (reason.trim()) setValidationError(null);
              }}
              validationError={validationError}
            />

            <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                data-testid="save-affiliate-btn"
                className="w-full sm:w-auto min-h-[44px]"
                disabled={saving}
              >
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
