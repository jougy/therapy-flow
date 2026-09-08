import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight, ClipboardEdit, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PatientClinicalSnapshotState } from "@/lib/patient-clinical-snapshots";
import { formatDateTime } from "@/lib/patient-formatting";
import { cn } from "@/lib/utils";

export type ClinicalHistoryVersion = {
  authorLabel?: string;
  date: string;
  id: string;
  isCurrent?: boolean;
  note?: string | null;
  changedFields?: string[];
  state: PatientClinicalSnapshotState;
};

export const CLINICAL_HISTORY_FIELDS: Array<{
  field: keyof PatientClinicalSnapshotState;
  label: string;
}> = [
  { field: "diagnoses", label: "Diagnósticos prévios" },
  { field: "surgeries", label: "Cirurgias e internações" },
  { field: "implants_devices", label: "Implantes e dispositivos" },
  { field: "falls_history", label: "Histórico de quedas" },
  { field: "continuous_medications", label: "Medicamentos de uso contínuo" },
  { field: "functional_independence", label: "Contexto funcional atual" },
  { field: "mobility_aids", label: "Dispositivos de apoio" },
  { field: "substance_use_history", label: "Uso de substâncias, vícios e compulsões" },
  { field: "clinical_notes", label: "Observações clínicas" },
];

export interface ClinicalHistoryNavigatorProps {
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  versions: ClinicalHistoryVersion[];
}

export const ClinicalHistoryNavigator: React.FC<ClinicalHistoryNavigatorProps> = ({
  currentIndex,
  onChangeIndex,
  versions,
}) => {
  // Tratamento elegante para histórico vazio
  if (!versions || versions.length === 0) {
    return (
      <Card className="border-border/70 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico Clínico Temporal</CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center space-y-2">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-foreground">Nenhuma revisão registrada</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Não constam alterações arquivadas ou histórico clínico prévio para este paciente.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Clamping seguro do índice
  const safeIndex = Math.min(Math.max(0, currentIndex), Math.max(0, versions.length - 1));
  const selectedVersion = versions[safeIndex] ?? versions[0];
  const canGoOlder = safeIndex < versions.length - 1;
  const canGoNewer = safeIndex > 0;

  // Memoização do Set de changedFields para otimização de render (evita recriação a cada ciclo)
  const changedFieldsSet = useMemo(
    () => new Set(selectedVersion?.changedFields || []),
    [selectedVersion?.changedFields]
  );

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Histórico Clínico Temporal</CardTitle>
        {versions.length === 1 ? (
          <Badge variant="outline" className="text-xs bg-muted/30">
            Registro inicial sem revisões anteriores
          </Badge>
        ) : (
          <Badge variant="outline" className="text-xs">
            {versions.length} revisões arquivadas
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Navegador de Revisão */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-3">
          <Button
            aria-label="Ver revisão anterior"
            disabled={!canGoOlder}
            onClick={() => onChangeIndex(safeIndex + 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {selectedVersion.isCurrent
                  ? "Versão Atual em Produção"
                  : `Revisão ${versions.length - safeIndex} de ${versions.length}`}
              </p>
              {selectedVersion.isCurrent ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] py-0 px-2">
                  Atual
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 px-2 text-muted-foreground">
                  Anterior ({safeIndex}ª retroativa)
                </Badge>
              )}
            </div>
            <p className="mt-1 text-base font-semibold text-foreground">
              {formatDateTime(selectedVersion.date)}
            </p>
            {selectedVersion.authorLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Responsável: <span className="font-medium text-foreground">{selectedVersion.authorLabel}</span>
              </p>
            ) : null}
          </div>

          <Button
            aria-label="Ver revisão mais recente"
            disabled={!canGoNewer}
            onClick={() => onChangeIndex(safeIndex - 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Seletor direto de versão quando houver mais de 2 revisões */}
        {versions.length > 2 ? (
          <div className="flex items-center justify-center gap-2 -mt-2 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Ir direto para:</span>
            <select
              value={safeIndex}
              onChange={(e) => onChangeIndex(Number(e.target.value))}
              className="text-xs bg-background border border-border/70 rounded-xl px-2.5 py-1.5 text-foreground hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer max-w-xs truncate shadow-2xs"
              aria-label="Selecionar revisão por data"
            >
              {versions.map((v, i) => (
                <option key={v.id || i} value={i}>
                  {v.isCurrent ? "Versão atual" : `Revisão ${versions.length - i}`} — {formatDateTime(v.date)} {v.authorLabel ? `(${v.authorLabel})` : ""}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* Nota da alteração */}
        {selectedVersion.note ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
              <ClipboardEdit className="h-3.5 w-3.5" />
              <span>Nota da alteração</span>
            </div>
            <p className="text-sm leading-6 text-foreground font-medium">{selectedVersion.note}</p>
          </div>
        ) : null}

        {/* Destaque de campos modificados na revisão */}
        {selectedVersion.changedFields && selectedVersion.changedFields.length > 0 ? (
          <div className="rounded-xl bg-muted/30 border border-border/60 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">
              Campos modificados nesta revisão ({selectedVersion.changedFields.length}):
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedVersion.changedFields.map((field) => {
                const item = CLINICAL_HISTORY_FIELDS.find((f) => f.field === field);
                return (
                  <Badge
                    key={field}
                    variant="secondary"
                    className="text-[11px] bg-primary/10 text-primary border border-primary/20 font-medium"
                  >
                    {item ? item.label : field}
                  </Badge>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Grid com destaques visuais para campos modificados */}
        <div className="grid gap-3 md:grid-cols-2">
          {CLINICAL_HISTORY_FIELDS.map(({ field, label }) => {
            const value = selectedVersion.state[field]?.trim();
            const isChanged = changedFieldsSet.has(field);

            return (
              <div
                key={field}
                className={cn(
                  "rounded-2xl px-4 py-3 transition-all",
                  isChanged
                    ? "border border-primary/40 bg-primary/5 shadow-xs ring-1 ring-primary/20"
                    : "bg-muted/20"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    {label}
                  </p>
                  {isChanged ? (
                    <span className="text-[10px] font-semibold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                      Modificado
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">
                  {value || <span className="text-muted-foreground/60 italic font-normal">—</span>}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
