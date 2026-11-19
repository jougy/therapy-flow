import React, { useMemo, useState } from "react";
import {
  CalendarCheck2,
  Loader2,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTO_LEAD_STAGE_META,
  type AutoLeadStage,
  type PlatformAutoLead,
} from "./types";
import { usePlatformAutoLeads } from "./usePlatformAutoLeads";
import { AutoLeadsContactsTable } from "./AutoLeadsContactsTable";
import { AutoLeadScheduleDialog } from "./AutoLeadScheduleDialog";
import { AutoLeadDetailSheet } from "./AutoLeadDetailSheet";
import { AutoLeadIntegrationModal } from "./AutoLeadIntegrationModal";

export const PlatformAutoLeadsView: React.FC = () => {
  const {
    leads,
    filteredLeads,
    affiliates,
    kpis,
    filters,
    setFilters,
    loading,
    syncingAgendas,
    updateLeadStage,
    assignLeadsToAffiliate,
    updateLeadDetails,
    scheduleLeadMeeting,
    importLeadsBatch,
    createManualLead,
    syncAgendasNow,
  } = usePlatformAutoLeads();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAffiliateId, setBulkAffiliateId] = useState<string>("");
  const [scheduleLead, setScheduleLead] = useState<PlatformAutoLead | null>(null);
  const [detailLead, setDetailLead] = useState<PlatformAutoLead | null>(null);
  const [integrationOpen, setIntegrationOpen] = useState(false);
  const [integrationTab, setIntegrationTab] = useState<"manual" | "import">("manual");

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) =>
      prev.length === filteredLeads.length ? [] : filteredLeads.map((l) => l.id)
    );
  };

  const handleBulkAssign = async () => {
    if (!bulkAffiliateId || selectedIds.length === 0) return;
    await assignLeadsToAffiliate(selectedIds, bulkAffiliateId === "unassigned" ? null : bulkAffiliateId);
    setSelectedIds([]);
  };

  const openModal = (tab: "manual" | "import" = "manual") => {
    setIntegrationTab(tab);
    setIntegrationOpen(true);
  };

  const activeDetailLead = useMemo(
    () => (detailLead ? leads.find((l) => l.id === detailLead.id) || detailLead : null),
    [leads, detailLead]
  );

  return (
    <div data-testid="platform-auto-leads-view" className="w-full max-w-full min-w-0 space-y-5">
      {/* KPIs de Acompanhamento */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Total de Leads</p>
              <p className="text-2xl font-bold">{kpis.total}</p>
            </div>
            <Users className="h-5 w-5 text-primary shrink-0" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Qualificados IA (≥70)</p>
              <p className="text-2xl font-bold">{kpis.qualified}</p>
            </div>
            <Sparkles className="h-5 w-5 text-amber-500 shrink-0" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Com WhatsApp</p>
              <p className="text-2xl font-bold">{kpis.withWhatsapp}</p>
            </div>
            <Phone className="h-5 w-5 text-emerald-600 shrink-0" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Agenda / Tentativas</p>
              <p className="text-2xl font-bold">
                {kpis.scheduledCount}{" "}
                <span className="text-xs font-medium text-amber-600">
                  ({kpis.attemptedCount} tent.)
                </span>
              </p>
            </div>
            <CalendarCheck2 className="h-5 w-5 text-sky-600 shrink-0" />
          </CardContent>
        </Card>
      </div>

      {/* Filtros & Ações de Agenda / Cadastro */}
      <Card>
        <CardContent className="p-3.5 space-y-3">
          <div className="flex flex-col lg:flex-row gap-2.5">
            <div className="relative flex-1 min-w-0">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome, telefone, grupo FB, clínica ou quem marcou..."
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className="pl-9"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2">
              <Select
                value={filters.agendaFilter}
                onValueChange={(val) =>
                  setFilters((prev) => ({ ...prev, agendaFilter: val as typeof prev.agendaFilter }))
                }
              >
                <SelectTrigger className="w-full lg:w-[190px] text-xs" data-testid="agenda-filter-select">
                  <SelectValue placeholder="Status Agenda" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Agendas</SelectItem>
                  <SelectItem value="scheduled">Com Reunião Marcada</SelectItem>
                  <SelectItem value="attempted">Tentaram Agendar (Bot/Com.)</SelectItem>
                  <SelectItem value="none">Sem Tentativa</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={filters.stage}
                onValueChange={(val) =>
                  setFilters((prev) => ({ ...prev, stage: val as AutoLeadStage | "all" }))
                }
              >
                <SelectTrigger className="w-full lg:w-[160px] text-xs">
                  <SelectValue placeholder="Estágio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Estágios</SelectItem>
                  {Object.entries(AUTO_LEAD_STAGE_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void syncAgendasNow()}
                disabled={syncingAgendas}
                className="gap-1.5 min-h-[44px] sm:min-h-[38px] text-xs"
              >
                {syncingAgendas ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                <span>Sincronizar Agendas</span>
              </Button>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => openModal("manual")}
                data-testid="add-import-leads-btn"
                className="gap-1.5 min-h-[44px] sm:min-h-[38px] text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Adicionar / Importar</span>
              </Button>
            </div>
          </div>

          {selectedIds.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg bg-primary/5 border border-primary/20 p-2.5">
              <span className="text-xs font-semibold text-primary">
                {selectedIds.length} lead(s) selecionado(s)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={bulkAffiliateId} onValueChange={setBulkAffiliateId}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    <SelectValue placeholder="Escolher afiliado..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Remover afiliado</SelectItem>
                    {affiliates.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" onClick={() => void handleBulkAssign()} disabled={!bulkAffiliateId} className="h-8 text-xs">
                  Distribuir Selecionados
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabela de Contatos */}
      {loading ? (
        <div className="flex items-center justify-center p-10 text-muted-foreground gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Carregando contatos e reconciliando agendas...</span>
        </div>
      ) : (
        <AutoLeadsContactsTable
          leads={filteredLeads}
          affiliates={affiliates}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          onStageChange={(id, stage) => void updateLeadStage(id, stage)}
          onAssignAffiliate={(id, affId) => void assignLeadsToAffiliate([id], affId)}
          onOpenSchedule={(lead) => setScheduleLead(lead)}
          onOpenDetail={(lead) => setDetailLead(lead)}
        />
      )}

      <AutoLeadScheduleDialog
        lead={scheduleLead}
        open={Boolean(scheduleLead)}
        onOpenChange={(open) => !open && setScheduleLead(null)}
        onSchedule={scheduleLeadMeeting}
      />

      <AutoLeadDetailSheet
        lead={activeDetailLead}
        open={Boolean(activeDetailLead)}
        onOpenChange={(open) => !open && setDetailLead(null)}
        affiliates={affiliates}
        onStageChange={(id, stage) => void updateLeadStage(id, stage)}
        onAssignAffiliate={(id, affId) => void assignLeadsToAffiliate([id], affId)}
        onSaveDetails={updateLeadDetails}
        onOpenSchedule={(lead) => {
          setDetailLead(null);
          setScheduleLead(lead);
        }}
      />

      <AutoLeadIntegrationModal
        open={integrationOpen}
        initialTab={integrationTab}
        onOpenChange={setIntegrationOpen}
        onCreateManualLead={createManualLead}
        onImportBatch={importLeadsBatch}
      />
    </div>
  );
};
