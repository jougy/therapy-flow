/**
 * Edge Function: marketing-flow-runner
 *
 * Executa fluxos DAG reais (marketing_flows) seguindo graph_edges,
 * avaliação condicional if_else sobre context_state, nós de IA (invokeUniversalLlm),
 * WhatsApp Evolution API, HTTP com proteção SSRF estrita, Kanban, Grupos e checkpoints human_approval.
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders } from '../_shared/cors.ts';
import { invokeUniversalLlm } from '../_shared/llm-gateway.ts';
import { checkRateLimit, rateLimitExceededResponse } from '../_shared/rate-limit.ts';
import { reportError } from '../_shared/error-dedup.ts';
import {
  DEFAULT_FALLBACK_CHAIN,
  DEFAULT_PROVIDER_CONFIG,
  normalizePhoneBr,
  resolveAgentLlmSetup,
} from '../_shared/marketing-zap/llmAndDiagnosticsHandlers.ts';

interface DagNode {
  id: string;
  type: string;
  title?: string;
  config?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

interface DagEdge {
  id?: string;
  source: string;
  target: string;
  sourceHandle?: string;
  label?: string;
  condition?: unknown;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function getNodeConfig(node: DagNode): Record<string, unknown> {
  return { ...(node.data || {}), ...(node.config || {}) };
}

function interpolateTemplate(template: string, ctx: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, path: string) => {
    const val = path.split('.').reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, ctx);
    return val !== undefined && val !== null ? String(val) : '';
  });
}

function evaluateIfElse(cfg: Record<string, unknown>, ctx: Record<string, unknown>): boolean {
  const field = String(cfg.field || cfg.left || '').trim();
  const op = String(cfg.operator || cfg.op || 'truthy').trim().toLowerCase();
  const expected = cfg.value ?? cfg.right;
  const actual = field
    ? field.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), ctx)
    : ctx;

  if (op === 'exists') return actual !== undefined && actual !== null && actual !== '';
  if (op === 'truthy') return Boolean(actual);
  if (op === 'eq' || op === '==' || op === '===') return String(actual ?? '') === String(expected ?? '');
  if (op === 'neq' || op === '!=' || op === '!==') return String(actual ?? '') !== String(expected ?? '');
  if (op === 'gt' || op === '>') return Number(actual) > Number(expected);
  if (op === 'gte' || op === '>=') return Number(actual) >= Number(expected);
  if (op === 'lt' || op === '<') return Number(actual) < Number(expected);
  if (op === 'lte' || op === '<=') return Number(actual) <= Number(expected);
  if (op === 'contains') return String(actual ?? '').toLowerCase().includes(String(expected ?? '').toLowerCase());
  return Boolean(actual);
}

function isBlockedIpAddress(ip: string): boolean {
  const clean = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (!clean) return true;
  if (clean === '::1' || clean === '::' || clean.startsWith('fe80:') || clean.startsWith('fc') || clean.startsWith('fd')) {
    return true;
  }
  const v4 = clean.startsWith('::ffff:') ? clean.slice(7) : clean;
  const parts = v4.split('.');
  if (parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p))) {
    const [a, b] = parts.map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
  }
  return false;
}

async function assertSafeExternalUrl(rawUrl: string): Promise<{ safe: boolean; url?: URL; reason?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'URL inválida.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { safe: false, reason: 'Protocolo não permitido; use HTTP ou HTTPS.' };
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata' ||
    /^\d+$/.test(host) ||
    /^0x[0-9a-f]+$/i.test(host) ||
    isBlockedIpAddress(host)
  ) {
    return { safe: false, reason: 'Host/IP bloqueado pela política anti-SSRF.' };
  }

  try {
    const resolver = (Deno as unknown as { resolveDns?: (q: string, t: 'A' | 'AAAA') => Promise<string[]> }).resolveDns;
    if (typeof resolver === 'function') {
      const [v4, v6] = await Promise.all([
        resolver(host, 'A').catch(() => []),
        resolver(host, 'AAAA').catch(() => []),
      ]);
      for (const ip of [...v4, ...v6]) {
        if (isBlockedIpAddress(ip)) {
          return { safe: false, reason: 'DNS resolveu para IP privado/bloqueado (anti-SSRF).' };
        }
      }
    }
  } catch {
    // Segue se resolveDns não estiver disponível no runtime
  }
  return { safe: true, url: parsed };
}

function selectOutgoingTargets(
  node: DagNode,
  edges: DagEdge[],
  branchResult?: boolean,
): string[] {
  const outgoing = edges.filter((e) => e.source === node.id);
  if (outgoing.length === 0) return [];
  if (node.type === 'if_else' && typeof branchResult === 'boolean') {
    const wanted = branchResult ? ['true', 'yes', 'sim', 'if'] : ['false', 'no', 'nao', 'não', 'else'];
    const matching = outgoing.filter((e) => {
      const tag = String(e.sourceHandle || e.label || e.condition || '').trim().toLowerCase();
      return wanted.includes(tag) || (typeof e.condition === 'boolean' && e.condition === branchResult);
    });
    if (matching.length > 0) return matching.map((e) => e.target);
    return branchResult ? [outgoing[0].target] : outgoing[1] ? [outgoing[1].target] : [];
  }
  return outgoing.map((e) => e.target);
}

async function executeNode(
  admin: SupabaseClient,
  node: DagNode,
  ctx: Record<string, unknown>,
  tenantScope: string,
  clinicId: string | null,
): Promise<{ status: 'completed' | 'waiting_approval' | 'failed'; branchResult?: boolean; tokensDelta?: number; meta?: Record<string, unknown>; error?: string }> {
  const cfg = getNodeConfig(node);
  const type = node.type;

  if (type === 'human_approval') {
    return { status: 'waiting_approval', meta: { paused_at: new Date().toISOString() } };
  }

  if (type.startsWith('trigger_')) {
    ctx.triggered_at = new Date().toISOString();
    return { status: 'completed', meta: { trigger_type: type } };
  }

  if (type === 'if_else') {
    const branchResult = evaluateIfElse(cfg, ctx);
    ctx.last_branch = branchResult;
    return { status: 'completed', branchResult, meta: { branchResult } };
  }

  if (type === 'delay_wait') {
    const delayMs = Math.min(2000, Math.max(0, Number(cfg.delay_ms || Number(cfg.delay_sec || 0) * 1000 || 0)));
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    return { status: 'completed', meta: { waited_ms: delayMs } };
  }

  if (type === 'ai_agent' || type === 'ai_agent_gemini') {
    let agentRow: Record<string, unknown> | null = null;
    if (cfg.agent_id) {
      const { data } = await admin.from('marketing_ai_agents').select('*').eq('id', String(cfg.agent_id)).maybeSingle();
      agentRow = (data as Record<string, unknown>) || null;
    }
    const setup = agentRow
      ? await resolveAgentLlmSetup(admin, agentRow)
      : { provider: DEFAULT_PROVIDER_CONFIG, modelId: String(cfg.model_id || DEFAULT_PROVIDER_CONFIG.defaultModel), disableThinking: true, fallbackChain: DEFAULT_FALLBACK_CHAIN };

    const promptText = interpolateTemplate(
      String(cfg.prompt || cfg.message || ctx.inbound_text || 'Gere uma mensagem consultiva curta para fisioterapeuta sobre o Pluri Fisio.'),
      ctx,
    );
    const res = await invokeUniversalLlm({
      provider: setup.provider,
      modelId: setup.modelId,
      systemPrompt: String(cfg.system_prompt || agentRow?.system_prompt || 'Você é o estrategista SDR do Pluri Fisio. Responda em PT-BR.'),
      messages: [{ role: 'user', content: promptText }],
      disableThinking: true,
      fallbackChain: setup.fallbackChain,
      maxTokens: Number(cfg.max_tokens || 350),
      tenantScope,
      route: 'marketing-flow-runner',
    });
    const outKey = String(cfg.output_key || 'ai_reply');
    ctx[outKey] = res.text;
    ctx.last_model_used = res.modelUsed;
    const tokensDelta = Math.ceil((promptText.length + res.text.length) / 4);
    return { status: 'completed', tokensDelta, meta: { modelUsed: res.modelUsed, usedFallback: res.usedFallback, outputKey: outKey } };
  }

  if (type === 'send_whatsapp' || type === 'zap_enqueue_cadence') {
    const phone = normalizePhoneBr(String(cfg.phone_e164 || ctx.phone_e164 || ctx.phone || ''));
    const text = interpolateTemplate(String(cfg.message || cfg.text || ctx.ai_reply || ''), ctx).trim();
    if (!phone || !text) {
      return { status: 'completed', meta: { skipped: 'missing_phone_or_text' } };
    }
    let optQ = admin.from('marketing_opt_outs').select('id').eq('tenant_scope', tenantScope).eq('phone_e164', phone);
    optQ = clinicId ? optQ.eq('clinic_id', clinicId) : optQ.is('clinic_id', null);
    const { data: optedOut } = await optQ.maybeSingle();
    if (optedOut) return { status: 'completed', meta: { blocked_optout: true, phone } };

    const evoUrl = (Deno.env.get('EVOLUTION_API_URL') || '').trim().replace(/\/+$/, '');
    const evoKey = (Deno.env.get('EVOLUTION_API_KEY') || '').trim();
    const instanceKey = String(cfg.instance_key || ctx.instance_key || 'pluri-mkt-5511965120431');
    let sentLive = false;
    if (evoUrl && evoKey) {
      const r = await fetch(`${evoUrl}/message/sendText/${encodeURIComponent(instanceKey)}`, {
        method: 'POST',
        headers: { apikey: evoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: phone, text }),
        signal: AbortSignal.timeout(8000),
      });
      sentLive = r.ok;
    }
    if (ctx.conversation_id) {
      await admin.from('marketing_zap_messages').insert({
        conversation_id: String(ctx.conversation_id),
        direction: 'outbound',
        sender_role: 'flow',
        message_type: 'text',
        body_text: text,
      });
    }
    return { status: 'completed', meta: { phone, sentLive } };
  }

  if (type === 'http_request') {
    const rawUrl = interpolateTemplate(String(cfg.url || ''), ctx).trim();
    const check = await assertSafeExternalUrl(rawUrl);
    if (!check.safe || !check.url) {
      return { status: 'failed', error: check.reason || 'URL bloqueada por política SSRF.' };
    }
    const method = String(cfg.method || 'POST').toUpperCase();
    const reqHeaders = (cfg.headers && typeof cfg.headers === 'object' ? cfg.headers : {}) as Record<string, string>;
    const bodyPayload = cfg.body !== undefined && !['GET', 'HEAD'].includes(method)
      ? typeof cfg.body === 'string'
        ? interpolateTemplate(cfg.body, ctx)
        : JSON.stringify(cfg.body)
      : undefined;

    try {
      const resp = await fetch(check.url.toString(), {
        method,
        headers: { 'Content-Type': 'application/json', ...reqHeaders },
        body: bodyPayload,
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
      const rawText = (await resp.text()).slice(0, 4000);
      let parsedBody: unknown = rawText;
      try {
        parsedBody = JSON.parse(rawText);
      } catch {
        // Texto puro
      }
      ctx[String(cfg.output_key || 'http_response')] = { status: resp.status, ok: resp.ok, data: parsedBody };
      return { status: 'completed', meta: { httpStatus: resp.status, ok: resp.ok } };
    } catch (err) {
      return { status: 'failed', error: err instanceof Error ? err.message.slice(0, 160) : 'HTTP request failed' };
    }
  }

  if (type === 'move_kanban_stage') {
    const stage = String(cfg.funnel_stage || cfg.stage || 'qualified');
    const validStages = ['lead', 'contacted', 'qualified', 'proposal', 'scheduled', 'won', 'opt_out'];
    if (!validStages.includes(stage)) return { status: 'failed', error: `Estágio inválido: ${stage}` };
    const convId = String(cfg.conversation_id || ctx.conversation_id || '').trim();
    const phone = normalizePhoneBr(String(cfg.phone_e164 || ctx.phone_e164 || ''));
    if (convId) {
      await admin.from('marketing_zap_conversations').update({ funnel_stage: stage }).eq('id', convId);
    } else if (phone) {
      await admin.from('marketing_zap_conversations').update({ funnel_stage: stage }).eq('phone_e164', phone).is('deleted_at', null);
    }
    ctx.funnel_stage = stage;
    return { status: 'completed', meta: { funnel_stage: stage } };
  }

  if (type === 'group_action') {
    const jobType = String(cfg.job_type || 'broadcast_group');
    const groupJid = String(cfg.group_jid || ctx.group_jid || '').trim();
    const instanceKey = String(cfg.instance_key || ctx.instance_key || 'pluri-mkt-5511965120431').trim();
    const { data: inst } = await admin.from('marketing_whatsapp_instances').select('id, tenant_scope, clinic_id').eq('instance_key', instanceKey).maybeSingle();
    if (inst?.id && groupJid) {
      const scheduledFor = new Date(Date.now() + 25000).toISOString();
      await admin.from('marketing_group_jobs').insert({
        tenant_scope: String(inst.tenant_scope || tenantScope),
        clinic_id: inst.clinic_id || clinicId,
        instance_id: inst.id,
        group_jid: groupJid,
        job_type: ['extract_members', 'add_participants', 'remove_participants', 'broadcast_group'].includes(jobType) ? jobType : 'broadcast_group',
        status: 'queued',
        payload: cfg.payload || { message: interpolateTemplate(String(cfg.message || ''), ctx) },
        scheduled_for: scheduledFor,
      });
    }
    return { status: 'completed', meta: { enqueued: Boolean(inst?.id && groupJid), jobType } };
  }

  return { status: 'completed', meta: { nodeType: type } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuração Supabase ausente.' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return json({ error: 'Não autenticado.' }, 401);

  const userId = userData.user.id;
  const [ownerRes, mktRes, flagRes] = await Promise.all([
    admin.rpc('is_platform_owner', { _user_id: userId }),
    admin.rpc('is_platform_marketing', { _user_id: userId }),
    admin.rpc('has_platform_flag', { _flag: 'marketing', _user_id: userId }),
  ]);
  if (!ownerRes.data && !mktRes.data && !flagRes.data) {
    return json({ error: 'Acesso restrito ao Marketing/Plataforma.' }, 403);
  }

  try {
    const rl = await checkRateLimit({
      preset: 'marketing_flow_run',
      identifier: userId,
      service: 'marketing-flow-runner',
      route: 'run_flow',
    });
    if (!rl.allowed) return rateLimitExceededResponse(rl, corsHeaders);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const runId = String(body.run_id || '').trim();
  let flowId = String(body.flow_id || '').trim();
  let existingRun: Record<string, unknown> | null = null;

  if (runId) {
    const { data } = await admin.from('marketing_flow_runs').select('*').eq('id', runId).maybeSingle();
    if (!data) return json({ error: 'Execução de fluxo não encontrada.' }, 404);
    existingRun = data as Record<string, unknown>;
    flowId = String(existingRun.flow_id);
  }
  if (!flowId) return json({ error: 'flow_id ou run_id é obrigatório.' }, 400);

  const { data: flow, error: flowErr } = await admin.from('marketing_flows').select('*').eq('id', flowId).is('deleted_at', null).single();
  if (flowErr || !flow) return json({ error: 'Fluxo não encontrado.' }, 404);

  const nodes = (Array.isArray(flow.graph_nodes) ? flow.graph_nodes : []) as DagNode[];
  const rawEdges = (Array.isArray(flow.graph_edges) ? flow.graph_edges : []) as Array<Record<string, unknown>>;
  const edges: DagEdge[] = rawEdges.map((e) => ({
    id: e.id ? String(e.id) : undefined,
    source: String(e.source || e.from || ''),
    target: String(e.target || e.to || ''),
    sourceHandle: e.sourceHandle ? String(e.sourceHandle) : undefined,
    label: e.label ? String(e.label) : undefined,
    condition: e.condition,
  })).filter((e) => e.source && e.target);

  const nodeMap = new Map(nodes.map((n) => [String(n.id), n]));
  const checkpoints: Record<string, unknown> = existingRun?.node_checkpoints
    ? { ...(existingRun.node_checkpoints as Record<string, unknown>) }
    : {};
  const ctx: Record<string, unknown> = existingRun?.context_state
    ? { ...(existingRun.context_state as Record<string, unknown>), ...(body.context_state as Record<string, unknown> | undefined) }
    : { ...((body.context_state || body.initial_context || {}) as Record<string, unknown>) };

  let tokensUsed = Number(existingRun?.tokens_used || 0);
  let finalStatus: 'completed' | 'waiting_approval' | 'failed' = 'completed';
  let currentNodeId: string | null = existingRun?.current_node_id ? String(existingRun.current_node_id) : null;

  let queue: string[] = [];
  if (existingRun && currentNodeId) {
    if (body.approved === false) {
      checkpoints[currentNodeId] = { status: 'rejected', rejected_at: new Date().toISOString() };
      const { data: rejectedRun } = await admin
        .from('marketing_flow_runs')
        .update({ status: 'failed', node_checkpoints: checkpoints, context_state: ctx, finished_at: new Date().toISOString() })
        .eq('id', existingRun.id)
        .select('*')
        .single();
      return json({ success: true, run: rejectedRun });
    }
    const resumedNode = nodeMap.get(currentNodeId);
    checkpoints[currentNodeId] = { status: 'completed', approved_at: new Date().toISOString() };
    if (resumedNode) {
      queue = edges.length > 0
        ? selectOutgoingTargets(resumedNode, edges)
        : (() => {
            const idx = nodes.findIndex((n) => n.id === currentNodeId);
            return idx >= 0 && nodes[idx + 1] ? [nodes[idx + 1].id] : [];
          })();
    }
  } else if (nodes.length > 0) {
    if (edges.length > 0) {
      const targetIds = new Set(edges.map((e) => e.target));
      const roots = nodes.filter((n) => n.type.startsWith('trigger_') || !targetIds.has(n.id));
      queue = roots.length > 0 ? [roots[0].id] : [nodes[0].id];
    } else {
      queue = [nodes[0].id];
    }
  }

  const visited = new Set<string>(Object.keys(checkpoints).filter((k) => {
    const cp = checkpoints[k] as { status?: string } | undefined;
    return cp?.status === 'completed';
  }));
  const maxSteps = Math.max(nodes.length * 3, 50);
  let steps = 0;

  while (queue.length > 0 && steps < maxSteps) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    const node = nodeMap.get(id);
    if (!node) continue;
    steps++;
    currentNodeId = id;

    const outcome = await executeNode(admin, node, ctx, String(flow.tenant_scope || 'platform'), (flow.clinic_id as string | null) || null);
    tokensUsed += outcome.tokensDelta || 0;

    if (outcome.status === 'waiting_approval') {
      checkpoints[id] = { status: 'waiting_approval', reached_at: new Date().toISOString(), ...(outcome.meta || {}) };
      finalStatus = 'waiting_approval';
      break;
    }

    if (outcome.status === 'failed') {
      checkpoints[id] = { status: 'failed', error: outcome.error, failed_at: new Date().toISOString() };
      finalStatus = 'failed';
      break;
    }

    visited.add(id);
    checkpoints[id] = { status: 'completed', executed_at: new Date().toISOString(), ...(outcome.meta || {}) };

    if (edges.length > 0) {
      const nextTargets = selectOutgoingTargets(node, edges, outcome.branchResult);
      for (const t of nextTargets) {
        if (!visited.has(t)) queue.push(t);
      }
    } else {
      const idx = nodes.findIndex((n) => n.id === id);
      if (idx >= 0 && nodes[idx + 1] && !visited.has(nodes[idx + 1].id)) {
        queue.push(nodes[idx + 1].id);
      }
    }
  }

  const runPayload = {
    flow_id: flow.id,
    status: finalStatus,
    current_node_id: currentNodeId,
    context_state: ctx,
    node_checkpoints: checkpoints,
    tokens_used: tokensUsed,
    finished_at: finalStatus === 'waiting_approval' ? null : new Date().toISOString(),
  };

  const { data: runRow } = existingRun
    ? await admin.from('marketing_flow_runs').update(runPayload).eq('id', existingRun.id).select('*').single()
    : await admin.from('marketing_flow_runs').insert(runPayload).select('*').single();

  return json({ success: true, run: runRow });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await reportError({
      service: 'marketing-flow-runner',
      level: 'critical',
      code: 'edge_unhandled_500',
      route: 'marketing-flow-runner',
      message,
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { user_id: userId },
    });
    return json({ error: message || 'Erro interno no runner de fluxos.' }, 500);
  }
});
