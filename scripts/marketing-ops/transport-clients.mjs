#!/usr/bin/env node
/**
 * Clientes leves Supabase REST & Evolution API v2 + normalização de telefone BR
 * para o ambiente marketing-ops (sem dependências extras além de Node 24 nativo).
 */

import { loadLocalMarketingEnv } from './media-engine.mjs';

export function normalizeBrPhone(raw = '') {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('55') && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function phoneSuffixes(raw = '') {
  const d = normalizeBrPhone(raw);
  return { full: d, last10: d.slice(-10), last8: d.slice(-8) };
}

export function resolveOpsCredentials() {
  const envFile = loadLocalMarketingEnv();
  const get = (k, fallback = '') => String(process.env[k] || envFile[k] || fallback).trim();
  const supabaseUrl = get('SUPABASE_URL') || get('VITE_SUPABASE_URL');
  const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY');
  const evoUrl = get('EVOLUTION_API_URL', 'http://127.0.0.1:8085').replace(/\/$/, '');
  const evoKey = get('EVOLUTION_API_KEY');
  const instanceKey = get('MARKETING_DEFAULT_INSTANCE_KEY', 'pluri-mkt-5511965120431');
  const launchCouponCode = get('PLURI_LAUNCH_COUPON_CODE');

  return { supabaseUrl, serviceKey, evoUrl, evoKey, instanceKey, launchCouponCode };
}

export function createSupabaseRestClient(supabaseUrl, serviceKey) {
  if (!supabaseUrl || !serviceKey) return null;
  const base = `${supabaseUrl.replace(/\/$/, '')}/rest/v1`;
  const baseHeaders = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  return {
    async select(table, queryString) {
      const res = await fetch(`${base}/${table}?${queryString}`, {
        headers: baseHeaders,
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Supabase SELECT ${table} HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    },
    async patch(table, filterQuery, payload) {
      const res = await fetch(`${base}/${table}?${filterQuery}`, {
        method: 'PATCH',
        headers: { ...baseHeaders, Prefer: 'return=minimal' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Supabase PATCH ${table} HTTP ${res.status}: ${await res.text()}`);
      return true;
    },
    async upsert(table, payload, onConflict = '') {
      const url = onConflict ? `${base}/${table}?on_conflict=${encodeURIComponent(onConflict)}` : `${base}/${table}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...baseHeaders, Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) throw new Error(`Supabase UPSERT ${table} HTTP ${res.status}: ${await res.text()}`);
      return res.json();
    },
  };
}

export function createEvolutionHttpClient(evoUrl, evoKey, instanceKey) {
  if (!evoUrl || !evoKey || !instanceKey) return null;
  const headers = { apikey: evoKey, 'Content-Type': 'application/json' };
  const enc = encodeURIComponent(instanceKey);

  return {
    instanceKey,
    async fetchExistingChatSuffixes() {
      const suffixes = new Set();
      try {
        const res = await fetch(`${evoUrl}/chat/findChats/${enc}`, {
          method: 'POST',
          headers,
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) return { ok: false, suffixes };
        const rows = await res.json();
        const list = Array.isArray(rows) ? rows : Array.isArray(rows?.chats) ? rows.chats : [];
        for (const row of list) {
          const jid = String(row.remoteJid || row.id || '');
          if (jid.endsWith('@g.us')) continue;
          const digits = jid.split('@')[0].replace(/\D/g, '');
          if (digits.length >= 8) {
            suffixes.add(digits.slice(-8));
            if (digits.length >= 10) suffixes.add(digits.slice(-10));
          }
        }
        return { ok: true, suffixes };
      } catch {
        return { ok: false, suffixes };
      }
    },
    async checkWhatsappNumbers(phones = []) {
      if (!phones.length) return new Map();
      const map = new Map();
      for (let i = 0; i < phones.length; i += 40) {
        const chunk = phones.slice(i, i + 40);
        try {
          const res = await fetch(`${evoUrl}/chat/whatsappNumbers/${enc}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ numbers: chunk }),
            signal: AbortSignal.timeout(15_000),
          });
          if (!res.ok) continue;
          const data = await res.json();
          const items = Array.isArray(data) ? data : Array.isArray(data?.response) ? data.response : [];
          for (const item of items) {
            const digits = normalizeBrPhone(item.number || String(item.jid || '').split('@')[0]);
            if (digits) map.set(digits.slice(-10), Boolean(item.exists));
          }
        } catch {
          // Segue sem bloquear caso filtro falhe parcialmente
        }
      }
      return map;
    },
    async sendHumanText(phoneE164, text) {
      await fetch(`${evoUrl}/chat/sendPresence/${enc}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: phoneE164, presence: 'composing', delay: 1400 }),
        signal: AbortSignal.timeout(6_000),
      }).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 1100));

      const res = await fetch(`${evoUrl}/message/sendText/${enc}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ number: phoneE164, text, delay: 800 }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
  };
}

export async function recordSequentialDispatchAudit({ supabase, instanceKey, leadId, phoneE164, messageText, nowIso }) {
  if (!supabase) return null;
  try {
    const camps = await supabase.select(
      'marketing_zap_campaigns',
      `select=id,instance_id&tenant_scope=eq.platform&name=eq.${encodeURIComponent('Orquestrador Sequencial Pluri Fisio')}&deleted_at=is.null&limit=1`,
    );
    let camp = camps?.[0];
    if (!camp?.id) {
      const insts = await supabase.select(
        'marketing_whatsapp_instances',
        `select=id&instance_key=eq.${encodeURIComponent(instanceKey)}&limit=1`,
      );
      const instId = insts?.[0]?.id || null;
      const created = await supabase.upsert('marketing_zap_campaigns', {
        tenant_scope: 'platform',
        clinic_id: null,
        instance_id: instId,
        name: 'Orquestrador Sequencial Pluri Fisio',
        status: 'running',
        audience_filter: { orchestrator_mode: 'sequential_2_slots' },
        message_template: '{{icebreaker_ia}}',
        enable_ai_spintax: false,
      });
      camp = Array.isArray(created) ? created[0] : created;
    }
    if (!camp?.id) return null;

    const idempotencyKey = `seq:${leadId}:${nowIso.slice(0, 10)}`;
    const inserted = await supabase.upsert(
      'marketing_zap_dispatches',
      {
        campaign_id: camp.id,
        instance_id: camp.instance_id || null,
        lead_id: leadId,
        phone_e164: phoneE164,
        step_index: 0,
        status: 'sent',
        rendered_body: messageText,
        idempotency_key: idempotencyKey,
        scheduled_for: nowIso,
        sent_at: nowIso,
      },
      'idempotency_key',
    );
    return Array.isArray(inserted) ? inserted[0]?.id || null : inserted?.id || null;
  } catch {
    return null;
  }
}

export async function isSlotBlockedBeforeSend({ supabase, evo, phoneE164 }) {
  const { last8, last10 } = phoneSuffixes(phoneE164);
  if (supabase) {
    const opt = await supabase
      .select('marketing_opt_outs', `select=id&phone_e164=ilike.*${last8}&limit=1`)
      .catch(() => []);
    if (Array.isArray(opt) && opt.length > 0) return 'opt_out';
  }
  if (evo) {
    const chats = await evo.fetchExistingChatSuffixes().catch(() => ({ ok: false, suffixes: new Set() }));
    if (chats.ok && (chats.suffixes.has(last8) || chats.suffixes.has(last10))) return 'skipped_existing_chat';
  }
  return null;
}
