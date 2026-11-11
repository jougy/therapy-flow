import React, { useState, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Trophy,
  Flame,
  Clock,
  Copy,
  Check,
  Share2,
  Info,
  Sparkles,
  CheckCircle2,
  Zap,
  Settings,
} from "lucide-react";
import {
  AffiliateCampaignConfig,
  DEFAULT_CAMPAIGN_CONFIG as BASE_DEFAULT_CONFIG,
  DEFAULT_CAMPAIGN_RULES,
} from "./campaignTypes";
import {
  CountdownState,
  calculateCountdown,
  useCountdown,
  formatCampaignBonus,
  getDefaultCampaignEndDate,
} from "./campaignCountdown";
import { CampaignRulesModal } from "./CampaignRulesModal";
import { useAffiliateCampaignConfig } from "./useAffiliateCampaignConfig";
import { PlatformCampaignEditorModal } from "./PlatformCampaignEditorModal";

// Re-exportações canônicas para retrocompatibilidade
export type { CountdownState };
export {
  calculateCountdown,
  useCountdown,
  formatCampaignBonus,
  getDefaultCampaignEndDate,
};

export const DEFAULT_CAMPAIGN_CONFIG = {
  ...BASE_DEFAULT_CONFIG,
  currentCount: 0,
};

export interface AffiliateSeasonalCampaignCardProps {
  config?: AffiliateCampaignConfig;
  canEdit?: boolean;
  title?: string;
  description?: string;
  targetCount?: number;
  currentCount?: number;
  bonusValueCents?: number;
  endDate?: Date | string;
  couponCode?: string;
  referralSlug?: string;
  campaignUrl?: string;
  onViewDetails?: () => void;
  onCopyLink?: (link: string) => void;
  onShareWhatsApp?: (link: string) => void;
  onConfigure?: () => void;
  className?: string;
}

