/**
 * Workflow Router & Engine Dispatcher
 * 
 * Gerencia a tabela de roteamento de workflows (lida do Upstash Redis ou env)
 * e dispara a execução no motor ativo ou aceita steps de motores em drenagem.
 */

import { WorkflowEngine, WorkflowRoutingConfig, reportWorkflowTelemetry } from "./unified-contract.ts";

const DEFAULT_ROUTES: Record<string, WorkflowRoutingConfig> = {
  "agenda-reminder": {
    active_engine: "cloudflare",
    drain_engines: ["upstash"],
  },
  "marketing-dag": {
    active_engine: "inngest",
    drain_engines: ["upstash"],
  },
  "asaas-payment-saga": {
    active_engine: "upstash",
    drain_engines: [],
  },
};

export function getWorkflowRoute(workflowId: string): WorkflowRoutingConfig {
  const customConfig = Deno.env.get(`WORKFLOW_ROUTE_${workflowId.toUpperCase().replace(/-/g, "_")}`);
  if (customConfig) {
    try {
      return JSON.parse(customConfig) as WorkflowRoutingConfig;
    } catch {
      // Fallback
    }
  }
  return DEFAULT_ROUTES[workflowId] || { active_engine: "upstash", drain_engines: [] };
}

export function isEngineAccepting(workflowId: string, engine: WorkflowEngine): boolean {
  const route = getWorkflowRoute(workflowId);
  return route.active_engine === engine || (route.drain_engines?.includes(engine) ?? false);
}
