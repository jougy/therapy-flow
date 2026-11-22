import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { classifyIntentDeterministic } from '../gemini-router.ts';
import { invokeUniversalLlm } from '../llm-gateway.ts';
import { executeUpstashCommand } from '../schedule-cache.ts';
import {
  matchActiveKeywordTrigger,
  normalizePhoneBr,
  resolveAgentLlmSetup,
  runCompactionForConversation,
  sha256Hex,
  type CallEvolutionFn,
  type ZapHandlerContext,
} from './llmAndDiagnosticsHandlers.ts';

async function resolveInstance(admin: SupabaseClient, instanceId?: string, instanceKey?: string) {
  const q = admin.from('marketing_whatsapp_instances').select('*').is('deleted_at', null);
  const { data } = instanceId
    ? await q.eq('id', instanceId).maybeSingle()
    : await q.eq('instance_key', (instanceKey || 'pluri-mkt-5511965120431').trim()).maybeSingle();
  return data as Record<string, unknown> | null;
}

async function isPhoneOptedOut(admin: SupabaseClient, phone: string, tenantScope = 'platform', clinicId?: string | null): Promise<boolean> {
  let q = admin.from('marketing_opt_outs').select('id').eq('tenant_scope', tenantScope).eq('phone_e164', phone);
  q = clinicId ? q.eq('clinic_id', clinicId) : q.is('clinic_id', null);
  const { data } = await q.maybeSingle();
  return Boolean(data);
}

async function dispatchEvolutionMessage(
  callEvolution: CallEvolutionFn,
  instanceKey: string,
  phone: string,
  text: string,
  mediaPayload?: Record<string, unknown>,
): Promise<{ ok: boolean; msgType: 'text' | 'image' | 'audio_ptt' | 'document' | 'video'; mediaUrl: string | null }> {
  const mediaType = String(mediaPayload?.mediaType || mediaPayload?.media_type || 'none');
  const mediaUrl = String(mediaPayload?.mediaUrl || mediaPayload?.media_url || '').trim() || null;
  const caption = String(mediaPayload?.caption || text || '').trim();
  const key = encodeURIComponent(instanceKey);

  if (mediaType === 'audio_ptt' && mediaUrl) {
    const res = await callEvolution(`/message/sendWhatsAppAudio/${key}`, 'POST', { number: phone, audio: mediaUrl, encoding: true });
    return { ok: res.ok, msgType: 'audio_ptt', mediaUrl };
  }
  if (mediaUrl && ['image', 'document', 'video'].includes(mediaType)) {
    const res = await callEvolution(`/message/sendMedia/${key}`, 'POST', { number: phone, mediatype: mediaType, media: mediaUrl, caption });
    return { ok: res.ok, msgType: mediaType as 'image' | 'document' | 'video', mediaUrl };
  }
  const res = await callEvolution(`/message/sendText/${key}`, 'POST', { number: phone, text });
  return { ok: res.ok, msgType: 'text', mediaUrl: null };
}

function extractArrayData(raw: unknown, nestedKeys: string[] = ['data', 'groups', 'participants', 'contacts']): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    for (const key of nestedKeys) {
      if (Array.isArray(obj[key])) return obj[key] as Array<Record<string, unknown>>;
    }
  }
  return [];
}

