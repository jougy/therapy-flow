import type { FC } from "react";
import { Calendar, ChevronDown, ChevronUp, Loader2, Package, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getLegacyGroupHex } from "@/lib/group-colors";
import { getSessionCareLineIds, shouldShowSessionCreatorInternBadge } from "@/lib/patient-sessions-view";
import { getSessionPersonLabel } from "@/lib/session-people";
import { SessionCard } from "../SessionCard";
import type { PatientGroup, Session } from "../pacienteDetalheTypes";
import { usePatientWorkspace } from "../context/PatientWorkspaceContext";
import { PatientSessionsToolbar } from "./PatientSessionsToolbar";

export const PatientSessionsPage: FC = () => {
  const ws = usePatientWorkspace();
  if (!ws.patient) return null;

  const renderSessionCard = (session: Session, fallbackColor?: string) => {
    const careLineIds = getSessionCareLineIds(session);
    const sessionGroups = careLineIds
      .map((gid) => ws.patientGroupsMap.get(gid))
      .filter(Boolean) as PatientGroup[];
    const cardColor = sessionGroups[0]?.color ? getLegacyGroupHex(sessionGroups[0].color) : fallbackColor;

    return (
      <SessionCard
        key={session.id}
        baseSchema={ws.baseSchema}
        canViewFinancialData={ws.canViewFinancialData}
        creatorName={getSessionPersonLabel(ws.profileMap.get(session.user_id))}
        creatorIsIntern={shouldShowSessionCreatorInternBadge(ws.profileMap.get(session.user_id)?.job_title)}
        session={session}
        sessionGroups={sessionGroups}
        shareSummary={ws.sessionShareSummaries[session.id]}
        isSelected={ws.selectedSessionIds.includes(session.id)}
        selectionMode={ws.canBulkManageSessions && ws.selectionMode}
        borderColor={cardColor}
        isCompact={ws.sessionViewMode === "compact"}
        isExpanded={ws.expandedSessionIds.includes(session.id)}
        onToggleExpand={() => ws.toggleSessionExpansion(session.id)}
        onEvolve={() => ws.setSessionToEvolve(session)}
        onLinkGroup={() => ws.setSessionToLinkGroup(session)}
        isEvolving={ws.evolvingSessionId === session.id}
        onPressStart={() => ws.handleSessionPressStart(session.id)}
        onPressCancel={ws.handleSessionPressCancel}
        onToggleSelect={() => ws.toggleSessionSelection(session.id)}
        onViewShareRecipients={() => ws.setShareRecipientsSessionId(session.id)}
        navigateTo={() => ws.handleSessionNavigate(session.id)}
        paymentPlan={session.payment_plan_id ? ws.paymentPlanMap.get(session.payment_plan_id) : null}
      />
    );
  };

  return (
    <div className="w-full max-w-full min-w-0 space-y-4">
      <PatientSessionsToolbar />

      {ws.sessionView.chronologicalSessions.length > 0 ? (
        <div className="space-y-4">
          {ws.groupByEvolution && ws.groupByMode !== "evolution" && ws.modularGroupedSessions ? (
            <div className="space-y-3">
              {ws.modularGroupedSessions.groups.map((group) => {
                const groupKey = `modular_${group.name}`;
                const isCollapsed = ws.collapsedModularGroupKeys.includes(groupKey);
                return (
                  <div key={groupKey} className="rounded-2xl border bg-card shadow-xs overflow-hidden transition-all">
                    <div
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/25 hover:bg-muted/40 cursor-pointer transition-colors border-b select-none"
                      onClick={() => ws.toggleModularGroupCollapse(groupKey)}
                    >
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={(e) => { e.stopPropagation(); ws.toggleModularGroupCollapse(groupKey); }}
                        >
                          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-3 w-3 rounded-full shrink-0 bg-primary" />
                          <h3 className="font-bold text-sm tracking-tight text-foreground truncate max-w-[280px] sm:max-w-md">{group.name}</h3>
                        </div>
                        <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5">
                          {group.count} {group.count === 1 ? "atendimento" : "atendimentos"}
                        </Badge>
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="p-3 space-y-2.5 bg-background/50">
                        {group.sessions.map((s) => renderSessionCard(s, "var(--primary)"))}
                      </div>
                    )}
                  </div>
                );
              })}

              {ws.modularGroupedSessions.ungrouped.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 pt-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Sem {ws.modularGroupedSessions.fieldLabel} definido ({ws.modularGroupedSessions.ungrouped.length})
                    </h4>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                  <div className="space-y-2.5">{ws.modularGroupedSessions.ungrouped.map((s) => renderSessionCard(s))}</div>
                </div>
              )}
            </div>
          ) : ws.groupByEvolution && ws.sessionView.evolutionGroups.length > 0 ? (
            <div className="space-y-3">
              {ws.sessionView.evolutionGroups.map((evoGroup) => {
                const isCollapsed = ws.collapsedEvolutionGroupIds.includes(evoGroup.id);
                const matchedPlan = evoGroup.paymentPlanIds.length > 0 ? ws.paymentPlanMap.get(evoGroup.paymentPlanIds[0]) : null;
                const primaryColor = evoGroup.tagGroups[0]?.color ? getLegacyGroupHex(evoGroup.tagGroups[0].color) : undefined;
                const groupTitle = evoGroup.customName || (evoGroup.tagGroups.length > 0 ? evoGroup.tagGroups.map((g) => g.name).join(" · ") : "Ciclo de Evolução");
                const latestInGroup = evoGroup.sessions[0];

                return (
                  <div key={evoGroup.id} className="rounded-2xl border bg-card shadow-xs overflow-hidden transition-all">
                    <div
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-muted/25 hover:bg-muted/40 cursor-pointer transition-colors border-b select-none"
                      onClick={() => ws.toggleEvolutionGroupCollapse(evoGroup.id)}
                    >
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground shrink-0"
                          onClick={(e) => { e.stopPropagation(); ws.toggleEvolutionGroupCollapse(evoGroup.id); }}
                        >
                          {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: primaryColor || "var(--primary)" }} />
                          <h3 className="font-bold text-sm tracking-tight text-foreground truncate max-w-[280px] sm:max-w-md">{groupTitle}</h3>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); ws.setEditingEvolutionGroup({ id: evoGroup.id, name: evoGroup.customName || "" }); }}
                            title="Personalizar nome do ciclo de evolução"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="secondary" className="text-[11px] font-semibold px-2 py-0.5">
                            {evoGroup.sessionCount} {evoGroup.sessionCount === 1 ? "atendimento" : "atendimentos"}
                          </Badge>
                          {evoGroup.firstSessionDate && (
                            <Badge variant="outline" className="text-[10px] font-normal px-2 py-0.5 text-muted-foreground">
                              {new Date(evoGroup.firstSessionDate).toLocaleDateString("pt-BR")}
                              {evoGroup.latestSessionDate && evoGroup.firstSessionDate !== evoGroup.latestSessionDate
                                ? ` até ${new Date(evoGroup.latestSessionDate).toLocaleDateString("pt-BR")}`
                                : ""}
                            </Badge>
                          )}
                          {matchedPlan && (
                            <Badge variant="outline" className="text-[10px] font-medium border-primary/30 bg-primary/10 text-primary gap-1">
                              <Package className="h-3 w-3" />
                              <span>{matchedPlan.name} ({matchedPlan.used_sessions}/{matchedPlan.total_sessions})</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        {latestInGroup && !ws.selectionMode && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2.5 gap-1.5 font-medium border-primary/30 hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={(e) => { e.stopPropagation(); ws.setSessionToEvolve(latestInGroup); }}
                            disabled={ws.evolvingSessionId === latestInGroup.id}
                          >
                            {ws.evolvingSessionId === latestInGroup.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                            <span>Evoluir da última</span>
                          </Button>
                        )}
                      </div>
                    </div>
                    {!isCollapsed && (
                      <div className="p-3 space-y-2.5 bg-background/50">
                        {evoGroup.sessions.map((s) => renderSessionCard(s, primaryColor))}
                      </div>
                    )}
                  </div>
                );
              })}

              {ws.sessionView.standaloneSessions.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2 pt-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Atendimentos Avulsos ({ws.sessionView.standaloneSessions.length})
                    </h4>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                  <div className="space-y-2.5">{ws.sessionView.standaloneSessions.map((s) => renderSessionCard(s))}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">{ws.sessionView.chronologicalSessions.map((s) => renderSessionCard(s))}</div>
          )}
        </div>
      ) : (
        <Card className="p-8 text-center border-dashed">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Calendar className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-3 text-base font-semibold">Nenhum atendimento encontrado</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {ws.searchTerm || ws.sessionStatusFilter !== "all" || ws.selectedTagFilter !== "all"
              ? "Nenhum atendimento corresponde aos filtros selecionados."
              : "Este paciente ainda não possui atendimentos registrados."}
          </p>
          {ws.selectedTagFilter !== "all" && (
            <Button variant="outline" size="sm" className="mt-4 text-xs" onClick={() => ws.setSelectedTagFilter("all")}>
              Ver todos os atendimentos
            </Button>
          )}
        </Card>
      )}
    </div>
  );
};

export default PatientSessionsPage;
