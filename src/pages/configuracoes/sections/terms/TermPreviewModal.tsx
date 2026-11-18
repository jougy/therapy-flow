import React from "react";
import { FileText, Copy, Check, ShieldCheck, Tag } from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { PreviewDocState } from "./types";

interface TermPreviewModalProps {
  previewDoc: PreviewDocState | null;
  onClose: () => void;
}

export const TermPreviewModal: React.FC<TermPreviewModalProps> = ({
  previewDoc,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!previewDoc) return null;

  const handleCopy = () => {
    void navigator.clipboard.writeText(previewDoc.content);
    setCopied(true);
    toast({
      title: "Copiado!",
      description: "O texto em Markdown foi copiado para a área de transferência.",
    });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={Boolean(previewDoc)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88dvh] flex flex-col p-0 overflow-hidden rounded-2xl bg-background border shadow-xl">
        <DialogHeader className="p-5 border-b space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{previewDoc.title}</span>
            </DialogTitle>

            {previewDoc.isImmutable ? (
              <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[11px] gap-1 self-start sm:self-auto shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" /> Imutável / Oficial Pluri-Health
              </Badge>
            ) : previewDoc.badge ? (
              <Badge variant="outline" className="text-[11px] self-start sm:self-auto shrink-0">
                {previewDoc.badge}
              </Badge>
            ) : null}
          </div>

          <DialogDescription className="text-xs text-muted-foreground">
            Visualização completa da redação com formatação Markdown e parágrafos.
          </DialogDescription>

          {previewDoc.detectedVariables && previewDoc.detectedVariables.length > 0 && (
            <div className="pt-1 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Tag className="w-3 h-3" /> Variáveis dinâmicas detectadas ({previewDoc.detectedVariables.length}):
              </span>
              {previewDoc.detectedVariables.map((v) => (
                <code
                  key={v}
                  className="text-[10px] font-mono bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20"
                >
                  {v}
                </code>
              ))}
            </div>
          )}
        </DialogHeader>

        <div className="flex-1 min-h-0 p-5 overflow-y-auto bg-muted/20">
          <div className="bg-card p-6 rounded-xl border shadow-sm prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed">
            <ReactMarkdown>{previewDoc.content}</ReactMarkdown>
          </div>
        </div>

        <DialogFooter className="p-3 border-t bg-muted/10 flex flex-row items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copiado" : "Copiar redação"}
          </Button>

          <Button type="button" variant="outline" size="sm" className="text-xs h-8" onClick={onClose}>
            Fechar Prévia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
