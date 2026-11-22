import type { SupabaseClient } from '@supabase/supabase-js';
import { generateWarmupAudioBase64, sendAudioPtt } from './audioPtt.js';
import { generateWithFallback, type WorkerLlmProviderType } from './llmWorkerClient.js';

export type WarmupInteractionType =
  | 'text_chat'
  | 'media_reply'
  | 'audio_ptt'
  | 'reaction'
  | 'group_chat';

export interface WarmupJobPayload {
  sessionId: string;
}

export interface EvolutionTransportConfig {
  baseUrl: string;
  apiKey: string;
}

interface WarmupPoolRow {
  id: string;
  name: string;
  pool_mode: 'private_chips' | 'collaborative_optin';
  daily_interactions_target: number;
  enable_media: boolean;
  enable_audio_ptt: boolean;
  enable_reactions: boolean;
  enable_group_interactions: boolean;
  llm_provider_id: string | null;
  is_active: boolean;
}

interface WarmupInstanceRow {
  id: string;
  instance_key: string;
  phone_e164: string;
  status: string;
  warmup_pool_id: string | null;
  role_type: string;
}

const FALLBACK_OPENERS_PTBR = [
  'Bom dia! Conseguiu confirmar os horários da agenda de amanhã?',
  'Oi, tudo certo por aí? Só testando se o protocolo novo já subiu no sistema.',
  'Boa tarde! Depois me dá um retorno sobre aquele material de fisioterapia, por favor.',
  'E aí, tranquilo? Quando puder me avisa se o paciente das 15h confirmou.',
];

const FALLBACK_REPLIES_PTBR = [
  'Tudo ótimo por aqui! Já deixei anotado e confirmo ainda hoje.',
  'Perfeito, acabei de conferir e está tudo alinhado sim!',
  'Combinado, obrigado pelo aviso. Qualquer novidade te chamo aqui.',
];

const REACTION_EMOJIS = ['👍', '✅', '🙏', '👏'];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

async function generatePtBrDialogue(
  preferredProvider?: WorkerLlmProviderType,
): Promise<{ opener: string; reply: string }> {
  const chain: Array<{ provider: WorkerLlmProviderType }> = [
    ...(preferredProvider ? [{ provider: preferredProvider }] : []),
    { provider: 'opencode_free' },
    { provider: 'local_ollama' },
    { provider: 'gemini' },
    { provider: 'groq' },
  ];

  const systemPrompt =
    'Você gera micro-diálogos naturais e curtos em português do Brasil entre colegas de uma clínica de saúde. Responda APENAS em JSON válido {"opener":"...","reply":"..."} com no máximo 140 caracteres por fala.';
  const userPrompt = 'Gere um cumprimento casual e uma resposta curta e cordial do dia a dia.';

  const res = await generateWithFallback(chain, systemPrompt, userPrompt, {
    temperature: 0.8,
    maxTokens: 140,
    timeoutMs: 12_000,
  });

  if (res.ok && res.text) {
    try {
      const cleaned = res.text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned) as { opener?: string; reply?: string };
      if (parsed.opener && parsed.reply) {
        return {
          opener: parsed.opener.slice(0, 200),
          reply: parsed.reply.slice(0, 200),
        };
      }
    } catch {
      // fall through to curated PT-BR fallback
    }
  }

  return {
    opener: pickRandom(FALLBACK_OPENERS_PTBR),
    reply: pickRandom(FALLBACK_REPLIES_PTBR),
  };
}

