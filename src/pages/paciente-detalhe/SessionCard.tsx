import { memo, useRef } from "react";
import { Share2, Copy, Loader2, FolderPlus, ChevronUp, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getLegacyGroupHex, getReadableTextColor } from "@/lib/group-colors";
import { getSessionPreviewIndicators } from "@/lib/session-preview";
import {
  getArrivalDelayMinutes,
  getSessionBalanceCents,
  getSessionOriginalAmountCents,
  getPaymentAdjustmentCents,
  getPaymentAdjustmentPercent,
  hasPaymentAdjustment,
  getPaymentStatusLabel,
  formatMoneyCents,
} from "@/lib/session-operations";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import type { SessionShareSummary } from "@/lib/session-sharing";
import type { PatientPaymentPlanRow } from "@/lib/payment-plans";
import type { Session, PatientGroup } from "./pacienteDetalheTypes";
import { statusColors, formatOperationalTime, ScaleIndicator } from "./pacienteDetalheHelpers";
import { SessionTabsPreview } from "./SessionTabsPreview";
import { formatAbbreviatedName } from "@/lib/session-people";

export interface SessionCardProps {
  baseSchema: AnamnesisTemplateSchema;
  borderColor?: string;
  canViewFinancialData: boolean;
  creatorName: string;
  creatorIsIntern: boolean;
  isCompact?: boolean;
  isExpanded?: boolean;
  isSelected: boolean;
  navigateTo: () => void;
  onEvolve?: () => void;
  onLinkGroup?: () => void;
  isEvolving?: boolean;
  onPressCancel: () => void;
  onPressStart: () => void;
  onToggleExpand?: () => void;
  onToggleSelect: () => void;
  onViewShareRecipients: () => void;
  selectionMode: boolean;
  shareSummary?: SessionShareSummary;
  session: Session;
  sessionGroups?: PatientGroup[];
  paymentPlan?: PatientPaymentPlanRow | null;
}

