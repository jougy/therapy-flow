import React, { useRef } from "react";
import {
  FileText,
  Upload,
  Eye,
  RotateCcw,
  CheckCircle2,
  Loader2,
  UserCheck,
  Baby,
  Printer,
  FileEdit,
  Plus,
  Tag,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { extractVariablesFromMarkdown } from "@/lib/termVariables";
import defaultAdultTermsMarkdown from "@/assets/adult-terms-of-consent.md?raw";
import defaultMinorTermsMarkdown from "@/assets/minor-terms-of-responsibility.md?raw";
import defaultPrintTermsMarkdown from "@/assets/print-terms-of-responsibility.md?raw";
import { CustomTemplatesGrid } from "./CustomTemplatesGrid";
import type {
  ClinicTermsData,
  ClinicCustomDocumentTemplate,
  StandardEditableTermKey,
  PreviewDocState,
} from "./types";
import type { TermEditorState } from "./TermEditorModal";

interface ClinicEditableTermsSectionProps {
  clinicTerms: ClinicTermsData;
  customTemplates: ClinicCustomDocumentTemplate[];
  canManageTerms: boolean;
  saving: boolean;
  onPreview: (preview: PreviewDocState) => void;
  onOpenEditor: (state: TermEditorState) => void;
  onFileUpload: (
    target: { type: "standard"; key: StandardEditableTermKey } | { type: "custom"; id: string },
    file: File
  ) => Promise<void>;
  onRestoreStandard: (key: StandardEditableTermKey) => Promise<void>;
  onDeleteCustomTemplate: (id: string) => Promise<void>;
  onOpenVariablesCatalog: () => void;
}

export const ClinicEditableTermsSection: React.FC<ClinicEditableTermsSectionProps> = ({
  clinicTerms,
  customTemplates,
  canManageTerms,
  saving,
  onPreview,
  onOpenEditor,
  onFileUpload,
  onRestoreStandard,
  onDeleteCustomTemplate,
  onOpenVariablesCatalog,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<
    { type: "standard"; key: StandardEditableTermKey } | { type: "custom"; id: string } | null
  >(null);

  const triggerFileUpload = (
    target: { type: "standard"; key: StandardEditableTermKey } | { type: "custom"; id: string }
  ) => {
    uploadTargetRef.current = target;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = uploadTargetRef.current;
    if (file && target) {
      void onFileUpload(target, file);
    }
  };

  const standardDocs: Array<{
    key: StandardEditableTermKey;
    title: string;
    description: string;
    icon: typeof UserCheck;
    defaultContent: string;
    customItem?: ClinicTermsData[StandardEditableTermKey];
  }> = [
    {
      key: "adult_terms",
      title: "Termo de Consentimento (Adulto)",
      description:
        "Aplicado a pacientes adultos. Inclui consentimento LGPD (Arts. 7º e 11), retenção legal de 20 anos (CFM 1.821/2007) e normas da clínica.",
      icon: UserCheck,
      defaultContent: defaultAdultTermsMarkdown,
      customItem: clinicTerms.adult_terms,
    },
    {
      key: "minor_terms",
      title: "Permissão dos Pais (Menor de Idade)",
      description:
        "Aplicado a crianças e adolescentes. Conformidade expressa com Art. 14 da LGPD para coleta de consentimento pelos responsáveis legais.",
      icon: Baby,
      defaultContent: defaultMinorTermsMarkdown,
      customItem: clinicTerms.minor_terms,
    },
    {
      key: "print_terms",
      title: "Termo de Responsabilidade para Impressão",
      description:
        "Exibido antes da impressão ou exportação física de prontuários médicos e dados sensíveis de pacientes (Lei 13.709/2018).",
      icon: Printer,
      defaultContent: defaultPrintTermsMarkdown,
      customItem: clinicTerms.print_terms,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.txt,.doc,.docx,.pdf"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Sub-cabeçalho da Seção de Modelos da Clínica */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> Modelos Editáveis da Clínica
          </h3>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={onOpenVariablesCatalog}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Catálogo de Variáveis
          </Button>

          {canManageTerms && (
            <Button
              type="button"
              size="sm"
              className="text-xs h-8 gap-1.5 shadow-sm"
              onClick={() =>
                onOpenEditor({
                  isCustomTemplate: true,
                  title: "",
                  description: "",
                  content: "# Novo Modelo de Documento\n\nEu, <nome_paciente>, portador do CPF <cpf_paciente>...",
                })
              }
              disabled={saving}
            >
              <Plus className="w-3.5 h-3.5" />
              Novo Modelo de Termo
            </Button>
          )}
        </div>
      </div>

      {/* Mensagem Informativa Dispensável */}
      <DismissibleInfoTip id="clinic-editable-terms-guide-tip" variant="muted">
        Personalize a redação dos termos clínicos, faça upload de arquivos (<strong>.pdf</strong>, <strong>.docx</strong> ou <strong>.md</strong>) e crie modelos adicionais com preenchimento automatizado de variáveis.
      </DismissibleInfoTip>

      {/* Grid com os 3 Termos Padrão Editáveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {standardDocs.map((doc) => {
          const Icon = doc.icon;
          const currentContent = doc.customItem?.content || doc.defaultContent;
          const detectedVariables =
            doc.customItem?.detectedVariables || extractVariablesFromMarkdown(currentContent);
          const isCustomized = Boolean(doc.customItem);

          return (
            <Card key={doc.key} className="border shadow-sm flex flex-col justify-between">
              <CardHeader className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Icon className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {doc.title}
                    </CardTitle>
                  </div>
                  {isCustomized && (
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3" /> Personalizado
                    </Badge>
                  )}
                </div>
                <CardDescription className="text-xs line-clamp-3 leading-relaxed">
                  {doc.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 pt-0 space-y-3">
                {isCustomized && doc.customItem && (
                  <div className="p-2.5 bg-muted/40 rounded-xl border text-[11px] space-y-1">
                    <p className="font-semibold text-foreground truncate">{doc.customItem.filename}</p>
                    <p className="text-muted-foreground text-[10px]">
                      Atualizado em: {new Date(doc.customItem.updatedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                )}

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
                          title: doc.title,
                          content: currentContent,
                          badge: isCustomized ? "Personalizado pela Clínica" : "Padrão Pluri-Health",
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
                            isCustomTemplate: false,
                            termKey: doc.key,
                            title: doc.title,
                            content: currentContent,
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
                        onClick={() => triggerFileUpload({ type: "standard", key: doc.key })}
                        disabled={saving}
                      >
                        {saving ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        Upload (.pdf / .docx)
                      </Button>

                      {isCustomized && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 px-2 text-muted-foreground hover:text-foreground"
                          title="Restaurar redação padrão"
                          onClick={() => void onRestoreStandard(doc.key)}
                          disabled={saving}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modelos Adicionais da Clínica (Custom Templates) */}
      <CustomTemplatesGrid
        customTemplates={customTemplates}
        canManageTerms={canManageTerms}
        saving={saving}
        onPreview={onPreview}
        onOpenEditor={onOpenEditor}
        onTriggerUpload={(id) => triggerFileUpload({ type: "custom", id })}
        onDeleteCustomTemplate={onDeleteCustomTemplate}
      />
    </div>
  );
};