async function sendTextMessage(
  evo: EvolutionTransportConfig,
  instanceKey: string,
  phoneE164: string,
  text: string,
): Promise<{ ok: boolean; messageId?: string; remoteJid?: string }> {
  const baseUrl = evo.baseUrl.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/message/sendText/${encodeURIComponent(instanceKey)}`, {
    method: 'POST',
    headers: {
      apikey: evo.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      number: phoneE164,
      text,
      delay: 1200,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) return { ok: false };
  try {
    const data = (await res.json()) as { key?: { id?: string; remoteJid?: string } };
    return { ok: true, messageId: data.key?.id, remoteJid: data.key?.remoteJid };
  } catch {
    return { ok: true };
  }
}

async function sendReaction(
  evo: EvolutionTransportConfig,
  instanceKey: string,
  remoteJid: string,
  messageId: string,
  emoji: string,
): Promise<boolean> {
  const baseUrl = evo.baseUrl.replace(/\/+$/, '');
  const res = await fetch(`${baseUrl}/message/sendReaction/${encodeURIComponent(instanceKey)}`, {
    method: 'POST',
    headers: {
      apikey: evo.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: {
        remoteJid,
        fromMe: false,
        id: messageId,
      },
      reaction: emoji,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  return res.ok;
}

/**
 * Planeja sessões diárias de aquecimento MultSender / MMZap PRO entre chips ativos do pool.
 */
export async function planWarmupSessionsForPool(
  supabase: SupabaseClient,
  poolId: string,
): Promise<{ planned: number }> {
  const { data: poolData } = await supabase
    .from('marketing_warmup_pools')
    .select('*')
    .eq('id', poolId)
    .eq('is_active', true)
    .is('deleted_at', null)
    .maybeSingle();

  const pool = poolData as WarmupPoolRow | null;
  if (!pool) return { planned: 0 };

  const { data: instancesData } = await supabase
    .from('marketing_whatsapp_instances')
    .select('id, instance_key, phone_e164, status, warmup_pool_id, role_type')
    .eq('status', 'connected')
    .is('deleted_at', null);

  const poolChips = ((instancesData || []) as WarmupInstanceRow[]).filter(
    (inst) => inst.warmup_pool_id === pool.id || inst.role_type === 'warmup_pool',
  );

  if (poolChips.length < 2) return { planned: 0 };

  const types: WarmupInteractionType[] = ['text_chat'];
  if (pool.enable_reactions) types.push('reaction');
  if (pool.enable_media) types.push('media_reply');
  if (pool.enable_audio_ptt) types.push('audio_ptt');

  const count = Math.min(pool.daily_interactions_target, 30);
  const rows: Array<Record<string, unknown>> = [];
  let cursorMs = Date.now() + 10_000;

  for (let i = 0; i < count; i++) {
    const sender = poolChips[i % poolChips.length];
    const receiver = poolChips[(i + 1 + (i % (poolChips.length - 1))) % poolChips.length];
    if (!sender || !receiver || sender.id === receiver.id) continue;

    cursorMs += (45 + Math.floor(Math.random() * 120)) * 1000;
    rows.push({
      pool_id: pool.id,
      sender_instance_id: sender.id,
      receiver_instance_id: receiver.id,
      interaction_type: types[i % types.length],
      status: 'queued',
      scheduled_for: new Date(cursorMs).toISOString(),
    });
  }

  if (rows.length === 0) return { planned: 0 };
  const { error } = await supabase.from('marketing_warmup_sessions').insert(rows);
  return { planned: error ? 0 : rows.length };
}

/**
 * Executa uma interação de aquecimento (texto, reação ou áudio PTT GrowSender) entre dois chips.
 */
export async function executeWarmupJob(
  supabase: SupabaseClient,
  evo: EvolutionTransportConfig,
  payload: WarmupJobPayload,
): Promise<{ status: 'sent' | 'replied' | 'skipped' | 'failed'; reason?: string }> {
  const { data: session } = await supabase
    .from('marketing_warmup_sessions')
    .select('id, pool_id, sender_instance_id, receiver_instance_id, interaction_type, status')
    .eq('id', payload.sessionId)
    .maybeSingle();

  if (!session || session.status !== 'queued') {
    return { status: 'skipped', reason: 'Session not queued' };
  }

  const [{ data: sender }, { data: receiver }, { data: pool }] = await Promise.all([
    supabase
      .from('marketing_whatsapp_instances')
      .select('id, instance_key, phone_e164, status')
      .eq('id', session.sender_instance_id)
      .maybeSingle(),
    supabase
      .from('marketing_whatsapp_instances')
      .select('id, instance_key, phone_e164, status')
      .eq('id', session.receiver_instance_id)
      .maybeSingle(),
    supabase
      .from('marketing_warmup_pools')
      .select('id, llm_provider_id')
      .eq('id', session.pool_id)
      .maybeSingle(),
  ]);

  if (!sender || !receiver || sender.status !== 'connected' || receiver.status !== 'connected') {
    await supabase
      .from('marketing_warmup_sessions')
      .update({ status: 'skipped', executed_at: new Date().toISOString() })
      .eq('id', session.id);
    return { status: 'skipped', reason: 'Sender or receiver instance disconnected' };
  }

  let preferredProvider: WorkerLlmProviderType | undefined;
  if (pool?.llm_provider_id) {
    const { data: llmRow } = await supabase
      .from('marketing_llm_providers')
      .select('provider_type')
      .eq('id', pool.llm_provider_id)
      .maybeSingle();
    if (llmRow?.provider_type) {
      preferredProvider = llmRow.provider_type as WorkerLlmProviderType;
    }
  }

  const dialogue = await generatePtBrDialogue(preferredProvider);
  let sentOk = false;
  let repliedOk = false;

  if (session.interaction_type === 'audio_ptt') {
    const pttBase64 = await generateWarmupAudioBase64(2);
    const pttResult = await sendAudioPtt({
      evolutionBaseUrl: evo.baseUrl,
      evolutionApiKey: evo.apiKey,
      instanceKey: sender.instance_key,
      phoneE164: receiver.phone_e164,
      audioBase64: pttBase64,
      simulateRecording: true,
    });
    sentOk = pttResult.ok;
    if (sentOk) {
      const replyRes = await sendTextMessage(
        evo,
        receiver.instance_key,
        sender.phone_e164,
        dialogue.reply,
      );
      repliedOk = replyRes.ok;
    }
  } else {
    const firstSend = await sendTextMessage(
      evo,
      sender.instance_key,
      receiver.phone_e164,
      dialogue.opener,
    );
    sentOk = firstSend.ok;

    if (sentOk && session.interaction_type === 'reaction' && firstSend.messageId) {
      const remoteJid = firstSend.remoteJid || `${sender.phone_e164}@s.whatsapp.net`;
      repliedOk = await sendReaction(
        evo,
        receiver.instance_key,
        remoteJid,
        firstSend.messageId,
        pickRandom(REACTION_EMOJIS),
      );
    } else if (sentOk) {
      const replySend = await sendTextMessage(
        evo,
        receiver.instance_key,
        sender.phone_e164,
        dialogue.reply,
      );
      repliedOk = replySend.ok;
    }
  }

  const finalStatus: 'replied' | 'sent' | 'failed' = repliedOk
    ? 'replied'
    : sentOk
      ? 'sent'
      : 'failed';

  await supabase
    .from('marketing_warmup_sessions')
    .update({
      status: finalStatus,
      executed_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  return { status: finalStatus };
}
