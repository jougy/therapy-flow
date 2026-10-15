import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  Copy,
  Check,
  Download,
  FileText,
  Sparkles,
  ExternalLink,
  HelpCircle,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ANAMNESIS_AI_REFERENCE_GUIDE_MARKDOWN,
  downloadAiReferenceGuideFile,
} from "@/lib/anamnesis-ai-guide";

interface AiReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AiReferenceModal: React.FC<AiReferenceModalProps> = ({
  open,
  onOpenChange,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(ANAMNESIS_AI_REFERENCE_GUIDE_MARKDOWN);
      setCopied(true);
      toast({
        title: "Prompt copiado com sucesso!",
        description: "Cole no ChatGPT, Claude ou Gemini junto com o seu PDF/Word.",
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar para a área de transferência.",
        variant: "destructive",
      });
    }
  };

  const handleDownload = () => {
    downloadAiReferenceGuideFile();
    toast({
      title: "Arquivo baixado!",
      description: "O guia 'guia-referencia-ia-plurihealth.md' foi salvo em seu computador.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88dvh] flex flex-col p-0 gap-0 overflow-hidden sm:rounded-2xl">
        {/* Header */}
        <div className="p-5 pb-4 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                Criar Fichas com IAs Externas
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  ChatGPT, Claude, Gemini
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Exporte o guia com a especificação de componentes e envie para qualquer IA transformar seus PDFs e documentos em formulários prontos.
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Content Tabs */}
        <Tabs defaultValue="how-to-use" className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-3 border-b bg-muted/20">
            <TabsList className="grid w-full grid-cols-2 max-w-xs">
              <TabsTrigger value="how-to-use" className="text-xs gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" />
                Como funciona
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Prompt & Regras
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-5 text-sm overscroll-contain">
            <TabsContent value="how-to-use" className="m-0 space-y-4">
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <h4 className="font-semibold text-foreground flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Passo a passo rápido em 3 etapas:
                </h4>
                <ol className="space-y-3 text-xs sm:text-sm text-muted-foreground list-decimal list-inside">
                  <li className="leading-relaxed">
                    <strong className="text-foreground">Copie ou baixe o guia:</strong> Use os botões abaixo para obter o prompt mestre com todas as instruções técnicas do Pluri-Health.
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-foreground">Abra sua IA de preferência:</strong> Acesse o ChatGPT, Claude, Gemini ou Copilot e envie o arquivo (ou cole o texto) acompanhado do seu arquivo de ficha (PDF, Word ou foto).
                  </li>
                  <li className="leading-relaxed">
                    <strong className="text-foreground">Importe o resultado:</strong> A IA responderá com um bloco JSON. Salve como um arquivo <code className="rounded bg-muted px-1 py-0.5 text-foreground font-mono">.json</code> e use o botão <strong className="text-foreground">"Importar arquivo"</strong> aqui no sistema!
                  </li>
                </ol>
              </div>

              <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                  💡 Dica de mensagem para enviar à IA junto com seu PDF/Word:
                </div>
                <div className="rounded-lg bg-background/80 p-3 text-xs font-mono text-foreground border border-border select-all">
                  "Leia o documento/imagem em anexo e monte a ficha clínica correspondente seguindo à risca as regras do Guia de Referência do Pluri-Health. Responda apenas com o bloco JSON válido dentro de ```json para que eu possa importar na clínica."
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="m-0">
              <div className="rounded-xl border bg-muted/40 p-4 max-h-[48dvh] overflow-y-auto">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed select-text">
                  {ANAMNESIS_AI_REFERENCE_GUIDE_MARKDOWN}
                </pre>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/30 flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-primary" />
            Compatível com todos os componentes clínicos
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 flex-1 sm:flex-none"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />
              Baixar Guia (.md)
            </Button>
            <Button
              type="button"
              size="sm"
              className="gap-2 flex-1 sm:flex-none shadow-sm"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar Prompt Mestre"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
