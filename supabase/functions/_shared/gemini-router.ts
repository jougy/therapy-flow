/**
 * Roteador Gemini Tiered (Pluri Growth OS) para Deno Edge Functions.
 *
 * Camada 0: gemini-decision-1 (POST /v1beta/decisions) — 0 output tokens
 * Camada 1: gemini-3.5-flash-lite (POST /v1/interactions) — alta vazão / custo mínimo
 * Camada 2: gemini-4-hydrogen (POST /v1/interactions) — conversa consultiva stateful
 *
 * Inclui Budget Circuit Breaker diário no Upstash Redis e telemetria sem PII no Axiom.
 */

import { executeUpstashCommand } from './schedule-cache.ts';
import { ingestToAxiom } from './telemetry-axiom.ts';

export type GeminiModelTier =
  | 'gemini-decision-1'
  | 'gemini-3.5-flash-lite'
  | 'gemini-4-hydrogen'
  | 'gemma-4-local';

export type MarketingIntent =
  | 'opt_out'
  | 'handoff_human'
  | 'pricing'
  | 'schedule_demo'
  | 'product_question'
  | 'greeting'
  | 'spam_or_unrelated';

export interface ClassifyIntentResult {
  intent: MarketingIntent;
  confidence: number;
  usedFallback: boolean;
}

export interface ConverseAgentParams {
  modelTier: GeminiModelTier;
  systemPrompt: string;
  knowledgeBase?: string;
  userMessage: string;
  previousInteractionId?: string | null;
  maxChars?: number;
  tenantScope?: string;
}

export interface ConverseAgentResult {
  reply: string;
  interactionId: string | null;
  modelUsed: string;
  usedFallback: boolean;
}

const OPT_OUT_REGEX =
  /\b(sair|parar|pare|stop|cancelar|descadastrar|nao quero|não quero|nao tenho interesse|não tenho interesse|tirar da lista|remover)\b/i;

const HANDOFF_REGEX =
  /\b(humano|atendente|pessoa|vendedor|suporte|ligar|ligação|fechar plano|assinar agora)\b/i;

const PRICING_REGEX = /\b(preço|preco|valor|custa|plano|mensalidade|quanto|desconto)\b/i;
const SCHEDULE_REGEX = /\b(agendar|demo|demonstração|demonstracao|reunião|reuniao|horário|horario|mostrar)\b/i;

export function classifyIntentDeterministic(text: string): ClassifyIntentResult {
  const normalized = (text || '').trim();
  if (OPT_OUT_REGEX.test(normalized)) {
    return { intent: 'opt_out', confidence: 0.99, usedFallback: true };
  }
  if (HANDOFF_REGEX.test(normalized)) {
    return { intent: 'handoff_human', confidence: 0.92, usedFallback: true };
  }
  if (SCHEDULE_REGEX.test(normalized)) {
    return { intent: 'schedule_demo', confidence: 0.88, usedFallback: true };
  }
  if (PRICING_REGEX.test(normalized)) {
    return { intent: 'pricing', confidence: 0.88, usedFallback: true };
  }
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|tudo bem)[!?. ]*$/i.test(normalized)) {
    return { intent: 'greeting', confidence: 0.9, usedFallback: true };
  }
  return { intent: 'product_question', confidence: 0.72, usedFallback: true };
}

function getGeminiApiKey(): string {
  return (Deno.env.get('GEMINI_API_KEY') || '').trim();
}

async function checkDailyBudgetAndMaybeDowngrade(
  requestedModel: GeminiModelTier,
  tenantScope = 'platform',
): Promise<{ allow: boolean; resolvedModel: string }> {
  const dayKey = new Date().toISOString().slice(0, 10);
  const counterKey = `marketing:gemini:calls:${tenantScope}:${dayKey}`;
  const current = await executeUpstashCommand(['INCR', counterKey]);
  if (current === 1) {
    void executeUpstashCommand(['EXPIRE', counterKey, 90000]);
  }

  const dailyCap = Number(Deno.env.get('MARKETING_GEMINI_DAILY_CAP') || '2500');
  const count = typeof current === 'number' ? current : 0;

  if (count > dailyCap) {
    return { allow: false, resolvedModel: 'gemini-3.5-flash-lite' };
  }

  if (requestedModel === 'gemma-4-local') {
    return { allow: true, resolvedModel: 'gemini-3.5-flash-lite' };
  }

  if (count >= Math.floor(dailyCap * 0.8) && requestedModel === 'gemini-4-hydrogen') {
    return { allow: true, resolvedModel: 'gemini-3.5-flash-lite' };
  }

  return { allow: true, resolvedModel: requestedModel };
}

export async function classifyMarketingIntent(text: string): Promise<ClassifyIntentResult> {
  const deterministic = classifyIntentDeterministic(text);
  if (deterministic.intent === 'opt_out') {
    return deterministic;
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return deterministic;
  }

  try {
    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/decisions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'gemini-decision-1',
        input: text.slice(0, 1200),
        questions: {
          intent: {
            type: 'choice',
            instructions: 'Classify the WhatsApp lead message intent into the single best category.',
            criteria: {
              opt_out: 'Lead asks to stop receiving messages or expresses clear refusal.',
              handoff_human: 'Lead explicitly asks to speak with a human agent or support.',
              schedule_demo: 'Lead wants to book a demo, call, or meeting.',
              pricing: 'Lead asks about prices, plans, or discounts.',
              product_question: 'Lead asks how the physiotherapy/clinic software works.',
              greeting: 'Short greeting without specific question yet.',
              spam_or_unrelated: 'Spam, automated message, or unrelated to healthcare software.',
            },
          },
        },
      }),
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) {
      return deterministic;
    }

    const data = (await res.json()) as {
      answers?: {
        intent?: {
          choice?: MarketingIntent;
          confidence?: number;
        };
      };
    };

    const choice = data?.answers?.intent?.choice;
    const confidence = Number(data?.answers?.intent?.confidence ?? 0.8);
    if (choice) {
      return { intent: choice, confidence, usedFallback: false };
    }
  } catch {
    // Fallback determinístico preserva resiliência
  }

  return deterministic;
}

