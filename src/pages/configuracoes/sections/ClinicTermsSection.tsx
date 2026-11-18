import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Loader2,
} from "lucide-react";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { scanAndCompressTermDocument } from "@/lib/termDocumentScanner";
import { extractVariablesFromMarkdown } from "@/lib/termVariables";
import { ClinicEditableTermsSection } from "./terms/ClinicEditableTermsSection";
import { PluriImmutableTermsSection } from "./terms/PluriImmutableTermsSection";
import { TermPreviewModal } from "./terms/TermPreviewModal";
import { TermEditorModal, type TermEditorState } from "./terms/TermEditorModal";
import { VariablesHelpDialog } from "./terms/VariablesHelpDialog";
import type {
  ClinicTermsData,
  ClinicCustomDocumentTemplate,
  StandardEditableTermKey,
  PreviewDocState,
} from "./terms/types";

export const ClinicTermsSection: React.FC = () => {
  const { clinicId, can } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinicTerms, setClinicTerms] = useState<ClinicTermsData>({});
  const [customTemplates, setCustomTemplates] = useState<ClinicCustomDocumentTemplate[]>([]);
  const [previewDoc, setPreviewDoc] = useState<PreviewDocState | null>(null);
  const [editorState, setEditorState] = useState<TermEditorState | null>(null);
  const [showVariablesCatalog, setShowVariablesCatalog] = useState(false);

  // Permissão governada exclusivamente pela capability soberana
  const canManageTerms = Boolean(typeof can === "function" && can("clinic_terms.manage"));

  // Carregamento resiliente dos termos e modelos da clínica
  const loadTermsAndTemplates = useCallback(async (isMounted: () => boolean) => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1. Carrega de clinics.custom_fields (fonte primária e garantida)
      const { data: clinicData, error: clinicError } = await supabase
        .from("clinics")
        .select("custom_fields")
        .eq("id", clinicId)
        .single();

      if (clinicError) {
        console.warn("Aviso ao buscar custom_fields da clínica:", clinicError);
      }

      const custom = (clinicData?.custom_fields || {}) as Record<string, unknown>;
      const termsFromCustom = (custom.clinic_terms || {}) as ClinicTermsData;
      let templatesFromCustom = (custom.clinic_document_templates || []) as ClinicCustomDocumentTemplate[];

      // 2. Tenta sincronizar com tabela clinic_document_templates se existente no schema
      try {
        const { data: dbTemplates, error: dbError } = await (supabase.from(
          "clinic_document_templates" as unknown as "clinics"
        ) as unknown as {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (col: string, val: boolean) => {
                is: (col: string, val: null) => Promise<{ data: unknown[] | null; error: unknown }>;
              };
            };
          };
        })
          .select("id, title, description, content_md, variables, updated_at")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .is("deleted_at", null);

        if (!dbError && Array.isArray(dbTemplates) && dbTemplates.length > 0) {
          const mapped: ClinicCustomDocumentTemplate[] = dbTemplates.map((row: unknown) => {
            const item = row as Record<string, unknown>;
            const rawContent = String(item.content_md ?? item.content_markdown ?? item.content ?? "");
            return {
              id: String(item.id),
              title: String(item.title || "Modelo sem título"),
              description: item.description ? String(item.description) : undefined,
              content: rawContent,
              filename: item.original_filename ? String(item.original_filename) : undefined,
              updatedAt: String(item.updated_at || new Date().toISOString()),
              detectedVariables: Array.isArray(item.variables)
                ? (item.variables as string[])
                : Array.isArray(item.detected_variables)
                  ? (item.detected_variables as string[])
                  : extractVariablesFromMarkdown(rawContent),
            };
          });
          templatesFromCustom = mapped;
        }
      } catch {
        // Tabela opcional; mantém templates do custom_fields
      }

      if (isMounted()) {
        setClinicTerms(termsFromCustom);
        setCustomTemplates(templatesFromCustom);
      }
    } catch (err) {
      console.error("Falha ao carregar termos da clínica:", err);
    } finally {
      if (isMounted()) setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    let mounted = true;
    void loadTermsAndTemplates(() => mounted);
    return () => {
      mounted = false;
    };
  }, [loadTermsAndTemplates]);

  // Persistência unificada
  const persistChanges = async (
    newTerms: ClinicTermsData,
    newTemplates: ClinicCustomDocumentTemplate[]
  ) => {
    if (!clinicId) return;
    setSaving(true);
    try {
      const { data: currentClinic } = await supabase
        .from("clinics")
        .select("custom_fields")
        .eq("id", clinicId)
        .single();

      const existingCustom = (currentClinic?.custom_fields || {}) as Record<string, unknown>;
      const updatedCustom = {
        ...existingCustom,
        clinic_terms: newTerms,
        clinic_document_templates: newTemplates,
      };

      const { error } = await supabase
        .from("clinics")
        .update({
          custom_fields: updatedCustom,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clinicId);

      if (error) throw error;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar alterações no banco";
      toast({
        title: "Erro de salvamento",
        description: message,
        variant: "destructive",
      });
      throw err;
    } finally {
      setSaving(false);
    }
  };

  // Upload e escaneamento (.pdf, .docx, .md)
  const handleFileUpload = async (
    target: { type: "standard"; key: StandardEditableTermKey } | { type: "custom"; id: string },
    file: File
  ) => {
    if (!canManageTerms) {
      toast({
        title: "Permissão necessária",
        description: "Você não possui a capability 'clinic_terms.manage' para alterar termos.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const scanned = await scanAndCompressTermDocument(file);

      if (scanned.hasRemovedImages) {
        toast({
          title: "Imagens descartadas automaticamente",
          description: "Para conformidade jurídica, integridade de relatórios e padronização A4, imagens foram removidas da redação.",
          variant: "default",
        });
      }

      if (target.type === "standard") {
        const updatedTerms: ClinicTermsData = {
          ...clinicTerms,
          [target.key]: {
            content: scanned.markdownText,
            filename: file.name,
            updatedAt: new Date().toISOString(),
            originalSize: scanned.originalSize,
            compressedSize: scanned.compressedSize,
            detectedVariables: scanned.detectedVariables,
          },
        };

        // Salva na tabela public.clinic_terms caso seja adult ou minor
        if (target.key === "adult_terms" || target.key === "minor_terms") {
          try {
            await supabase.from("clinic_terms").upsert(
              {
                clinic_id: clinicId,
                term_type: target.key === "adult_terms" ? "adult_consent" : "minor_consent",
                original_filename: file.name,
                content_markdown: scanned.markdownText,
                b2_object_key: `clinics/${clinicId}/terms/${target.key}_${Date.now()}.md.gz`,
                byte_size: scanned.originalSize,
                compressed_byte_size: scanned.compressedSize,
                storage_encoding: "gzip",
                version: 1,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "clinic_id,term_type" }
            );
          } catch (dbErr) {
            console.warn("Aviso ao salvar em clinic_terms:", dbErr);
          }
        }

        await persistChanges(updatedTerms, customTemplates);
        setClinicTerms(updatedTerms);
      } else {
        const updatedTemplates = customTemplates.map((t) =>
          t.id === target.id
            ? {
                ...t,
                content: scanned.markdownText,
                filename: file.name,
                updatedAt: new Date().toISOString(),
                detectedVariables: scanned.detectedVariables,
              }
            : t
        );

        await persistChanges(clinicTerms, updatedTemplates);
        setCustomTemplates(updatedTemplates);
      }

      toast({
        title: "Arquivo processado com sucesso",
        description: `O documento ${file.name} foi sanitizado, convertido e vinculado à clínica.`,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha ao escanear documento";
      toast({
        title: "Erro no escaneamento",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Salvar a partir do editor modal (texto Markdown ou novo modelo)
  const handleSaveEditor = async (data: {
    isCustomTemplate?: boolean;
    templateId?: string;
    termKey?: StandardEditableTermKey;
    title: string;
    description?: string;
    content: string;
  }) => {
    const detectedVariables = extractVariablesFromMarkdown(data.content);

    if (data.isCustomTemplate) {
      let updatedTemplates: ClinicCustomDocumentTemplate[];
      if (data.templateId) {
        // Atualiza modelo existente
        updatedTemplates = customTemplates.map((t) =>
          t.id === data.templateId
            ? {
                ...t,
                title: data.title,
                description: data.description,
                content: data.content,
                updatedAt: new Date().toISOString(),
                detectedVariables,
              }
            : t
        );
      } else {
        // Cria novo modelo
        const newTemplate: ClinicCustomDocumentTemplate = {
          id: crypto.randomUUID(),
          title: data.title,
          description: data.description,
          content: data.content,
          filename: `${data.title.toLowerCase().replace(/\s+/g, "-")}.md`,
          updatedAt: new Date().toISOString(),
          detectedVariables,
        };
        updatedTemplates = [newTemplate, ...customTemplates];
      }

      await persistChanges(clinicTerms, updatedTemplates);
      setCustomTemplates(updatedTemplates);
    } else if (data.termKey) {
      const key = data.termKey;
      const updatedTerms: ClinicTermsData = {
        ...clinicTerms,
        [key]: {
          content: data.content,
          filename: clinicTerms[key]?.filename || `${key}.md`,
          updatedAt: new Date().toISOString(),
          detectedVariables,
        },
      };

      if (key === "adult_terms" || key === "minor_terms") {
        try {
          await supabase.from("clinic_terms").upsert(
            {
              clinic_id: clinicId,
              term_type: key === "adult_terms" ? "adult_consent" : "minor_consent",
              original_filename: clinicTerms[key]?.filename || `${key}.md`,
              content_markdown: data.content,
              b2_object_key: `clinics/${clinicId}/terms/${key}_${Date.now()}.md.gz`,
              byte_size: data.content.length,
              compressed_byte_size: data.content.length,
              storage_encoding: "plain",
              version: 1,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "clinic_id,term_type" }
          );
        } catch (dbErr) {
          console.warn("Aviso ao salvar em clinic_terms:", dbErr);
        }
      }

      await persistChanges(updatedTerms, customTemplates);
      setClinicTerms(updatedTerms);
    }

    setEditorState(null);
    toast({
      title: "Modelo salvo com sucesso",
      description: "As alterações foram gravadas e já estão ativas para novos atendimentos.",
    });
  };

  // Restaurar padrão Pluri
  const handleRestoreStandard = async (key: StandardEditableTermKey) => {
    if (!canManageTerms || !clinicId) return;

    const updated = { ...clinicTerms };
    delete updated[key];

    if (key === "adult_terms" || key === "minor_terms") {
      try {
        await supabase
          .from("clinic_terms")
          .delete()
          .eq("clinic_id", clinicId)
          .eq("term_type", key === "adult_terms" ? "adult_consent" : "minor_consent");
      } catch (dbErr) {
        console.warn("Erro ao remover da tabela clinic_terms:", dbErr);
      }
    }

    await persistChanges(updated, customTemplates);
    setClinicTerms(updated);

    toast({
      title: "Padrão restaurado",
      description: "A clínica voltou a utilizar a redação oficial homologada pelo Therapy-Flow.",
    });
  };

  // Excluir modelo customizado
  const handleDeleteCustomTemplate = async (id: string) => {
    if (!canManageTerms || !clinicId) return;

    const updatedTemplates = customTemplates.filter((t) => t.id !== id);
    await persistChanges(clinicTerms, updatedTemplates);
    setCustomTemplates(updatedTemplates);

    toast({
      title: "Modelo removido",
      description: "O modelo personalizado foi excluído com sucesso.",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden min-w-0">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" /> Termos de Consentimento & Documentos Clínicos
          </h2>
        </div>
      </div>

      {/* Mensagem Informativa Dispensável */}
      <DismissibleInfoTip id="clinic-terms-overview-tip" variant="muted">
        Configure e personalize os termos de consentimento livre e esclarecido (TCLE), permissões de menores e termos de impressão utilizados no dia a dia da clínica, com suporte a variáveis dinâmicas.
      </DismissibleInfoTip>

      {/* Parte Superior: Modelos Editáveis da Clínica */}
      <ClinicEditableTermsSection
        clinicTerms={clinicTerms}
        customTemplates={customTemplates}
        canManageTerms={canManageTerms}
        saving={saving}
        onPreview={setPreviewDoc}
        onOpenEditor={setEditorState}
        onFileUpload={handleFileUpload}
        onRestoreStandard={handleRestoreStandard}
        onDeleteCustomTemplate={handleDeleteCustomTemplate}
        onOpenVariablesCatalog={() => setShowVariablesCatalog(true)}
      />

      {/* Parte Inferior: Termos Padrões da Pluri-Health (Imutáveis) */}
      <PluriImmutableTermsSection onPreview={setPreviewDoc} />

      {/* Modais de Pré-Visualização, Edição e Catálogo */}
      <TermPreviewModal previewDoc={previewDoc} onClose={() => setPreviewDoc(null)} />

      <TermEditorModal
        editorState={editorState}
        saving={saving}
        onClose={() => setEditorState(null)}
        onSave={handleSaveEditor}
      />

      <VariablesHelpDialog
        open={showVariablesCatalog}
        onOpenChange={setShowVariablesCatalog}
      />
    </div>
  );
};
