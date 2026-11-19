import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Calendar, CheckCircle2, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatMoneyCents,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getSessionBalanceCents,
} from "@/lib/session-operations";
import { cn } from "@/lib/utils";
import {
  formatShortDate,
  getSessionEffectiveChargeCents,
  isSessionPaidCharge,
  isSessionPendingCharge,
  type ChargesFilter,
  type Session,
} from "./types";

export interface PaymentsChargesListProps {
  sessions: Session[];
  canManageFinance: boolean;
  onReceiveSession: (session: Session) => void;
}

const FILTER_OPTIONS: { value: ChargesFilter; label: string }[] = [
  { value: "pending", label: "Pendentes" },
  { value: "paid", label: "Pagos" },
  { value: "all", label: "Tudo" },
];

export const PaymentsChargesList: React.FC<PaymentsChargesListProps> = ({
  sessions,
  canManageFinance,
  onReceiveSession,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [filter, setFilter] = React.useState<ChargesFilter>("pending");

  const activeSessions = React.useMemo(
    () =>
      sessions
        .filter((s) => !s.deleted_at)
        .sort((a, b) => (b.session_date || "").localeCompare(a.session_date || "")),
    [sessions],
  );

  const counts = React.useMemo(() => {
    const pending = activeSessions.filter(isSessionPendingCharge).length;
    const paid = activeSessions.filter(isSessionPaidCharge).length;
    return { pending, paid, all: activeSessions.length };
  }, [activeSessions]);

  const filteredSessions = React.useMemo(() => {
    if (filter === "pending") return activeSessions.filter(isSessionPendingCharge);
    if (filter === "paid") return activeSessions.filter(isSessionPaidCharge);
    return activeSessions;
  }, [activeSessions, filter]);

  return (
    <section className="w-full max-w-full min-w-0 rounded-2xl border bg-card p-4 shadow-2xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Receipt className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            Cobranças de Sessões
          </h3>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Filtrar cobranças"
        >
          {FILTER_OPTIONS.map((option) => {
            const isSelected = filter === option.value;
            const count = counts[option.value];
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setFilter(option.value)}
                className={cn(
                  "min-h-[44px] rounded-full px-3.5 text-xs font-semibold transition-colors",
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {option.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-h-[44dvh] md:max-h-[440px] overflow-y-auto overscroll-contain space-y-2 pr-1">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-8 px-4 text-center">
            <CheckCircle2 className="h-7 w-7 text-muted-foreground/60 mb-2" />
            <p className="text-sm font-medium text-foreground">
              {filter === "pending"
                ? "Nenhuma cobrança pendente"
                : filter === "paid"
                ? "Nenhum pagamento registrado"
                : "Nenhuma sessão registrada"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              As sessões do paciente aparecerão aqui conforme forem lançadas.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false} mode="popLayout">
            {filteredSessions.map((session) => {
              const isPending = isSessionPendingCharge(session);
              const balanceCents = getSessionBalanceCents(session);
              const effectiveCharge = getSessionEffectiveChargeCents(session);
              const displayAmountCents = isPending
                ? balanceCents || effectiveCharge
                : session.amount_paid_cents || effectiveCharge;

              return (
                <motion.div
                  key={session.id}
                  layout={!shouldReduceMotion}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18 }}
                  className="flex w-full max-w-full min-w-0 flex-col gap-3 rounded-xl border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        {formatShortDate(session.session_date)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px]",
                          isPending
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {getPaymentStatusLabel(session.payment_status)}
                      </Badge>
                      {session.payment_plan_id ? (
                        <Badge variant="secondary" className="text-[11px]">
                          Pacote
                        </Badge>
                      ) : null}
                    </div>

                    <p className="truncate text-xs text-muted-foreground">
                      Forma: {getPaymentMethodLabel(session.payment_method)}
                      {session.payment_status === "parcial" && effectiveCharge > 0
                        ? ` · Pago ${formatMoneyCents(session.amount_paid_cents)} de ${formatMoneyCents(effectiveCharge)}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 sm:justify-end shrink-0">
                    <span
                      className={cn(
                        "text-sm font-bold tabular-nums",
                        isPending ? "text-amber-700 dark:text-amber-300" : "text-foreground",
                      )}
                    >
                      {formatMoneyCents(displayAmountCents)}
                    </span>

                    {isPending && canManageFinance ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onReceiveSession(session)}
                        className="min-h-[44px] shrink-0 px-4 text-xs font-semibold"
                      >
                        Receber
                      </Button>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
};
