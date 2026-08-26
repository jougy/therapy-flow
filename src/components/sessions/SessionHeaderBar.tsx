import { useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, FileText, Loader2, Pencil, Printer, Save, Share2, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PatientRiskAlerts, PatientClinicalSummaryDialog } from "@/components/patients";
import type { SessionDocumentKind } from "@/lib/session-documents";
import type { Database } from "@/integrations/supabase/types";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

export interface SessionHeaderBarProps {
  canDeleteSession: boolean;
  canEditPresenceSummary: boolean;
  canEditSavedDraft: boolean;
  canManageSessionSharing: boolean;
  canPrintSessionDoc: boolean;
  canStartNewSessionFromThis: boolean;
  isEditing: boolean;
  isNew: boolean;
  locked: boolean;
  patient?: PatientRow | null;
  patientId: string | undefined;
  patientName: string;
  saving: boolean;
  sessionDate: string;
  startingFromThis: boolean;
  status: string;
  onBack: () => void;
  onDelete: () => Promise<void>;
  onEdit: () => void;
  onOpenShareAccess: () => void;
  onPrintDocument: (kind: SessionDocumentKind) => void;
  onSave: (explicitStatus?: "concluído" | "rascunho") => Promise<void>;
  onShareDocument: (kind: SessionDocumentKind) => Promise<void>;
  onStartFromThis: () => Promise<void>;
  onStatusChange: (status: string) => void;
}

export const SessionHeaderBar = ({
  canDeleteSession,
  canEditSavedDraft,
  canManageSessionSharing,
  canPrintSessionDoc,
  canStartNewSessionFromThis,
  isEditing,
  isNew,
  locked,
  patient,
  patientName,
  saving,
  sessionDate,
  startingFromThis,
  status,
  onBack,
  onDelete,
  onEdit,
  onOpenShareAccess,
  onPrintDocument,
  onSave,
  onShareDocument,
  onStartFromThis,
  onStatusChange,
}: SessionHeaderBarProps) => {
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);

  const statusColors: Record<string, string> = {
    concluído: "bg-success/15 text-success border-success/20",
    rascunho: "bg-warning/15 text-warning border-warning/20",
    cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Voltar para paciente"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              {isNew ? "Novo Atendimento" : `Atendimento — ${sessionDate}`}
            </h1>
            <p className="text-sm text-muted-foreground">{patientName}</p>
          </div>
        </div>

        {/* Alertas de Risco do Paciente e Resumo Clínico */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          <PatientRiskAlerts patient={patient} size="sm" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSummaryDialogOpen(true)}
            disabled={!patient}
            className="h-8 rounded-full border-primary/25 bg-background hover:border-primary/50 hover:bg-primary/5 text-xs font-medium gap-1.5 px-3 shadow-2xs cursor-pointer"
            title="Abrir resumo clínico do paciente"
          >
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span>Resumo clínico</span>
          </Button>
          <Badge variant="outline" className={statusColors[status] || ""}>
            {status}
          </Badge>
        </div>
      </div>

      <PatientClinicalSummaryDialog
        open={summaryDialogOpen}
        onOpenChange={setSummaryDialogOpen}
        patient={patient}
      />

      {/* Action Bar */}
      <div className="flex gap-2 flex-wrap items-center">
        {(isNew || isEditing) && !locked && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              data-tutorial="session-finish-btn"
              size="sm"
              onClick={() => void onSave("concluído")}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              <span>Concluir Atendimento</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void onSave("rascunho")}
              disabled={saving}
              className="gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>Salvar como Rascunho</span>
            </Button>
          </div>
        )}
        {!isNew && canEditSavedDraft && !isEditing && (
          <Button size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            <span>Editar</span>
          </Button>
        )}
        {!isNew && canDeleteSession && !isEditing && (
          <Button size="sm" variant="outline" onClick={() => void onDelete()}>
            <Trash2 className="h-4 w-4 mr-2" />
            <span>Excluir</span>
          </Button>
        )}
        {!isNew && !isEditing && (
          <Button size="sm" variant="outline" onClick={onOpenShareAccess} disabled={!canManageSessionSharing}>
            <Share2 className="h-4 w-4 mr-2" />
            <span>Compartilhar com colaboradores</span>
          </Button>
        )}
        {!isNew && !isEditing && (
          <Button
            size="sm"
            variant="outline"
            onClick={onStartFromThis}
            disabled={startingFromThis || !canStartNewSessionFromThis}
            title={!canStartNewSessionFromThis ? "Compartilhado com permissão apenas de visualização" : undefined}
            className="gap-1.5"
          >
            {startingFromThis ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Sparkles className="h-4 w-4 mr-1 text-primary" />}
            <span>Evoluir Atendimento</span>
          </Button>
        )}
        {(isNew || isEditing) && (
          <Select value={status} onValueChange={onStatusChange} disabled={locked}>
            <SelectTrigger className="w-[140px] h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="rascunho">Rascunho</SelectItem>
              <SelectItem value="concluído">Concluído</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        )}
        {!isNew && !isEditing && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline">
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => void onShareDocument("anamnesis")}>Anamnese</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void onShareDocument("treatment")}>Tratamento</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void onShareDocument("combined")}>Anamnese + Tratamento</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {canPrintSessionDoc && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => onPrintDocument("combined")}>Anamnese + Tratamento</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        )}
      </div>

      {locked && (
        <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
          Este atendimento está com status final e não pode mais ser editado. Use "Iniciar novo atendimento a partir deste"
          para abrir um novo rascunho com todos os campos já preenchidos.
        </div>
      )}
    </div>
  );
};