export const SessionCard = memo(({
  baseSchema,
  borderColor,
  canViewFinancialData,
  creatorName,
  creatorIsIntern,
  isCompact,
  isExpanded,
  isSelected,
  navigateTo,
  onEvolve,
  onLinkGroup,
  isEvolving,
  onPressCancel,
  onPressStart,
  onToggleExpand,
  onToggleSelect,
  onViewShareRecipients,
  shareSummary,
  selectionMode,
  session,
  sessionGroups,
  paymentPlan,
}: SessionCardProps) => {
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressOccurredRef = useRef(false);
  const indicators = getSessionPreviewIndicators(session, baseSchema);
  const shareCount = shareSummary?.share_count ?? 0;
  const delayMinutes = getArrivalDelayMinutes(session);
  const balanceCents = getSessionBalanceCents(session);
  const originalAmountCents = getSessionOriginalAmountCents(session);
  const adjustmentCents = getPaymentAdjustmentCents(session);
  const adjustmentPercent = getPaymentAdjustmentPercent(session);
  const sessionHasPaymentAdjustment = hasPaymentAdjustment(session);
  const hasPaymentInfo =
    session.payment_status !== "nao_cobrado" || Boolean(session.amount_charged_cents || session.amount_paid_cents);
  const hasOperationalInfo =
    Boolean(session.scheduled_start_at || session.patient_arrived_at) || (canViewFinancialData && hasPaymentInfo);

  if (isCompact) {
    return (
      <Card
        className={`border-l-4 cursor-pointer select-none hover:shadow-xs transition-all ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
        style={borderColor ? { borderLeftColor: borderColor } : undefined}
        onClick={() => {
          if (longPressOccurredRef.current) {
            longPressOccurredRef.current = false;
            return;
          }
          if (selectionMode) {
            onToggleSelect();
          } else {
            navigateTo();
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          if (selectionMode) {
            onToggleSelect();
          } else {
            navigateTo();
          }
        }}
        onPointerDown={(e) => {
          if (selectionMode || (e.button !== undefined && e.button !== 0)) return;
          touchStartPosRef.current = { x: e.clientX, y: e.clientY };
          setTimeout(() => {
            if (touchStartPosRef.current) longPressOccurredRef.current = true;
          }, 400);
          onPressStart();
        }}
        onPointerMove={(e) => {
          if (selectionMode || !touchStartPosRef.current) return;
          const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
          const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
          if (dx > 10 || dy > 10) {
            touchStartPosRef.current = null;
            onPressCancel();
          }
        }}
        onPointerUp={() => {
          touchStartPosRef.current = null;
          if (!selectionMode) onPressCancel();
        }}
        onPointerCancel={() => {
          touchStartPosRef.current = null;
          if (!selectionMode) onPressCancel();
        }}
      >
        <CardContent className="p-2.5 sm:p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className="font-semibold text-xs tracking-tight">{new Date(session.session_date).toLocaleDateString("pt-BR")}</span>
              <Badge variant="outline" className={`text-[10px] h-5 px-1.5 ${statusColors[session.status] || ""}`}>{session.status}</Badge>
              <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={creatorName}>
                {formatAbbreviatedName(creatorName)}
              </span>
              {creatorIsIntern && (
                <Badge variant="outline" className="text-[10px] h-5 px-1">Estagiário</Badge>
              )}
              {sessionGroups && sessionGroups.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  {sessionGroups.slice(0, 3).map((tag) => (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-[10px] h-5 px-1.5 font-medium gap-1"
                      style={{
                        borderColor: getLegacyGroupHex(tag.color),
                        backgroundColor: `${getLegacyGroupHex(tag.color)}18`,
                        color: getReadableTextColor(getLegacyGroupHex(tag.color)) === "#111827" ? "#111827" : undefined,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: getLegacyGroupHex(tag.color) }} />
                      {tag.name}
                    </Badge>
                  ))}
                  {sessionGroups.length > 3 && (
                    <span className="text-[10px] text-muted-foreground font-medium">+{sessionGroups.length - 3}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              {indicators.length > 0 && (
                <div className="flex items-center gap-1 text-[11px] font-medium bg-muted/60 px-2 py-0.5 rounded-md">
                  <span className="text-muted-foreground">{indicators[0].label.replace("Escala de ", "")}:</span>
                  <span>{indicators[0].score}/{indicators[0].max}</span>
                </div>
              )}

              {shareCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewShareRecipients();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="text-[10px]">{shareCount}</span>
                </Button>
              )}

              {selectionMode && (
                <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                  {isSelected ? "Selecionado" : "Selecionar"}
                </Badge>
              )}

              {onLinkGroup && !selectionMode && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onLinkGroup();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="Vincular a grupo de evolução"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">Grupo</span>
                </Button>
              )}

              {onEvolve && !selectionMode && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                  onClick={(event) => {
                    event.stopPropagation();
                    onEvolve();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  disabled={isEvolving}
                  title="Evoluir atendimento (iniciar novo a partir deste)"
                >
                  {isEvolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="text-[11px] font-medium">Evoluir</span>
                </Button>
              )}

              {onToggleExpand && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleExpand();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title={isExpanded ? "Recolher detalhes" : "Expandir detalhes rápidos"}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {/* Inline Preview when expanded in compact mode */}
          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3" onClick={(e) => e.stopPropagation()}>
              {hasOperationalInfo ? (
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {session.scheduled_start_at || session.patient_arrived_at ? (
                    <span className="rounded-full bg-muted px-2 py-1" title={session.payment_adjustment_reason ?? undefined}>
                      Agendado {formatOperationalTime(session.scheduled_start_at)} · Chegou {formatOperationalTime(session.patient_arrived_at)}
                      {delayMinutes && delayMinutes > 0 ? ` · atraso ${delayMinutes}min` : ""}
                    </span>
                  ) : null}
                  {canViewFinancialData && hasPaymentInfo ? (
                    <span className="rounded-full bg-muted px-2 py-1">
                      {getPaymentStatusLabel(session.payment_status)} · {formatMoneyCents(session.amount_paid_cents)} de{" "}
                      {sessionHasPaymentAdjustment ? (
                        <>
                          <span className="line-through">{formatMoneyCents(originalAmountCents)}</span>{" "}
                          {formatMoneyCents(session.amount_charged_cents)}
                          <span className={adjustmentCents > 0 ? "ml-1 font-semibold text-success" : "ml-1 font-semibold text-destructive"}>
                            {adjustmentCents > 0 ? "+" : ""}
                            {adjustmentPercent}%
                          </span>
                        </>
                      ) : (
                        formatMoneyCents(session.amount_charged_cents)
                      )}
                      {balanceCents > 0 ? ` · aberto ${formatMoneyCents(balanceCents)}` : ""}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="min-w-0 flex-1">
                  <SessionTabsPreview
                    baseSchema={baseSchema}
                    session={session}
                    paymentPlan={paymentPlan}
                    canViewFinancialData={canViewFinancialData}
                  />
                </div>
                {indicators.length > 0 && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:w-[220px] lg:shrink-0 lg:grid-cols-1">
                    {indicators.map((indicator) => (
                      <div key={indicator.id}>
                        <span className="text-xs text-muted-foreground block">{indicator.label}</span>
                        <ScaleIndicator score={indicator.score} min={indicator.min} max={indicator.max} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={`border-l-4 cursor-pointer select-none hover:shadow-md transition-shadow ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
      onClick={() => {
        if (longPressOccurredRef.current) {
          longPressOccurredRef.current = false;
          return;
        }
        if (selectionMode) {
          onToggleSelect();
        } else {
          navigateTo();
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();

        if (selectionMode) {
          onToggleSelect();
          return;
        }

        navigateTo();
      }}
      onPointerDown={(e) => {
        if (selectionMode || (e.button !== undefined && e.button !== 0)) return;
        touchStartPosRef.current = { x: e.clientX, y: e.clientY };

        setTimeout(() => {
          if (touchStartPosRef.current) {
            longPressOccurredRef.current = true;
          }
        }, 400);

        onPressStart();
      }}
      onPointerMove={(e) => {
        if (selectionMode || !touchStartPosRef.current) return;
        const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
        const dy = Math.abs(e.clientY - touchStartPosRef.current.y);
        if (dx > 10 || dy > 10) {
          touchStartPosRef.current = null;
          onPressCancel();
        }
      }}
      onPointerUp={() => {
        touchStartPosRef.current = null;
        if (!selectionMode) onPressCancel();
      }}
      onPointerCancel={() => {
        touchStartPosRef.current = null;
        if (!selectionMode) onPressCancel();
      }}
      onContextMenu={(e) => {
        if (!selectionMode && onPressStart) {
          e.preventDefault();
          longPressOccurredRef.current = true;
          touchStartPosRef.current = null;
          onPressStart();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="font-medium text-sm">{new Date(session.session_date).toLocaleDateString("pt-BR")}</span>
                <Badge variant="outline" className={`text-xs ${statusColors[session.status] || ""}`}>{session.status}</Badge>
                <Badge variant="secondary" className="text-xs max-w-[200px] truncate" title={creatorName}>
                  {formatAbbreviatedName(creatorName)}
                </Badge>
                {creatorIsIntern && (
                  <Badge variant="outline" className="text-xs">
                    Estagiario
                  </Badge>
                )}
                {shareCount > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      onViewShareRecipients();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {shareCount}
                  </Button>
                )}
                {selectionMode && (
                  <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                    {isSelected ? "Selecionado" : "Toque para selecionar"}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                {onLinkGroup && !selectionMode && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      onLinkGroup();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    title="Vincular a grupo de evolução"
                  >
                    <FolderPlus className="h-3.5 w-3.5" />
                    <span className="text-[11px]">Grupo</span>
                  </Button>
                )}
                {onEvolve && !selectionMode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 px-2 text-xs gap-1 border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors"
                    onClick={(event) => {
                      event.stopPropagation();
                      onEvolve();
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    disabled={isEvolving}
                    title="Evoluir atendimento (iniciar novo a partir deste)"
                  >
                    {isEvolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="text-[11px] font-medium">Evoluir caso</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Badges de Sintomas & Linhas de Cuidado da Sessão */}
            {sessionGroups && sessionGroups.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {sessionGroups.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="outline"
                    className="text-[11px] font-semibold px-2 py-0.5 gap-1 shadow-xs"
                    style={{
                      borderColor: getLegacyGroupHex(tag.color),
                      backgroundColor: `${getLegacyGroupHex(tag.color)}20`,
                      color: getReadableTextColor(getLegacyGroupHex(tag.color)) === "#111827" ? "#111827" : undefined,
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: getLegacyGroupHex(tag.color) }}
                    />
                    {tag.name}
                  </Badge>
                ))}
              </div>
            )}
            {hasOperationalInfo ? (
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                {session.scheduled_start_at || session.patient_arrived_at ? (
                  <span className="rounded-full bg-muted px-2 py-1" title={session.payment_adjustment_reason ?? undefined}>
                    Agendado {formatOperationalTime(session.scheduled_start_at)} · Chegou {formatOperationalTime(session.patient_arrived_at)}
                    {delayMinutes && delayMinutes > 0 ? ` · atraso ${delayMinutes}min` : ""}
                  </span>
                ) : null}
                {canViewFinancialData && hasPaymentInfo ? (
                  <span className="rounded-full bg-muted px-2 py-1">
                    {getPaymentStatusLabel(session.payment_status)} · {formatMoneyCents(session.amount_paid_cents)} de{" "}
                    {sessionHasPaymentAdjustment ? (
                      <>
                        <span className="line-through">{formatMoneyCents(originalAmountCents)}</span>{" "}
                        {formatMoneyCents(session.amount_charged_cents)}
                        <span className={adjustmentCents > 0 ? "ml-1 font-semibold text-success" : "ml-1 font-semibold text-destructive"}>
                          {adjustmentCents > 0 ? "+" : ""}
                          {adjustmentPercent}%
                        </span>
                      </>
                    ) : (
                      formatMoneyCents(session.amount_charged_cents)
                    )}
                    {balanceCents > 0 ? ` · aberto ${formatMoneyCents(balanceCents)}` : ""}
                  </span>
                ) : null}
              </div>
            ) : null}
            <SessionTabsPreview
              baseSchema={baseSchema}
              session={session}
              paymentPlan={paymentPlan}
              canViewFinancialData={canViewFinancialData}
            />
          </div>
          {indicators.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:w-[240px] lg:shrink-0 lg:grid-cols-1">
              {indicators.map((indicator) => (
                <div key={indicator.id}>
                  <span className="text-xs text-muted-foreground block">{indicator.label}</span>
                  <ScaleIndicator score={indicator.score} min={indicator.min} max={indicator.max} />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

SessionCard.displayName = "SessionCard";
