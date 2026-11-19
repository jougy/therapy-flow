import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Clock, Package, Plus, ShieldCheck, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { formatMoneyCents } from "@/lib/session-operations";
import { cn } from "@/lib/utils";
import type { PatientHealthInsuranceRecord, PatientPaymentPlanRow } from "./types";

export interface PaymentsSummaryCardsProps {
  pendingTotalCents: number;
  pendingCount: number;
  creditBalanceCents: number;
  activePlan: PatientPaymentPlanRow | null;
  patientInsurance: PatientHealthInsuranceRecord | null;
  insuranceName: string | null;
  canManageFinance: boolean;
  onOpenReceiveAll: () => void;
  onOpenAddCredit: () => void;
  onOpenNewPlan: () => void;
  onOpenLinkInsurance: () => void;
}

export const PaymentsSummaryCards: React.FC<PaymentsSummaryCardsProps> = ({
  pendingTotalCents,
  pendingCount,
  creditBalanceCents,
  activePlan,
  patientInsurance,
  insuranceName,
  canManageFinance,
  onOpenReceiveAll,
  onOpenAddCredit,
  onOpenNewPlan,
  onOpenLinkInsurance,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi | null>(null);
  const [selectedSlide, setSelectedSlide] = React.useState(0);

  React.useEffect(() => {
    if (!carouselApi) return;
    const handleSelect = () => {
      setSelectedSlide(carouselApi.selectedScrollSnap());
    };
    handleSelect();
    carouselApi.on("select", handleSelect);
    carouselApi.on("reInit", handleSelect);
    return () => {
      carouselApi.off("select", handleSelect);
      carouselApi.off("reInit", handleSelect);
    };
  }, [carouselApi]);

  const totalSessions = activePlan?.total_sessions ?? 0;
  const usedSessions = activePlan?.used_sessions ?? 0;
  const planProgressPct =
    totalSessions > 0 ? Math.min(100, Math.round((usedSessions / totalSessions) * 100)) : 0;

  const creditCard = (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          <Wallet className="h-4 w-4 shrink-0" />
          Crédito Livre
        </span>
        {canManageFinance ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenAddCredit}
            className="min-h-[44px] border-emerald-500/40 bg-background/80 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Adicionar
          </Button>
        ) : null}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {formatMoneyCents(creditBalanceCents)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Saldo disponível para abater sessões
        </p>
      </div>
    </div>
  );

  const packageCard = (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
          <Package className="h-4 w-4 shrink-0" />
          Pacote Ativo
        </span>
        {canManageFinance ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onOpenNewPlan}
            className="min-h-[44px] px-2.5 text-xs font-semibold text-primary hover:bg-primary/10"
          >
            {activePlan ? "Renovar" : "+ Novo"}
          </Button>
        ) : null}
      </div>
      <div className="mt-3 space-y-2">
        {activePlan ? (
          <>
            <p className="text-xl font-bold tracking-tight text-foreground">
              {usedSessions} / {totalSessions} sessões
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-primary/15">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={shouldReduceMotion ? false : { width: 0 }}
                animate={{ width: `${planProgressPct}%` }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 260, damping: 28 }
                }
              />
            </div>
          </>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">
            Nenhum pacote ativo no momento
          </p>
        )}
      </div>
    </div>
  );

  const insuranceCard = (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-sky-500/30 bg-sky-500/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Convênio
        </span>
        {canManageFinance ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onOpenLinkInsurance}
            className="min-h-[44px] border-sky-500/40 bg-background/80 px-3 text-xs font-semibold text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
          >
            {patientInsurance ? "Atualizar" : "+ Vincular"}
          </Button>
        ) : null}
      </div>
      <div className="mt-3 min-w-0">
        {patientInsurance ? (
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-base font-bold text-foreground">
              {insuranceName || "Convênio vinculado"}
            </p>
            <Badge
              variant="secondary"
              className="shrink-0 border border-sky-500/30 bg-sky-500/15 text-sky-700 dark:text-sky-300"
            >
              Ativo
            </Badge>
          </div>
        ) : (
          <p className="text-sm font-medium text-muted-foreground">
            Atendimento particular
          </p>
        )}
      </div>
    </div>
  );

  const pendingPillMobile = (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border px-4 py-2.5",
        pendingTotalCents > 0
          ? "border-amber-500/35 bg-amber-500/10"
          : "border-emerald-500/25 bg-emerald-500/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Clock
          className={cn(
            "h-4 w-4 shrink-0",
            pendingTotalCents > 0
              ? "text-amber-600 dark:text-amber-400"
              : "text-emerald-600 dark:text-emerald-400",
          )}
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            A Receber
          </p>
          <p className="truncate text-sm font-bold text-foreground">
            {pendingTotalCents > 0
              ? `${formatMoneyCents(pendingTotalCents)} (${pendingCount})`
              : "Tudo em dia"}
          </p>
        </div>
      </div>

      {pendingTotalCents > 0 && canManageFinance ? (
        <Button
          type="button"
          size="sm"
          onClick={onOpenReceiveAll}
          className="min-h-[44px] shrink-0 bg-amber-600 px-4 text-xs font-semibold text-white hover:bg-amber-700"
        >
          Receber
        </Button>
      ) : null}
    </div>
  );

  const mobileSlides = [
    { key: "package", label: "Pacote", content: packageCard },
    { key: "credit", label: "Crédito", content: creditCard },
    { key: "insurance", label: "Convênio", content: insuranceCard },
  ];

  return (
    <div className="w-full max-w-full min-w-0">
      {/* Desktop: 4 cards limpos */}
      <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex h-full flex-col justify-between rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <Clock className="h-4 w-4 shrink-0" />
              A Receber
            </span>
            {pendingTotalCents > 0 && canManageFinance ? (
              <Button
                type="button"
                size="sm"
                onClick={onOpenReceiveAll}
                className="min-h-[44px] bg-amber-600 px-3 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Receber
              </Button>
            ) : null}
          </div>
          <div className="mt-3">
            <p className="text-2xl font-bold tracking-tight text-foreground">
              {formatMoneyCents(pendingTotalCents)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? "sessão pendente" : "sessões pendentes"}`
                : "Nenhuma pendência em aberto"}
            </p>
          </div>
        </div>

        {creditCard}
        {packageCard}
        {insuranceCard}
      </div>

      {/* Mobile: pílula A Receber + Carrossel de 3 pilares */}
      <div className="space-y-3 md:hidden">
        {pendingPillMobile}

        <Carousel
          setApi={setCarouselApi}
          opts={{ align: "start", loop: false }}
          className="w-full max-w-full"
        >
          <CarouselContent className="-ml-3">
            {mobileSlides.map((slide) => (
              <CarouselItem key={slide.key} className="basis-[88%] pl-3">
                {slide.content}
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>

        <div className="flex items-center justify-center gap-1.5" aria-label="Indicadores do carrossel">
          {mobileSlides.map((slide, index) => {
            const isActive = index === selectedSlide;
            return (
              <button
                key={slide.key}
                type="button"
                aria-label={`Ir para ${slide.label}`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => carouselApi?.scrollTo(index)}
                className="flex min-h-[44px] min-w-[28px] items-center justify-center p-1"
              >
                <motion.span
                  layout={!shouldReduceMotion}
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 420, damping: 28 }
                  }
                  className={cn(
                    "block h-2 rounded-full transition-colors",
                    isActive ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30",
                  )}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
