import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { FileText, CheckCircle2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { SessionAnamnesisRuntime, type GroupSuggestion } from "@/components/sessions";
import type { ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import type { AnamnesisFormResponse, TemplateLayoutItem } from "@/lib/anamnesis-forms";
import type { DatabaseAnamnesisTemplate } from "./sessaoDetalheTypes";

export interface SessionComplementaryFormsBlockProps {
  anamnesisTemplates: DatabaseAnamnesisTemplate[];
  anamnesisTemplateId: string | null;
  activeTemplate: DatabaseAnamnesisTemplate | null;
  extraLayout: TemplateLayoutItem[];
  locked: boolean;
  anamnesisFormResponse: AnamnesisFormResponse;
  complexityScore: number[];
  horizontalScrollRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  horizontalScrollState: Record<string, { clientWidth: number; scrollLeft: number; scrollWidth: number }>;
  observacoes: string;
  painScore: number[];
  queixa: string;
  sintomas: string;
  suggestedCareLine?: any;
  clinicColorSlots: ClinicGroupColorSlot[];
  groupSuggestions: GroupSuggestion[];
  clinicId: string | null;
  patientId?: string;
  sessionId?: string;
  onAnamnesisTemplateSelect: (templateId: string | null) => void;
  onAnamnesisFormResponseChange: (response: AnamnesisFormResponse) => void;
  onComplexityScoreChange: (score: number[]) => void;
  onObservacoesChange: (value: string) => void;
  onPainScoreChange: (score: number[]) => void;
  onQueixaChange: (value: string) => void;
  onSintomasChange: (value: string) => void;
  onSelectCareLinePreset: (groupId: string) => void;
  scrollHorizontalSectionToRatio: (key: string, ratio: number, behavior?: ScrollBehavior) => void;
  scrollHorizontalSectionToSibling: (key: string, direction: "left" | "right") => void;
  beginHorizontalDrag: (key: string, event: ReactPointerEvent<HTMLDivElement>) => void;
  updateHorizontalDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  endHorizontalDrag: (event: ReactPointerEvent<HTMLDivElement>) => void;
  scheduleHorizontalScrollSync: () => void;
  onNavigateToTemplates: () => void;
}

export function SessionComplementaryFormsBlock({
  anamnesisTemplates,
  anamnesisTemplateId,
  activeTemplate,
  extraLayout,
  locked,
  anamnesisFormResponse,
  complexityScore,
  horizontalScrollRefs,
  horizontalScrollState,
  observacoes,
  painScore,
  queixa,
  sintomas,
  suggestedCareLine,
  clinicColorSlots,
  groupSuggestions,
  clinicId,
  patientId,
  sessionId,
  onAnamnesisTemplateSelect,
  onAnamnesisFormResponseChange,
  onComplexityScoreChange,
  onObservacoesChange,
  onPainScoreChange,
  onQueixaChange,
  onSintomasChange,
  onSelectCareLinePreset,
  scrollHorizontalSectionToRatio,
  scrollHorizontalSectionToSibling,
  beginHorizontalDrag,
  updateHorizontalDrag,
  endHorizontalDrag,
  scheduleHorizontalScrollSync,
  onNavigateToTemplates,
}: SessionComplementaryFormsBlockProps) {
  if (anamnesisTemplates.length === 0) {
    return null;
  }

  return (
    <div
      data-tutorial="session-custom-forms-box"
      className="relative overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/15 p-5 sm:p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:border-primary/60"
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/20 blur-2xl" />
      <div className="pointer-events-none absolute -left-8 -bottom-8 h-36 w-36 rounded-full bg-accent/25 blur-2xl" />

      <div className="relative z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/30 animate-pulse">
                <FileText className="h-4 w-4" />
              </div>
              <h3 className="font-bold text-base text-foreground tracking-tight flex items-center gap-2">
                Ficha Complementar de Avaliação
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-semibold uppercase tracking-wider">
                  Especializada
                </Badge>
              </h3>
              <ComponentHelpButton helpId="session-custom-forms" size="xs" />
            </div>
            <p className="text-xs text-muted-foreground max-w-xl">
              Deseja aprofundar a avaliação deste atendimento com um formulário clínico estruturado da clínica? Escolha uma ficha abaixo:
            </p>
          </div>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 text-xs bg-background/80 hover:bg-background border-primary/30 text-primary hover:text-primary gap-1 self-start sm:self-auto shrink-0 shadow-sm"
            onClick={onNavigateToTemplates}
          >
            <FileText className="w-3.5 h-3.5" />
            Gerenciar fichas da clínica
          </Button>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
          {anamnesisTemplates.map((template) => {
            const isSelected = anamnesisTemplateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => {
                  if (locked) return;
                  if (isSelected) {
                    onAnamnesisTemplateSelect(null);
                  } else {
                    onAnamnesisTemplateSelect(template.id);
                  }
                }}
                className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all duration-200 ${
                  isSelected
                    ? "border-primary bg-primary/15 shadow-md shadow-primary/10 ring-2 ring-primary/40"
                    : "border-border/80 bg-background/90 hover:border-primary/50 hover:bg-accent/40 hover:shadow-sm"
                }`}
                disabled={locked}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileText className={`h-4 w-4 ${isSelected ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                      <span className="font-semibold text-xs text-foreground line-clamp-1">{template.name}</span>
                    </div>
                    {isSelected ? (
                      <Badge className="h-5 px-1.5 text-[10px] bg-primary text-primary-foreground gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Ativa
                      </Badge>
                    ) : (
                      <span className="text-[10px] font-medium text-muted-foreground group-hover:text-primary">
                        + Usar
                      </span>
                    )}
                  </div>
                  {template.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2">{template.description}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
            onClick={() => onAnamnesisTemplateSelect(null)}
            disabled={locked}
          >
            {anamnesisTemplateId ? "✕ Remover Ficha Complementar (Usar apenas evolução livre)" : "✓ Utilizando apenas evolução livre"}
          </Button>
        </div>

        {activeTemplate && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-background/95 p-5 space-y-4 shadow-sm animate-in fade-in">
            <div className="flex items-center justify-between gap-3 border-b pb-3">
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  {activeTemplate.name}
                </h4>
                {activeTemplate.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{activeTemplate.description}</p>
                )}
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => onAnamnesisTemplateSelect(null)}
                disabled={locked}
              >
                Desvincular
              </Button>
            </div>
            <SessionAnamnesisRuntime
              anamnesisFormResponse={anamnesisFormResponse}
              complexityScore={complexityScore}
              horizontalScrollRefs={horizontalScrollRefs}
              horizontalScrollState={horizontalScrollState}
              layout={extraLayout}
              locked={locked}
              observacoes={observacoes}
              painScore={painScore}
              queixa={queixa}
              sintomas={sintomas}
              suggestedCareLine={suggestedCareLine}
              clinicColorSlots={clinicColorSlots}
              groupSuggestions={groupSuggestions}
              clinicId={clinicId}
              patientId={patientId}
              sessionId={sessionId}
              onAnamnesisFormResponseChange={onAnamnesisFormResponseChange}
              onComplexityScoreChange={onComplexityScoreChange}
              onObservacoesChange={onObservacoesChange}
              onPainScoreChange={onPainScoreChange}
              onQueixaChange={onQueixaChange}
              onSintomasChange={onSintomasChange}
              onSelectCareLinePreset={onSelectCareLinePreset}
              scrollHorizontalSectionToRatio={scrollHorizontalSectionToRatio}
              scrollHorizontalSectionToSibling={scrollHorizontalSectionToSibling}
              beginHorizontalDrag={beginHorizontalDrag}
              updateHorizontalDrag={updateHorizontalDrag}
              endHorizontalDrag={endHorizontalDrag}
              scheduleHorizontalScrollSync={scheduleHorizontalScrollSync}
            />
          </div>
        )}
      </div>
    </div>
  );
}
