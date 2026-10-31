import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldCheck, Search } from "lucide-react";
import { formatPrecisionTimestamp, getEventBadge, type UserTelemetryRecord } from "./types";

interface UserTelemetryAuditTableProps {
  loading: boolean;
  filteredEvents: UserTelemetryRecord[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  eventTypeFilter: string;
  setEventTypeFilter: (filter: string) => void;
}

export const UserTelemetryAuditTable: React.FC<UserTelemetryAuditTableProps> = ({
  loading,
  filteredEvents,
  searchQuery,
  setSearchQuery,
  eventTypeFilter,
  setEventTypeFilter,
}) => {
  return (
    <Card className="w-full max-w-full min-w-0 shadow-sm border-neutral-200/80">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Log de Telemetria e Auditoria Desta Conta</span>
          </CardTitle>
          <CardDescription>
            Eventos instantâneos e resumos de auditoria do colaborador (Axiom Cloud / Upstash Redis).
          </CardDescription>
        </div>

        <div className="flex w-full flex-col sm:w-auto sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filtrar por rota..."
              className="h-9 pl-8 text-xs bg-neutral-50 w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[160px] text-xs bg-neutral-50">
              <SelectValue placeholder="Tipo de evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              <SelectItem value="print_screen">📷 Captura de Tela</SelectItem>
              <SelectItem value="document_print">🖨️ Impressão</SelectItem>
              <SelectItem value="export_pdf">📁 Exportação PDF</SelectItem>
              <SelectItem value="page_view">📄 Navegação</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="w-full max-w-full min-w-0 px-2 sm:px-6">
        {loading ? (
          <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
            Carregando eventos do usuário...
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500 border border-dashed rounded-xl">
            Nenhum evento individual instantâneo registrado. Os dados acumulados continuam visíveis no sumário acima.
          </div>
        ) : (
          <div className="w-full max-w-full min-w-0 overflow-x-auto touch-pan-x rounded-lg border border-neutral-100 dark:border-neutral-800">
            <table className="w-full min-w-[600px] text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400 font-semibold">
                  <th className="py-3 px-4">Selo Data / Hora (Preciso)</th>
                  <th className="py-3 px-4">Tipo de Ação</th>
                  <th className="py-3 px-4">Página (Rota)</th>
                  <th className="py-3 px-4">Metadados & Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {filteredEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      {formatPrecisionTimestamp(ev.created_at)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getEventBadge(ev.event_type)}
                    </td>
                    <td className="py-3 px-4 font-mono text-neutral-600 dark:text-neutral-400 break-all max-w-[200px]">
                      {ev.pathname}
                    </td>
                    <td className="py-3 px-4 text-neutral-500 font-mono text-[11px] max-w-[240px] truncate" title={JSON.stringify(ev.metadata)}>
                      {JSON.stringify(ev.metadata)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
