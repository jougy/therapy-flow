import React from "react";
import { Sparkles, Tag, Eye, FileEdit, Upload, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractVariablesFromMarkdown } from "@/lib/termVariables";
import { TermDocumentDropzone, type ScannedDocumentPayload } from "./TermDocumentDropzone";
import type { ClinicCustomDocumentTemplate, PreviewDocState } from "./types";
import type { TermEditorState } from "./TermEditorModal";

interface CustomTemplatesGridProps {
  customTemplates: ClinicCustomDocumentTemplate[];
  canManageTerms: boolean;
  saving: boolean;
  onPreview: (preview: PreviewDocState) => void;
  onOpenEditor: (state: TermEditorState) => void;
  onTriggerUpload: (id: string) => void;
  onDeleteCustomTemplate: (id: string) => Promise<void>;
}

export const CustomTemplatesGrid: React.FC<CustomTemplatesGridProps> = ({
  customTemplates,
  canManageTerms,
  saving,
  onPreview,
  onOpenEditor,
  onTriggerUpload,
  onDeleteCustomTemplate,
}) => {
  const handleDropzoneScanned = (payload: ScannedDocumentPayload) => {
    onOpenEditor({
      isCustomTemplate: true,
      title: payload.suggestedTitle,
      description: "",
      content: payload.markdownText,
    });
  };

  return (
    <div className="space-y-4">
      {customTemplates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {customTemplates.map((template) => {
            const detectedVariables =
              template.detectedVariables || extractVariablesFromMarkdown(template.content);

            return (
              <Card key={template.id} className="border shadow-sm flex flex-col justify-between">
                <CardHeader className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm font-semibold truncate">
                      {template.title}
                    </CardTitle>
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">
                      Personalizado
                    </Badge>
                  </div>
                  {template.description && (
                    <CardDescription className="text-xs line-clamp-2 leading-relaxed">
                      {template.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="p-4 pt-0 space-y-3">
                  {detectedVariables.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3 text-primary" />
                          Variáveis ({detectedVariables.length}):
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap max-h-12 overflow-y-auto">
                        {detectedVariables.slice(0, 4).map((v) => (
                          <code
                            key={v}
                            className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.2 rounded border border-primary/20"
                          >
                            {v}
                          </code>
                        ))}
                        {detectedVariables.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{detectedVariables.length - 4} mais
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t flex flex-col gap-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 gap-1 w-full"
                        onClick={() =>
                          onPreview({
                            title: template.title,
                            content: template.content,
                            badge: "Modelo Personalizado",
                            detectedVariables,
                          })
                        }
                      >
                        <Eye className="w-3.5 h-3.5" /> Visualizar
                      </Button>

                      {canManageTerms ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 gap-1 w-full"
                          onClick={() =>
                            onOpenEditor({
                              isCustomTemplate: true,
                              templateId: template.id,
                              title: template.title,
                              description: template.description,
                              content: template.content,
                            })
                          }
                          disabled={saving}
                        >
                          <FileEdit className="w-3.5 h-3.5" /> Editar
                        </Button>
                      ) : null}
                    </div>

                    {canManageTerms && (
                      <div className="flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          className="text-xs h-8 gap-1 flex-1"
                          onClick={() => onTriggerUpload(template.id)}
                          disabled={saving}
                        >
                          <Upload className="w-3.5 h-3.5" /> Upload (.pdf / .docx)
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          title="Excluir modelo"
                          onClick={() => void onDeleteCustomTemplate(template.id)}
                          disabled={saving}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Modelos Adicionais & Contratos Personalizados
          </h4>
          <span className="text-xs text-muted-foreground">
            {customTemplates.length} modelo(s) cadastrado(s)
          </span>
        </div>

        {/* Zona de Drag & Drop para Novo Modelo (com OCR local) */}
        {canManageTerms && (
          <TermDocumentDropzone
            variant="full"
            disabled={saving}
            onScanned={handleDropzoneScanned}
          />
        )}
      </div>
    </div>
  );
};
