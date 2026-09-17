import React from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, FileText, Activity, Building2, Calendar, Lock } from "lucide-react";
import type { ClinicalPortfolioItem } from "@/types/clinicalPortfolio";
import { formatSessionDateTime } from "@/lib/clinical-portfolio";

interface ClinicalRecordEvolutionModalProps {
  item: ClinicalPortfolioItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ClinicalRecordEvolutionModal: React.FC<ClinicalRecordEvolutionModalProps> = ({
  item,
  open,
  onOpenChange,
}) => {
  if (!item) return null;

  const painColor =
    item.pain_score === null
      ? "secondary"
      : item.pain_score <= 3
      ? "default"
      : item.pain_score <= 7
      ? "secondary"
      : "destructive";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90dvh] w-[95vw] sm:w-full flex flex-col p-0 overflow-hidden"
        data-testid="clinical-record-evolution-modal"
      >
        {/* Header */}
        <div className="border-b px-5 py-4 bg-muted/20">
          <DialogHeader className="text-left space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Evolução e Conduta Clínica
                </DialogTitle>
              </div>
              <Badge variant="outline" className="flex items-center gap-1 text-xs border-primary/40 bg-primary/5 text-primary font-medium">
                <Lock className="h-3 w-3" />
                Acervo Imutável (Read-Only)
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Registro histórico emitido sob sua responsabilidade técnica profissional.
            </DialogDescription>
          </DialogHeader>

          {/* Patient and context badges */}
          <div className="mt-3 flex flex-wrap items-center gap-2 pt-1 text-xs">
            <Badge variant="secondary" className="font-semibold text-foreground">
              {item.patient_pseudonym}
            </Badge>
            {item.patient_demographics && (
              <Badge variant="outline" className="text-muted-foreground">
                {item.patient_demographics}
              </Badge>
            )}
            <Badge variant="outline" className="flex items-center gap-1 bg-background text-muted-foreground">
              <Building2 className="h-3 w-3 text-primary" />
              {item.clinic_name}
            </Badge>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatSessionDateTime(item.session_date)}
            </span>
          </div>

          {/* Care lines / tags */}
          {item.tags && item.tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-1" data-testid="modal-session-tags">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">Linhas de cuidado:</span>
              {item.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-[11px] h-5 px-2 font-medium gap-1"
                  style={{
                    borderColor: tag.color || undefined,
                    backgroundColor: tag.color ? `${tag.color}18` : undefined,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color || "currentColor" }}
                  />
                  {tag.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Scrollable Body - Mobile friendly */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3.5 sm:px-5 sm:py-4 space-y-4">
          {/* Pain & Complexity Summary */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            <Card className="bg-muted/10 border-muted">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Escala Visual Analógica (EVA)</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {item.pain_score !== null ? `${item.pain_score} / 10` : "Não avaliado"}
                  </p>
                </div>
                <Activity className="h-5 w-5 text-primary opacity-80" />
              </CardContent>
            </Card>

            <Card className="bg-muted/10 border-muted">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Complexidade Clínica</p>
                  <p className="text-lg font-bold text-foreground mt-0.5">
                    {item.complexity_score !== null ? `Nível ${item.complexity_score}` : "Padrão"}
                  </p>
                </div>
                <Badge variant={painColor} className="text-xs">
                  {item.complexity_score !== null ? `Score ${item.complexity_score}` : "Geral"}
                </Badge>
              </CardContent>
            </Card>
          </div>

          {/* Form response extra indicators if present */}
          {item.anamnesis_form_response &&
            typeof item.anamnesis_form_response === "object" &&
            !Array.isArray(item.anamnesis_form_response) &&
            Object.keys(item.anamnesis_form_response).length > 0 && (
              <Card className="bg-muted/10 border-muted" data-testid="modal-form-indicators">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Respostas do Formulário Clínico
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(item.anamnesis_form_response as Record<string, unknown>).map(
                    ([key, val]) => {
                      if (val === null || val === undefined || val === "") return null;
                      const displayVal =
                        typeof val === "object"
                          ? JSON.stringify(val)
                          : String(val);
                      return (
                        <div key={key} className="rounded border bg-background/60 p-2 text-xs">
                          <span className="font-medium text-muted-foreground block truncate">
                            {key.replace(/_/g, " ")}:
                          </span>
                          <span className="text-foreground font-semibold break-words mt-0.5 block">
                            {displayVal}
                          </span>
                        </div>
                      );
                    }
                  )}
                </CardContent>
              </Card>
            )}

          {/* Anotações Clínicas / Evolução */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Anotações Clínicas & Evolução
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {item.notes_sanitized ? (
                <div className="whitespace-pre-wrap break-words text-sm text-foreground/90 leading-relaxed rounded-md bg-muted/20 p-3 border border-border/50">
                  {item.notes_sanitized}
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground py-2">
                  Nenhuma anotação de evolução registrada neste atendimento.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Conduta Terapêutica / Tratamento */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-600" />
                Conduta Terapêutica & Procedimentos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1">
              {item.treatment_sanitized ? (
                <div className="whitespace-pre-wrap break-words text-sm text-foreground/90 leading-relaxed rounded-md bg-muted/20 p-3 border border-border/50">
                  {item.treatment_sanitized}
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground py-2">
                  Nenhum protocolo ou conduta terapêutica detalhada registrada.
                </p>
              )}
            </CardContent>
          </Card>

          {/* LGPD Institutional note */}
          <div className="rounded-lg border border-sky-200/70 bg-sky-50/50 dark:border-sky-900/40 dark:bg-sky-950/20 p-3 flex items-start gap-2.5 text-xs text-sky-900 dark:text-sky-300">
            <ShieldCheck className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
            <p className="leading-normal">
              <strong>Garantia Ética & LGPD:</strong> Este registro faz parte do seu acervo técnico profissional permanente. Os dados de identificação civil do paciente foram pseudonimizados na visualização para resguardar o sigilo e as relações dos estabelecimentos de saúde.
            </p>
          </div>
        </div>

        {/* Footer: strictly Read-Only, no delete or edit buttons */}
        <div className="border-t px-4 py-2.5 sm:px-5 sm:py-3 bg-muted/10 flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Lock className="h-3 w-3" /> Somente leitura
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid="close-evolution-modal"
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
