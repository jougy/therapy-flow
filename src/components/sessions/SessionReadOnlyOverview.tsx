import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PatientFilesPanel } from "@/components/PatientFilesPanel";
import { PatientFilesProvider } from "@/contexts/PatientFilesContext";
import { formatMoneyCents, getPaymentInstallmentLabel, getPaymentMethodLabel, getPaymentStatusLabel } from "@/lib/session-operations";
import { formatSessionAuditDateTime, getSessionPersonLabel } from "@/lib/session-people";
import { ExternalLink, Pencil, Share2 } from "lucide-react";
import {
  formatDateLabel,
  formatDateTimeLabel,
  type AnamnesisTemplate,
  type CollaboratorProfile,
  type PatientGroup,
  type SessionEditHistoryRow,
  type SessionShareRecipient,
} from "./types";
import { getShareRecipientLabel } from "@/lib/session-sharing";
import type { TreatmentBlock } from "@/lib/session-treatment";
import { ScaleIndicator } from "./SessionAnamnesisRuntime";
import { SessionAuditHistoryModal } from "./SessionAuditHistoryModal";
import type { SessionEditHistoryViewEntry } from "@/lib/session-people";

export interface SessionReadOnlyOverviewProps {
  activeTemplate: AnamnesisTemplate | null;
  amountChargedCents: number;
  amountOriginalCents: number;
  amountPaidCents: number;
  arrivalDelayMinutes: number | null;
  arrivalDeltaLabel: string | null;
  canEditPaymentSummary: boolean;
  canEditPresenceSummary: boolean;
  clinicHomePath: string;
  clinicId: string | null | undefined;
  creatorProfile: Partial<CollaboratorProfile> | null;
  currentHasPaymentAdjustment: boolean;
  currentNormalizedPaymentStatus: string;
  currentPaymentAdjustmentCents: number;
  currentPaymentAdjustmentPercent: number;
  editHistory: SessionEditHistoryRow[];
  editHistoryView: SessionEditHistoryViewEntry[];
  groupId: string | null;
  groups: PatientGroup[];
  historyDialogOpen: boolean;
  notes: string;
  patientArrivedAt: string;
  patientId: string;
  paymentAdjustmentReason: string;
  paymentBalanceCents: number;
  paymentInstallments: number;
  paymentMethod: string;
  paymentStatus: any;
  paymentStatusDate: string;
  resolvedPatientId: string | null;
  scheduledStartAt: string;
  sessionCreatedAt: string | null;
  sessionDate: string;
  sessionId: string | undefined;
  sessionSummary: string;
  shareRecipients: SessionShareRecipient[];
  status: string;
  treatmentBlocks: TreatmentBlock[];
  treatmentGeneralGuidance: string;
  visibleBaseSliderFields: any[];
  readBaseSliderValue: (field: any) => number;
  onNavigate: (path: string) => void;
  onOpenHistoryDialogChange: (open: boolean) => void;
  onOpenPaymentDialog: () => void;
  onOpenPresenceDialog: () => void;
}

