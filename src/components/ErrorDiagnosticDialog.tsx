import { AlertCircle, Clipboard, Copy, Info, ServerCrash, Wrench } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDiagnosticForPrompt, type AppDiagnosticError } from "@/lib/app-diagnostics";

const sectionStyles = {
  danger: "border-destructive/20 bg-destructive/5 text-destructive",
  info: "border-primary/20 bg-primary/5 text-primary",
  neutral: "border-border bg-muted/30 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-warning",
};

const DetailSection = ({
  children,
  icon,
  tone = "neutral",
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  tone?: keyof typeof sectionStyles;
  title: string;
}) => (
  <section className={`rounded-lg border p-3 ${sectionStyles[tone]}`}>
    <div className="mb-2 flex items-center gap-2 font-medium">
      {icon}
      <h3 className="text-sm">{title}</h3>
    </div>
    <div className="text-sm leading-relaxed text-foreground">{children}</div>
  </section>
);

export const ErrorDiagnosticDialog = ({
  diagnostic,
  onOpenChange,
  open,
}: {
  diagnostic: AppDiagnosticError | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const handleCopy = async () => {
    if (!diagnostic) return;

    await navigator.clipboard.writeText(formatDiagnosticForPrompt(diagnostic));
    toast({ title: "Diagnóstico copiado", description: "O relatório está pronto para colar em um prompt de IA." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[calc(100vw-1rem)] max-w-3xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <AlertCircle className="h-5 w-5 text-destructive" />
            {diagnostic?.title ?? "Diagnóstico do erro"}
          </DialogTitle>
          <DialogDescription>
            Relatório mascarado e formatado para entender a falha sem expor dados sensíveis.
          </DialogDescription>
        </DialogHeader>

        {diagnostic ? (
          <div className="space-y-3">
            <DetailSection title="Resumo" tone="danger" icon={<Info className="h-4 w-4" />}>
              <p>{diagnostic.humanSummary}</p>
            </DetailSection>

            <DetailSection title="Onde falhou" tone="warning" icon={<ServerCrash className="h-4 w-4" />}>
              <div className="grid gap-1">
                <p><strong>Etapa:</strong> {diagnostic.stage}</p>
                {diagnostic.functionName ? <p><strong>Edge Function:</strong> {diagnostic.functionName}</p> : null}
                {diagnostic.status ? <p><strong>Status HTTP:</strong> {diagnostic.status}</p> : null}
              </div>
            </DetailSection>

            <DetailSection title="Possíveis causas" tone="info" icon={<Wrench className="h-4 w-4" />}>
              <p>{diagnostic.probableCause}</p>
            </DetailSection>

            <DetailSection title="Detalhes técnicos" icon={<Clipboard className="h-4 w-4" />}>
              <div className="space-y-2">
                <p><strong>Mensagem original:</strong> {diagnostic.originalMessage}</p>
                {diagnostic.technicalDetails ? (
                  <pre className="max-h-44 overflow-auto whitespace-pre-wrap rounded-md bg-background p-3 text-xs text-muted-foreground">
                    {diagnostic.technicalDetails}
                  </pre>
                ) : null}
              </div>
            </DetailSection>

            <DetailSection title="Contexto mascarado" icon={<Info className="h-4 w-4" />}>
              <dl className="grid gap-2 sm:grid-cols-2">
                {Object.entries(diagnostic.safeContext).map(([key, value]) => (
                  <div key={key} className="min-w-0 rounded-md bg-background p-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{key}</dt>
                    <dd className="break-words text-sm">{String(value ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            </DetailSection>

            <DetailSection title="Próximos passos" tone="info" icon={<Wrench className="h-4 w-4" />}>
              <p>Copie o diagnóstico e envie para um agente de IA junto com o que você estava tentando fazer. O relatório já vem com os arquivos prováveis para investigar.</p>
            </DetailSection>

            <Button type="button" className="w-full sm:w-auto" onClick={() => void handleCopy()}>
              <Copy className="mr-2 h-4 w-4" />
              Copiar diagnóstico
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
