import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { ClinicalPortfolioItem } from "@/types/clinicalPortfolio";
import { getSessionPreviewIndicators } from "@/lib/session-preview";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import { getLegacyGroupHex, getReadableTextColor } from "@/lib/group-colors";

export interface PortfolioCompactSessionCardProps {
  session: ClinicalPortfolioItem;
  baseSchema?: AnamnesisTemplateSchema;
  borderColor?: string;
  sessionGroups?: Array<{ id: string; name: string; color: string }>;
  isExpandedDefault?: boolean;
  onViewDetails?: (session: ClinicalPortfolioItem) => void;
}

const statusColors: Record<string, string> = {
  concluído: "bg-success/15 text-success border-success/20",
  concluido: "bg-success/15 text-success border-success/20",
  rascunho: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
};

const ScaleIndicator = ({ max = 10, min = 0, score }: { max?: number; min?: number; score: number }) => {
  const color = score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  const totalBars = Math.max(max - min, 1);
  const normalizedScore = Math.max(Math.min(score - min, totalBars), 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: totalBars }).map((_, i) => (
          <div key={i} className={`w-2 h-4 rounded-sm ${i < normalizedScore ? color : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}/{max}</span>
    </div>
  );
};

export const PortfolioCompactSessionCard: React.FC<PortfolioCompactSessionCardProps> = ({
  session,
  baseSchema,
  borderColor,
  sessionGroups,
  isExpandedDefault = false,
  onViewDetails,
}) => {
  const [isExpanded, setIsExpanded] = useState(isExpandedDefault);
  const [activeTab, setActiveTab] = useState("queixa");

  // Indicators dynamically derived from showInPatientList
  const previewIndicators = getSessionPreviewIndicators(
    {
      anamnesis_form_response: session.anamnesis_form_response,
      complexity_score: session.complexity_score,
      pain_score: session.pain_score,
    },
    baseSchema
  );

  const formattedDate = (() => {
    try {
      return new Date(session.session_date).toLocaleDateString("pt-BR");
    } catch {
      return session.session_date;
    }
  })();

  const groups = sessionGroups ?? session.tags ?? [];

  const handleCardClick = () => {
    onViewDetails?.(session);
  };

  return (
    <Card
      className="group/card border-l-4 cursor-pointer select-none hover:shadow-xs hover:border-primary/40 transition-all"
      style={borderColor ? { borderLeftColor: borderColor } : undefined}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      aria-label={`Ver evolução completa do atendimento de ${session.patient_name || session.patient_pseudonym}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCardClick();
        }
      }}
      data-testid={`portfolio-compact-card-${session.id}`}
    >
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Main Info Row */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* 1. Date */}
            <span className="font-semibold text-xs tracking-tight">{formattedDate}</span>

            {/* 2. Status Badge */}
            <Badge
              variant="outline"
              className={`text-[10px] h-5 px-1.5 ${statusColors[session.status.toLowerCase()] || "bg-muted text-muted-foreground"}`}
            >
              {session.status}
            </Badge>

            {/* 3. Clinic Badge */}
            <Badge
              variant="secondary"
              className="flex items-center gap-1 text-[10px] h-5 px-1.5 font-medium bg-primary/10 text-primary border-transparent"
            >
              <Building2 className="h-3 w-3" />
              {session.clinic_name}
            </Badge>

            {/* 4. Nome completo real do paciente & Demographics */}
            <span className="text-xs text-foreground font-medium truncate max-w-[240px]">
              {session.patient_name || session.patient_pseudonym}
              {session.patient_demographics ? ` • ${session.patient_demographics}` : ""}
            </span>

            {/* 5. Care lines / Tag badges */}
            {groups.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                {groups.slice(0, 3).map((tag) => {
                  const tagColor = getLegacyGroupHex(tag.color);
                  const isDarkText = getReadableTextColor(tagColor) === "#111827";
                  return (
                    <Badge
                      key={tag.id}
                      variant="outline"
                      className="text-[10px] h-5 px-1.5 font-medium gap-1"
                      style={{
                        borderColor: tagColor,
                        backgroundColor: `${tagColor}18`,
                        color: isDarkText ? "#111827" : undefined,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: tagColor }} />
                      {tag.name}
                    </Badge>
                  );
                })}
                {groups.length > 3 && (
                  <span className="text-[10px] text-muted-foreground font-medium">+{groups.length - 3}</span>
                )}
              </div>
            )}
          </div>

          {/* Right: Dynamic indicators, View Full Evolution clue & Chevron toggle */}
          <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
            {previewIndicators.length > 0 && (
              <div
                className="flex items-center gap-1 text-[11px] font-medium bg-muted/60 px-2 py-0.5 rounded-md"
                data-testid="preview-indicator-compact"
              >
                <span className="text-muted-foreground">
                  {previewIndicators[0].label.replace(/^Escala\s+/i, "")}:
                </span>
                <span>
                  {previewIndicators[0].score}/{previewIndicators[0].max}
                </span>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-normal text-muted-foreground hover:text-primary hover:bg-primary/10 gap-1 hidden sm:inline-flex"
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(session);
              }}
              title="Abrir atendimento"
              data-testid={`view-details-btn-${session.id}`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Abrir atendimento</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded((prev) => !prev);
              }}
              aria-label={isExpanded ? "Recolher detalhes" : "Expandir detalhes rápidos"}
              data-testid={`toggle-expand-btn-${session.id}`}
            >
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Inline Smooth Expanded Panel */}
        {isExpanded && (
          <div
            className="mt-3 pt-3 border-t space-y-3"
            onClick={(e) => e.stopPropagation()}
            data-testid={`expanded-panel-${session.id}`}
          >
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="min-w-0 flex-1">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-1">
                  <TabsList className="grid h-auto w-full grid-cols-2">
                    <TabsTrigger
                      value="queixa"
                      className="whitespace-normal px-2 py-1.5 text-xs sm:text-sm"
                      onClick={() => setActiveTab("queixa")}
                    >
                      Queixa principal
                    </TabsTrigger>
                    <TabsTrigger
                      value="tratamento"
                      className="whitespace-normal px-2 py-1.5 text-xs sm:text-sm"
                      onClick={() => setActiveTab("tratamento")}
                    >
                      Tratamento
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="queixa" className="rounded-md border bg-muted/20 p-3 mt-2">
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {session.notes_sanitized || "Nenhuma queixa principal registrada."}
                    </p>
                  </TabsContent>
                  <TabsContent value="tratamento" className="rounded-md border bg-muted/20 p-3 mt-2">
                    <p className="text-sm text-muted-foreground whitespace-pre-line">
                      {session.treatment_sanitized || "Nenhum tratamento registrado."}
                    </p>
                  </TabsContent>
                </Tabs>
              </div>

              {previewIndicators.length > 0 && (
                <div
                  className="grid gap-3 sm:grid-cols-2 lg:w-[220px] lg:shrink-0 lg:grid-cols-1 pt-1"
                  data-testid="expanded-indicators"
                >
                  {previewIndicators.map((indicator) => (
                    <div key={indicator.id}>
                      <span className="text-xs text-muted-foreground block mb-1">{indicator.label}</span>
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
};
