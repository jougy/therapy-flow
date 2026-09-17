import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  Upload,
  FileText,
  CheckCircle2,
  Eye,
  ChevronDown,
  ChevronUp,
  Globe,
  Users,
  Shield,
  Printer,
  Baby,
  Trash2,
  FileCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import defaultMinorTermsMarkdown from "@/assets/minor-terms-of-responsibility.md?raw";
import defaultPrintTermsMarkdown from "@/assets/print-terms-of-responsibility.md?raw";

export interface TermsDocItem {
  content: string;
  filename: string;
  updatedAt: string;
}

export interface TermsConfigPayload {
  owner_br?: TermsDocItem;
  user_br?: TermsDocItem;
  owner_intl?: TermsDocItem;
  user_intl?: TermsDocItem;
  print_terms?: TermsDocItem;
  minor_terms?: TermsDocItem;
  minor_consent?: TermsDocItem;
  publishedVersion?: string;
  publishedAt?: string;
}

export type DocTypeKey = "owner_br" | "user_br" | "owner_intl" | "user_intl" | "print_terms" | "minor_terms";

interface TermsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Record<string, unknown>;
  onSave: (payload: Record<string, unknown>) => void;
}

export const DOC_TYPES: Array<{
  key: DocTypeKey;
  label: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultFallback?: { filename: string; content: string };
}> = [
  {
    key: "owner_br",
    label: "Termos Owner (Brasil)",
    badge: "PT-BR | Owner",
    description: "Direcionado especificamente para administradores/owners de clínicas no Brasil.",
    icon: Shield,
  },
  {
    key: "user_br",
    label: "Termos Usuários (Brasil)",
    badge: "PT-BR | Todos",
    description: "Aplicável a todos os usuários brasileiros (profissionais, assistentes, estagiários e owners).",
    icon: Users,
  },
  {
    key: "owner_intl",
    label: "Termos Owner (Internacional)",
    badge: "EN | Owner",
    description: "Direcionado para administradores/owners de clínicas internacionais (em inglês).",
    icon: Globe,
  },
  {
    key: "user_intl",
    label: "Termos Usuários (Internacional)",
    badge: "EN | Todos",
    description: "Aplicável a todos os usuários internacionais (em inglês, incluindo owners).",
    icon: Users,
  },
  {
    key: "print_terms",
    label: "Termo de Responsabilidade para Impressão",
    badge: "PT-BR | Impressão LGPD",
    description: "Exibido a qualquer usuário antes de realizar a impressão de relatórios e dados sensíveis.",
    icon: Printer,
    defaultFallback: {
      filename: "print-terms-of-responsibility.md (Padrão)",
      content: defaultPrintTermsMarkdown,
    },
  },
  {
    key: "minor_terms",
    label: "Termo de Consentimento para Menor de Idade (LGPD)",
    badge: "PT-BR | Menor de Idade LGPD",
    description: "Termo de consentimento específico e em destaque para coleta e tratamento de dados de crianças e adolescentes (Art. 14 da LGPD).",
    icon: Baby,
    defaultFallback: {
      filename: "minor-terms-of-responsibility.md (Padrão)",
      content: defaultMinorTermsMarkdown,
    },
  },
];