export async function handleValidateNumbersBatch({ admin, body, callEvolution, getEvolutionConfig, json }: ZapHandlerContext): Promise<Response> {
  const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
  const rawNumbers = Array.isArray(body.numbers) ? body.numbers : [];
  const normalized = Array.from(new Set(rawNumbers.map((n) => normalizePhoneBr(String(n || ''))).filter((n) => n.length >= 10))).slice(0, 500);
  if (normalized.length === 0) return json({ success: true, results: [], fromCacheCount: 0, checkedLiveCount: 0 });

  const instanceRow = await resolveInstance(admin, undefined, instanceKey);
  const tenantScope = String(instanceRow?.tenant_scope || 'platform');
  const clinicId = (instanceRow?.clinic_id as string | null) || null;
  const nowIso = new Date().toISOString();

  let cacheQ = admin.from('marketing_number_validations').select('phone_e164, exists_on_whatsapp, whatsapp_jid, verified_name, checked_at, expires_at').eq('tenant_scope', tenantScope).in('phone_e164', normalized);
  cacheQ = clinicId ? cacheQ.eq('clinic_id', clinicId) : cacheQ.is('clinic_id', null);
  const { data: existingRows } = await cacheQ;

  const resultMap = new Map<string, Record<string, unknown>>();
  const expiredPhones = new Set<string>();
  for (const row of (existingRows || []) as Array<Record<string, unknown>>) {
    const phone = String(row.phone_e164);
    if (String(row.expires_at || '') > nowIso) {
      resultMap.set(phone, { phoneE164: phone, existsOnWhatsapp: Boolean(row.exists_on_whatsapp), whatsappJid: row.whatsapp_jid || null, verifiedName: row.verified_name || null, fromCache: true, checkedAt: row.checked_at });
    } else {
      expiredPhones.add(phone);
    }
  }

  const fromCacheCount = resultMap.size;
  const misses = normalized.filter((p) => !resultMap.has(p));
  const evo = getEvolutionConfig();
  let checkedLiveCount = 0;

  if (misses.length > 0 && evo.configured) {
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < misses.length; i += 50) {
      const batch = misses.slice(i, i + 50);
      const res = await callEvolution(`/chat/whatsappNumbers/${encodeURIComponent(instanceKey)}`, 'POST', { numbers: batch });
      const liveMap = new Map<string, Record<string, unknown>>();
      for (const item of extractArrayData(res.data, ['data', 'numbers', 'result'])) {
        const key = normalizePhoneBr(String(item.number || String(item.jid || '').split('@')[0] || ''));
        if (key) liveMap.set(key, item);
      }

      const toInsert: Array<Record<string, unknown>> = [];
      for (const phone of batch) {
        const match = liveMap.get(phone);
        const exists = Boolean(match?.exists);
        const jid = match?.jid ? String(match.jid) : exists ? `${phone}@s.whatsapp.net` : null;
        const verifiedName = match?.name ? String(match.name) : null;
        checkedLiveCount++;
        resultMap.set(phone, { phoneE164: phone, existsOnWhatsapp: exists, whatsappJid: jid, verifiedName, fromCache: false, checkedAt: nowIso });

        const payloadRow = { tenant_scope: tenantScope, clinic_id: clinicId, phone_e164: phone, exists_on_whatsapp: exists, whatsapp_jid: jid, verified_name: verifiedName, checked_by_instance_id: instanceRow?.id || null, checked_at: nowIso, expires_at: expiresAt };
        if (expiredPhones.has(phone)) {
          let upd = admin.from('marketing_number_validations').update(payloadRow).eq('tenant_scope', tenantScope).eq('phone_e164', phone);
          upd = clinicId ? upd.eq('clinic_id', clinicId) : upd.is('clinic_id', null);
          await upd;
        } else {
          toInsert.push(payloadRow);
        }
      }
      if (toInsert.length > 0) await admin.from('marketing_number_validations').insert(toInsert);
    }
  }

  return json({
    success: true,
    configured: evo.configured,
    results: normalized.map((p) => resultMap.get(p) || { phoneE164: p, existsOnWhatsapp: false, fromCache: false, checkedAt: nowIso }),
    fromCacheCount,
    checkedLiveCount,
  });
}

