import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";
import {
  DOC_TYPES,
  DocTypeKey,
  TermsConfigPayload,
  TermsDocItem,
  TermsDocCard,
  TermsBulkDownloadButton,
} from "./terms";

export type { TermsDocItem, TermsConfigPayload, DocTypeKey };
export { DOC_TYPES };

interface TermsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Record<string, unknown>;
  onSave: (payload: Record<string, unknown>) => void;
}

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
        adult_terms: (initialData.adult_terms as TermsDocItem) || undefined,
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
        <DialogHeader className="space-y-1 pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Configuração dos Termos de Uso e Consentimento
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Faça o upload dos arquivos <strong>.md</strong> ou <strong>.txt</strong> para os perfis de termos e consentimento da plataforma.
              </DialogDescription>
            </div>

            <TermsBulkDownloadButton docs={docs} />
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
          {DOC_TYPES.map((docDef) => (
            <TermsDocCard
              key={docDef.key}
              docDef={docDef}
              customDoc={docs[docDef.key]}
              isPreviewOpen={previewKey === docDef.key}
              onTogglePreview={() => setPreviewKey((prev) => (prev === docDef.key ? null : docDef.key))}
              onFileUpload={(file) => handleFileUpload(docDef.key, file)}
              onRemoveDoc={() => handleRemoveDoc(docDef.key)}
            />
          ))}
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
