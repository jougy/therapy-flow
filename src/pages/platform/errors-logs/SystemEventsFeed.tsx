import React from "react";
import { Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RuntimeDebugEvent, DebugEventType } from "@/lib/runtime-debug";

interface SystemEventsFeedProps {
  events: RuntimeDebugEvent[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onCopy: (text: string, label: string) => void;
}

export const SystemEventsFeed: React.FC<SystemEventsFeedProps> = ({
  events,
  expandedId,
  onToggleExpand,
  onCopy,
}) => {
  const getBadgeVariant = (type: DebugEventType) => {
    switch (type) {
      case "error":
        return "destructive";
      case "warn":
        return "secondary";
      case "rpc":
        return "outline";
      case "info":
      default:
        return "outline";
    }
  };

  if (events.length === 0) return null;

  return (
    <div className="space-y-2.5">
      {events.map((ev) => {
        const isExpanded = expandedId === ev.id;
        const hasExtraDetails = !!(ev.errorDetails?.stack || ev.context);

        return (
          <Card
            key={ev.id}
            className={`border transition-all ${
              ev.type === "error"
                ? "border-rose-200 dark:border-rose-900/50 bg-rose-50/10 hover:border-rose-300"
                : ev.type === "warn"
                ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/10 hover:border-amber-300"
                : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
            }`}
          >
            <CardContent className="p-3.5 space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={getBadgeVariant(ev.type)} className="text-[11px] uppercase font-mono px-2 py-0.5">
                    {ev.type}
                  </Badge>
                  <code className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                    {ev.scope}
                  </code>
                  <span className="text-xs text-muted-foreground font-mono">
                    {ev.timeString}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
                    onClick={() => onCopy(ev.message, "Mensagem do log")}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar
                  </Button>
                  {hasExtraDetails && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs font-medium"
                      onClick={() => onToggleExpand(ev.id)}
                    >
                      {isExpanded ? "Ocultar Detalhes" : "Ver Detalhes"}
                    </Button>
                  )}
                </div>
              </div>

              <p className="text-sm font-medium text-slate-900 dark:text-slate-100 break-words font-sans">
                {ev.message}
              </p>

              {/* Stack Trace and Context */}
              {isExpanded && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-3">
                  {ev.errorDetails?.stack && (
                    <div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">Stack Trace:</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[11px]"
                          onClick={() => onCopy(ev.errorDetails?.stack || "", "Stack trace")}
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copiar Stack
                        </Button>
                      </div>
                      <pre className="p-2.5 rounded-md bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                        {ev.errorDetails.stack}
                      </pre>
                    </div>
                  )}

                  {ev.context && (
                    <div>
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Contexto do Evento:</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-1.5 text-[11px]"
                          onClick={() => onCopy(JSON.stringify(ev.context, null, 2), "Contexto")}
                        >
                          <Copy className="w-3 h-3 mr-1" /> Copiar JSON
                        </Button>
                      </div>
                      <pre className="p-2.5 rounded-md bg-slate-900 text-sky-300 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-48">
                        {JSON.stringify(ev.context, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