export const AffiliateSeasonalCampaignCard: React.FC<AffiliateSeasonalCampaignCardProps> = ({
  config: propConfig,
  canEdit = false,
  title: propTitle,
  description: propDescription,
  targetCount: propTargetCount,
  currentCount = 0,
  bonusValueCents: propBonusValueCents,
  endDate: propEndDate,
  couponCode,
  referralSlug,
  campaignUrl,
  onViewDetails,
  onCopyLink,
  onShareWhatsApp,
  onConfigure,
  className = "",
}) => {
  const hook = useAffiliateCampaignConfig();
  const activeConfig = propConfig ?? hook.config;

  const [copied, setCopied] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);

  // Resolução com precedência de props sobre a configuração persistida
  const effectiveIsActive = activeConfig.isActive ?? true;
  const effectiveTitle = propTitle ?? activeConfig.title ?? DEFAULT_CAMPAIGN_CONFIG.title;
  const effectiveDescription =
    propDescription ?? activeConfig.description ?? DEFAULT_CAMPAIGN_CONFIG.description;
  const effectiveTargetCount =
    propTargetCount ?? activeConfig.targetCount ?? DEFAULT_CAMPAIGN_CONFIG.targetCount;
  const effectiveBonusValueCents =
    propBonusValueCents ?? activeConfig.bonusValueCents ?? DEFAULT_CAMPAIGN_CONFIG.bonusValueCents;
  const effectiveBadgeLabel = activeConfig.badgeLabel ?? "Desafio Sazonal Ativo";
  const effectiveRulesList =
    activeConfig.rulesList && activeConfig.rulesList.length > 0
      ? activeConfig.rulesList
      : DEFAULT_CAMPAIGN_RULES;

  // Fallback seguro de data de término
  const effectiveEndDate = useMemo(() => {
    if (propEndDate) return propEndDate;
    if (activeConfig.endDate) return activeConfig.endDate;
    return getDefaultCampaignEndDate();
  }, [propEndDate, activeConfig.endDate]);

  const countdown = useCountdown(effectiveEndDate);

  const safeTarget = Math.max(1, effectiveTargetCount);
  const safeCurrent = Math.max(0, currentCount);
  const progressPercent = Math.min(100, Math.round((safeCurrent / safeTarget) * 100));
  const isGoalReached = safeCurrent >= safeTarget;
  const remainingClinics = Math.max(0, safeTarget - safeCurrent);

  const formattedBonus = useMemo(
    () => formatCampaignBonus(effectiveBonusValueCents),
    [effectiveBonusValueCents]
  );

  const generatedCampaignUrl = useMemo(() => {
    if (campaignUrl) return campaignUrl;
    const params = new URLSearchParams();
    if (couponCode) params.set("cupom", couponCode);
    if (referralSlug) params.set("ref", referralSlug);
    params.set("utm_source", "campaign");
    params.set("utm_medium", "affiliate");
    params.set("utm_campaign", "sprint-bonus");
    const qs = params.toString();
    return `https://pluri.health/${qs ? `?${qs}` : ""}`;
  }, [campaignUrl, couponCode, referralSlug]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard?.writeText(generatedCampaignUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
      onCopyLink?.(generatedCampaignUrl);
    } catch {
      onCopyLink?.(generatedCampaignUrl);
    }
  }, [generatedCampaignUrl, onCopyLink]);

  const handleWhatsApp = useCallback(() => {
    const text = `Participe comigo da Pluri Health! Acesse a plataforma com meu cupom especial e garanta desconto exclusivo na assinatura: ${generatedCampaignUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    if (typeof window !== "undefined") {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }
    onShareWhatsApp?.(generatedCampaignUrl);
  }, [generatedCampaignUrl, onShareWhatsApp]);

  const handleOpenDetails = useCallback(() => {
    if (onViewDetails) {
      onViewDetails();
    } else {
      setDetailsOpen(true);
    }
  }, [onViewDetails]);

  const handleOpenEditor = useCallback(() => {
    if (onConfigure) {
      onConfigure();
    } else {
      setEditorOpen(true);
    }
  }, [onConfigure]);

  // Se a campanha estiver desativada:
  // - No backoffice (canEdit=true): renderiza card compacto para permitir reativação/configuração
  // - No portal do parceiro (canEdit=false): oculta completamente (retorna null)
  if (!effectiveIsActive) {
    if (!canEdit) {
      return null;
    }

    return (
      <>
        <Card
          className={`p-4 sm:p-5 rounded-2xl border border-dashed border-amber-500/30 bg-muted/20 w-full max-w-full min-w-0 transition-all ${className}`}
          data-testid="affiliate-seasonal-campaign-inactive"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">
                    Nenhum Desafio Sazonal Ativo no Momento
                  </h4>
                  <Badge variant="outline" className="text-[10px] text-muted-foreground border-muted-foreground/30">
                    Inativo
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ative uma campanha com metas de indicação e bônus no Asaas para acelerar o crescimento da rede.
                </p>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleOpenEditor}
              className="text-xs h-10 sm:h-9 font-semibold gap-1.5 touch-manipulation min-h-[44px] sm:min-h-[36px] bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs shrink-0"
              data-testid="activate-campaign-btn"
            >
              <Sparkles className="h-3.5 w-3.5" />
              + Criar / Ativar Desafio
            </Button>
          </div>
        </Card>

        {canEdit && (
          <PlatformCampaignEditorModal
            open={editorOpen}
            onOpenChange={setEditorOpen}
            config={activeConfig}
            onSave={hook.saveConfig}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Card
        className={`relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-violet-500/10 p-4 sm:p-5 shadow-sm transition-all hover:border-amber-500/40 w-full max-w-full min-w-0 ${className}`}
        data-testid="affiliate-seasonal-campaign-card"
      >
        {/* Glows decorativos de fundo */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-12 h-36 w-36 rounded-full bg-violet-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 w-full max-w-full min-w-0">
          {/* Header com Badges & Botão de Configuração */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-[11px] gap-1 shadow-2xs border-0 py-1"
                data-testid="campaign-badge"
              >
                <Flame className="h-3 w-3 animate-pulse" />
                {effectiveBadgeLabel}
              </Badge>
              {countdown.isExpired ? (
                <Badge variant="outline" className="border-rose-500/40 text-rose-600 dark:text-rose-400 text-[11px]">
                  Campanha Encerrada
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300 text-[11px] gap-1">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  Bônus Extra
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Badge de Premiação */}
              <Badge
                variant="outline"
                className="bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 text-xs sm:text-sm font-bold py-1 px-3 shadow-2xs transition-colors"
                data-testid="reward-badge"
              >
                <Trophy className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>+ {formattedBonus} no Asaas</span>
              </Badge>

              {/* Botão de Edição Soberana (Apenas Backoffice / Master Admin) */}
              {canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleOpenEditor}
                  className="h-8 px-2.5 text-xs gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 touch-manipulation min-h-[36px]"
                  data-testid="campaign-configure-btn"
                  title="Configurar Desafio Sazonal"
                  aria-label="Configurar Desafio Sazonal"
                >
                  <Settings className="h-3.5 w-3.5 text-amber-600" />
                  <span className="hidden sm:inline">Configurar</span>
                </Button>
              )}
            </div>
          </div>

          {/* Título & Descrição */}
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              {effectiveTitle}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {effectiveDescription}
            </p>
          </div>

          {/* Seção de Progresso da Meta */}
          <div className="space-y-2 rounded-xl bg-card/60 border border-border/60 p-3 sm:p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                Progresso da Meta
              </span>
              <span className="font-bold text-foreground" data-testid="campaign-progress-label">
                {safeCurrent} de {safeTarget} clínicas indicadas ({progressPercent}%)
              </span>
            </div>

            <Progress
              value={progressPercent}
              className="h-2.5 sm:h-3 rounded-full bg-muted/80"
              data-testid="campaign-progress-bar"
            />

            <div className="text-[11px]">
              {isGoalReached ? (
                <p className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Meta atingida! Seu bônus de {formattedBonus} está garantido na apuração do ciclo.
                </p>
              ) : safeCurrent === 0 ? (
                <p className="text-muted-foreground">
                  Nenhuma indicação registrada nesta campanha ainda. Compartilhe seu link para dar a largada no sprint!
                </p>
              ) : (
                <p className="text-muted-foreground">
                  Falta{remainingClinics > 1 ? "m" : ""} apenas <span className="font-bold text-foreground">{remainingClinics}</span> indicação{remainingClinics > 1 ? "ões" : ""} para destravar o bônus de {formattedBonus} no Asaas.
                </p>
              )}
            </div>
          </div>

          {/* Relógio Regressivo Dinâmico */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                Tempo Restante do Desafio:
              </span>
              {countdown.isExpired && (
                <span className="font-semibold text-rose-500 text-[11px]">Prazo esgotado</span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2 sm:gap-3 text-center" data-testid="countdown-container">
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <span className="text-base sm:text-xl font-black font-mono tracking-tight text-foreground" data-testid="countdown-days">
                  {countdown.formatted.days}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Dias</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <span className="text-base sm:text-xl font-black font-mono tracking-tight text-foreground" data-testid="countdown-hours">
                  {countdown.formatted.hours}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Horas</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <span className="text-base sm:text-xl font-black font-mono tracking-tight text-foreground" data-testid="countdown-minutes">
                  {countdown.formatted.minutes}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Minutos</span>
              </div>
              <div className="flex flex-col items-center justify-center p-2 rounded-xl bg-background/80 border border-border/60 shadow-2xs">
                <span className="text-base sm:text-xl font-black font-mono tracking-tight text-foreground" data-testid="countdown-seconds">
                  {countdown.formatted.seconds}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Segundos</span>
              </div>
            </div>
          </div>

          {/* Botões de Ação Rápida */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
            <Button
              type="button"
              onClick={handleCopy}
              className="h-11 sm:h-10 text-xs sm:text-sm font-semibold gap-2 min-h-[44px] touch-manipulation flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              data-testid="campaign-copy-btn"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-300" />
                  Link Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copiar Link do Desafio
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleWhatsApp}
              className="h-11 sm:h-10 text-xs sm:text-sm font-medium gap-2 min-h-[44px] touch-manipulation border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              data-testid="campaign-whatsapp-btn"
            >
              <Share2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              WhatsApp
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={handleOpenDetails}
              className="h-11 sm:h-10 text-xs sm:text-sm text-muted-foreground hover:text-foreground gap-1.5 min-h-[44px] touch-manipulation"
              data-testid="campaign-details-btn"
            >
              <Info className="h-4 w-4" />
              Regras do Desafio
            </Button>
          </div>
        </div>
      </Card>

      {/* Modal de Regras do Desafio */}
      <CampaignRulesModal
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        title={effectiveTitle}
        rulesList={effectiveRulesList}
      />

      {/* Modal de Edição da Campanha para o Backoffice */}
      {canEdit && (
        <PlatformCampaignEditorModal
          open={editorOpen}
          onOpenChange={setEditorOpen}
          config={activeConfig}
          onSave={hook.saveConfig}
        />
      )}
    </>
  );
};
