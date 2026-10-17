import React from "react";
import {
  MessageSquare,
  ExternalLink,
  Copy,
  User,
  ZoomIn,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RuntimeDebugEvent } from "@/lib/runtime-debug";
import type { WhatsAppBugContext } from "./types";
import {
  formatWhatsAppPhone,
  getWhatsAppDeepLink,
  isSafeHttpUrl,
} from "./helpers";

interface WhatsAppReportsListProps {
  reports: RuntimeDebugEvent[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onZoomImage: (image: { url: string; alt: string }) => void;
  onCopy: (text: string, label: string) => void;
}

export const WhatsAppReportsList: React.FC<WhatsAppReportsListProps> = ({
  reports,
  expandedId,
  onToggleExpand,
  onZoomImage,
  onCopy,
}) => {
  if (reports.length === 0) return null;

  return (
    <div className="space-y-3">
      {reports.map((ev) => {
        const isExpanded = expandedId === ev.id;
        const ctx = (ev.context || {}) as WhatsAppBugContext;
        const hasExtraDetails = !!(ev.errorDetails?.stack || ev.context);

        const leadName = ctx.leadName || ctx.userName || "Cliente WhatsApp";
        const clinicName = ctx.clinicName || "Consultório";
        const phone = ctx.phone;
        const clientMessage = ctx.message || ev.message;
        const imageUrl = ctx.imageUrl;
        const waDeepLink = phone ? getWhatsAppDeepLink(phone, leadName) : null;

        return (
          <Card
            key={ev.id}
            className="border-2 border-emerald-300 dark:border-emerald-800/80 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/20 dark:from-emerald-950/30 dark:via-slate-900 dark:to-emerald-950/10 shadow-sm transition-all hover:border-emerald-400"
          >
            <CardContent className="p-4 space-y-3">
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2.5 py-1 text-xs gap-1.5 shadow-sm">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Relato de Bug (WhatsApp)
                  </Badge>

                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-mono">
                    {ev.timeString}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {waDeepLink && (
                    <Button
                      asChild
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 h-8 text-xs font-medium shadow-sm"
                    >
                      <a href={waDeepLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Chamar no WhatsApp (+55...)
                      </a>
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs"
                    onClick={() => onCopy(clientMessage, "Mensagem do cliente")}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copiar Mensagem
                  </Button>
                </div>
              </div>

              {/* Customer Identification */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-md border border-emerald-100 dark:border-emerald-900/40">
                <div className="flex items-center gap-1.5 font-medium">
                  <User className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Titular: <strong>{leadName}</strong></span>
                </div>
                <div className="text-slate-400 dark:text-slate-600">•</div>
                <div>
                  Clínica: <strong>{clinicName}</strong>
                </div>
                <div className="text-slate-400 dark:text-slate-600">•</div>
                <div>
                  Telefone: <strong>{formatWhatsAppPhone(phone)}</strong>
                </div>
              </div>

              {/* Message Detailed View */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-emerald-900 dark:text-emerald-300 flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" />
                  Mensagem relatada pelo cliente:
                </span>
                <div className="p-3 rounded-md bg-emerald-50/60 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/50 text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                  {clientMessage}
                </div>
              </div>

              {/* Image Preview */}
              {imageUrl && isSafeHttpUrl(imageUrl) && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Print/Imagem anexada pelo cliente:
                  </span>
                  <div className="relative group w-fit">
                    <button
                      type="button"
                      onClick={() => onZoomImage({ url: imageUrl, alt: `Print anexado por ${leadName}` })}
                      className="relative block rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-emerald-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <img
                        src={imageUrl}
                        alt={`Print anexado por ${leadName}`}
                        className="max-h-48 max-w-xs object-cover rounded-md group-hover:scale-105 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1">
                        <ZoomIn className="w-4 h-4" />
                        Ampliar Imagem
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Extra details */}
              {hasExtraDetails && (
                <div className="pt-2 border-t border-emerald-100 dark:border-emerald-900/40">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50"
                    onClick={() => onToggleExpand(ev.id)}
                  >
                    {isExpanded ? "Ocultar Dados Técnicos" : "Ver Dados Técnicos / Contexto"}
                  </Button>

                  {isExpanded && (
                    <div className="mt-2 space-y-2">
                      {ev.errorDetails?.stack && (
                        <pre className="p-2 rounded bg-slate-950 text-slate-100 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                          {ev.errorDetails.stack}
                        </pre>
                      )}
                      {ev.context && (
                        <pre className="p-2 rounded bg-slate-900 text-emerald-300 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap max-h-40">
                          {JSON.stringify(ev.context, null, 2)}
                        </pre>
                      )}
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