export async function handleSendPushAlert({ admin, body, callEvolution, getEvolutionConfig, json }: ZapHandlerContext): Promise<Response> {
  const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
  const phone = normalizePhoneBr(String(body.phone_e164 || body.phone || ''));
  const messageText = String(body.message_text || body.message || '').trim();
  const mediaPayload = (body.media_payload as Record<string, unknown> | undefined) || undefined;
  if (!phone || (!messageText && !mediaPayload?.mediaUrl && !mediaPayload?.media_url)) {
    return json({ error: 'phone_e164 e message_text ou media_payload são obrigatórios.' }, 400);
  }

  const instanceRow = await resolveInstance(admin, undefined, instanceKey);
  if (await isPhoneOptedOut(admin, phone, String(instanceRow?.tenant_scope || 'platform'), (instanceRow?.clinic_id as string | null) || null)) {
    return json({ success: false, blocked_optout: true, error: 'Contato bloqueado por Opt-Out LGPD.' }, 409);
  }

  const evo = getEvolutionConfig();
  let msgType: 'text' | 'image' | 'audio_ptt' | 'document' | 'video' = 'text';
  let mediaUrl: string | null = null;
  if (evo.configured) {
    const sent = await dispatchEvolutionMessage(callEvolution, instanceKey, phone, messageText, mediaPayload);
    msgType = sent.msgType;
    mediaUrl = sent.mediaUrl;
  }

  const { data: conv } = await admin.from('marketing_zap_conversations').select('id').eq('phone_e164', phone).is('deleted_at', null).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  if (conv?.id) {
    const preview = (messageText || String(mediaPayload?.caption || '[Alerta PushZap]')).slice(0, 240);
    await admin.from('marketing_zap_messages').insert({ conversation_id: conv.id, direction: 'outbound', sender_role: 'system', message_type: msgType, body_text: messageText || preview, media_object_key: mediaUrl });
    await admin.from('marketing_zap_conversations').update({ last_message_preview: preview, last_message_direction: 'outbound' }).eq('id', conv.id);
  }
  return json({ success: true, sent: evo.configured, phone_e164: phone });
}

export async function handleSyncWhatsappGroups({ admin, body, callEvolution, getEvolutionConfig, json }: ZapHandlerContext): Promise<Response> {
  const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
  const instanceRow = await resolveInstance(admin, undefined, instanceKey);
  if (!instanceRow) return json({ error: 'Instância WhatsApp não encontrada.' }, 404);

  const evo = getEvolutionConfig();
  if (!evo.configured) {
    const { data: existing } = await admin.from('marketing_whatsapp_groups').select('*').eq('instance_id', instanceRow.id).order('participants_count', { ascending: false });
    return json({ success: true, configured: false, groups: existing || [] });
  }

  const res = await callEvolution(`/group/fetchAllGroups/${encodeURIComponent(instanceKey)}?getParticipants=true`, 'GET');
  const nowIso = new Date().toISOString();
  const rows = extractArrayData(res.data, ['groups', 'data']).map((g) => {
    const groupJid = String(g.id || g.jid || '').trim();
    if (!groupJid) return null;
    const participants = Array.isArray(g.participants) ? (g.participants as Array<Record<string, unknown>>) : [];
    return {
      tenant_scope: String(instanceRow.tenant_scope || 'platform'),
      clinic_id: instanceRow.clinic_id || null,
      instance_id: instanceRow.id,
      group_jid: groupJid,
      subject: String(g.subject || 'Grupo WhatsApp'),
      participants_count: Number(g.size || participants.length || 0),
      is_admin: Boolean(g.isAdmin || participants.some((p) => p.admin === 'admin' || p.admin === 'superadmin')),
      invite_code: g.inviteCode ? String(g.inviteCode) : null,
      participants_sample: participants.slice(0, 50).map((p) => ({ id: String(p.id || p.jid || ''), admin: p.admin ? String(p.admin) : null })),
      last_synced_at: nowIso,
    };
  }).filter((r): r is NonNullable<typeof r> => r !== null);

  if (rows.length > 0) await admin.from('marketing_whatsapp_groups').upsert(rows, { onConflict: 'instance_id,group_jid' });
  const { data: groups } = await admin.from('marketing_whatsapp_groups').select('*').eq('instance_id', instanceRow.id).order('participants_count', { ascending: false });
  return json({ success: true, configured: true, groups: groups || rows });
}

