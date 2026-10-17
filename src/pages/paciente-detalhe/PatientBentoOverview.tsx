import React from "react";
import { Calendar, CalendarDays, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLegacyGroupHex } from "@/lib/group-colors";
import {
  getSessionCareLineIds,
  shouldShowSessionCreatorInternBadge,
} from "@/lib/patient-sessions-view";
import { formatAgendaEventDateTime } from "./pacienteDetalheHelpers";
import { getSessionPersonLabel } from "@/lib/session-people";
import { SessionCard } from "./SessionCard";
import type { AgendaEvent, PatientGroup, ProfileSummary, Session } from "./pacienteDetalheTypes";
import type { SessionShareSummary } from "@/lib/session-sharing";
import type { PatientPaymentPlanRow } from "@/lib/payment-plans";

export interface PatientBentoOverviewProps {
  upcomingAgendaEvent: AgendaEvent | null | undefined;
  onOpenPatientAgendaDialog: () => void;
  onSelectAgendaEvent?: (event: AgendaEvent) => void;
  onViewFullHistory: () => void;
  latestSession: Session | null | undefined;
  patientGroupsMap: Map<string, PatientGroup>;
  profileMap: Map<string, ProfileSummary>;
  sessionShareSummaries: Record<string, SessionShareSummary>;
  canViewFinancialData: boolean;
  baseSchema: unknown;
  sessionViewMode: "compact" | "detailed";
  expandedSessionIds: string[];
  toggleSessionExpansion: (sessionId: string) => void;
  onEvolveSession: (session: Session) => void;
  onLinkGroup: (session: Session) => void;
  evolvingSessionId: string | null;
  onPressStart: (sessionId: string) => void;
  onPressCancel: () => void;
  toggleSessionSelection: (sessionId: string) => void;
  onViewShareRecipients: (sessionId: string) => void;
  onNavigateToSession: (sessionId: string) => void;
  paymentPlanMap?: Map<string, PatientPaymentPlanRow>;
}

export const PatientBentoOverview: React.FC<PatientBentoOverviewProps> = ({
  upcomingAgendaEvent,
  onOpenPatientAgendaDialog,
  onSelectAgendaEvent,
  onViewFullHistory,
  latestSession,
  patientGroupsMap,
  profileMap,
  sessionShareSummaries,
  canViewFinancialData,
  baseSchema,
  sessionViewMode,
  expandedSessionIds,
  toggleSessionExpansion,
  onEvolveSession,
  onLinkGroup,
  evolvingSessionId,
  onPressStart,
  onPressCancel,
  toggleSessionSelection,
  onViewShareRecipients,
  onNavigateToSession,
  paymentPlanMap,
}) => {
  return (
    <div className="md:hidden space-y-4">
      {/* Bloco Resumido de Agenda */}
      <div className="rounded-2xl border bg-card/90 p-3.5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-foreground">
              Agenda do Paciente
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5 gap-1.5 rounded-lg border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 shadow-2xs font-medium active:scale-95 transition-all"
            onClick={onOpenPatientAgendaDialog}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo</span>
          </Button>
        </div>

        {upcomingAgendaEvent ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectAgendaEvent?.(upcomingAgendaEvent)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelectAgendaEvent?.(upcomingAgendaEvent);
              }
            }}
            className="flex items-center justify-between rounded-xl bg-muted/40 hover:bg-muted/70 p-2.5 text-xs cursor-pointer border border-transparent hover:border-primary/20 transition-all select-none active:scale-[0.99]"
            title="Clique para configurar horário, status, lembrete WhatsApp ou excluir"
          >
            <div className="space-y-0.5 min-w-0 pr-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                <span>Próximo agendamento</span>
                <span className="text-[10px] font-normal text-primary">⚙️ Configurar</span>
              </p>
              <p className="text-muted-foreground truncate">
                {formatAgendaEventDateTime(upcomingAgendaEvent.scheduled_for)}
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] capitalize bg-background shrink-0">
              {upcomingAgendaEvent.status === "aguardando_confirmacao"
                ? "Pendente confirmação"
                : upcomingAgendaEvent.status}
            </Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-1">
            Nenhum agendamento futuro para este paciente.
          </p>
        )}
      </div>

      {/* Apenas o Último Atendimento no padrão dos cards do histórico */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Atendimento Mais Recente
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-primary px-1.5"
            onClick={onViewFullHistory}
          >
            Ver histórico completo →
          </Button>
        </div>

        {latestSession ? (
          (() => {
            const careLineIds = getSessionCareLineIds(latestSession);
            const sessionGroups = careLineIds
              .map((groupId) => patientGroupsMap.get(groupId))
              .filter(Boolean) as PatientGroup[];
            const primaryColor = sessionGroups[0]?.color
              ? getLegacyGroupHex(sessionGroups[0].color)
              : undefined;

            const matchedPlan = latestSession.payment_plan_id && paymentPlanMap
              ? paymentPlanMap.get(latestSession.payment_plan_id)
              : null;

            return (
              <SessionCard
                key={`mobile-latest-${latestSession.id}`}
                baseSchema={baseSchema}
                canViewFinancialData={canViewFinancialData}
                creatorName={getSessionPersonLabel(profileMap.get(latestSession.user_id))}
                creatorIsIntern={shouldShowSessionCreatorInternBadge(
                  profileMap.get(latestSession.user_id)?.job_title
                )}
                session={latestSession}
                sessionGroups={sessionGroups}
                shareSummary={sessionShareSummaries[latestSession.id]}
                isSelected={false}
                selectionMode={false}
                borderColor={primaryColor}
                isCompact={sessionViewMode === "compact"}
                isExpanded={expandedSessionIds.includes(latestSession.id)}
                onToggleExpand={() => toggleSessionExpansion(latestSession.id)}
                onEvolve={() => onEvolveSession(latestSession)}
                onLinkGroup={() => onLinkGroup(latestSession)}
                isEvolving={evolvingSessionId === latestSession.id}
                onPressStart={() => onPressStart(latestSession.id)}
                onPressCancel={onPressCancel}
                onToggleSelect={() => toggleSessionSelection(latestSession.id)}
                onViewShareRecipients={() => onViewShareRecipients(latestSession.id)}
                navigateTo={() => onNavigateToSession(latestSession.id)}
                paymentPlan={matchedPlan}
              />
            );
          })()
        ) : (
          <Card className="p-6 text-center border-dashed">
            <Calendar className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-2 text-xs font-medium text-muted-foreground">
              Este paciente ainda não possui atendimentos registrados.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
