import React, { memo, useCallback, useEffect, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { CheckCircle2, Clock, Play, Plus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NODE_PALETTE_ITEMS,
  type MarketingFlowEdge,
  type MarketingFlowNode,
  type MarketingFlowTemplate,
  type NodePaletteItem,
} from "./types";

export interface BotzomFlowCanvasProps {
  flow: MarketingFlowTemplate;
  onSelectNode: (node: MarketingFlowNode) => void;
  onAddNode: (item: NodePaletteItem, position?: { x: number; y: number }) => void;
  onSaveGraph: (nodes: MarketingFlowNode[], edges: MarketingFlowEdge[]) => void;
  onRunFlow: () => void;
}

const PALETTE_TOOLBAR_TYPES = new Set([
  "trigger_whatsapp_inbound",
  "zap_enqueue_cadence",
  "send_whatsapp_media",
  "ai_agent_gemini",
  "condition_if_else",
  "http_request",
  "move_kanban_stage",
  "group_action",
  "human_approval",
]);

const PALETTE_TOOLBAR_ITEMS = NODE_PALETTE_ITEMS.filter((item) =>
  PALETTE_TOOLBAR_TYPES.has(item.type),
);

const ACCENT_BY_TYPE: Record<string, string> = Object.fromEntries(
  NODE_PALETTE_ITEMS.map((i) => [i.type, i.accentClass]),
);

const BotzomNodeCard = memo(({ data, selected }: NodeProps) => {
  const flowNode = data?.flowNode as MarketingFlowNode | undefined;
  if (!flowNode) return null;

  const accent =
    ACCENT_BY_TYPE[flowNode.type] ||
    "border-primary/40 bg-primary/10 text-primary";
  const modelTag =
    typeof flowNode.config?.customModelId === "string" && flowNode.config.customModelId.trim()
      ? flowNode.config.customModelId
      : typeof flowNode.config?.modelId === "string"
        ? flowNode.config.modelId
        : null;

  return (
    <div
      className={`min-w-[210px] max-w-[250px] rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-all ${
        selected ? "ring-2 ring-primary border-primary" : "border-border hover:border-primary/50"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !bg-primary !border-2 !border-background"
      />
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1.5">
          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${accent}`}>
            {flowNode.type}
          </Badge>
          {flowNode.checkpointStatus === "completed" && (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          )}
          {flowNode.checkpointStatus === "waiting_approval" && (
            <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          )}
        </div>
        <p className="text-xs font-semibold text-foreground leading-snug">
          {flowNode.title}
        </p>
        <p className="text-[11px] text-muted-foreground leading-tight line-clamp-2">
          {flowNode.subtitle}
        </p>
        {modelTag && (
          <Badge variant="secondary" className="text-[9px] font-mono">
            {modelTag}
          </Badge>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
});
BotzomNodeCard.displayName = "BotzomNodeCard";

const nodeTypes: NodeTypes = {
  botzom: BotzomNodeCard,
};

function toRfNodes(flowNodes: MarketingFlowNode[]): Node[] {
  return flowNodes.map((fn, idx) => ({
    id: fn.id,
    type: "botzom",
    position: fn.position ?? { x: 40 + idx * 270, y: 90 + (idx % 2) * 70 },
    data: { flowNode: fn },
  }));
}

function toRfEdges(flow: MarketingFlowTemplate): Edge[] {
  if (flow.edges && flow.edges.length > 0) {
    return flow.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: true,
    }));
  }
  const auto: Edge[] = [];
  for (let i = 0; i < flow.nodes.length - 1; i++) {
    auto.push({
      id: `edge-${flow.nodes[i].id}-${flow.nodes[i + 1].id}`,
      source: flow.nodes[i].id,
      target: flow.nodes[i + 1].id,
      animated: true,
    });
  }
  return auto;
}

export const BotzomFlowCanvas: React.FC<BotzomFlowCanvasProps> = ({
  flow,
  onSelectNode,
  onAddNode,
  onSaveGraph,
  onRunFlow,
}) => {
  const initialNodes = useMemo(() => toRfNodes(flow.nodes), [flow.nodes]);
  const initialEdges = useMemo(() => toRfEdges(flow), [flow]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(toRfNodes(flow.nodes));
  }, [flow.nodes, setNodes]);

  useEffect(() => {
    setEdges(toRfEdges(flow));
  }, [flow, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true }, eds));
    },
    [setEdges],
  );

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, rfNode: Node) => {
      const flowNode = rfNode.data?.flowNode as MarketingFlowNode | undefined;
      if (flowNode) onSelectNode(flowNode);
    },
    [onSelectNode],
  );

  const handleSave = () => {
    const nextNodes: MarketingFlowNode[] = nodes.map((rfNode) => {
      const base = rfNode.data?.flowNode as MarketingFlowNode;
      return {
        ...base,
        position: rfNode.position,
      };
    });
    const nextEdges: MarketingFlowEdge[] = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: typeof e.label === "string" ? e.label : undefined,
    }));
    onSaveGraph(nextNodes, nextEdges);
  };

  return (
    <div data-testid="botzom-flow-canvas" className="space-y-3 w-full max-w-full min-w-0">
      {/* Node Palette Toolbar */}
      <div className="rounded-xl border bg-card p-2.5 flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-muted-foreground">
            Paleta Botzom — Clique para adicionar nó ao canvas ou clique num nó para editar:
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleSave}
              className="min-h-[38px] gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Salvar Grafo</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onRunFlow}
              className="min-h-[38px] gap-1.5 text-xs"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Executar Fluxo</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto touch-pan-x pb-1">
          {PALETTE_TOOLBAR_ITEMS.map((item) => (
            <Button
              key={item.type}
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onAddNode(item, {
                  x: 60 + nodes.length * 240,
                  y: 100 + (nodes.length % 2) * 80,
                })
              }
              className="min-h-[38px] shrink-0 text-[11px] gap-1"
            >
              <Plus className="h-3 w-3 text-primary" />
              <span>{item.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* React Flow Canvas */}
      <div className="h-[460px] w-full rounded-xl border bg-muted/15 overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={handleNodeClick}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </div>
  );
};

export default BotzomFlowCanvas;