export function TermsConfigModal({ isOpen, onClose, initialData, onSave }: TermsConfigModalProps) {
  const [docs, setDocs] = useState<TermsConfigPayload>({});
  const [previewKey, setPreviewKey] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setDocs({
        owner_br: (initialData.owner_br as TermsDocItem) || undefined,
        user_br: (initialData.user_br as TermsDocItem) || undefined,
        owner_intl: (initialData.owner_intl as TermsDocItem) || undefined,
        user_intl: (initialData.user_intl as TermsDocItem) || undefined,
        print_terms: (initialData.print_terms as TermsDocItem) || undefined,
        minor_terms:
          (initialData.minor_terms as TermsDocItem) ||
          (initialData.minor_consent as TermsDocItem) ||
          undefined,
        minor_consent:
          (initialData.minor_consent as TermsDocItem) ||
          (initialData.minor_terms as TermsDocItem) ||
          undefined,
        publishedVersion: (initialData.publishedVersion as string) || undefined,
        publishedAt: (initialData.publishedAt as string) || undefined,
      });
    }
  }, [initialData, isOpen]);

  const handleFileUpload = (docKey: DocTypeKey, file: File) => {
    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      toast({
        title: "Formato inválido",
        description: "Por favor, selecione um arquivo no formato .md ou .txt.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        toast({
          title: "Arquivo vazio",
          description: "O arquivo selecionado não contém texto.",
          variant: "destructive",
        });
        return;
      }

      const item: TermsDocItem = {
        content,
        filename: file.name,
        updatedAt: new Date().toISOString(),
      };

      setDocs((prev) => ({
        ...prev,
        [docKey]: item,
        ...(docKey === "minor_terms" ? { minor_consent: item } : {}),
      }));

      const docDef = DOC_TYPES.find((d) => d.key === docKey);
      toast({
        title: "Documento carregado",
        description: `${file.name} foi associado ao documento ${docDef?.label}.`,
      });
    };

    reader.readAsText(file);
  };

  const handleRemoveDoc = (docKey: DocTypeKey) => {
    setDocs((prev) => {
      const next = { ...prev };
      delete next[docKey];
      if (docKey === "minor_terms") {
        delete next.minor_consent;
      }
      return next;
    });

    if (previewKey === docKey) {
      setPreviewKey(null);
    }

    const docDef = DOC_TYPES.find((d) => d.key === docKey);
    toast({
      title: "Documento customizado removido",
      description: docDef?.defaultFallback
        ? `O arquivo customizado foi removido. O sistema voltará a utilizar a versão padrão.`
        : `O arquivo customizado de ${docDef?.label} foi removido.`,
    });
  };

  const handleSave = () => {
    onSave(docs as unknown as Record<string, unknown>);
    toast({
      title: "Configurações salvas",
      description: "Os documentos dos Termos de Uso e Consentimento foram salvos com sucesso.",
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader className="space-y-1 pb-2 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Configuração dos Termos de Uso e Consentimento
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Faça o upload dos arquivos <strong>.md</strong> ou <strong>.txt</strong> para os perfis de termos e consentimento da plataforma.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {DOC_TYPES.map((docDef) => {
            const customDoc = docs[docDef.key];
            const defaultFallback = docDef.defaultFallback;
            const hasCustomDoc = !!customDoc;
            const isUsingFallback = !hasCustomDoc && !!defaultFallback;
            const activeDocContent = customDoc?.content || defaultFallback?.content;
            const Icon = docDef.icon;
            const isPreviewOpen = previewKey === docDef.key;

            return (
              <div key={docDef.key} className="flex flex-col border rounded-xl p-4 bg-card shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="w-5 h-5 text-primary shrink-0" />
                    <div>
                      <h4 className="font-semibold text-foreground text-sm">{docDef.label}</h4>
                      <span className="inline-block text-[11px] font-medium px-2 py-0.5 rounded bg-muted text-muted-foreground mt-0.5">
                        {docDef.badge}
                      </span>
                    </div>
                  </div>

                  {hasCustomDoc ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-1 rounded-md shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Customizado
                    </span>
                  ) : isUsingFallback ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-sky-700 bg-sky-50 dark:bg-sky-950/50 dark:text-sky-300 px-2 py-1 rounded-md shrink-0">
                      <FileCheck className="w-3.5 h-3.5" /> Padrão Ativo
                    </span>
                  ) : null}
                </div>

                <p className="text-xs text-muted-foreground">{docDef.description}</p>

                {hasCustomDoc ? (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-mono text-muted-foreground">
                      <span className="truncate max-w-[200px] font-semibold text-foreground">{customDoc.filename}</span>
                      <span>{new Date(customDoc.updatedAt).toLocaleDateString("pt-BR")}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-primary hover:text-primary"
                        onClick={() => setPreviewKey(isPreviewOpen ? null : docDef.key)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        {isPreviewOpen ? "Ocultar Prévia" : "Visualizar Texto"}
                        {isPreviewOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                      </Button>

                      <label className="cursor-pointer ml-auto">
                        <input
                          type="file"
                          accept=".md,.txt"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(docDef.key, file);
                          }}
                        />
                        <span className="inline-flex items-center text-xs font-medium text-muted-foreground hover:text-foreground underline">
                          Substituir
                        </span>
                      </label>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveDoc(docDef.key)}
                        title="Remover documento customizado"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remover
                      </Button>
                    </div>

                    {isPreviewOpen && activeDocContent && (
                      <div className="mt-2 p-3 bg-background rounded border max-h-48 overflow-y-auto text-xs prose prose-sm prose-neutral dark:prose-invert max-w-none">
                        <ReactMarkdown>{activeDocContent}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : isUsingFallback && defaultFallback ? (
                  <div className="rounded-lg border border-sky-200 dark:border-sky-900/60 bg-sky-50/40 dark:bg-sky-950/20 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="truncate max-w-[220px] font-medium text-foreground">{defaultFallback.filename}</span>
                      <span className="text-[11px] text-sky-600 dark:text-sky-400">Embarcado</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs px-2 text-sky-700 dark:text-sky-300 hover:text-sky-800"
                        onClick={() => setPreviewKey(isPreviewOpen ? null : docDef.key)}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        {isPreviewOpen ? "Ocultar Prévia" : "Visualizar Padrão"}
                        {isPreviewOpen ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                      </Button>

                      <label className="cursor-pointer ml-auto">
                        <input
                          type="file"
                          accept=".md,.txt"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(docDef.key, file);
                          }}
                        />
                        <span className="inline-flex items-center text-xs font-semibold text-primary hover:underline">
                          <Upload className="w-3 h-3 mr-1" /> Customizar com .md
                        </span>
                      </label>
                    </div>

                    {isPreviewOpen && activeDocContent && (
                      <div className="mt-2 p-3 bg-background rounded border max-h-48 overflow-y-auto text-xs prose prose-sm prose-neutral dark:prose-invert max-w-none">
                        <ReactMarkdown>{activeDocContent}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:bg-muted/40 transition-colors">
                    <input
                      type="file"
                      accept=".md,.txt"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(docDef.key, file);
                      }}
                    />
                    <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                    <span className="text-xs font-medium text-foreground">Upload de arquivo .md ou .txt</span>
                    <span className="text-[11px] text-muted-foreground">Clique para selecionar</span>
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            Salvar Documentos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
