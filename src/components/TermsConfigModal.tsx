import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, CheckCircle2, Eye, ChevronDown, ChevronUp, Globe, Users, Shield } from "lucide-react";
import ReactMarkdown from "react-markdown";

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
  publishedVersion?: string;
  publishedAt?: string;
}

interface TermsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Record<string, unknown>;
  onSave: (payload: Record<string, unknown>) => void;
}

const DOC_TYPES: Array<{ key: keyof Omit<TermsConfigPayload, "publishedVersion" | "publishedAt">; label: string; badge: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
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
        publishedVersion: (initialData.publishedVersion as string) || undefined,
        publishedAt: (initialData.publishedAt as string) || undefined,
      });
    }
  }, [initialData, isOpen]);

  const handleFileUpload = (docKey: keyof Omit<TermsConfigPayload, "publishedVersion" | "publishedAt">, file: File) => {
    if (!file.name.endsWith(".md") && !file.name.endsWith(".txt")) {
      toast({ title: "Formato inválido", description: "Por favor, selecione um arquivo no formato .md ou .txt.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) {
        toast({ title: "Arquivo vazio", description: "O arquivo selecionado não contém texto.", variant: "destructive" });
        return;
      }

      setDocs((prev) => ({
        ...prev,
        [docKey]: {
          content,
          filename: file.name,
          updatedAt: new Date().toISOString(),
        },
      }));

      toast({ title: "Documento carregado", description: `${file.name} foi associado aos ${DOC_TYPES.find(d => d.key === docKey)?.label}.` });
    };

    reader.readAsText(file);
  };

  const handleSave = () => {
    onSave(docs as unknown as Record<string, unknown>);
    toast({ title: "Configurações salvas", description: "Os documentos dos Termos de Uso foram salvos com sucesso." });
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
            Faça o upload dos arquivos <strong>.md</strong> para os 4 perfis de termos do sistema.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {DOC_TYPES.map((docDef) => {
            const currentDoc = docs[docDef.key];
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

                  {currentDoc && (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Carregado
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">{docDef.description}</p>

                {currentDoc ? (
                  <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-mono text-muted-foreground">
                      <span className="truncate max-w-[200px] font-semibold text-foreground">{currentDoc.filename}</span>
                      <span>{new Date(currentDoc.updatedAt).toLocaleDateString("pt-BR")}</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
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
                          Substituir .md
                        </span>
                      </label>
                    </div>

                    {isPreviewOpen && (
                      <div className="mt-2 p-3 bg-background rounded border max-h-48 overflow-y-auto text-xs prose prose-sm prose-neutral max-w-none">
                        <ReactMarkdown>{currentDoc.content}</ReactMarkdown>
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
                    <span className="text-xs font-medium text-foreground">Upload de arquivo .md</span>
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
