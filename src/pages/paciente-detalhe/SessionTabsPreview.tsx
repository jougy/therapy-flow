import { useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { usePatientFilesContext } from "@/contexts/PatientFilesContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useAuth } from "@/hooks/useAuth";
import { FileThumbnailCard } from "@/components/FileThumbnailCard";
import { getSessionPreviewContent } from "@/lib/session-preview";
import {
  formatMoneyCents,
  getPaymentMethodLabel,
  getPaymentStatusLabel,
  getSessionBalanceCents,
  getSessionOriginalAmountCents,
  getPaymentAdjustmentCents,
  getPaymentAdjustmentPercent,
  hasPaymentAdjustment,
} from "@/lib/session-operations";
import { getPaymentPlanStatusLabel } from "@/lib/payment-plans";
import type { PatientPaymentPlanRow } from "@/lib/payment-plans";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import type { Session } from "./pacienteDetalheTypes";

export interface SessionTabsPreviewProps {
  baseSchema: AnamnesisTemplateSchema;
  session: Session;
  paymentPlan?: PatientPaymentPlanRow | null;
  canViewFinancialData?: boolean;
}

export const SessionTabsPreview = ({
  baseSchema,
  session,
  paymentPlan,
  canViewFinancialData,
}: SessionTabsPreviewProps) => {
  const preview = getSessionPreviewContent(session, baseSchema);
  const { files } = usePatientFilesContext();
  const sessionFiles = useMemo(() => files.filter((f) => f.session_id === session.id), [files, session.id]);
  const { isFeatureEnabled } = useFeatureFlags();
  const { can } = useAuth();
  const showFiles = isFeatureEnabled("storage_s3_integration");

  // Soberania RBAC via can(capability): treasury.manage
  const hasFinancePermission =
    typeof canViewFinancialData === "boolean"
      ? canViewFinancialData
      : typeof can === "function"
      ? can("treasury.manage")
      : false;

  // Tabs counting
  const tabColumnsCount = 2 + (showFiles ? 1 : 0) + (hasFinancePermission ? 1 : 0);

  // Cálculos financeiros
  const balanceCents = getSessionBalanceCents(session);
  const originalAmountCents = getSessionOriginalAmountCents(session);
  const adjustmentCents = getPaymentAdjustmentCents(session);
  const adjustmentPercent = getPaymentAdjustmentPercent(session);
  const sessionHasPaymentAdjustment = hasPaymentAdjustment(session);

  // Cálculo do pacote / plano
  const planInfo = useMemo(() => {
    if (!paymentPlan) return null;
    const totalAmount = paymentPlan.total_amount_cents ?? 0;
    const sessionUnitAmount = paymentPlan.session_unit_amount_cents ?? 0;
    const totalSessions = paymentPlan.total_sessions ?? 0;
    const usedSessions = paymentPlan.used_sessions ?? 0;
    const planStatusLabel = getPaymentPlanStatusLabel(paymentPlan.payment_status);

    // Se o plano está totalmente pago
    let paidAmountCents = 0;
    if (paymentPlan.payment_status === "pago") {
      paidAmountCents = totalAmount;
    } else if (paymentPlan.payment_status === "parcial") {
      // Estima com base nas sessões utilizadas ou unitárias se disponível
      paidAmountCents = Math.min(totalAmount, usedSessions * sessionUnitAmount);
    }

    const percentPaid = totalAmount > 0 ? Math.min(100, Math.round((paidAmountCents / totalAmount) * 100)) : 0;

    return {
      name: paymentPlan.name,
      totalAmount,
      paidAmountCents,
      percentPaid,
      totalSessions,
      usedSessions,
      statusLabel: planStatusLabel,
      methodLabel: getPaymentMethodLabel(paymentPlan.payment_method),
    };
  }, [paymentPlan]);

  return (
    <Tabs
      defaultValue="anamnese"
      className="mt-3"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TabsList
        className="grid h-auto w-full"
        style={{
          gridTemplateColumns: `repeat(${tabColumnsCount}, minmax(0, 1fr))`,
        }}
      >
        <TabsTrigger value="anamnese" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">
          Anamnese
        </TabsTrigger>
        <TabsTrigger value="tratamento" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">
          Tratamento
        </TabsTrigger>
        {showFiles && (
          <TabsTrigger value="arquivos" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">
            Arquivos
            {sessionFiles.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1">
                {sessionFiles.length}
              </Badge>
            )}
          </TabsTrigger>
        )}
        {hasFinancePermission && (
          <TabsTrigger value="pagamento" className="whitespace-normal px-2 py-2 text-xs leading-tight sm:text-sm">
            Pagamento
          </TabsTrigger>
        )}
      </TabsList>

      <TabsContent value="anamnese" className="rounded-md border bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {preview.complaint || "Nenhum dado de anamnese registrado."}
        </p>
      </TabsContent>

      <TabsContent value="tratamento" className="rounded-md border bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {preview.treatment || "Nenhum tratamento registrado."}
        </p>
      </TabsContent>

      {showFiles && (
        <TabsContent value="arquivos" className="rounded-md border bg-muted/20 p-3">
          {sessionFiles.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {sessionFiles.map((file) => (
                <FileThumbnailCard key={file.id} file={file} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum arquivo anexado a esta sessão.</p>
          )}
        </TabsContent>
      )}

      {hasFinancePermission && (
        <TabsContent value="pagamento" className="rounded-md border bg-muted/20 p-3 space-y-3">
          {/* Informações de Pagamento da Sessão */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Status da Sessão
              </span>
              <Badge variant="outline" className="text-xs">
                {getPaymentStatusLabel(session.payment_status)}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs sm:text-sm">
              <div className="rounded-lg bg-card border p-2.5">
                <span className="text-muted-foreground block text-[11px]">Forma de Pagamento</span>
                <span className="font-semibold">{getPaymentMethodLabel(session.payment_method)}</span>
              </div>

              <div className="rounded-lg bg-card border p-2.5">
                <span className="text-muted-foreground block text-[11px]">Valor Pago</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatMoneyCents(session.amount_paid_cents || 0)}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  de {sessionHasPaymentAdjustment ? (
                    <>
                      <span className="line-through">{formatMoneyCents(originalAmountCents)}</span>{" "}
                      {formatMoneyCents(session.amount_charged_cents)}
                      <span className={adjustmentCents > 0 ? "ml-1 font-semibold text-success" : "ml-1 font-semibold text-destructive"}>
                        {adjustmentCents > 0 ? "+" : ""}{adjustmentPercent}%
                      </span>
                    </>
                  ) : (
                    formatMoneyCents(session.amount_charged_cents || 0)
                  )}
                </span>
              </div>

              <div className="rounded-lg bg-card border p-2.5">
                <span className="text-muted-foreground block text-[11px]">Saldo Pendente</span>
                <span className={balanceCents > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "font-semibold text-muted-foreground"}>
                  {formatMoneyCents(balanceCents)}
                </span>
              </div>
            </div>
          </div>

          {/* Se vinculado a um Pacote / Plano de Sessões */}
          {planInfo && (
            <div className="rounded-xl border bg-primary/5 p-3 space-y-2 mt-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">
                    Pacote Vinculado
                  </span>
                  <span className="font-medium text-xs sm:text-sm truncate block">{planInfo.name}</span>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {planInfo.statusLabel}
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div>
                  <span className="text-muted-foreground block text-[10px]">Total do Pacote</span>
                  <span className="font-semibold">{formatMoneyCents(planInfo.totalAmount)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Total Pago</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {formatMoneyCents(planInfo.paidAmountCents)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">% Quitado</span>
                  <span className="font-semibold">{planInfo.percentPaid}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">Sessões</span>
                  <span className="font-semibold">
                    {planInfo.usedSessions} / {planInfo.totalSessions}
                  </span>
                </div>
              </div>

              {/* Barra de progresso de quitação do pacote */}
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-300"
                  style={{ width: `${planInfo.percentPaid}%` }}
                />
              </div>
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
};
