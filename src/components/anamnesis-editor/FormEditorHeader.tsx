import React from "react";
import {
  ArrowLeft,
  CheckSquare,
  Edit3,
  Loader2,
  Play,
  Redo2,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import { useTutorial } from "@/contexts/TutorialContext";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import type { useFormEditorState } from "./useFormEditorState";

export interface FormEditorHeaderProps {
  state: ReturnType<typeof useFormEditorState>;
}

export const FormEditorHeader: React.FC<FormEditorHeaderProps> = ({ state }) => {
  const { showComponentHelp } = useTutorial();

  const updateTemplateName = (value: string) => {
    state.setTemplateName(sanitizeSingleLineInput(value, INPUT_LIMITS.formTemplateName));
  };

  const updateTemplateDescription = (value: string) => {
    state.setTemplateDescription(sanitizeMultilineInput(value, INPUT_LIMITS.formDescription));
  };

  return (
    <>
      <div
        ref={state.topContainerRef}
        className={`transition-all ${state.flowSidebarCollapsed ? "lg:pl-[80px]" : "lg:pl-[308px]"} lg:pr-[356px]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div ref={state.headerRef} className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={state.handleBack} aria-label="Voltar para gerenciar formulários">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  {state.isBase ? "Bloco padrão universal" : state.isNew ? "Nova ficha" : state.template?.name || "Editar ficha"}
                </h1>
                <ComponentHelpButton helpId="form-editor-tour" size="sm" />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {state.isBase
                  ? "Edite a primeira parte obrigatória da anamnese, aplicada automaticamente em todas as fichas da clínica."
                  : "Monte e personalize os campos no canvas interativo. Alterne entre os modos de edição e teste de preenchimento."}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!state.isBase && !state.isNew && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
                onClick={() => state.setDeleteTemplateDialogOpen(true)}
                title="Excluir este formulário da clínica"
              >
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">Excluir ficha</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs font-semibold gap-1.5 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 shadow-xs"
              onClick={() => showComponentHelp("form-editor-tour")}
              title="Ver tutorial interativo de como criar e personalizar fichas"
            >
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>Como Funciona</span>
            </Button>
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground hover:bg-background hover:shadow-xs disabled:opacity-30 disabled:pointer-events-none transition-all"
                onClick={state.handleUndo}
                disabled={!state.canUndo}
                title="Desfazer (Ctrl+Z / Cmd+Z)"
                aria-label="Desfazer ação"
              >
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-foreground hover:bg-background hover:shadow-xs disabled:opacity-30 disabled:pointer-events-none transition-all"
                onClick={state.handleRedo}
                disabled={!state.canRedo}
                title="Refazer (Ctrl+Y / Cmd+Shift+Z)"
                aria-label="Refazer ação"
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <Button variant="outline" onClick={() => state.templateImportInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Importar modelo
              </Button>
              <Button
                onClick={() => void state.handleSave()}
                disabled={state.saving || !state.templateName.trim() || (!state.isDirty && !state.isNew)}
              >
                {state.saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar ficha
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`space-y-4 transition-all ${state.flowSidebarCollapsed ? "lg:pl-[80px]" : "lg:pl-[308px]"} lg:pr-[356px]`}
      >
        <Card
          data-tutorial="form-editor-title-card"
          className="max-w-full overflow-hidden border-border/80"
          onClick={(e) => e.stopPropagation()}
        >
          <CardContent className="grid gap-4 p-5 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{state.isBase ? "Nome da estrutura" : "Nome da ficha"}</Label>
              <Input
                value={state.templateName}
                onChange={(event) => updateTemplateName(event.target.value)}
                placeholder="Ex: Ficha de Avaliação Ortopédica"
                disabled={state.isBase}
                maxLength={INPUT_LIMITS.formTemplateName}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Descrição da ficha</Label>
              <Input
                value={state.templateDescription}
                onChange={(event) => updateTemplateDescription(event.target.value)}
                placeholder="Ex: Triagem inicial e histórico clínico do paciente"
                disabled={state.isBase}
                maxLength={INPUT_LIMITS.formDescription}
              />
            </div>
          </CardContent>
        </Card>

        {/* Canvas Mode Control Bar */}
        <div
          data-tutorial="form-editor-history-bar"
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-xs flex-wrap"
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div
              data-tutorial="form-editor-mode-toggle"
              className="flex items-center gap-1.5 rounded-lg bg-muted p-1 text-xs font-semibold"
            >
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                  state.canvasMode === "edit"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => state.setCanvasMode("edit")}
              >
                <Edit3 className="h-3.5 w-3.5 text-primary" />
                <span>Modo Editor</span>
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                  state.canvasMode === "test"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => state.setCanvasMode("test")}
              >
                <Play className="h-3.5 w-3.5 text-emerald-500" />
                <span>Testar Preenchimento</span>
              </button>
            </div>

            {/* Undo / Redo History Buttons */}
            <div
              data-tutorial="form-editor-history-actions"
              className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border/50"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-foreground hover:bg-background hover:shadow-xs disabled:opacity-30 disabled:pointer-events-none transition-all"
                onClick={state.handleUndo}
                disabled={!state.canUndo}
                title="Desfazer (Ctrl+Z / Cmd+Z)"
                aria-label="Desfazer ação"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Desfazer</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-foreground hover:bg-background hover:shadow-xs disabled:opacity-30 disabled:pointer-events-none transition-all"
                onClick={state.handleRedo}
                disabled={!state.canRedo}
                title="Refazer (Ctrl+Y / Cmd+Shift+Z)"
                aria-label="Refazer ação"
              >
                <Redo2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Refazer</span>
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs gap-1.5 transition-colors",
                state.isAllSelected
                  ? "border-primary text-primary bg-primary/10 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={state.handleToggleSelectAll}
              title="Selecionar / Desmarcar todos os campos (Ctrl+A / Cmd+A)"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {state.isAllSelected ? "Desmarcar todos" : "Selecionar todos (Ctrl+A)"}
              </span>
            </Button>
            {state.hasTestAnswers && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                onClick={state.handleClearTestAnswers}
                title="Limpar todas as respostas de teste preenchidas no preview"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Limpar testes</span>
              </Button>
            )}
            {state.selectedField && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => state.setSelectedFieldId(null)}
              >
                Desmarcar campo
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
