import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Gift,
  Calendar,
  Share2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { getAffiliateTierByVolume } from "@/lib/affiliate-tiers";

export interface AffiliateMrrCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialReferrals?: number;
  baseTicket?: number;
  averageSessionPrice?: number;
  onStartSharing?: () => void;
}

export const BASE_TICKET_DEFAULT = 147;
export const DEFAULT_SESSION_PRICE = 150;
const PRESET_TIERS = [3, 5, 10, 15, 30, 50, 100, 200];

export function formatBRL(amount: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function AffiliateMrrCalculatorModal({
  isOpen,
  onClose,
  initialReferrals = 10,
  baseTicket = BASE_TICKET_DEFAULT,
  averageSessionPrice = DEFAULT_SESSION_PRICE,
  onStartSharing,
}: AffiliateMrrCalculatorModalProps) {
  const [referrals, setReferrals] = useState<number>(Math.max(1, initialReferrals));

  // Cálculo dinâmico das regras oficiais de afiliados
  const tierDef = getAffiliateTierByVolume(referrals);
  const monthlyMrr = referrals * baseTicket * (tierDef.recurringCommissionPercent / 100);
  const annualMrr = monthlyMrr * 12;
  const firstMonthTotal = referrals * baseTicket * (tierDef.firstMonthCommissionPercent / 100);
  const isWaived = tierDef.isSubscriptionWaived || referrals >= 4;
  const remainingForFreeSubscription = Math.max(0, 4 - referrals);
  const equivalentSessionsAnnual = Math.max(1, Math.round(annualMrr / averageSessionPrice));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="mrr-calculator-modal"
        className="w-full max-w-xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl"
      >
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                Simulador de Renda Recorrente (MRR)
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Projeção interativa de comissões passivas para parceiros Pluri
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Card do Nível Alcançado */}
          <div className="rounded-xl border bg-card p-3.5 sm:p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nível de Parceiro
              </span>
              <Badge
                data-testid="tier-badge"
                className={`px-2.5 py-0.5 text-xs font-bold border ${tierDef.badgeColorClass}`}
              >
                Tier {tierDef.label}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground">{tierDef.tagline}</p>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t text-xs">
              <div className="bg-muted/40 p-2 rounded-lg">
                <span className="text-muted-foreground block text-[11px]">1ª Mensalidade</span>
                <span className="font-bold text-foreground text-sm">
                  {tierDef.firstMonthCommissionPercent}%
                </span>
                <span className="text-[10px] text-muted-foreground block truncate">
                  ({formatBRL(firstMonthTotal)} inicial)
                </span>
              </div>
              <div className="bg-muted/40 p-2 rounded-lg">
                <span className="text-muted-foreground block text-[11px]">Recorrência Vitalícia</span>
                <span className="font-bold text-primary text-sm">
                  {tierDef.recurringCommissionPercent}%
                </span>
                <span className="text-[10px] text-muted-foreground block">todo mês ativo</span>
              </div>
            </div>
          </div>

          {/* Slider Interativo de Clínicas / Colegas */}
          <div className="space-y-3 bg-muted/30 p-3.5 sm:p-4 rounded-xl border border-muted">
            <div className="flex items-center justify-between">
              <label
                htmlFor="referral-slider"
                className="text-xs sm:text-sm font-medium text-foreground"
              >
                Quantas clínicas / colegas pretende indicar?
              </label>
              <div className="text-right">
                <span
                  data-testid="referral-count-display"
                  className="text-2xl sm:text-3xl font-extrabold text-primary font-mono"
                >
                  {referrals}
                </span>
                <span className="text-xs text-muted-foreground ml-1">
                  {referrals === 1 ? "clínica" : "clínicas"}
                </span>
              </div>
            </div>

            <div className="pt-2 pb-1">
              <Slider
                id="referral-slider"
                data-testid="referral-slider"
                aria-label="Número de clínicas indicadas"
                min={1}
                max={250}
                step={1}
                value={[referrals]}
                onValueChange={(val) => setReferrals(val[0] ?? 1)}
                className="cursor-pointer py-1"
              />
            </div>

            {/* Presets rápidos Mobile-Friendly */}
            <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-none">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                Atalhos:
              </span>
              {PRESET_TIERS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setReferrals(preset)}
                  className={`min-h-[32px] px-2.5 py-1 text-xs rounded-md font-semibold transition-all shrink-0 ${
                    referrals === preset
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-background border border-border text-foreground hover:bg-muted"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Renda Passiva: Mensal e Anual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 sm:p-4 rounded-xl border bg-gradient-to-br from-primary/5 via-card to-card space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>Renda Passiva Mensal</span>
              </div>
              <div
                data-testid="monthly-mrr-display"
                className="text-xl sm:text-2xl font-black text-primary tracking-tight font-mono"
              >
                {formatBRL(monthlyMrr)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Creditado mensalmente via split direto na sua subconta Asaas.
              </p>
            </div>

            <div className="p-3.5 sm:p-4 rounded-xl border bg-gradient-to-br from-amber-500/5 via-card to-card space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Gift className="w-3.5 h-3.5 text-amber-500" />
                <span>Renda Projetada (12 Meses)</span>
              </div>
              <div
                data-testid="annual-mrr-display"
                className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight font-mono"
              >
                {formatBRL(annualMrr)}
                <span className="text-xs font-normal text-muted-foreground ml-1">/ano</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Ganhos cumulativos mantendo as indicações ativas.
              </p>
            </div>
          </div>

          {/* Status de Isenção da Assinatura da Clínica */}
          <div
            data-testid="subscription-waived-badge"
            className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all ${
              isWaived
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-300"
                : "bg-muted/40 border-muted text-muted-foreground"
            }`}
          >
            {isWaived ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Clock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-0.5">
              <div className="font-bold flex items-center gap-1.5">
                {isWaived
                  ? "🎉 Assinatura 100% Gratuita (Isenção Ativa)"
                  : `Assinatura Gratuita a partir do Tier Prata`}
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                {isWaived
                  ? `Com ${referrals} indicações ativas, você desbloqueou a isenção de 100% da assinatura do Pluri Health (economia de mais de R$ 1.700/ano).`
                  : `Faltam apenas ${remainingForFreeSubscription} ${
                      remainingForFreeSubscription === 1 ? "indicação" : "indicações"
                    } para zerar 100% o custo da assinatura da sua clínica.`}
              </p>
            </div>
          </div>

          {/* Banner de Equivalência Motivacional */}
          <div
            data-testid="motivational-equivalence"
            className="p-3.5 rounded-xl bg-primary/10 border border-primary/20 text-foreground flex items-start gap-2.5"
          >
            <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-xs space-y-0.5">
              <span className="font-semibold text-primary block text-[11px] uppercase tracking-wide">
                Equivalência Clínica Real
              </span>
              <p className="text-xs text-foreground leading-relaxed">
                Isso equivale a{" "}
                <strong className="text-primary font-bold">
                  {equivalentSessionsAnnual} atendimentos particulares
                </strong>{" "}
                de fisioterapia por ano sem você precisar atender nenhum paciente a mais!
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t mt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] text-xs font-semibold"
          >
            Fechar
          </Button>

          <Button
            type="button"
            data-testid="btn-start-sharing"
            onClick={() => {
              if (onStartSharing) {
                onStartSharing();
              } else {
                onClose();
              }
            }}
            className="w-full sm:w-auto min-h-[44px] text-xs font-bold gap-2 bg-primary text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Share2 className="w-4 h-4" />
            <span>Começar a Indicar Agora</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
