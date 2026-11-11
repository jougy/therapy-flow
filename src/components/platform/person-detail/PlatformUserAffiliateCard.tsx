import React, { useState } from "react";
import {
  Award,
  Check,
  Clock3,
  Copy,
  Loader2,
  Sparkles,
  Sliders,
  UserPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { AFFILIATE_TIERS } from "@/lib/affiliate-tiers";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { PlatformInviteAffiliateModal } from "@/components/platform/PlatformInviteAffiliateModal";
import { PlatformAffiliateManagementModal } from "@/components/platform/PlatformAffiliateManagementModal";
import type { PlatformUserAffiliateCardProps } from "./types";
import { useUserAffiliate } from "./useUserAffiliate";

export { PlatformUserAffiliateCardProps };

export const PlatformUserAffiliateCard: React.FC<PlatformUserAffiliateCardProps> = ({
  userId,
  userName,
  userEmail,
  userPhone,
  primaryClinicId,
  onAffiliateStatusChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [manageModalOpen, setManageModalOpen] = useState(false);

  const {
    loading,
    actionLoading,
    affiliate,
    invitation,
    loadAffiliateStatus,
    confirmInvitation,
  } = useUserAffiliate({
    userId,
    userName,
    userEmail,
    primaryClinicId,
    onAffiliateStatusChange,
  });

  const handleCopyInviteLink = async () => {
    if (!invitation?.token) return;
    const inviteUrl = buildPublicAppUrl(`/afiliados/onboarding?token=${invitation.token}`);

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(inviteUrl);
      }
      setCopied(true);
      toast({
        title: "Link copiado!",
        description: "Link do convite copiado para a área de transferência.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link automaticamente.",
        variant: "destructive",
      });
    }
  };

  const currentTierDef = affiliate
    ? AFFILIATE_TIERS.find((t) => t.tier === affiliate.tier) || AFFILIATE_TIERS[0]
    : null;

  const invitationTierDef = invitation
    ? AFFILIATE_TIERS.find((t) => t.tier === invitation.floor_tier) || AFFILIATE_TIERS[0]
    : null;

  return (
    <>
      <Card
        className="w-full max-w-full min-w-0 shadow-sm"
        data-testid="platform-user-affiliate-card"
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Award className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base font-semibold leading-tight truncate">
                  Programa de Afiliados
                </CardTitle>
                <p className="text-xs text-muted-foreground truncate">
                  Parceria & Comissionamento
                </p>
              </div>
            </div>

            {!loading && (
              <div className="shrink-0">
                {affiliate ? (
                  <Badge
                    data-testid="affiliate-status-active"
                    variant="outline"
                    className={
                      currentTierDef?.badgeColorClass ||
                      "bg-emerald-50 text-emerald-700 border-emerald-300"
                    }
                  >
                    {currentTierDef?.label || "Afiliado"}
                  </Badge>
                ) : invitation ? (
                  <Badge
                    data-testid="affiliate-status-pending"
                    variant="outline"
                    className="bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300"
                  >
                    Convite Pendente
                  </Badge>
                ) : (
                  <Badge
                    data-testid="affiliate-status-none"
                    variant="outline"
                    className="text-muted-foreground border-border"
                  >
                    Não Afiliado
                  </Badge>
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              <span className="text-xs">Consultando afiliação...</span>
            </div>
          ) : affiliate ? (
            /* CASO 1: Já é Afiliado */
            <div className="space-y-3">
              <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Status da Afiliação:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
                    {affiliate.status === "active" ? "Ativo" : affiliate.status}
                  </span>
                </div>

                {affiliate.coupon_code && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Cupom de Indicação:</span>
                    <span className="font-mono font-medium">{affiliate.coupon_code}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1 border-t text-xs">
                  <div>
                    <p className="text-muted-foreground text-[11px]">Indicados Ativos</p>
                    <p className="text-sm font-semibold">{affiliate.active_referrals_count ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-[11px]">Vendas Totais</p>
                    <p className="text-sm font-semibold">{affiliate.total_sales_count ?? 0}</p>
                  </div>
                </div>

                {affiliate.lifetime_commission_cents != null && (
                  <div className="pt-1 border-t flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Comissões Acumuladas:</span>
                    <span className="font-semibold text-foreground">
                      {((affiliate.lifetime_commission_cents || 0) / 100).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </span>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 border-primary/30 hover:border-primary text-sm font-medium"
                data-testid="btn-manage-affiliate"
                onClick={() => setManageModalOpen(true)}
              >
                <Sliders className="h-4 w-4 text-primary" />
                Gerenciar Afiliado
              </Button>
            </div>
          ) : invitation ? (
            /* CASO 2: Convite Pendente */
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Clock3 className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-amber-900 dark:text-amber-200">
                      Convite de Afiliação Enviado
                    </p>
                    {invitation.created_at && (
                      <p className="text-muted-foreground">
                        Enviado em {new Date(invitation.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-1.5 border-t border-amber-500/10 text-xs text-muted-foreground">
                  {invitation.metadata?.is_custom ? (
                    <p>
                      Comissões acordadas:{" "}
                      <span className="font-semibold text-foreground">
                        {invitation.metadata.custom_commissions?.first_month_percent ?? 30}% (1º
                        mês) / {invitation.metadata.custom_commissions?.recurring_percent ?? 10}%
                        (recorrente)
                      </span>
                    </p>
                  ) : (
                    <p>
                      Piso garantido:{" "}
                      <span className="font-semibold text-foreground">
                        {invitationTierDef?.label || "Bronze"}
                      </span>
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  data-testid="btn-confirm-invitation"
                  disabled={actionLoading}
                  onClick={confirmInvitation}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Confirmar e Ativar Afiliação
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  data-testid="btn-copy-invite-link"
                  onClick={handleCopyInviteLink}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Link Copiado!" : "Copiar Link do Convite"}
                </Button>
              </div>
            </div>
          ) : (
            /* CASO 3: Não Afiliado */
            <div className="space-y-3">
              <div className="rounded-lg border border-dashed p-4 text-center space-y-1.5 bg-muted/10">
                <p className="text-xs font-medium text-foreground">
                  Este usuário ainda não faz parte do programa de afiliados.
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Emita um convite com piso mínimo garantido ou comissões personalizadas.
                </p>
              </div>

              <Button
                type="button"
                className="w-full gap-2 shadow-sm"
                data-testid="btn-invite-affiliate"
                onClick={() => setInviteModalOpen(true)}
              >
                <UserPlus className="h-4 w-4" />
                Convidar para Afiliado
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Convidar Afiliado */}
      <PlatformInviteAffiliateModal
        isOpen={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        user={{
          id: userId,
          fullName: userName,
          email: userEmail,
          phone: userPhone,
          clinicId: primaryClinicId,
        }}
        onInviteSuccess={async () => {
          onAffiliateStatusChange?.();
          await loadAffiliateStatus();
        }}
      />

      {/* Modal de Gerenciamento de Afiliado */}
      <PlatformAffiliateManagementModal
        isOpen={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        affiliateId={affiliate?.id}
        onSuccess={async () => {
          onAffiliateStatusChange?.();
          await loadAffiliateStatus();
        }}
      />
    </>
  );
};