export async function handleExtractGroupMembers({ admin, body, callEvolution, getEvolutionConfig, json }: ZapHandlerContext): Promise<Response> {
  const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
  const groupJid = String(body.group_jid || '').trim();
  if (!groupJid) return json({ error: 'group_jid é obrigatório.' }, 400);

  const instanceRow = await resolveInstance(admin, undefined, instanceKey);
  const evo = getEvolutionConfig();
  let rawParticipants: Array<Record<string, unknown>> = [];

  if (evo.configured) {
    const res = await callEvolution(`/group/participants/${encodeURIComponent(instanceKey)}?groupJid=${encodeURIComponent(groupJid)}`, 'GET');
    rawParticipants = extractArrayData(res.data, ['participants', 'data']);
  } else if (instanceRow?.id) {
    const { data: groupRow } = await admin.from('marketing_whatsapp_groups').select('participants_sample').eq('instance_id', instanceRow.id).eq('group_jid', groupJid).maybeSingle();
    rawParticipants = Array.isArray(groupRow?.participants_sample) ? (groupRow.participants_sample as Array<Record<string, unknown>>) : [];
  }

  const { data: optOuts } = await admin.from('marketing_opt_outs').select('phone_e164').eq('tenant_scope', String(instanceRow?.tenant_scope || 'platform'));
  const optOutSet = new Set((optOuts || []).map((o: { phone_e164?: string | null }) => normalizePhoneBr(String(o.phone_e164))));
  const deduped = new Map<string, Record<string, unknown>>();
  let filteredOptOutCount = 0;

  for (const p of rawParticipants) {
    const rawId = String(p.id || p.jid || p.phoneNumber || '');
    const phone = normalizePhoneBr(rawId.split('@')[0]);
    if (!phone || phone.length < 10) continue;
    if (optOutSet.has(phone)) { filteredOptOutCount++; continue; }
    if (!deduped.has(phone)) {
      deduped.set(phone, { phone_e164: phone, jid: rawId || `${phone}@s.whatsapp.net`, admin: p.admin ? String(p.admin) : null, name: String(p.name || p.pushName || '') });
    }
  }
  return json({ success: true, members: Array.from(deduped.values()), totalRaw: rawParticipants.length, filteredOptOutCount });
}

export async function handleEnqueueGroupAction({ admin, body, json }: ZapHandlerContext): Promise<Response> {
  const jobType = String(body.job_type || body.action_type || '').trim();
  const allowed = ['add_participants', 'remove_participants', 'broadcast_group'];
  if (!allowed.includes(jobType)) return json({ error: `job_type inválido. Permitidos: ${allowed.join(', ')}` }, 400);

  const groupJid = String(body.group_jid || '').trim();
  if (!groupJid) return json({ error: 'group_jid é obrigatório.' }, 400);

  const instanceRow = await resolveInstance(admin, body.instance_id ? String(body.instance_id) : undefined, body.instance_key ? String(body.instance_key) : undefined);
  if (!instanceRow) return json({ error: 'Instância WhatsApp não encontrada.' }, 404);

  const safeDelayMs = (20 + Math.floor(Math.random() * 40)) * 1000;
  const requestedTime = body.scheduled_for ? Date.parse(String(body.scheduled_for)) : 0;
  const scheduledFor = new Date(Math.max(Date.now() + safeDelayMs, requestedTime || 0)).toISOString();
  const payload = body.payload && typeof body.payload === 'object'
    ? (body.payload as Record<string, unknown>)
    : { participants: Array.isArray(body.participants) ? body.participants : [], message: String(body.message || '') };

  const { data: job, error } = await admin.from('marketing_group_jobs').insert({
    tenant_scope: String(instanceRow.tenant_scope || 'platform'),
    clinic_id: instanceRow.clinic_id || null,
    instance_id: instanceRow.id,
    group_jid: groupJid,
    job_type: jobType,
    status: 'queued',
    payload,
    scheduled_for: scheduledFor,
  }).select('*').single();

  if (error) return json({ error: error.message }, 400);
  return json({ success: true, job });
}

export async function handleSyncWhatsappContacts({ body, callEvolution, getEvolutionConfig, json }: ZapHandlerContext): Promise<Response> {
  const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
  if (!getEvolutionConfig().configured) return json({ success: true, configured: false, contacts: [] });

  const res = await callEvolution(`/chat/findContacts/${encodeURIComponent(instanceKey)}`, 'POST', { where: (body.where as Record<string, unknown>) || {} });
  const dedup = new Map<string, Record<string, unknown>>();
  for (const c of extractArrayData(res.data, ['contacts', 'data'])) {
    const jid = String(c.remoteJid || c.id || '');
    if (!jid || jid.includes('@g.us')) continue;
    const phone = normalizePhoneBr(jid.split('@')[0]);
    if (!phone || phone.length < 10 || dedup.has(phone)) continue;
    dedup.set(phone, { phone_e164: phone, jid, name: String(c.pushName || c.name || c.verifiedName || phone), profile_pic_url: c.profilePicUrl ? String(c.profilePicUrl) : null });
  }
  return json({ success: true, configured: true, contacts: Array.from(dedup.values()) });
}

