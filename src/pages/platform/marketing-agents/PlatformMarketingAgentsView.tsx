import React, { useState } from "react";
import {
  Bot,
  Cpu,
  Filter,
  Flame,
  MessageSquare,
  Plus,
  QrCode,
  Send,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_MARKETING_CHIP_DISPLAY,
  INSTANCE_STATUS_META,
  type AgentsPanelTab,
  type MarketingAiAgent,
} from "./types";
import { useMarketingAgents } from "./useMarketingAgents";
import { useZapSuiteExtras } from "./useZapSuiteExtras";
import { AgentsStudioSection } from "./AgentsStudioSection";
import { AgentEditorSheet } from "./AgentEditorSheet";
import { LlmHarnessDrawer } from "./LlmHarnessDrawer";
import { ConnectionsQrSection } from "./ConnectionsQrSection";
import { CampaignsBroadcastSection } from "./CampaignsBroadcastSection";
import { TurboFilterAndGroupsSection } from "./TurboFilterAndGroupsSection";
import { WarmupAntiBanSection } from "./WarmupAntiBanSection";
import { AgentCrmInboxSection } from "./AgentCrmInboxSection";
import { formatPhoneBr } from "./antiBanEngine";

export const PlatformMarketingAgentsView: React.FC = () => {
  const {
    instances,
    primaryInstance,
    agents,
    campaigns,
    conversations,
    optOuts,
    eligibleLeadsCount,
    previewFallback,
    qrCodeBase64,
    evolutionSetupHint,
    connectingInstanceKey,
    simulationTurns,
    simulating,
    reload,
    connectInstanceQr,
    checkInstanceStatus,
    toggleCircuitBreaker,
    addExtraInstance,
    saveAgent,
    toggleAgentActive,
    simulateAgentMessage,
    clearSimulation,
    createAndEnqueueCampaign,
    toggleCampaignStatus,
    updateAntiBanConfig,
    addManualOptOut,
    removeOptOut,
    toggleConversationHumanMode,
    updateConversationStage,
  } = useMarketingAgents();

  const extras = useZapSuiteExtras({
    previewFallback,
    instances,
    onReloadCore: reload,
  });

  const [activeTab, setActiveTab] = useState<AgentsPanelTab>("agents");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<MarketingAiAgent | null>(null);
  const [harnessOpen, setHarnessOpen] = useState(false);
  const [playgroundOverride, setPlaygroundOverride] = useState<{
    providerSlug: string;
    modelId: string;
  } | null>(null);

  const primaryStatus = INSTANCE_STATUS_META[primaryInstance.status];
  const activeAgentsCount = agents.filter((a) => a.is_active).length;

  const openCreateEditor = () => {
    setEditingAgent(null);
    setEditorOpen(true);
  };

  const openEditEditor = (agent: MarketingAiAgent) => {
    setEditingAgent(agent);
    setEditorOpen(true);
  };

  return (
    <div
      data-testid="platform-marketing-agents-view"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-5"
    >
      {/* Header estilo Ninja Zap / CrabStudios 16-em-1 com Chip Dedicado */}
      <div className="rounded-xl border bg-card/70 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight">
              Pluri Zap Suite 16-em-1 — Painel de Agentes & Automação
            </h3>
            <Badge variant="outline" className={primaryStatus.badgeClass}>
              {primaryStatus.label}
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs">
              Chip: {formatPhoneBr(primaryInstance.phone_e164) || DEFAULT_MARKETING_CHIP_DISPLAY}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Evolution API v2 + Harness Multi-LLM Local-First (Ollama, OpenCode Free, Gemini, GPT, Claude) + Compactação de Contexto + Anti-Ban em 7 Camadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="agents-open-harness-btn"
            onClick={() => setHarnessOpen(true)}
            className="min-h-[44px] sm:min-h-[38px] gap-1.5"
          >
            <Cpu className="h-4 w-4 text-primary" />
            <span>Harness LLM</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setActiveTab("connections")}
            className="min-h-[44px] sm:min-h-[38px] gap-1.5"
          >
            <QrCode className="h-4 w-4 text-primary" />
            <span>Conectar QR Code</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={openCreateEditor}
            className="min-h-[44px] sm:min-h-[38px] gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Novo Agente IA</span>
          </Button>
        </div>
      </div>

      {previewFallback && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-800 dark:text-amber-200">
          Modo preview local ativo — aplique as migrations{" "}
          <code>20261121203000</code> e <code>20261122090000</code> no Supabase para persistir instâncias, provedores LLM, agentes e grupos no banco.
        </div>
      )}

      {/* KPIs Executivos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Saúde do Chip</p>
              <p className="text-2xl font-bold">{primaryInstance.health_score}/100</p>
            </div>
            <Smartphone className="h-5 w-5 text-emerald-500 shrink-0" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Agentes IA Ativos</p>
              <p className="text-2xl font-bold">
                {activeAgentsCount}/{agents.length}
              </p>
            </div>
            <Bot className="h-5 w-5 text-primary shrink-0" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Envios Hoje / Warm-up</p>
              <p className="text-2xl font-bold">
                {primaryInstance.daily_sent_count}/{primaryInstance.daily_limit}
              </p>
            </div>
            <Flame className="h-5 w-5 text-amber-500 shrink-0" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">CRM & Opt-Outs LGPD</p>
              <p className="text-2xl font-bold">
                {conversations.length} / {optOuts.length}
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 text-sky-500 shrink-0" />
          </CardContent>
        </Card>
      </div>

      {/* Subnavegação interna 6 Pilares */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AgentsPanelTab)}>
        <div className="w-full overflow-x-auto touch-pan-x pb-1">
          <TabsList className="inline-flex lg:grid lg:grid-cols-6 w-max lg:w-full h-auto p-1 gap-1">
            <TabsTrigger
              value="agents"
              data-testid="agents-inner-tab-agents"
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
            >
              <Bot className="h-4 w-4 shrink-0" />
              <span>Agentes & LLMs</span>
            </TabsTrigger>
            <TabsTrigger
              value="connections"
              data-testid="agents-inner-tab-connections"
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
            >
              <QrCode className="h-4 w-4 shrink-0" />
              <span>Conexões & Defender</span>
            </TabsTrigger>
            <TabsTrigger
              value="campaigns"
              data-testid="agents-inner-tab-campaigns"
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
            >
              <Send className="h-4 w-4 shrink-0" />
              <span>Disparos & Push</span>
            </TabsTrigger>
            <TabsTrigger
              value="filter_groups"
              data-testid="agents-inner-tab-filter-groups"
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
            >
              <Filter className="h-4 w-4 shrink-0" />
              <span>Filtro & Grupos</span>
            </TabsTrigger>
            <TabsTrigger
              value="warmup"
              data-testid="agents-inner-tab-warmup"
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
            >
              <Flame className="h-4 w-4 shrink-0" />
              <span>Aquecimento</span>
            </TabsTrigger>
            <TabsTrigger
              value="crm"
              data-testid="agents-inner-tab-crm"
              className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
            >
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span>CRM & Gatilhos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="agents" className="mt-4">
          <AgentsStudioSection
            agents={agents}
            instances={instances}
            simulationTurns={simulationTurns}
            simulating={simulating}
            onCreateNew={openCreateEditor}
            onEditAgent={openEditEditor}
            onToggleActive={toggleAgentActive}
            onSimulateMessage={simulateAgentMessage}
            onClearSimulation={clearSimulation}
            deviceHarness={extras.deviceHarness}
            providers={extras.llmProviders}
            catalog={extras.liveCatalog}
            onOpenHarness={() => setHarnessOpen(true)}
            playgroundModelOverride={playgroundOverride}
            onChangePlaygroundModelOverride={setPlaygroundOverride}
            onSimulateWithModel={simulateAgentMessage}
          />
        </TabsContent>

        <TabsContent value="connections" className="mt-4">
          <ConnectionsQrSection
            instances={instances}
            qrCodeBase64={qrCodeBase64}
            evolutionSetupHint={evolutionSetupHint}
            connectingInstanceKey={connectingInstanceKey}
            onConnectQr={connectInstanceQr}
            onCheckStatus={checkInstanceStatus}
            onToggleCircuitBreaker={toggleCircuitBreaker}
            onAddExtraInstance={addExtraInstance}
            onRequestPairingCode={extras.requestPairingCode}
            defenderReports={extras.defenderReports}
            onRunDefenderAudit={extras.runZapDefenderAudit}
            auditingInstanceId={extras.auditingInstanceId}
          />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-4">
          <CampaignsBroadcastSection
            instances={instances}
            agents={agents}
            campaigns={campaigns}
            eligibleLeadsCount={eligibleLeadsCount}
            onCreateCampaign={createAndEnqueueCampaign}
            onToggleCampaignStatus={toggleCampaignStatus}
            groups={extras.groups}
            onSendPushAlert={extras.sendPushAlert}
          />
        </TabsContent>

        <TabsContent value="filter_groups" className="mt-4">
          <TurboFilterAndGroupsSection
            instances={instances}
            groups={extras.groups}
            onValidateBatch={extras.validateNumbersBatch}
            onSyncGroups={extras.syncGroups}
            onExtractGroupMembers={extras.extractGroupMembers}
            onBatchGroupMembers={(payload) => extras.enqueueGroupJob(payload)}
            onScheduleGroupBroadcast={(payload) => extras.enqueueGroupJob(payload)}
          />
        </TabsContent>

        <TabsContent value="warmup" className="mt-4">
          <WarmupAntiBanSection
            primaryInstance={primaryInstance}
            optOuts={optOuts}
            onSaveAntiBan={updateAntiBanConfig}
            onAddOptOut={addManualOptOut}
            onRemoveOptOut={removeOptOut}
            pools={extras.warmupPools}
            instances={instances}
            onSavePool={extras.saveWarmupPool}
          />
        </TabsContent>

        <TabsContent value="crm" className="mt-4">
          <AgentCrmInboxSection
            conversations={conversations}
            onToggleHumanMode={toggleConversationHumanMode}
            onUpdateStage={updateConversationStage}
            triggers={extras.keywordTriggers}
            onCreateTrigger={extras.createKeywordTrigger}
            onToggleTrigger={extras.toggleKeywordTrigger}
            onDeleteTrigger={extras.deleteKeywordTrigger}
            onSendHumanReply={extras.sendHumanReply}
            onCompactMemory={extras.compactConversationMemory}
          />
        </TabsContent>
      </Tabs>

      <AgentEditorSheet
        open={editorOpen}
        onOpenChange={setEditorOpen}
        agent={editingAgent}
        instances={instances}
        onSave={saveAgent}
        catalog={extras.liveCatalog}
        providers={extras.llmProviders}
      />

      <LlmHarnessDrawer
        open={harnessOpen}
        onOpenChange={setHarnessOpen}
        config={extras.deviceHarness}
        catalog={extras.liveCatalog}
        onSaveConfig={extras.saveDeviceHarness}
        onTestProvider={extras.testLlmProvider}
      />
    </div>
  );
};