import React, { Suspense, useMemo, useState } from "react";
import { ArrowDown, ArrowRight, Bot, CheckCircle2, Clock, Layers, Pencil, Play, Plus, Workflow } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_FLOW_TEMPLATES,
  NODE_PALETTE_ITEMS,
  type MarketingFlowEdge,
  type MarketingFlowNode,
  type MarketingFlowTemplate,
  type NodePaletteItem,
} from "./types";
import { FlowNodeInspectorSheet } from "./FlowNodeInspectorSheet";
import { TypeZapBridgeSection } from "./TypeZapBridgeSection";

const LazyBotzomFlowCanvas = React.lazy(() => import("./BotzomFlowCanvas"));

export interface PlatformMarketingFlowsViewProps {
  flows?: MarketingFlowTemplate[];
  onSaveFlow?: (flow: MarketingFlowTemplate) => Promise<void>;
  onRunFlow?: (flow: MarketingFlowTemplate) => Promise<void>;
}

function CheckpointIcon({ status }: { status?: MarketingFlowNode["checkpointStatus"] }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === "waiting_approval") return <Clock className="h-4 w-4 text-amber-500 shrink-0" />;
  return null;
}

export const PlatformMarketingFlowsView: React.FC<PlatformMarketingFlowsViewProps> = ({
  flows: controlledFlows,
  onSaveFlow,
  onRunFlow,
}) => {
  const [localFlows, setLocalFlows] = useState<MarketingFlowTemplate[]>(DEFAULT_FLOW_TEMPLATES);
  const flows = controlledFlows ?? localFlows;

  const [subtab, setSubtab] = useState<"builder" | "typezap" | "templates">("builder");
  const [selectedFlowId, setSelectedFlowId] = useState<string>(() => flows[0]?.id || DEFAULT_FLOW_TEMPLATES[0].id);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [inspectorNode, setInspectorNode] = useState<MarketingFlowNode | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [mobilePaletteType, setMobilePaletteType] = useState<string>(NODE_PALETTE_ITEMS[0].type);

  const selectedFlow = useMemo(
    () => flows.find((f) => f.id === selectedFlowId) ?? flows[0] ?? DEFAULT_FLOW_TEMPLATES[0],
    [flows, selectedFlowId],
  );

  const updateFlowState = (updated: MarketingFlowTemplate) => {
    setLocalFlows((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
    if (onSaveFlow) void onSaveFlow(updated);
  };

  const toggleFlow = (id: string) => {
    const target = flows.find((f) => f.id === id);
    if (!target) return;
    updateFlowState({ ...target, isActive: !target.isActive });
    toast({ title: "Status do fluxo atualizado" });
  };

  const runFlowNow = async (flow: MarketingFlowTemplate) => {
    setRunningId(flow.id);
    try {
      if (onRunFlow) await onRunFlow(flow);
      let halted = false;
      const executed: MarketingFlowTemplate = {
        ...flow,
        nodes: flow.nodes.map((node) => {
          if (halted) return { ...node, checkpointStatus: "idle" };
          if (node.type === "human_approval") {
            halted = true;
            return { ...node, checkpointStatus: "waiting_approval" };
          }
          return { ...node, checkpointStatus: "completed" };
        }),
      };
      setLocalFlows((prev) => prev.map((f) => (f.id === flow.id ? executed : f)));
      toast({ title: "Execução DAG concluída com checkpoints!", description: `Fluxo "${flow.name}" processado.` });
    } finally {
      setRunningId(null);
    }
  };

  const handleAddNode = (item: NodePaletteItem, position?: { x: number; y: number }) => {
    const newNode: MarketingFlowNode = {
      id: `node-${Date.now().toString(36)}`,
      type: item.type,
      title: item.defaultTitle,
      subtitle: item.defaultSubtitle,
      checkpointStatus: "idle",
      position: position ?? { x: 60 + selectedFlow.nodes.length * 250, y: 100 + (selectedFlow.nodes.length % 2) * 70 },
    };
    const prevLast = selectedFlow.nodes[selectedFlow.nodes.length - 1];
    const nextEdges: MarketingFlowEdge[] = [
      ...(selectedFlow.edges || []),
      ...(prevLast ? [{ id: `edge-${prevLast.id}-${newNode.id}`, source: prevLast.id, target: newNode.id }] : []),
    ];
    updateFlowState({ ...selectedFlow, nodes: [...selectedFlow.nodes, newNode], edges: nextEdges });
    toast({ title: `Nó "${item.label}" adicionado!` });
  };

  const handleSaveGraph = (nodes: MarketingFlowNode[], edges: MarketingFlowEdge[]) => {
    updateFlowState({ ...selectedFlow, nodes, edges });
    toast({ title: "Grafo Botzom salvo!", description: `${nodes.length} nós conectados.` });
  };

  const handleSaveInspectorNode = (updatedNode: MarketingFlowNode) => {
    updateFlowState({
      ...selectedFlow,
      nodes: selectedFlow.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n)),
    });
    toast({ title: "Configuração do nó aplicada" });
  };

  const handleDeleteNode = (nodeId: string) => {
    updateFlowState({
      ...selectedFlow,
      nodes: selectedFlow.nodes.filter((n) => n.id !== nodeId),
      edges: (selectedFlow.edges || []).filter((e) => e.source !== nodeId && e.target !== nodeId),
    });
    toast({ title: "Nó removido do fluxo" });
  };

  const handleCreateBlankFlow = () => {
    const id = `flow-custom-${Date.now().toString(36)}`;
    const created: MarketingFlowTemplate = {
      id,
      name: `Novo Fluxo Botzom (${flows.length + 1})`,
      description: "Fluxo personalizado criado no Botzom Visual Builder.",
      isActive: false,
      nodes: [
        { id: `${id}-n1`, type: "trigger_whatsapp_inbound", title: "Gatilho: Mensagem WhatsApp", subtitle: "Dispara ao receber mensagem", position: { x: 60, y: 120 } },
        { id: `${id}-n2`, type: "ai_agent_gemini", title: "Agente Multi-LLM SDR", subtitle: "OpenCode Free / Gemini", position: { x: 350, y: 120 } },
      ],
    };
    setLocalFlows((prev) => [created, ...prev]);
    setSelectedFlowId(id);
    toast({ title: "Novo fluxo criado!" });
  };

  return (
    <div data-testid="platform-marketing-flows-view" className="w-full max-w-full min-w-0 overflow-x-hidden space-y-4">
      <div className="rounded-xl border bg-card/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight flex items-center gap-2">
              <Workflow className="h-4 w-4 text-primary shrink-0" />
              Botzom Visual Builder &amp; TypeZap (DAG)
            </h3>
            <Badge variant="outline">Checkpointing por Nó</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Orquestre WhatsApp, Multi-LLM, Webhook HTTP, Kanban, CrabStudio e Typebot OSS no mesmo fluxo.
          </p>
        </div>
      </div>

      <Tabs value={subtab} onValueChange={(v) => setSubtab(v as "builder" | "typezap" | "templates")} className="w-full max-w-full min-w-0 space-y-4">
        <div className="w-full overflow-x-auto touch-pan-x pb-1">
          <TabsList className="inline-flex sm:grid sm:grid-cols-3 w-max sm:w-full h-auto p-1 gap-1">
            <TabsTrigger value="builder" className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap">
              <Workflow className="h-4 w-4 shrink-0" /><span>Botzom Visual Builder</span>
            </TabsTrigger>
            <TabsTrigger value="typezap" className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap">
              <Bot className="h-4 w-4 shrink-0" /><span>TypeZap (Fluxos Typebot)</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap">
              <Layers className="h-4 w-4 shrink-0" /><span>Templates Prontos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="builder" className="mt-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <Select value={selectedFlow.id} onValueChange={setSelectedFlowId}>
                <SelectTrigger className="w-full sm:w-80 min-h-[44px] sm:min-h-[38px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {flows.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant={selectedFlow.isActive ? "default" : "secondary"} className="text-[10px]">
                {selectedFlow.isActive ? "Ativo" : "Pausado"}
              </Badge>
            </div>
            <Button type="button" size="sm" variant="outline" onClick={handleCreateBlankFlow} className="min-h-[44px] sm:min-h-[38px] gap-1.5 text-xs shrink-0">
              <Plus className="h-4 w-4" /><span>Novo Fluxo</span>
            </Button>
          </div>

          {/* Desktop: Lazy-loaded flow canvas */}
          <div className="hidden md:block">
            <Suspense fallback={<div className="h-[460px] w-full rounded-xl border bg-muted/20 flex items-center justify-center text-xs text-muted-foreground">Carregando Botzom Visual Builder...</div>}>
              <LazyBotzomFlowCanvas
                flow={selectedFlow}
                onSelectNode={(node) => { setInspectorNode(node); setInspectorOpen(true); }}
                onAddNode={handleAddNode}
                onSaveGraph={handleSaveGraph}
                onRunFlow={() => void runFlowNow(selectedFlow)}
              />
            </Suspense>
          </div>

          {/* Mobile: Tactile Vertical Stepper Cards */}
          <div className="md:hidden space-y-3">
            <div className="rounded-xl border bg-card p-3 space-y-2.5">
              <p className="text-xs font-semibold">Adicionar Nó ao Stepper Mobile</p>
              <div className="flex gap-2">
                <Select value={mobilePaletteType} onValueChange={setMobilePaletteType}>
                  <SelectTrigger className="min-h-[44px] text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NODE_PALETTE_ITEMS.map((item) => <SelectItem key={item.type} value={item.type}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    const found = NODE_PALETTE_ITEMS.find((i) => i.type === mobilePaletteType);
                    if (found) handleAddNode(found);
                  }}
                  className="min-h-[44px] shrink-0 gap-1 text-xs"
                >
                  <Plus className="h-4 w-4" /><span>Adicionar Nó</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {selectedFlow.nodes.map((node, index) => (
                <React.Fragment key={node.id}>
                  <Card className="border">
                    <CardContent className="p-3.5 flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">Passo {index + 1}</Badge>
                          <CheckpointIcon status={node.checkpointStatus} />
                        </div>
                        <p className="text-xs font-semibold">{node.title}</p>
                        <p className="text-[11px] text-muted-foreground">{node.subtitle}</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" onClick={() => { setInspectorNode(node); setInspectorOpen(true); }} className="min-h-[44px] text-xs gap-1 shrink-0">
                        <Pencil className="h-3.5 w-3.5" /><span>Editar Nó</span>
                      </Button>
                    </CardContent>
                  </Card>
                  {index < selectedFlow.nodes.length - 1 && <div className="flex justify-center"><ArrowDown className="h-4 w-4 text-muted-foreground" /></div>}
                </React.Fragment>
              ))}
            </div>

            <Button type="button" disabled={runningId === selectedFlow.id} onClick={() => void runFlowNow(selectedFlow)} className="w-full min-h-[44px] gap-1.5 text-xs">
              <Play className="h-4 w-4" /><span>Executar Fluxo Agora</span>
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="typezap" className="mt-0"><TypeZapBridgeSection /></TabsContent>

        <TabsContent value="templates" className="mt-0 space-y-4">
          {flows.map((flow) => (
            <Card key={flow.id} data-testid={`marketing-flow-card-${flow.id}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-sm sm:text-base">{flow.name}</CardTitle>
                    <CardDescription className="text-xs">{flow.description}</CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <div className="flex items-center gap-2 text-xs">
                      <Switch checked={flow.isActive} aria-label={`Ativar fluxo ${flow.name}`} onCheckedChange={() => toggleFlow(flow.id)} />
                      <span>{flow.isActive ? "Ativo" : "Pausado"}</span>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => { setSelectedFlowId(flow.id); setSubtab("builder"); }} className="min-h-[44px] sm:min-h-[38px] text-xs">
                      Abrir no Builder
                    </Button>
                    <Button type="button" size="sm" disabled={runningId === flow.id} onClick={() => void runFlowNow(flow)} className="min-h-[44px] sm:min-h-[38px] gap-1.5 text-xs">
                      <Play className="h-3.5 w-3.5" /><span>Executar Agora</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row md:items-center gap-2 overflow-x-auto pb-1 touch-pan-x">
                  {flow.nodes.map((node, index) => (
                    <React.Fragment key={node.id}>
                      <div className="rounded-xl border bg-muted/30 p-3 min-w-[200px] flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-foreground">{node.title}</span>
                          <CheckpointIcon status={node.checkpointStatus} />
                        </div>
                        <p className="text-[11px] text-muted-foreground">{node.subtitle}</p>
                      </div>
                      {index < flow.nodes.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 self-center rotate-90 md:rotate-0" />}
                    </React.Fragment>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      <FlowNodeInspectorSheet
        open={inspectorOpen}
        onOpenChange={setInspectorOpen}
        node={inspectorNode}
        onSaveNode={handleSaveInspectorNode}
        onDeleteNode={handleDeleteNode}
      />
    </div>
  );
};
