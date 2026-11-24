import { ChevronDown, ChevronUp, Copy, FolderPlus, Loader2, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import { getLegacyGroupHex, getReadableTextColor } from "@/lib/group-colors";
import type { PatientPaymentPlanRow } from "@/lib/payment-plans";
import { formatAbbreviatedName } from "@/lib/session-people";
import { getSessionPreviewIndicators } from "@/lib/session-preview";
import type { SessionShareSummary } from "@/lib/session-sharing";
import { ScaleIndicator, SessionOperationalChips, statusColors } from "./pacienteDetalheHelpers";
import type { PatientGroup, Session } from "./pacienteDetalheTypes";
import { SessionTabsPreview } from "./SessionTabsPreview";

export interface SessionCardViewProps {
  baseSchema: AnamnesisTemplateSchema;
  canViewFinancialData: boolean;
  creatorName: string;
  creatorIsIntern: boolean;
  isExpanded?: boolean;
  isSelected: boolean;
  onEvolve?: () => void;
  onLinkGroup?: () => void;
  isEvolving?: boolean;
  onToggleExpand?: () => void;
  onViewShareRecipients: () => void;
  selectionMode: boolean;
  shareSummary?: SessionShareSummary;
  session: Session;
  sessionGroups?: PatientGroup[];
  paymentPlan?: PatientPaymentPlanRow | null;
}

export function SessionCardCompact({
  baseSchema,
  canViewFinancialData,
  creatorName,
  creatorIsIntern,
  isExpanded,
  isSelected,
  onEvolve,
  onLinkGroup,
  isEvolving,
  onToggleExpand,
  onViewShareRecipients,
  selectionMode,
  shareSummary,
  session,
  sessionGroups,
  paymentPlan,
}: SessionCardViewProps) {
  const indicators = getSessionPreviewIndicators(session, baseSchema);
  const shareCount = shareSummary?.share_count ?? 0;

  return (
    <CardContent className="min-w-0 max-w-full p-2.5 sm:p-3">
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs font-semibold tracking-tight">
            {new Date(session.session_date).toLocaleDateString("pt-BR")}
          </span>
          <Badge variant="outline" className={`h-5 max-w-full truncate px-1.5 text-[10px] ${statusColors[session.status] || ""}`}>
            {session.status}
          </Badge>
          <span className="max-w-full truncate text-xs text-muted-foreground sm:max-w-[140px]" title={creatorName}>
            {formatAbbreviatedName(creatorName)}
          </span>
          {creatorIsIntern && (
            <Badge variant="outline" className="h-5 max-w-full truncate px-1 text-[10px]">
              Estagiário
            </Badge>
          )}
          {sessionGroups && sessionGroups.length > 0 && (
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {sessionGroups.slice(0, 3).map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="h-5 max-w-full truncate gap-1 px-1.5 text-[10px] font-medium"
                  style={{
                    borderColor: getLegacyGroupHex(tag.color),
                    backgroundColor: `${getLegacyGroupHex(tag.color)}18`,
                    color: getReadableTextColor(getLegacyGroupHex(tag.color)) === "#111827" ? "#111827" : undefined,
                  }}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: getLegacyGroupHex(tag.color) }} />
                  <span className="truncate">{tag.name}</span>
                </Badge>
              ))}
              {sessionGroups.length > 3 && (
                <span className="text-[10px] font-medium text-muted-foreground">+{sessionGroups.length - 3}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5 self-end sm:self-center shrink-0">
          {indicators.length > 0 && (
            <div className="flex max-w-full items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-[11px] font-medium">
              <span className="truncate text-muted-foreground">{indicators[0].label.replace("Escala de ", "")}:</span>
              <span className="shrink-0">{indicators[0].score}/{indicators[0].max}</span>
            </div>
          )}

          {shareCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[44px] min-w-[44px] px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onViewShareRecipients();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label={`Ver ${shareCount} compartilhamentos`}
            >
              <Share2 className="h-3.5 w-3.5" />
              <span className="text-[10px]">{shareCount}</span>
            </Button>
          )}

          {selectionMode && (
            <Badge variant={isSelected ? "default" : "outline"} className="max-w-full truncate text-xs">
              {isSelected ? "Selecionado" : "Selecionar"}
            </Badge>
          )}

          {onLinkGroup && !selectionMode && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-[44px] min-w-[44px] gap-1 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onLinkGroup();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              title="Vincular a grupo de evolução"
              aria-label="Vincular a grupo de evolução"
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
              className="min-h-[44px] gap-1 border-primary/20 px-2.5 text-xs transition-colors hover:bg-primary/10 hover:text-primary"
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
              className="min-h-[44px] min-w-[44px] p-0 text-muted-foreground hover:text-foreground"
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpand();
              }}
              onPointerDown={(event) => event.stopPropagation()}
              title={isExpanded ? "Recolher detalhes" : "Expandir detalhes rápidos"}
              aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes rápidos"}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-3 min-w-0 max-w-full space-y-3 border-t pt-3" onClick={(e) => e.stopPropagation()}>
          <SessionOperationalChips session={session} canViewFinancialData={canViewFinancialData} />
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
            <div className="min-w-0 flex-1">
              <SessionTabsPreview
                baseSchema={baseSchema}
                session={session}
                paymentPlan={paymentPlan}
                canViewFinancialData={canViewFinancialData}
              />
            </div>
            {indicators.length > 0 && (
              <div className="grid w-full max-w-full gap-3 sm:grid-cols-2 lg:w-56 lg:shrink-0 lg:grid-cols-1">
                {indicators.map((indicator) => (
                  <div key={indicator.id} className="min-w-0">
                    <span className="block break-words text-xs text-muted-foreground">{indicator.label}</span>
                    <ScaleIndicator score={indicator.score} min={indicator.min} max={indicator.max} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </CardContent>
  );
}
