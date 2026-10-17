import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Package,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Edit2,
  Unlink,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Loader2,
} from "lucide-react";
import { formatMoneyCents } from "@/lib/session-operations";
import {
  calculatePlanFinancialSummary,
  getPaymentPlanBadgeStyle,
  getPaymentPlanStatusLabel,
  type PatientPaymentPlanRow,
} from "@/lib/payment-plans";
import type { AgendaEventRow } from "@/integrations/supabase/types/tables";
import { toast } from "@/components/ui/use-toast";
import { EditPaymentPlanDialog } from "./EditPaymentPlanDialog";

interface ActivePaymentPlanCardProps {
  plan: PatientPaymentPlanRow;
  currentSessionIndex: number;
  locked?: boolean;
  onPlanUpdated: (updatedPlan: PatientPaymentPlanRow) => void;
  onUnlinkPlan: () => void;
  agendaEvents: AgendaEventRow[];
  onUpdateAgendaEventDate: (eventId: string, newDateIso: string) => Promise<void>;
  onPayDebit: () => Promise<void>;
}

export const ActivePaymentPlanCard: React.FC<ActivePaymentPlanCardProps> = ({
  plan,
  currentSessionIndex,
  locked,
  onPlanUpdated,
  onUnlinkPlan,
  agendaEvents,
  onUpdateAgendaEventDate,
  onPayDebit,
}) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isAgendaEventsOpen, setIsAgendaEventsOpen] = useState(false);
  const [payingDebit, setPayingDebit] = useState(false);
  const [updatingEventId, setUpdatingEventId] = useState<string | null>(null);

  const summary = useMemo(() => calculatePlanFinancialSummary(plan), [plan]);

  const progressPercentage = useMemo(() => {
    if (!summary.totalSessions) return 0;
    return Math.min(100, Math.round((summary.usedSessions / summary.totalSessions) * 100));
  }, [summary.usedSessions, summary.totalSessions]);

  const handlePayDebitClick = async () => {
    setPayingDebit(true);
    try {
      await onPayDebit();
      toast({
        title: "Pagamento registrado",
        description: "O débito pendente do pacote foi quitado com sucesso.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao quitar débito",
        description: err?.message || "Ocorreu um erro ao atualizar o pagamento.",
        variant: "destructive",
      });
    } finally {
      setPayingDebit(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-primary/30 bg-card p-4 sm:p-5 shadow-sm transition-all w-full max-w-full min-w-0">
      {/* Header do Card com Status e Ações */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary border border-primary/20 shrink-0">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground">{plan.name}</h3>
              <Badge variant="outline" className={getPaymentPlanBadgeStyle(plan.payment_status)}>
                {getPaymentPlanStatusLabel(plan.payment_status)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Esta sessão será vinculada automaticamente como a <strong>{currentSessionIndex}ª sessão</strong> deste pacote.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditDialogOpen(true)}
            disabled={locked}
            className="gap-1.5 text-xs h-8"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Editar Plano</span>
          </Button>

          {!locked && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onUnlinkPlan}
              className="gap-1.5 text-xs text-muted-foreground hover:text-destructive h-8"
            >
              <Unlink className="h-3.5 w-3.5" />
              <span>Desvincular</span>
            </Button>
          )}
        </div>
      </div>

      {/* Barra de Progresso das Sessões */}
      <div className="space-y-2 rounded-lg bg-muted/30 p-3.5 border border-muted">
        <div className="flex items-center justify-between text-xs font-medium">
          <span className="text-foreground">
            Sessões Utilizadas: <strong className="text-primary">{summary.usedSessions}</strong> de{" "}
            <strong>{summary.totalSessions}</strong> ({progressPercentage}%)
          </span>
          <span className="text-muted-foreground">
            Restam <strong>{summary.remainingSessions}</strong> sessões
          </span>
        </div>
        <Progress value={progressPercentage} className="h-2.5 w-full bg-muted" />
      </div>

      {/* Painel de Conciliação e Compensação Financeira */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* Card 1: Compensado */}
        <div className="rounded-lg border bg-background/50 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Valor Compensado
          </span>
          <div className="text-base font-bold text-success">
            {formatMoneyCents(summary.compensatedAmountCents)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {summary.usedSessions} × {formatMoneyCents(summary.sessionUnitAmountCents)} por sessão
          </p>
        </div>

        {/* Card 2: Crédito Restante */}
        <div className="rounded-lg border bg-background/50 p-3 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Crédito Restante
          </span>
          <div className="text-base font-bold text-primary">
            {formatMoneyCents(summary.remainingCreditCents)}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {summary.remainingSessions} sessões a realizar
          </p>
        </div>

        {/* Card 3: Situação de Pagamento / Débitos */}
        <div className="rounded-lg border bg-background/50 p-3 space-y-1.5 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
              Situação Financeira
            </span>
            {summary.isFullyPaid ? (
              <div className="flex items-center gap-1.5 text-xs font-semibold text-success mt-1">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>100% Quitado ({formatMoneyCents(summary.totalAmountCents)})</span>
              </div>
            ) : (
              <div className="space-y-0.5 mt-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                  <span>Débito: {formatMoneyCents(summary.pendingDebitCents)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Pago: {formatMoneyCents(summary.paidAmountCents)} de {formatMoneyCents(summary.totalAmountCents)}
                </p>
              </div>
            )}
          </div>

          {!summary.isFullyPaid && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handlePayDebitClick}
              disabled={payingDebit || locked}
              className="w-full text-xs h-7 bg-amber-600 hover:bg-amber-700 text-white gap-1 mt-1"
            >
              {payingDebit ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <DollarSign className="h-3 w-3" />
              )}
              <span>Quitar Débito</span>
            </Button>
          )}
        </div>
      </div>

      {/* Seção Expansível de Pré-Agendamentos na Agenda */}
      {agendaEvents && agendaEvents.length > 0 && (
        <div className="rounded-lg border border-border/60 bg-muted/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setIsAgendaEventsOpen((prev) => !prev)}
            className="w-full flex items-center justify-between p-3 text-xs font-semibold hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2 text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>
                Pré-agendamentos na Agenda ({agendaEvents.length} sessões pendentes)
              </span>
            </div>
            {isAgendaEventsOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {isAgendaEventsOpen && (
            <div className="p-3 pt-0 space-y-2 border-t border-border/40">
              <p className="text-[11px] text-muted-foreground pt-2">
                Você pode ajustar a data e o horário dos próximos atendimentos. A agenda será atualizada automaticamente.
              </p>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {agendaEvents.map((evt) => {
                  const currentDateVal = evt.scheduled_for
                    ? new Date(evt.scheduled_for).toISOString().slice(0, 16)
                    : "";

                  return (
                    <div
                      key={evt.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 rounded-md bg-background border text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-primary">
                          #{evt.payment_plan_session_index || "?"}
                        </span>
                        <span className="text-foreground truncate max-w-[200px]">
                          {evt.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Input
                          type="datetime-local"
                          defaultValue={currentDateVal}
                          disabled={locked || updatingEventId === evt.id}
                          className="h-7 text-xs w-auto min-w-[170px]"
                          onChange={async (e) => {
                            const val = e.target.value;
                            if (!val) return;
                            try {
                              setUpdatingEventId(evt.id);
                              const newIso = new Date(val).toISOString();
                              await onUpdateAgendaEventDate(evt.id, newIso);
                            } catch (err: any) {
                              toast({
                                title: "Erro ao reagendar",
                                description: err?.message || "Não foi possível atualizar a data do agendamento.",
                                variant: "destructive",
                              });
                            } finally {
                              setUpdatingEventId(null);
                            }
                          }}
                        />
                        {updatingEventId === evt.id && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Desacoplado de Edição do Plano */}
      <EditPaymentPlanDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        plan={plan}
        onPlanUpdated={onPlanUpdated}
      />
    </div>
  );
};