export async function handleSendHumanReply({ admin, body, callEvolution, getEvolutionConfig, json }: ZapHandlerContext): Promise<Response> {
  const conversationId = String(body.conversation_id || '').trim();
  const messageText = String(body.message_text || body.text || '').trim();
  const mediaPayload = (body.media_payload as Record<string, unknown> | undefined) || undefined;
  if (!conversationId || (!messageText && !mediaPayload?.mediaUrl && !mediaPayload?.media_url)) {
    return json({ error: 'conversation_id e message_text ou media_payload são obrigatórios.' }, 400);
  }

  const { data: conv } = await admin.from('marketing_zap_conversations').select('*').eq('id', conversationId).is('deleted_at', null).maybeSingle();
  if (!conv) return json({ error: 'Conversa não encontrada.' }, 404);

  const instanceRow = await resolveInstance(admin, conv.instance_id ? String(conv.instance_id) : undefined, body.instance_key ? String(body.instance_key) : undefined);
  const instanceKey = String(instanceRow?.instance_key || body.instance_key || 'pluri-mkt-5511965120431');
  const evo = getEvolutionConfig();
  let msgType: 'text' | 'image' | 'audio_ptt' | 'document' | 'video' = 'text';
  let mediaUrl: string | null = null;
  if (evo.configured) {
    const sent = await dispatchEvolutionMessage(callEvolution, instanceKey, String(conv.phone_e164), messageText, mediaPayload);
    msgType = sent.msgType;
    mediaUrl = sent.mediaUrl;
  }

  const preview = (messageText || String(mediaPayload?.caption || '[Mídia enviada]')).slice(0, 240);
  const { data: savedMsg } = await admin.from('marketing_zap_messages').insert({
    conversation_id: conv.id, direction: 'outbound', sender_role: 'human', message_type: msgType, body_text: messageText || preview, media_object_key: mediaUrl,
  }).select('*').single();

  await admin.from('marketing_zap_conversations').update({ agent_mode: 'human', unread_count: 0, last_message_preview: preview, last_message_direction: 'outbound' }).eq('id', conv.id);
  return json({ success: true, sent: evo.configured, message: savedMsg });
}

export async function handleSyncTypebotBinding({ admin, body, callEvolution, getEvolutionConfig, json }: ZapHandlerContext): Promise<Response> {
  const name = String(body.name || '').trim();
  const typebotPublicId = String(body.typebot_public_id || '').trim();
  if (!name || !typebotPublicId) return json({ error: 'name e typebot_public_id são obrigatórios.' }, 400);

  const instanceRow = await resolveInstance(admin, body.instance_id ? String(body.instance_id) : undefined, body.instance_key ? String(body.instance_key) : undefined);
  const recordPayload = {
    tenant_scope: String(instanceRow?.tenant_scope || body.tenant_scope || 'platform'),
    clinic_id: instanceRow?.clinic_id || null,
    instance_id: instanceRow?.id || null,
    name,
    typebot_base_url: String(body.typebot_base_url || 'https://typebot.io').trim(),
    typebot_public_id: typebotPublicId,
    trigger_type: String(body.trigger_type || 'keyword') === 'all' ? 'all' : 'keyword',
    trigger_operator: String(body.trigger_operator || 'contains'),
    trigger_value: String(body.trigger_value || ''),
    delay_message_ms: Number(body.delay_message_ms ?? 1200),
    simulate_typing: body.simulate_typing !== false,
    simulate_recording: body.simulate_recording !== false,
    debounce_seconds: Number(body.debounce_seconds ?? 8),
    keyword_finish: String(body.keyword_finish || '#sair'),
    clone_source_url: body.clone_source_url ? String(body.clone_source_url) : null,
    is_active: body.is_active !== false,
  };

  const bindingId = String(body.id || '').trim();
  const { data: binding, error } = bindingId
    ? await admin.from('marketing_typebot_bindings').update(recordPayload).eq('id', bindingId).select('*').single()
    : await admin.from('marketing_typebot_bindings').insert(recordPayload).select('*').single();
  if (error || !binding) return json({ error: error?.message || 'Erro ao salvar Typebot.' }, 400);

  let syncedToEvolution = false;
  if (getEvolutionConfig().configured && instanceRow?.instance_key) {
    const evoRes = await callEvolution(`/typebot/create/${encodeURIComponent(String(instanceRow.instance_key))}`, 'POST', {
      enabled: recordPayload.is_active, url: recordPayload.typebot_base_url, typebot: recordPayload.typebot_public_id,
      triggerType: recordPayload.trigger_type, triggerOperator: recordPayload.trigger_operator, triggerValue: recordPayload.trigger_value,
      delayMessage: recordPayload.delay_message_ms, keywordFinish: recordPayload.keyword_finish, debounceTime: recordPayload.debounce_seconds, listeningFromMe: false,
    });
    syncedToEvolution = evoRes.ok;
  }
  return json({ success: true, binding, syncedToEvolution });
}

