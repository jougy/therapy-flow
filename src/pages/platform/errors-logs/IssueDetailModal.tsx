import React from "react";
import {
  Sparkles,
  Copy,
  Clock,
  Layers,
  Activity,
  AlertCircle,
  Smartphone,
  Monitor,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { GroupedIssue } from "./types";
import { generateAntigravityDiagnosticPrompt } from "./helpers";
import { toast } from "@/hooks/use-toast";

interface IssueDetailModalProps {
  issue: GroupedIssue | null;
  isOpen: boolean;
  onClose: () => void;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue,
  isOpen,
  onClose,
}) => {
  if (!issue) return null;

  const copyDiagnostic = () => {
    const prompt = generateAntigravityDiagnosticPrompt(issue);
    navigator.clipboard.writeText(prompt);
    toast({
      title: "Diagnóstico Antigravity copiado!",
      description: "Prompt pronto para colar no chat com o agente de IA.",
    });
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: `${label} copiado`,
      description: "Conteúdo transferido para a área de transferência.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88dvh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="destructive" className="font-mono text-xs uppercase">
                {issue.type}
              </Badge>
              <code className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                {issue.scope}
              </code>
              <Badge variant="secondary" className="text-xs font-semibold">
                {issue.count} ocorrência{issue.count > 1 ? "s" : ""}
              </Badge>
            </div>

            <Button
              size="sm"
              onClick={copyDiagnostic}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 shadow-sm h-8 text-xs font-medium"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Copiar Diagnóstico Antigravity
            </Button>
          </div>

          <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mt-2 break-words">
            {issue.message}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Visto por último às {issue.lastTimeString} • {issue.affectedUsers.size} usuário(s) afetado(s)
          </DialogDescription>
        </DialogHeader>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 overscroll-contain">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Layers className="w-3 h-3" /> Ocorrências
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {issue.count} evento(s)
              </p>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> Última Vez Visto
              </span>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                {issue.lastTimeString}
              </p>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Monitor className="w-3 h-3" /> Dispositivos
              </span>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {Array.from(issue.devices).join(", ")}
              </p>
            </div>
          </div>

          {/* Breadcrumbs Trail */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              Últimos Passos do Usuário (Breadcrumbs)
            </span>

            {issue.breadcrumbs.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground border rounded-md bg-slate-50 dark:bg-slate-900">
                Nenhum passo registrado antes desta ocorrência.
              </div>
            ) : (
              <div className="border rounded-lg border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                {issue.breadcrumbs.map((b, idx) => (
                  <div key={b.id || idx} className="p-2.5 text-xs flex items-start justify-between gap-2 hover:bg-slate-50/60 dark:hover:bg-slate-900/60">
                    <div className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-muted-foreground mt-0.5 shrink-0">
                        {b.timeString}
                      </span>
                      <div>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono mr-1.5 py-0 px-1">
                          {b.category}
                        </Badge>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {b.message}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Stack Trace */}
          {issue.stack && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                  Stack Trace
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => copyText(issue.stack || "", "Stack trace")}
                >
                  <Copy className="w-3 h-3 mr-1" /> Copiar Stack
                </Button>
              </div>
              <pre className="p-3 rounded-lg bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-56 leading-relaxed">
                {issue.stack}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
