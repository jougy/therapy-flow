import React, { useState, useEffect, useRef } from "react";
import {
  FileEdit,
  Save,
  Loader2,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { extractVariablesFromMarkdown } from "@/lib/termVariables";
import { TermDocumentDropzone, type ScannedDocumentPayload } from "./TermDocumentDropzone";
import { TermEditorVariablesSidebar } from "./TermEditorVariablesSidebar";

export interface TermEditorState {
  isCustomTemplate?: boolean;
  templateId?: string;
  termKey?: "adult_terms" | "minor_terms" | "print_terms";
  title: string;
  description?: string;
  content: string;
}

interface TermEditorModalProps {
  editorState: TermEditorState | null;
  saving: boolean;
  onClose: () => void;
  onSave: (data: {
    isCustomTemplate?: boolean;
    templateId?: string;
    termKey?: "adult_terms" | "minor_terms" | "print_terms";
    title: string;
    description?: string;
    content: string;
  }) => Promise<void>;
}

export const TermEditorModal: React.FC<TermEditorModalProps> = ({
  editorState,
  saving,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editorState) {
      setTitle(editorState.title || "");
      setDescription(editorState.description || "");
      setContent(editorState.content || "");
    }
  }, [editorState]);

  if (!editorState) return null;

  const detectedVariables = extractVariablesFromMarkdown(content);

  const insertVariableAtCursor = (variableKey: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setContent((prev) => `${prev} ${variableKey}`);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const current = content;
    const updated = current.substring(0, start) + variableKey + current.substring(end);
    setContent(updated);

    setTimeout(() => {
      textarea.focus();
      const nextPos = start + variableKey.length;
      textarea.setSelectionRange(nextPos, nextPos);
    }, 50);
  };

  const handleDropzoneScanned = (payload: ScannedDocumentPayload) => {
    setContent(payload.markdownText);
    if (!title.trim() || title === "Novo Modelo de Documento") {
      setTitle(payload.suggestedTitle);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    await onSave({
      isCustomTemplate: editorState.isCustomTemplate,
      templateId: editorState.templateId,
      termKey: editorState.termKey,
      title: title.trim() || editorState.title,
      description: description.trim(),
      content: content.trim(),
    });
  };

  return (
    <>
      <Dialog open={Boolean(editorState)} onOpenChange={(open) => !open && !saving && onClose()}>
        <DialogContent
          className="w-[95vw] sm:w-full max-w-4xl max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-xl"
          onPointerDownOutside={(e) => {
            if ((e.target as HTMLElement)?.closest('[data-variables-sidebar="true"]')) {
              e.preventDefault();
            }
          }}
          onInteractOutside={(e) => {
            if ((e.target as HTMLElement)?.closest('[data-variables-sidebar="true"]')) {
              e.preventDefault();
            }
          }}
        >
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <DialogHeader className="p-5 pb-3 border-b space-y-2">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-primary shrink-0" />
                <DialogTitle className="text-base font-bold">
                  {editorState.isCustomTemplate
                    ? editorState.templateId
                      ? "Editar Modelo Personalizado"
                      : "Criar Novo Modelo de Termo"
                    : `Editar ${editorState.title}`}
                </DialogTitle>
              </div>
              <DismissibleInfoTip id="term-editor-markdown-tip">
                Edite o documento em formato Markdown. Utilize variáveis dinâmicas para preenchimento automatizado no momento do atendimento.
              </DismissibleInfoTip>
            </DialogHeader>

            <div className="flex-1 min-h-0 p-5 overflow-y-auto overscroll-contain space-y-4">
              {editorState.isCustomTemplate && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="template-title" className="text-xs font-semibold">
                      Título do Modelo *
                    </Label>
                    <Input
                      id="template-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Ex: Termo de Teleatendimento e Consentimento Digital"
                      className="text-xs h-9"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="template-desc" className="text-xs font-semibold">
                      Descrição / Finalidade
                    </Label>
                    <Input
                      id="template-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Ex: Aplicável a consultas remotas e orientações por vídeo."
                      className="text-xs h-9"
                    />
                  </div>
                </div>
              )}

              {/* Área de Drag & Drop para conversão e OCR de documentos */}
              <TermDocumentDropzone
                variant="compact"
                disabled={saving}
                onScanned={handleDropzoneScanned}
                label="Preencher redação a partir de arquivo (.pdf, .docx, .doc, .md)"
                description="Clique aqui ou arraste um arquivo para fazer upload"
              />

              {/* Campo do Conteúdo Markdown */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="template-content" className="text-xs font-semibold">
                    Conteúdo do Documento (Markdown) *
                  </Label>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    {content.length} caracteres
                  </span>
                </div>
                <Textarea
                  ref={textareaRef}
                  id="template-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="# Título do Documento&#10;&#10;Eu, <nome_paciente>, confirmo..."
                  className="font-mono text-xs leading-relaxed min-h-[260px] resize-y"
                  required
                />
              </div>

              {/* Variáveis Detectadas em Tempo Real */}
              <div className="p-3 bg-muted/20 rounded-xl border space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Tag className="w-3.5 h-3.5 text-primary" />
                  <span>
                    Variáveis detectadas neste texto ({detectedVariables.length}):
                  </span>
                </div>
                {detectedVariables.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {detectedVariables.map((v) => (
                      <code
                        key={v}
                        className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20"
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">
                    Nenhuma variável encontrada no momento. Use os botões acima para adicionar tags dinâmicas.
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="p-3 border-t bg-muted/10 flex flex-row items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="text-xs h-8 gap-1.5"
                disabled={saving || !content.trim()}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Salvar Modelo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <TermEditorVariablesSidebar onInsertVariable={insertVariableAtCursor} />
    </>
  );
};
