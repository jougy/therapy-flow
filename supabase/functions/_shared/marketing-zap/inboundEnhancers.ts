/**
 * Inbound Enhancers: Burst message coalescing, WhatsApp audio transcription, and Triple Agenda reconciliation.
 */

import { executeUpstashCommand } from '../schedule-cache.ts';
import { ingestToAxiom } from '../telemetry-axiom.ts';

export async function coalesceBurstMessages(
  phone: string,
  msgId: string,
  text: string,
  debounceSec: number,
): Promise<{ proceed: boolean; combinedText: string }> {
  if (debounceSec <= 0 || !Deno.env.get('UPSTASH_REDIS_REST_URL')) {
    return { proceed: true, combinedText: text };
  }

  try {
    const bufKey = `zap:buf:${phone}`;
    const lastKey = `zap:buf:last:${phone}`;

    await executeUpstashCommand(['RPUSH', bufKey, text]);
    await executeUpstashCommand(['EXPIRE', bufKey, 30]);
    await executeUpstashCommand(['SET', lastKey, msgId, 'EX', 30]);

    const waitMs = Math.min(6, debounceSec) * 1000;
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    const currentLast = await executeUpstashCommand(['GET', lastKey]);
    if (currentLast !== msgId) {
      return { proceed: false, combinedText: '' };
    }

    const items = (await executeUpstashCommand(['LRANGE', bufKey, 0, -1])) as string[];
    await executeUpstashCommand(['DEL', bufKey]);

    const combinedText = Array.isArray(items) && items.length > 0 ? items.join('\n') : text;
    return { proceed: true, combinedText };
  } catch (_err) {
    return { proceed: true, combinedText: text };
  }
}

export async function transcribeInboundAudio(
  msgContent: Record<string, unknown>,
  payloadData: Record<string, unknown>,
  instanceKey: string,
  evoCall: (
    path: string,
    method: 'GET' | 'POST' | 'DELETE',
    body?: unknown,
  ) => Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>,
): Promise<string | null> {
  if (!msgContent.audioMessage) return null;

  try {
    const mediaRes = await evoCall(
      `/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceKey)}`,
      'POST',
      { message: { key: payloadData.key } },
    );

    if (!mediaRes.ok || !mediaRes.data) {
      return '[Áudio recebido — transcrição indisponível]';
    }

    const dataObj = mediaRes.data as Record<string, unknown>;
    const base64 = String(dataObj.base64 || dataObj.base64Data || '');
    if (!base64) return '[Áudio recebido — transcrição indisponível]';

    const groqKey = Deno.env.get('GROQ_API_KEY');
    if (groqKey) {
      try {
        const binStr = atob(base64.includes(',') ? base64.split(',')[1] : base64);
        const len = binStr.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binStr.charCodeAt(i);
        }

        const formData = new FormData();
        formData.append('file', new Blob([bytes], { type: 'audio/ogg' }), 'audio.ogg');
        formData.append('model', 'whisper-large-v3-turbo');
        formData.append('language', 'pt');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        let resp: Response;
        try {
          resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqKey}` },
            body: formData,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (resp.ok) {
          const json = (await resp.json()) as { text?: string };
          if (json.text && json.text.trim()) {
            return json.text.trim();
          }
        }
      } catch (_e) {
        // Fallback to Gemini
      }
    }

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (geminiKey) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      let gResp: Response;
      try {
        gResp = await fetch(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': geminiKey,
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inlineData: {
                        mimeType: 'audio/ogg',
                        data: base64.includes(',') ? base64.split(',')[1] : base64,
                      },
                    },
                    {
                      text: 'Transcreva este áudio em Português do Brasil apenas com o texto falado.',
                    },
                  ],
                },
              ],
            }),
            signal: controller.signal,
          },
        );
      } finally {
        clearTimeout(timeoutId);
      }

      if (gResp.ok) {
        const gJson = (await gResp.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const txt = gJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt && txt.trim()) {
          return txt.trim();
        }
      }
    }
  } catch (_err) {
    // Fail-safe
  }

  return '[Áudio recebido — transcrição indisponível]';
}

export async function reconcileAutoLeadAndTripleAgenda(
  admin: any,
  senderPhone: string,
  intent: string,
  contactName: string,
): Promise<void> {
  if (!intent || intent === 'opt_out') return;

  try {
    const last8 = senderPhone.slice(-8);
    if (!last8) return;

    const { data: lead } = await admin
      .from('platform_auto_leads')
      .select('id, stage')
      .ilike('phone', `%${last8}`)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle();

    if (lead?.id) {
      const currentStage = String(lead.stage || 'new');
      let nextStage: string | null = null;
      if (intent === 'schedule_demo' && currentStage !== 'converted_trial') {
        nextStage = 'meeting_scheduled';
      } else if ((intent === 'pricing' || intent === 'qualified') && currentStage === 'new') {
        nextStage = 'qualified';
      } else if (['new', 'qualified', 'assigned', 'contacted'].includes(currentStage)) {
        nextStage = 'replied';
      }

      if (nextStage && nextStage !== currentStage) {
        await admin
          .from('platform_auto_leads')
          .update({ stage: nextStage, updated_at: new Date().toISOString() })
          .eq('id', lead.id);
      }
    }

    void ingestToAxiom([
      {
        level: 'info',
        service: 'pluri-marketing-zap-gateway',
        route: 'triple_agenda_sync',
        message: 'Reconciled lead intent',
        metadata: {
          intent,
          hasLeadMatch: Boolean(lead?.id),
          contactNameLen: contactName.length,
        },
      },
    ]);
  } catch (_err) {
    // Fail-safe
  }
}
