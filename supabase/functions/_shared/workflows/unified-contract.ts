/**
 * Unified Workflow Contract & Multi-Engine Router
 * 
 * Permite definir fluxos de trabalho (durable workflows) agnósticos de provedor.
 * Suporta roteamento dinâmico (Upstash, Cloudflare, Inngest) com migração A/B
 * e "draining" automático sem quebra de execução.
 * 
 * Telemetria: todo erro ou timeout é imediatamente reportado ao Axiom,
 * acionando alertas no Telegram e E-mail via dispatchAdminErrorAlert.
 */

import { ingestToAxiom } from "../telemetry-axiom.ts";
import { dispatchAdminErrorAlert } from "../error-alert.ts";
import { reportError } from "../error-dedup.ts";

export type WorkflowEngine = "upstash" | "cloudflare" | "inngest";

export interface WorkflowRoutingConfig {
  active_engine: WorkflowEngine;
  drain_engines?: WorkflowEngine[];
}

export interface UnifiedStepContext {
  run<T>(stepName: string, fn: () => Promise<T>): Promise<T>;
  sleep(stepName: string, durationSeconds: number | string): Promise<void>;
  sleepUntil(stepName: string, targetIsoOrTimestamp: string | number): Promise<void>;
  waitForEvent<T = unknown>(
    stepName: string,
    options: { eventName: string; timeoutSeconds?: number }
  ): Promise<T | null>;
}

export interface UnifiedWorkflowDefinition<TInput = Record<string, unknown>, TOutput = unknown> {
  id: string;
  name: string;
  defaultEngine: WorkflowEngine;
  execute: (ctx: { input: TInput; step: UnifiedStepContext }) => Promise<TOutput>;
}

export async function reportWorkflowTelemetry(params: {
  workflowId: string;
  runId: string;
  engine: WorkflowEngine;
  stepName?: string;
  status: "started" | "step_completed" | "completed" | "failed";
  durationMs?: number;
  error?: string;
  meta?: Record<string, unknown>;
}) {
  const timestamp = new Date().toISOString();

  // 1. Ingestão no Axiom
  await ingestToAxiom([
    {
      _time: timestamp,
      service: "unified-workflow-router",
      workflow_id: params.workflowId,
      run_id: params.runId,
      engine: params.engine,
      step_name: params.stepName || null,
      status: params.status,
      duration_ms: params.durationMs || 0,
      error: params.error || null,
      meta: params.meta || {},
    },
  ]).catch(() => {});

  // 2. Se falhar, deduplica e dispara alerta crítico no Telegram + E-mail
  if (params.status === "failed") {
    const errorMsg = `Workflow ${params.workflowId} (${params.engine}) falhou no step '${params.stepName || "root"}': ${params.error || "Erro desconhecido"}`;
    
    await reportError({
      message: errorMsg,
      service: `workflow-${params.engine}`,
      route: `/workflows/${params.workflowId}`,
      metadata: {
        workflow_id: params.workflowId,
        run_id: params.runId,
        engine: params.engine,
        step: params.stepName,
        meta: params.meta,
      },
    }).catch(() => {});

    await dispatchAdminErrorAlert({
      title: `🚨 Falha Crítica em Workflow: ${params.workflowId}`,
      message: errorMsg,
      service: `workflow-${params.engine}`,
      route: `/workflows/${params.workflowId}`,
      severity: "error",
      meta: {
        workflowId: params.workflowId,
        runId: params.runId,
        engine: params.engine,
        stepName: params.stepName,
        timestamp,
      },
    }).catch(() => {});
  }
}
