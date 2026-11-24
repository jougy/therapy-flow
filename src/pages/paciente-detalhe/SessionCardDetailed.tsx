import { Copy, FolderPlus, Loader2, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { getLegacyGroupHex, getReadableTextColor } from "@/lib/group-colors";
import { formatAbbreviatedName } from "@/lib/session-people";
import { getSessionPreviewIndicators } from "@/lib/session-preview";
import { ScaleIndicator, SessionOperationalChips, statusColors } from "./pacienteDetalheHelpers";
import type { SessionCardViewProps } from "./SessionCardCompact";
import { SessionTabsPreview } from "./SessionTabsPreview";

export function SessionCardDetailed({
  baseSchema,
  canViewFinancialData,
  creatorName,
  creatorIsIntern,
  isSelected,
  onEvolve,
  onLinkGroup,
  isEvolving,
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
    <CardContent className="min-w-0 max-w-full p-3.5 sm:p-4">
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-sm font-medium">
                {new Date(session.session_date).toLocaleDateString("pt-BR")}
              </span>
              <Badge variant="outline" className={`max-w-full truncate text-xs ${statusColors[session.status] || ""}`}>
                {session.status}
              </Badge>
              <Badge variant="secondary" className="max-w-full truncate text-xs sm:max-w-[200px]" title={creatorName}>
                {formatAbbreviatedName(creatorName)}
              </Badge>
              {creatorIsIntern && (
                <Badge variant="outline" className="max-w-full truncate text-xs">
                  Estagiário
                </Badge>
              )}
              {shareCount > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="min-h-[44px] min-w-[44px] gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewShareRecipients();
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  aria-label={`Ver ${shareCount} compartilhamentos`}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {shareCount}
                </Button>
              )}
              {selectionMode && (
                <Badge variant={isSelected ? "default" : "outline"} className="max-w-full truncate text-xs">
                  {isSelected ? "Selecionado" : "Toque para selecionar"}
                </Badge>
              )}
            </div>

            <div className="ml-auto flex flex-wrap items-center gap-1.5 shrink-0">
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
                  <span className="text-[11px] font-medium">Evoluir caso</span>
                </Button>
              )}
            </div>
          </div>

          {sessionGroups && sessionGroups.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
              {sessionGroups.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="max-w-full truncate gap-1 px-2 py-0.5 text-[11px] font-semibold shadow-xs"
                  style={{
                    borderColor: getLegacyGroupHex(tag.color),
                    backgroundColor: `${getLegacyGroupHex(tag.color)}20`,
                    color: getReadableTextColor(getLegacyGroupHex(tag.color)) === "#111827" ? "#111827" : undefined,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: getLegacyGroupHex(tag.color) }}
                  />
                  <span className="truncate">{tag.name}</span>
                </Badge>
              ))}
            </div>
          )}

          <SessionOperationalChips
            session={session}
            canViewFinancialData={canViewFinancialData}
            className="mt-2"
          />

          <SessionTabsPreview
            baseSchema={baseSchema}
            session={session}
            paymentPlan={paymentPlan}
            canViewFinancialData={canViewFinancialData}
          />
        </div>

        {indicators.length > 0 && (
          <div className="grid w-full max-w-full gap-3 sm:grid-cols-2 lg:w-60 lg:shrink-0 lg:grid-cols-1">
            {indicators.map((indicator) => (
              <div key={indicator.id} className="min-w-0">
                <span className="block break-words text-xs text-muted-foreground">{indicator.label}</span>
                <ScaleIndicator score={indicator.score} min={indicator.min} max={indicator.max} />
              </div>
            ))}
          </div>
        )}
      </div>
    </CardContent>
  );
}
