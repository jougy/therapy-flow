import type { FC } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Calendar, CalendarClock, ChevronDown, ClipboardList, History, SlidersHorizontal } from "lucide-react";
import AgendaWidget from "@/components/AgendaWidget";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { getLegacyGroupHex } from "@/lib/group-colors";
import { getClinicPatientPath } from "@/lib/patient-routing";
import { getSessionCareLineIds, shouldShowSessionCreatorInternBadge } from "@/lib/patient-sessions-view";
import { formatMoneyCents, getArrivalDelayMinutes } from "@/lib/session-operations";
import { getSessionPersonLabel } from "@/lib/session-people";
import { cn } from "@/lib/utils";
import { SessionCard } from "../SessionCard";
import { formatAgendaEventDateTime, formatSessionMetaDate } from "../pacienteDetalheHelpers";
import type { PatientGroup } from "../pacienteDetalheTypes";
import { usePatientWorkspace } from "../context/PatientWorkspaceContext";

export const PatientOverviewPage: FC = () => {
  const navigate = useNavigate();
  const ws = usePatientWorkspace();
  const { patient, targetClinicKey } = ws;

  if (!patient) return null;

  const patientRef = patient || ws.id!;
  const sessionsPath = getClinicPatientPath(targetClinicKey, patientRef, "atendimentos");

  const scheduledSessionsCount = ws.sessions.filter((s) => s.scheduled_start_at).length;
  const absentSessionsCount = ws.operationalSummary.absences;
  const delayedSessionsCount = ws.sessions.filter((s) => {
    const delay = getArrivalDelayMinutes(s);
    return delay !== null && delay > 0;
  }).length;
  const draftCount = ws.sessions.filter((s) => s.status === "rascunho").length;

  const latestCareLineIds = ws.latestSession ? getSessionCareLineIds(ws.latestSession) : [];
  const latestGroups = latestCareLineIds
    .map((gid) => ws.patientGroupsMap.get(gid))
    .filter(Boolean) as PatientGroup[];
  const latestPrimaryColor = latestGroups[0]?.color ? getLegacyGroupHex(latestGroups[0].color) : undefined;

  return (
    <div className="w-full max-w-full min-w-0 space-y-4 sm:space-y-5">
      <DismissibleInfoTip id="patient-detail-quick-actions-tip" variant="subtle" className="text-xs">
        Acesse rapidamente contato, cadastro, status e novo atendimento sem sair da ficha do paciente.
      </DismissibleInfoTip>

      {/* Bento Grid de Métricas Rápidas */}
      <div data-tutorial="patient-metrics-panel" className="w-full grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="rounded-2xl border bg-card/80 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Último Atendimento</span>
            <ComponentHelpButton helpId="patient-metrics-panel" size="xs" />
          </div>
          <div className="mt-1.5">
            <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {formatSessionMetaDate(ws.latestSession?.session_date ?? null)}
            </p>
            <p className="text-xs text-muted-foreground capitalize mt-0.5 truncate">
              {ws.latestSession ? `Status: ${ws.latestSession.status}` : "Sem atendimentos anteriores"}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border bg-card/80 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Presença & Histórico</span>
          <div className="mt-1.5">
            <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
              {ws.totalSessionsCount} atendimento{ws.totalSessionsCount !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {ws.completedSessionsCount} conc. · {ws.canceledSessionsCount} canc.
              {ws.operationalSummary.averageDelayMinutes > 0 ? ` · ${ws.operationalSummary.averageDelayMinutes}m méd.` : ""}
              {scheduledSessionsCount > 0 && absentSessionsCount === 0 && delayedSessionsCount === 0 ? " · pontual" : ""}
            </p>
          </div>
        </div>

        {ws.canViewFinancialData ? (
          <div className="rounded-2xl border bg-card/80 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Financeiro do Paciente</span>
            <div className="mt-1.5">
              <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">{formatMoneyCents(ws.settledPaymentCents)}</p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {ws.operationalSummary.openBalanceCents > 0 ? `Aberto: ${formatMoneyCents(ws.operationalSummary.openBalanceCents)}` : "Em dia"}
              </p>
            </div>
          </div>
        ) : (
          <div
            role={ws.upcomingAgendaEvent ? "button" : undefined}
            tabIndex={ws.upcomingAgendaEvent ? 0 : undefined}
            onClick={() => ws.upcomingAgendaEvent && ws.handleOpenAgendaDetails(ws.upcomingAgendaEvent)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && ws.upcomingAgendaEvent) {
                e.preventDefault();
                ws.handleOpenAgendaDetails(ws.upcomingAgendaEvent);
              }
            }}
            className={cn(
              "rounded-2xl border bg-card/80 p-2.5 sm:p-3 shadow-2xs flex flex-col justify-between hover:border-primary/30 transition-colors select-none",
              ws.upcomingAgendaEvent && "cursor-pointer hover:bg-muted/40"
            )}
            title={ws.upcomingAgendaEvent ? "Clique para gerenciar o agendamento" : undefined}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Agendamentos</span>
              {ws.upcomingAgendaEvent && <span className="text-[10px] font-medium text-primary hover:underline">Configurar</span>}
            </div>
            <div className="mt-1.5">
              <p className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                {ws.futureAgendaCount} agendado{ws.futureAgendaCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {ws.upcomingAgendaEvent ? `Próximo: ${formatAgendaEventDateTime(ws.upcomingAgendaEvent.scheduled_for)}` : "Nenhum futuro"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Agenda Dinâmica Integrada */}
      <div data-tutorial="patient-internal-agenda" className="w-full min-w-0">
        <AgendaWidget
          fixedPatient={{ id: patient.id, name: patient.name }}
          onStartAttendance={() => void ws.handleStartAttendanceNow()}
          startAttendanceLabel="Iniciar atendimento agora"
          headerAccessory={
            <Button
              data-tutorial="patient-btn-recurrence"
              type="button"
              variant={patient.is_recurring ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-xl text-xs gap-1.5 px-2.5 font-medium border-border/80 shadow-2xs hover:bg-accent transition-all active:scale-95"
              onClick={() => ws.setRecurrenceDialogOpen(true)}
              title={patient.is_recurring ? `Recorrente: ${ws.patientRecurrenceLabel}` : "Configurar recorrência"}
            >
              <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>{ws.patientRecurrenceLabel}</span>
            </Button>
          }
        />
      </div>

      {/* Banner de Rascunhos Pendentes */}
      {draftCount > 0 && (
        <DismissibleInfoTip
          id="patient-detail-drafts-warning-tip"
          variant="subtle"
          icon={<AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
          className="border-amber-500/30 bg-amber-500/10"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm text-foreground">{draftCount} atendimento(s) em rascunho pendente(s)</p>
              <p className="text-xs text-muted-foreground">Revisar e concluir atendimentos em andamento mantém o prontuário clínico protegido e atualizado.</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-500/40 bg-background/80 hover:bg-background text-xs gap-1 self-start sm:self-auto shrink-0"
              onClick={() => {
                ws.setSessionStatusFilter("rascunho");
                navigate(sessionsPath);
              }}
            >
              Ver Rascunhos
            </Button>
          </div>
        </DismissibleInfoTip>
      )}

      {/* Último Atendimento Realizado */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Último Atendimento Realizado
            </h2>
            <Badge variant="secondary" className="text-xs font-semibold px-2 py-0.5 rounded-full">
              {ws.sessionView.totalCount} {ws.sessionView.totalCount === 1 ? "atendimento" : "atendimentos"}
            </Badge>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(sessionsPath)}
            className="h-8 gap-1.5 text-xs rounded-xl shadow-2xs font-medium hover:bg-accent"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Ver histórico completo ({ws.sessionView.totalCount})</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </div>

        {ws.latestSession ? (
          <SessionCard
            key={`overview-latest-${ws.latestSession.id}`}
            baseSchema={ws.baseSchema}
            canViewFinancialData={ws.canViewFinancialData}
            creatorName={getSessionPersonLabel(ws.profileMap.get(ws.latestSession.user_id))}
            creatorIsIntern={shouldShowSessionCreatorInternBadge(ws.profileMap.get(ws.latestSession.user_id)?.job_title)}
            session={ws.latestSession}
            sessionGroups={latestGroups}
            shareSummary={ws.sessionShareSummaries[ws.latestSession.id]}
            isSelected={false}
            selectionMode={false}
            borderColor={latestPrimaryColor}
            isCompact={ws.sessionViewMode === "compact"}
            isExpanded={ws.expandedSessionIds.includes(ws.latestSession.id)}
            onToggleExpand={() => ws.toggleSessionExpansion(ws.latestSession.id)}
            onEvolve={() => ws.setSessionToEvolve(ws.latestSession)}
            onLinkGroup={() => ws.setSessionToLinkGroup(ws.latestSession)}
            isEvolving={ws.evolvingSessionId === ws.latestSession.id}
            onPressStart={() => ws.handleSessionPressStart(ws.latestSession!.id)}
            onPressCancel={ws.handleSessionPressCancel}
            onToggleSelect={() => ws.toggleSessionSelection(ws.latestSession!.id)}
            onViewShareRecipients={() => ws.setShareRecipientsSessionId(ws.latestSession!.id)}
            navigateTo={() => ws.handleSessionNavigate(ws.latestSession!.id)}
            paymentPlan={ws.latestSession.payment_plan_id ? ws.paymentPlanMap.get(ws.latestSession.payment_plan_id) : null}
          />
        ) : (
          <Card className="p-6 text-center border-dashed">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Este paciente ainda não possui atendimentos registrados.
            </p>
          </Card>
        )}

        {ws.sessionView.totalCount > 1 && (
          <div className="pt-1 flex justify-center">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => navigate(sessionsPath)}
              className="text-xs text-primary hover:text-primary gap-1.5 font-medium hover:bg-primary/5 rounded-lg"
            >
              <History className="h-3.5 w-3.5" />
              <span>Ver histórico completo ({ws.sessionView.totalCount} atendimentos)</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientOverviewPage;