function buildDeterministicReply(
  intent: MarketingIntent,
  maxChars: number,
): string {
  const replies: Record<MarketingIntent, string> = {
    opt_out:
      'Entendido! Já removemos seu contato da nossa lista de comunicações. Desculpe qualquer incômodo e ótimo trabalho por aí!',
    handoff_human:
      'Perfeito! Vou transferir agora seu atendimento para nossa equipe comercial no WhatsApp (11) 98011-3936 para te ajudar diretamente.',
    pricing:
      'Temos planos pensados para autônomos e clínicas completas, com teste grátis para você conhecer o prontuário SOAP, agenda e cobranças. Quer que eu te envie o link da demonstração de 10 minutos?',
    schedule_demo:
      'Ótimo! Qual o melhor dia e período (manhã ou tarde) para fazermos uma demonstração rápida de 10 minutos do Pluri Fisio para a sua rotina?',
    product_question:
      'O Pluri Fisio reúne prontuário SOAP, escala EVA, assinatura digital de termos, agenda multi-turno e gestão financeira em um único lugar mobile-first. Hoje você atende sozinho ou com equipe?',
    greeting:
      'Olá! Tudo bem? Sou o assistente da Pluri Fisio. Hoje você já usa algum sistema para prontuário e agenda ou ainda controla em planilhas?',
    spam_or_unrelated:
      'Olá! Agradeço o contato. Caso precise conhecer o sistema Pluri Fisio para clínicas e fisioterapeutas, fico à disposição!',
  };

  return replies[intent].slice(0, maxChars);
}

export async function converseMarketingAgent(
  params: ConverseAgentParams,
): Promise<ConverseAgentResult> {
  const maxChars = Math.max(80, Math.min(2000, params.maxChars || 450));
  const intentRes = await classifyMarketingIntent(params.userMessage);
  const apiKey = getGeminiApiKey();

  const budget = await checkDailyBudgetAndMaybeDowngrade(
    params.modelTier,
    params.tenantScope || 'platform',
  );

  if (!apiKey || !budget.allow) {
    return {
      reply: buildDeterministicReply(intentRes.intent, maxChars),
      interactionId: params.previousInteractionId ?? null,
      modelUsed: 'deterministic-fallback',
      usedFallback: true,
    };
  }

  const startedAt = Date.now();
  const modelToUse =
    budget.resolvedModel === 'gemini-decision-1' ? 'gemini-3.5-flash-lite' : budget.resolvedModel;

  const systemInstruction = [
    params.systemPrompt,
    params.knowledgeBase ? `Base de conhecimento oficial:\n${params.knowledgeBase}` : '',
    `Regras de formatação: responda em português do Brasil, tom humano de WhatsApp, no máximo ${maxChars} caracteres, sem markdown pesado nem invenção de dados.`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const payload: Record<string, unknown> = {
      model: modelToUse,
      input: params.userMessage.slice(0, 2000),
      system_instruction: systemInstruction,
      generation_config: {
        max_output_tokens: Math.min(600, Math.ceil(maxChars / 2) + 80),
        temperature: 0.45,
      },
    };

    if (params.previousInteractionId) {
      payload.previous_interaction_id = params.previousInteractionId;
    }

    const res = await fetch('https://generativelanguage.googleapis.com/v1/interactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      return {
        reply: buildDeterministicReply(intentRes.intent, maxChars),
        interactionId: params.previousInteractionId ?? null,
        modelUsed: `${modelToUse}-fallback`,
        usedFallback: true,
      };
    }

    const data = (await res.json()) as {
      id?: string;
      output_text?: string;
      outputs?: Array<{ type?: string; text?: string }>;
    };

    const rawText =
      data.output_text ||
      (Array.isArray(data.outputs)
        ? data.outputs
            .filter((o) => typeof o?.text === 'string')
            .map((o) => o.text)
            .join('\n')
        : '');

    const cleanReply = (rawText || buildDeterministicReply(intentRes.intent, maxChars))
      .trim()
      .slice(0, maxChars);

    void ingestToAxiom([
      {
        level: 'info',
        service: 'pluri-marketing-gemini-router',
        route: 'marketing-zap-gateway',
        message: 'Gemini marketing reply generated',
        metadata: {
          model: modelToUse,
          intent: intentRes.intent,
          latency_ms: Date.now() - startedAt,
          stateful: Boolean(params.previousInteractionId),
        },
      },
    ]);

    return {
      reply: cleanReply,
      interactionId: data.id || params.previousInteractionId || null,
      modelUsed: modelToUse,
      usedFallback: false,
    };
  } catch {
    return {
      reply: buildDeterministicReply(intentRes.intent, maxChars),
      interactionId: params.previousInteractionId ?? null,
      modelUsed: `${modelToUse}-fallback`,
      usedFallback: true,
    };
  }
}
