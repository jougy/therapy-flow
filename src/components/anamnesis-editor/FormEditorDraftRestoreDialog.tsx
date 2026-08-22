import React from "react";
import { Loader2, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormEditorGuideModal } from "@/components/anamnesis/FormEditorGuideModal";
import { isContainerField } from "@/lib/anamnesis-forms";
import type { useFormEditorState } from "./useFormEditorState";

export interface FormEditorDraftRestoreDialogProps {
  state: ReturnType<typeof useFormEditorState>;
}

export const FormEditorDraftRestoreDialog: React.FC<FormEditorDraftRestoreDialogProps> = ({ state }) => {
  const navigate = useNavigate();

  return (
    <>
      {/* Diálogo / Banner de Recuperação de Rascunho */}
      {state.recoverableDraft && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200 shadow-xs flex-wrap">
          <div className="flex items-center gap-2.5 min-w-0">
            <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">Rascunho não salvo encontrado neste navegador</p>
              <p className="text-[11px] opacity-80 mt-0.5 truncate">
                Salvo localmente em{" "}
                {new Date(state.recoverableDraft.savedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                . Deseja restaurar suas alterações locais?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-amber-500/40 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20"
              onClick={state.handleDiscardDraft}
            >
              Descartar
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
              onClick={state.handleRestoreDraft}
            >
              Restaurar rascunho
            </Button>
          </div>
        </div>
      )}

      {/* Modal de confirmação ao excluir seção que contém campos */}
      <Dialog open={state.deleteSectionDialogOpen} onOpenChange={state.setDeleteSectionDialogOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Excluir seção &quot;{state.sectionToDelete?.label}&quot;</DialogTitle>
            <DialogDescription className="pt-1 text-xs">
              Esta seção possui campos em seu interior. O que você deseja fazer com os campos antes de excluir a seção?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <Label className="text-xs font-semibold">Opção A: Mover campos e excluir apenas a seção</Label>
              <p className="text-xs text-muted-foreground">
                Selecione o destino para onde os campos internos serão transferidos:
              </p>
              <div className="pt-1">
                <Select
                  value={state.deleteMoveTargetSectionId}
                  onValueChange={state.setDeleteMoveTargetSectionId}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Selecione a seção destino" />
                  </SelectTrigger>
                  <SelectContent className="text-xs">
                    <SelectItem value="none">Raiz (Sem seção pai)</SelectItem>
                    {state.templateFields
                      .filter((f) => isContainerField(f) && f.id !== state.sectionToDelete?.id)
                      .map((container) => (
                        <SelectItem key={container.id} value={container.id}>
                          Mover para: {container.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                className="mt-2 w-full text-xs"
                onClick={() => {
                  if (state.sectionToDelete) {
                    state.executeMoveFieldsAndDeleteSection(
                      state.sectionToDelete.id,
                      state.deleteMoveTargetSectionId === "none" ? null : state.deleteMoveTargetSectionId
                    );
                  }
                }}
              >
                Mover campos e excluir apenas a seção
              </Button>
            </div>

            <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <Label className="text-xs font-semibold text-destructive">Opção B: Excluir tudo</Label>
              <p className="text-xs text-muted-foreground">
                Exclui esta seção e todos os campos contidos nela permanentemente.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="mt-1 w-full text-xs"
                onClick={() => {
                  if (state.sectionToDelete) {
                    state.executeDeleteAllSectionAndFields(state.sectionToDelete.id);
                  }
                }}
              >
                Excluir seção e todos os campos
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" onClick={() => state.setDeleteSectionDialogOpen(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação de Saída com Alterações não Salvas */}
      <Dialog open={state.unsavedChangesDialogOpen} onOpenChange={state.setUnsavedChangesDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
              <RotateCcw className="h-5 w-5" />
              Alterações não salvas
            </DialogTitle>
            <DialogDescription>
              Você possui alterações pendentes neste formulário. Se sair agora sem salvar no servidor, as modificações
              recentes permanecerão apenas como rascunho de contingência local neste navegador.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => state.setUnsavedChangesDialogOpen(false)}>
              Continuar editando
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                state.setUnsavedChangesDialogOpen(false);
                navigate(state.clinicFormsManagerPath);
              }}
            >
              Sair sem salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de Exclusão de Ficha / Formulário */}
      <Dialog open={state.deleteTemplateDialogOpen} onOpenChange={state.setDeleteTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Excluir formulário da clínica
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir permanentemente o modelo{" "}
              <strong>&quot;{state.templateName || state.template?.name}&quot;</strong>?
              Esta ação removerá este modelo da lista de formulários da clínica. Atendimentos e evoluções já preenchidos
              anteriormente no histórico dos pacientes continuarão preservados intactos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => state.setDeleteTemplateDialogOpen(false)}
              disabled={state.deletingTemplate}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void state.handleDeleteTemplate()}
              disabled={state.deletingTemplate}
              className="gap-2"
            >
              {state.deletingTemplate ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Sim, excluir formulário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Guia Passo a Passo para Usuários */}
      <FormEditorGuideModal open={state.guideModalOpen} onOpenChange={state.setGuideModalOpen} />
    </>
  );
};