export const SessionReadOnlyOverview = ({
  activeTemplate,
  amountChargedCents,
  amountOriginalCents,
  amountPaidCents,
  arrivalDelayMinutes,
  arrivalDeltaLabel,
  canEditPaymentSummary,
  canEditPresenceSummary,
  clinicHomePath,
  clinicId,
  creatorProfile,
  currentHasPaymentAdjustment,
  currentNormalizedPaymentStatus,
  currentPaymentAdjustmentCents,
  currentPaymentAdjustmentPercent,
  editHistoryView,
  groupId,
  groups,
  historyDialogOpen,
  notes,
  patientArrivedAt,
  patientId,
  paymentAdjustmentReason,
  paymentBalanceCents,
  paymentInstallments,
  paymentMethod,
  paymentStatus,
  paymentStatusDate,
  resolvedPatientId,
  scheduledStartAt,
  sessionCreatedAt,
  sessionDate,
  sessionId,
  sessionSummary,
  shareRecipients,
  status,
  treatmentBlocks,
  treatmentGeneralGuidance,
  visibleBaseSliderFields,
  readBaseSliderValue,
  onNavigate,
  onOpenHistoryDialogChange,
  onOpenPaymentDialog,
  onOpenPresenceDialog,
}: SessionReadOnlyOverviewProps) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
            <p className="mt-1 font-medium">{status}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Linha de Cuidado / Motivo</p>
            <p className="mt-1 font-medium">
              {groups.find((group) => group.id === groupId)?.name || "Geral / Sintomas não definidos"}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ficha complementar</p>
            <div className="mt-1 flex items-center gap-1.5">
              <p className="font-medium">{activeTemplate?.name || "Sem ficha extra"}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 w-5 p-0 text-muted-foreground hover:text-primary"
                onClick={() => onNavigate(`${clinicHomePath}/configuracoes?secao=forms`)}
                title="Abrir gerenciador de formulários"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Criado por</p>
            <p className="mt-1 font-medium">{getSessionPersonLabel(creatorProfile as any)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {sessionCreatedAt ? formatSessionAuditDateTime(sessionCreatedAt) : "Ainda não salvo"}
            </p>
            <SessionAuditHistoryModal
              editHistoryView={editHistoryView}
              historyDialogOpen={historyDialogOpen}
              onOpenChange={onOpenHistoryDialogChange}
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Compartilhamento</p>
            {shareRecipients.length > 0 ? (
              <div className="mt-2 space-y-2">
                <Badge variant="secondary" className="gap-1">
                  <Share2 className="h-3.5 w-3.5" />
                  {shareRecipients.length} colaborador(es)
                </Badge>
                <div className="space-y-1">
                  {shareRecipients.slice(0, 3).map((recipient) => (
                    <p key={recipient.id} className="truncate text-xs text-muted-foreground">
                      {getShareRecipientLabel(recipient)}
                    </p>
                  ))}
                  {shareRecipients.length > 3 ? (
                    <p className="text-xs text-muted-foreground">+{shareRecipients.length - 3} outros</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">Não compartilhado</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Presença</h2>
                <p className="text-sm text-muted-foreground">Horário combinado e chegada do paciente.</p>
              </div>
              {canEditPresenceSummary ? (
                <Button type="button" variant="outline" size="sm" onClick={onOpenPresenceDialog}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar presença
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Agendado</p>
                <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(scheduledStartAt)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Chegada</p>
                  {arrivalDeltaLabel ? (
                    <span
                      className={`text-xs font-semibold ${arrivalDelayMinutes && arrivalDelayMinutes > 0 ? "text-destructive" : "text-success"}`}
                    >
                      {arrivalDeltaLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(patientArrivedAt)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Início do atendimento</p>
                <p className="mt-1 text-sm font-medium">{formatDateTimeLabel(sessionDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">Pagamento</h2>
                <p className="text-sm text-muted-foreground">Valor da consulta e baixa simples do pagamento.</p>
              </div>
              {canEditPaymentSummary ? (
                <Button type="button" variant="outline" size="sm" onClick={onOpenPaymentDialog}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar pagamento
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Status</p>
                <p className="mt-1 text-sm font-medium">{getPaymentStatusLabel(paymentStatus)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Data</p>
                <p className="mt-1 text-sm font-medium">{formatDateLabel(paymentStatusDate)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Método</p>
                <p className="mt-1 text-sm font-medium">
                  {getPaymentMethodLabel(
                    currentNormalizedPaymentStatus === "cortesia" ? "cortesia" : (paymentMethod as any)
                  )}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Parcelas</p>
                <p className="mt-1 text-sm font-medium">{getPaymentInstallmentLabel(paymentInstallments)}</p>
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Consulta</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium">
                  {currentHasPaymentAdjustment ? (
                    <span className="text-muted-foreground line-through">{formatMoneyCents(amountOriginalCents)}</span>
                  ) : null}
                  <span>{formatMoneyCents(amountChargedCents)}</span>
                  {currentHasPaymentAdjustment ? (
                    <span
                      className={`text-xs font-semibold ${currentPaymentAdjustmentCents > 0 ? "text-success" : "text-destructive"}`}
                    >
                      {currentPaymentAdjustmentCents > 0 ? "+" : ""}
                      {currentPaymentAdjustmentPercent}%
                    </span>
                  ) : null}
                </div>
                {currentHasPaymentAdjustment && paymentAdjustmentReason ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{paymentAdjustmentReason}</p>
                ) : null}
              </div>
              <div className="rounded-lg border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Pago</p>
                <p className="mt-1 text-sm font-medium">{formatMoneyCents(amountPaidCents)}</p>
              </div>
            </div>
            {paymentBalanceCents > 0 ? (
              <Badge variant="outline" className="border-warning/20 bg-warning/15 text-warning">
                Em aberto: {formatMoneyCents(paymentBalanceCents)}
              </Badge>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {visibleBaseSliderFields.length > 0 && (
        <Card data-tutorial="session-pain-scale">
          <CardContent className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleBaseSliderFields.map((field) => {
              const value = readBaseSliderValue(field);
              return (
                <div key={field.id} className="rounded-xl border bg-muted/20 p-4 space-y-3">
                  <div>
                    <p className="font-medium text-sm">{field.label}</p>
                  </div>
                  <ScaleIndicator score={value} min={field.min ?? 0} max={field.max ?? 10} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <PatientFilesProvider patientId={resolvedPatientId || patientId} clinicId={clinicId}>
        <PatientFilesPanel
          clinicId={clinicId}
          patientId={resolvedPatientId || patientId}
          sessionId={sessionId}
          variant="session"
        />
      </PatientFilesProvider>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Anamnese</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {sessionSummary || "Nenhuma anamnese registrada."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Tratamento</h2>
            <Badge variant="outline">{treatmentBlocks.length} bloco(s)</Badge>
          </div>
          {treatmentBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum bloco de tratamento registrado.</p>
          ) : (
            <div className="space-y-4">
              {treatmentBlocks.map((block, index) => (
                <div key={block.id} className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">Bloco {index + 1}</p>
                    <span className="text-sm text-muted-foreground">{block.name || "Sem nome"}</span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Frequência</p>
                      <p className="mt-1 text-sm">{block.frequency || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Duração</p>
                      <p className="mt-1 text-sm">{block.duration || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Séries</p>
                      <p className="mt-1 text-sm">{block.series || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Repetições</p>
                      <p className="mt-1 text-sm">{block.repetitions || "—"}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Instruções adicionais</p>
                    <p className="mt-1 whitespace-pre-line text-sm">{block.instructions || "—"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Orientações gerais e observações</p>
            <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
              {treatmentGeneralGuidance || "Nenhuma orientação geral registrada."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold">Anotações rápidas</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {notes || "Nenhuma anotação rápida registrada."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