export async function handleWebhookAndroidBridge({ admin, body, req, json }: ZapHandlerContext): Promise<Response> {
  const providedSecret = (req.headers.get('x-android-bridge-secret') || String(body.bridge_secret || '')).trim();
  const envSecret = (Deno.env.get('ANDROID_BRIDGE_SECRET') || '').trim();
  const requireSecret = (Deno.env.get('REQUIRE_WEBHOOK_SECRET') || '').trim().toLowerCase() === 'true';

  const instanceKey = String(body.instance_key || body.instance || 'pluri-mkt-5511965120431').trim();
  const instanceRow = await resolveInstance(admin, undefined, instanceKey);
  const instanceSecret = String(((instanceRow?.anti_ban_config as Record<string, unknown> | undefined)?.bridge_secret) || '').trim();

  if (envSecret && providedSecret !== envSecret) return json({ error: 'x-android-bridge-secret inválido.' }, 401);
  if (!envSecret && instanceSecret && providedSecret !== instanceSecret) return json({ error: 'Segredo da instância Android Bridge inválido.' }, 401);
  if (!envSecret && !instanceSecret && requireSecret) return json({ error: 'ANDROID_BRIDGE_SECRET obrigatório não configurado.' }, 401);

  const senderPhone = normalizePhoneBr(String(body.phone_e164 || body.sender || body.from || ''));
  const inboundText = String(body.message_text || body.text || body.message || '').trim();
  if (!senderPhone || !inboundText) return json({ error: 'phone_e164 e message_text são obrigatórios.' }, 400);

  const msgId = String(body.message_id || `${instanceKey}:${senderPhone}:${inboundText.slice(0, 24)}`);
  const dedup = await executeUpstashCommand(['SET', `zap:mob:${msgId}`, '1', 'NX', 'EX', 3600]);
  if (dedup === null && Deno.env.get('UPSTASH_REDIS_REST_URL')) return json({ success: true, deduplicated: true });

  const tenantScope = String(instanceRow?.tenant_scope || 'platform');
  const clinicId = (instanceRow?.clinic_id as string | null) || null;
  const det = classifyIntentDeterministic(inboundText);

  if (det.intent === 'opt_out') {
    const phoneHash = await sha256Hex(senderPhone);
    await executeUpstashCommand(['SADD', 'marketing:optout', phoneHash]);
    if (!(await isPhoneOptedOut(admin, senderPhone, tenantScope, clinicId))) {
      await admin.from('marketing_opt_outs').insert({ tenant_scope: tenantScope, clinic_id: clinicId, phone_e164: senderPhone, phone_hash: phoneHash, reason: 'android_bridge_opt_out', source_channel: 'android_bridge' });
    }
    return json({ success: true, reply_text: 'Entendido! Já removemos seu contato da nossa lista.', save_contact: false, handoff: false, opt_out: true });
  }

  const { data: existingConv } = await admin.from('marketing_zap_conversations').select('*').eq('phone_e164', senderPhone).is('deleted_at', null).order('updated_at', { ascending: false }).limit(1).maybeSingle();
  const { data: conv } = await admin.from('marketing_zap_conversations').upsert({
    id: existingConv?.id, tenant_scope: tenantScope, clinic_id: clinicId, instance_id: instanceRow?.id || null, phone_e164: senderPhone,
    contact_name: String(body.contact_name || existingConv?.contact_name || 'Lead MobZap'), last_message_preview: inboundText.slice(0, 240), last_message_direction: 'inbound', last_inbound_at: new Date().toISOString(),
  }).select('*').single();

  if (conv?.id) {
    await admin.from('marketing_zap_messages').insert({ conversation_id: conv.id, direction: 'inbound', sender_role: 'lead', message_type: 'text', body_text: inboundText, provider_message_id: msgId });
  }

  const trigger = await matchActiveKeywordTrigger(admin, inboundText, tenantScope, instanceRow?.id ? String(instanceRow.id) : null);
  if (trigger) {
    await admin.from('marketing_keyword_triggers').update({ hit_count: trigger.hit_count + 1 }).eq('id', trigger.id);
    const replyText = String(trigger.action_payload.text || trigger.action_payload.reply_text || '');
    if (conv?.id && replyText) {
      await admin.from('marketing_zap_messages').insert({ conversation_id: conv.id, direction: 'outbound', sender_role: 'system', message_type: 'text', body_text: replyText });
    }
    return json({ success: true, reply_text: replyText, save_contact: true, handoff: trigger.action_type === 'handoff_human', triggerHit: trigger.name });
  }

  const { data: agentRow } = await admin.from('marketing_ai_agents').select('*').eq('instance_id', instanceRow?.id || '').eq('is_active', true).is('deleted_at', null).limit(1).maybeSingle();
  const llmSetup = await resolveAgentLlmSetup(admin, (agentRow as Record<string, unknown>) || null);
  const { data: recentMsgs } = conv?.id
    ? await admin.from('marketing_zap_messages').select('direction, sender_role, body_text').eq('conversation_id', conv.id).eq('is_compacted', false).order('created_at', { ascending: true })
    : { data: [] };

  const history = ((recentMsgs || []) as Array<Record<string, unknown>>).map((m) => ({
    role: (m.sender_role === 'lead' || m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: String(m.body_text || ''),
  }));
  const sysParts = [
    String(agentRow?.system_prompt || 'Você é o consultor SDR do Pluri Fisio no WhatsApp. Seja cordial e objetivo.'),
    agentRow?.knowledge_base ? `Base:\n${String(agentRow.knowledge_base)}` : '',
    conv?.rolling_summary ? `Resumo anterior:\n${String(conv.rolling_summary)}` : '',
  ].filter(Boolean);

  const llmRes = await invokeUniversalLlm({
    provider: llmSetup.provider, modelId: llmSetup.modelId, systemPrompt: sysParts.join('\n\n'),
    messages: history.length > 0 ? history : [{ role: 'user', content: inboundText }],
    disableThinking: llmSetup.disableThinking, fallbackChain: llmSetup.fallbackChain,
    maxTokens: Math.min(500, Number(agentRow?.max_chars_per_reply || 450)), route: 'webhook-android-bridge',
  });

  const handoff = det.intent === 'handoff_human';
  if (conv?.id) {
    await admin.from('marketing_zap_messages').insert({ conversation_id: conv.id, direction: 'outbound', sender_role: 'ai', message_type: 'text', body_text: llmRes.text, model_used: llmRes.modelUsed });
    await admin.from('marketing_zap_conversations').update({ agent_id: agentRow?.id || null, agent_mode: handoff ? 'human' : 'ai', last_message_preview: llmRes.text.slice(0, 240), last_message_direction: 'outbound', ai_turns_count: Number(conv.ai_turns_count || 0) + 1 }).eq('id', conv.id);
    if (agentRow?.auto_compact_context !== false && (recentMsgs?.length || 0) + 1 > Number(agentRow?.max_context_messages || 8)) {
      await runCompactionForConversation(admin, conv as Record<string, unknown>, 4, llmSetup.provider);
    }
  }
  return json({ success: true, reply_text: llmRes.text, save_contact: true, handoff, modelUsed: llmRes.modelUsed, usedFallback: llmRes.usedFallback });
}
