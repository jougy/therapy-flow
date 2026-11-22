export type MarketingFlowNodeType =
  | "trigger_auto_lead"
  | "trigger_schedule"
  | "trigger_whatsapp_inbound"
  | "trigger_webhook"
  | "ai_agent_gemini"
  | "studio_generate_static"
  | "studio_generate_reel"
  | "human_approval"
  | "zap_enqueue_cadence"
  | "send_whatsapp_media"
  | "condition_if_else"
  | "http_request"
  | "move_kanban_stage"
  | "group_action"
  | "delay_wait";

export interface MarketingFlowNode {
  id: string;
  type: MarketingFlowNodeType;
  title: string;
  subtitle: string;
  checkpointStatus?: "idle" | "completed" | "waiting_approval";
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
}

export interface MarketingFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface MarketingFlowTemplate {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  nodes: MarketingFlowNode[];
  edges?: MarketingFlowEdge[];
}

export interface NodePaletteItem {
  type: MarketingFlowNodeType;
  label: string;
  defaultTitle: string;
  defaultSubtitle: string;
  category: "trigger" | "ai" | "whatsapp" | "logic" | "studio";
  accentClass: string;
}

export const NODE_PALETTE_ITEMS: NodePaletteItem[] = [
  {
    type: "trigger_whatsapp_inbound",
    label: "Gatilho WhatsApp",
    defaultTitle: "Gatilho: Mensagem WhatsApp",
    defaultSubtitle: "Palavra-chave ou mensagem recebida",
    category: "trigger",
    accentClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    type: "trigger_webhook",
    label: "Gatilho Webhook",
    defaultTitle: "Gatilho: Webhook Entrada",
    defaultSubtitle: "POST JSON externo",
    category: "trigger",
    accentClass: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    type: "zap_enqueue_cadence",
    label: "Texto / Spintax",
    defaultTitle: "Enviar Texto / Spintax",
    defaultSubtitle: "Chip Anti-Ban + Jitter",
    category: "whatsapp",
    accentClass: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    type: "send_whatsapp_media",
    label: "Mídia / Áudio PTT",
    defaultTitle: "Enviar Mídia / Áudio PTT",
    defaultSubtitle: "Imagem, documento ou áudio gravado",
    category: "whatsapp",
    accentClass: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    type: "ai_agent_gemini",
    label: "Agente Multi-LLM",
    defaultTitle: "Agente Multi-LLM SDR",
    defaultSubtitle: "OpenCode Free / Gemini / Ollama",
    category: "ai",
    accentClass: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    type: "condition_if_else",
    label: "Condição If/Else",
    defaultTitle: "Condição If / Else",
    defaultSubtitle: "Desvio por intenção ou etapa",
    category: "logic",
    accentClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    type: "http_request",
    label: "Webhook HTTP",
    defaultTitle: "Requisição HTTP / API",
    defaultSubtitle: "POST/GET externo com JSON",
    category: "logic",
    accentClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    type: "move_kanban_stage",
    label: "Mover Kanban",
    defaultTitle: "Mover Etapa Kanban",
    defaultSubtitle: "Atualizar estágio no OmegaChat",
    category: "logic",
    accentClass: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    type: "group_action",
    label: "Grupo WhatsApp",
    defaultTitle: "Ação em Grupo WhatsApp",
    defaultSubtitle: "Extrair ou enviar p/ grupo",
    category: "whatsapp",
    accentClass: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    type: "human_approval",
    label: "Aprovação Humana",
    defaultTitle: "Aprovação Humana",
    defaultSubtitle: "Checkpoint com pausa segura",
    category: "logic",
    accentClass: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  {
    type: "delay_wait",
    label: "Delay / Aguardar",
    defaultTitle: "Aguardar Tempo / Jitter",
    defaultSubtitle: "Espera configurável entre passos",
    category: "logic",
    accentClass: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  {
    type: "studio_generate_static",
    label: "Carrossel Studio",
    defaultTitle: "Gerar Carrossel CrabStudio",
    defaultSubtitle: "Satori PNG sem custo de API",
    category: "studio",
    accentClass: "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  },
];

export const DEFAULT_FLOW_TEMPLATES: MarketingFlowTemplate[] = [
  {
    id: "flow-sdr-hunt",
    name: "Caça & Conversão SDR (Chip (11) 96512-0431)",
    description: "Captura Auto-Lead quente, gera quebra-gelo no Gemini e dispara cadência Anti-Ban.",
    isActive: true,
    nodes: [
      { id: "n1", type: "trigger_auto_lead", title: "Gatilho: Novo Auto-Lead", subtitle: "Score IA >= 75 + WhatsApp" },
      { id: "n2", type: "ai_agent_gemini", title: "Agente Icebreaker Gemini", subtitle: "gemini-3.5-flash-lite (Spintax)" },
      { id: "n3", type: "zap_enqueue_cadence", title: "Cadência Anti-Ban 3 Toques", subtitle: "Chip (11) 96512-0431 + Jitter" },
      { id: "n4", type: "delay_wait", title: "Reconciliação Agenda Tripla", subtitle: "Sincroniza Bot + Comercial" },
    ],
  },
  {
    id: "flow-weekly-content",
    name: "Fábrica Semanal de Conteúdo (CrabStudio)",
    description: "Toda segunda às 08h cria carrossel + Reel e pede aprovação antes de publicar.",
    isActive: false,
    nodes: [
      { id: "c1", type: "trigger_schedule", title: "Cron: Segunda às 08:00", subtitle: "Execução semanal automática" },
      { id: "c2", type: "ai_agent_gemini", title: "Estrategista Pluri Fisio", subtitle: "gemini-4-hydrogen" },
      { id: "c3", type: "studio_generate_static", title: "Carrossel Satori (5 Slides)", subtitle: "Custo R$ 0 + Brand Kit" },
      { id: "c4", type: "studio_generate_reel", title: "Carrossel → Reel 1080x1920", subtitle: "Edge-TTS + FFmpeg/Remotion" },
      { id: "c5", type: "human_approval", title: "Aprovação Humana (Telegram)", subtitle: "Pausa até seu OK" },
    ],
  },
  {
    id: "flow-cold-reactivation",
    name: "Reativação de Leads Frios (D+7)",
    description: "Retoma leads sem resposta há 7 dias respeitando Opt-Out LGPD.",
    isActive: false,
    nodes: [
      { id: "r1", type: "trigger_schedule", title: "Lead sem resposta há 7 dias", subtitle: "Filtro automático CRM" },
      { id: "r2", type: "ai_agent_gemini", title: "Follow-up Curto Lite", subtitle: "gemini-3.5-flash-lite" },
      { id: "r3", type: "zap_enqueue_cadence", title: "Disparo Suave Evolution", subtitle: "Chip (11) 96512-0431" },
    ],
  },
];
