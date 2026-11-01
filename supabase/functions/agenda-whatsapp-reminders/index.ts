// supabase/functions/agenda-whatsapp-reminders/index.ts
/**
 * Edge Function: agenda-whatsapp-reminders
 * 
 * Responsável pelo envio em tempo real e agendado de notificações de compromissos da agenda:
 * 1. Ação "notify_new_booking": Confirmação instantânea para o paciente e/ou equipe pós-agendamento.
 * 2. Ação "cron_dispatch_due_reminders": Varredura periódica de lembretes devidos (24h, 2h, na hora)
 *    com proteção contra disparos duplicados gravados em reminder_dispatches.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { WhatsAppClient, sanitizeWhatsAppNumber } from "../_shared/whatsapp-client.ts";
import { getGlobalFeatureFlag } from "../_shared/feature-flags-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestPayload {
  action: "notify_new_booking" | "cron_dispatch_due_reminders";
  eventId?: string;
  clinicId?: string;
}

export function formatDateTimeBr(isoString: string): { dateStr: string; timeStr: string } {
  try {
    const d = new Date(isoString);
    // Converte para horário de Brasília (UTC-3)
    const brDate = new Date(d.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const day = String(brDate.getDate()).padStart(2, "0");
    const month = String(brDate.getMonth() + 1).padStart(2, "0");
    const year = brDate.getFullYear();
    const hours = String(brDate.getHours()).padStart(2, "0");
    const mins = String(brDate.getMinutes()).padStart(2, "0");
    return {
      dateStr: `${day}/${month}/${year}`,
      timeStr: `${hours}:${mins}`,
    };
  } catch {
    return { dateStr: isoString.slice(0, 10), timeStr: isoString.slice(11, 16) };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Configurações de Supabase ausentes." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const whatsAppClient = new WhatsAppClient();

  // Verifica feature flag global de lembretes
  const remindersEnabled = await getGlobalFeatureFlag(supabase, "notifications_patient_reminders", true);

  try {
    let payload: RequestPayload = { action: "cron_dispatch_due_reminders" };
    try {
      const parsed = await req.json();
      if (parsed?.action) payload = parsed;
    } catch {
      // Usa default se corpo vazio (invocação de webhook/cron)
    }

    // =========================================================================
    // 1. AÇÃO: NOTIFICAR NOVO AGENDAMENTO (IMEDIATO)
    // =========================================================================
    if (payload.action === "notify_new_booking") {
      if (!payload.eventId) {
        return new Response(
          JSON.stringify({ error: "eventId é obrigatório para notify_new_booking." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: event, error: eventErr } = await supabase
        .from("agenda_events")
        .select(`
          id, title, scheduled_for, duration_minutes, event_type, status,
          notify_patient, notify_team, clinic_id, user_id, patient_id, reminder_dispatches
        `)
        .eq("id", payload.eventId)
        .maybeSingle();

      if (eventErr || !event) {
        return new Response(
          JSON.stringify({ error: "Agendamento não encontrado.", details: eventErr }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let clinicName = "PluriFisio";
      if (event.clinic_id) {
        const { data: clinicData } = await supabase
          .from("clinics")
          .select("name")
          .eq("id", event.clinic_id)
          .maybeSingle();
        if (clinicData?.name) clinicName = clinicData.name;
      }

      const { dateStr, timeStr } = formatDateTimeBr(event.scheduled_for);
      const dispatches = Array.isArray(event.reminder_dispatches) ? [...event.reminder_dispatches] : [];
      const notificationsSent: string[] = [];

      // A. Disparo para o Paciente
      if (event.patient_id) {
        const { data: patientData } = await supabase
          .from("patients")
          .select("name, phone")
          .eq("id", event.patient_id)
          .maybeSingle();

        const cleanPatientPhone = sanitizeWhatsAppNumber(patientData?.phone);
        if (cleanPatientPhone) {
          const patientGreeting = patientData?.name ? `Olá, *${patientData.name}*!` : `Olá!`;
          const patientMsg =
            `${patientGreeting} 👋\n\n` +
            `Seu atendimento foi agendado com sucesso na *${clinicName}*:\n\n` +
            `🗓️ *Data:* ${dateStr}\n` +
            `⏰ *Horário:* ${timeStr} (Duração: ${event.duration_minutes || 60} min)\n` +
            `📋 *Procedimento:* ${event.title}\n\n` +
            `Caso precise reagendar ou tenha alguma dúvida, basta responder a esta mensagem. Até logo! 😊`;

          const sendRes = await whatsAppClient.sendTextMessage(cleanPatientPhone, patientMsg);
          if (sendRes.success) {
            notificationsSent.push(`patient:${cleanPatientPhone}`);
            dispatches.push({
              key: "immediate_patient_confirmation",
              sent_at: new Date().toISOString(),
              channel: "whatsapp",
              recipient: cleanPatientPhone,
            });
          }
        }
      }

      // B. Disparo para o Profissional / Equipe
      if (event.notify_team && event.user_id) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", event.user_id)
          .maybeSingle();

        const cleanProfPhone = sanitizeWhatsAppNumber(profData?.phone);
        if (cleanProfPhone) {
          const profMsg =
            `📅 *Novo Agendamento Confirmado!*\n\n` +
            `Olá, *${profData?.full_name || "Doutor(a)"}*! Um novo compromisso foi registrado na sua agenda:\n\n` +
            `📋 *Título:* ${event.title}\n` +
            `🗓️ *Data:* ${dateStr}\n` +
            `⏰ *Horário:* ${timeStr}\n` +
            `🏥 *Clínica:* ${clinicName}`;

          const sendProfRes = await whatsAppClient.sendTextMessage(cleanProfPhone, profMsg);
          if (sendProfRes.success) {
            notificationsSent.push(`team:${cleanProfPhone}`);
            dispatches.push({
              key: "immediate_team_notification",
              sent_at: new Date().toISOString(),
              channel: "whatsapp",
              recipient: cleanProfPhone,
            });
          }
        }
      }

      // Atualiza tracking no banco
      await supabase
        .from("agenda_events")
        .update({
          reminder_dispatches: dispatches,
          last_reminder_dispatched_at: new Date().toISOString(),
        })
        .eq("id", event.id);

      return new Response(
        JSON.stringify({ success: true, notificationsSent, eventId: event.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // 2. AÇÃO: CRON DE VARREDURA DE LEMBRETES DEVIDOS (24H, 2H, NA HORA)
    // =========================================================================
    if (!remindersEnabled) {
      return new Response(
        JSON.stringify({ success: true, message: "Lembretes desativados via feature flag." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const now = new Date();
    // Busca eventos nos próximos 25 horas para checar janelas de 24h, 2h e na hora (0min)
    const windowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10 min de tolerância retroativa
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data: dueEvents, error: pollErr } = await supabase
      .from("agenda_events")
      .select(`
        id, title, scheduled_for, duration_minutes, clinic_id, user_id, patient_id,
        reminder_dispatches, reminder_configs, notify_patient
      `)
      .in("status", ["confirmado", "agendado", "aguardando_confirmacao"])
      .gte("scheduled_for", windowStart)
      .lte("scheduled_for", windowEnd);

    if (pollErr || !dueEvents || dueEvents.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processedCount: 0, dueEventsCount: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let dispatchedCount = 0;

    for (const ev of dueEvents) {
      const scheduledTime = new Date(ev.scheduled_for).getTime();
      const diffMs = scheduledTime - now.getTime();
      const diffMinutes = Math.round(diffMs / 60000);

      const dispatches = Array.isArray(ev.reminder_dispatches) ? [...ev.reminder_dispatches] : [];
      const hasDispatched = (key: string) => dispatches.some((d: any) => d.key === key);

      // Regras de Antecedência:
      // 1. 24h antes: entre 1380 e 1440 min (23h a 24h)
      // 2. 2h antes: entre 90 e 130 min (1h30 a 2h10)
      // 3. Na hora do evento: entre -5 e +15 min (momento da consulta)
      let dueKey: string | null = null;
      let reminderLabel = "";

      if (diffMinutes >= 1380 && diffMinutes <= 1440 && !hasDispatched("24h_before")) {
        dueKey = "24h_before";
        reminderLabel = "Lembrete: sua consulta acontece amanhã";
      } else if (diffMinutes >= 90 && diffMinutes <= 130 && !hasDispatched("2h_before")) {
        dueKey = "2h_before";
        reminderLabel = "Lembrete: sua consulta acontece em aproximadamente 2 horas";
      } else if (diffMinutes >= -5 && diffMinutes <= 15 && !hasDispatched("at_event_time")) {
        dueKey = "at_event_time";
        reminderLabel = "Sua consulta agendada está iniciando agora";
      }

      if (!dueKey) continue;

      // Obtém dados do paciente
      let patientPhone: string | null = null;
      let patientName = "Paciente";
      if (ev.patient_id) {
        const { data: pData } = await supabase
          .from("patients")
          .select("name, phone")
          .eq("id", ev.patient_id)
          .maybeSingle();
        if (pData?.phone) patientPhone = sanitizeWhatsAppNumber(pData.phone);
        if (pData?.name) patientName = pData.name;
      }

      // Obtém telefone do profissional responsável
      let profPhone: string | null = null;
      if (ev.user_id) {
        const { data: prData } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", ev.user_id)
          .maybeSingle();
        if (prData?.phone) profPhone = sanitizeWhatsAppNumber(prData.phone);
      }

      const { dateStr, timeStr } = formatDateTimeBr(ev.scheduled_for);

      // Dispara para paciente (se tiver telefone cadastrado)
      if (patientPhone) {
        const reminderMsg =
          `⏰ *${reminderLabel}* 🩺\n\n` +
          `Olá, *${patientName}*!\n` +
          `Passando para lembrar do seu atendimento:\n\n` +
          `📋 *Compromisso:* ${ev.title}\n` +
          `🗓️ *Data:* ${dateStr}\n` +
          `⏰ *Horário:* ${timeStr}\n\n` +
          `Poderia nos confirmar sua presença respondendo com *Sim*? Até breve! 😊`;

        const sent = await whatsAppClient.sendTextMessage(patientPhone, reminderMsg);
        if (sent.success) {
          dispatches.push({
            key: dueKey,
            sent_at: new Date().toISOString(),
            channel: "whatsapp",
            recipient: patientPhone,
          });
          dispatchedCount++;
        }
      }

      // Se for no horário do evento e o profissional tiver WhatsApp, dispara lembrete para o profissional
      if (dueKey === "at_event_time" && profPhone && !hasDispatched("prof_at_event_time")) {
        const profAlertMsg =
          `🔔 *Compromisso da Agenda Iniciando!* ⏰\n\n` +
          `O atendimento "*${ev.title}*" está programado para agora (${timeStr}).\n` +
          `Acesse sua agenda no app para iniciar o prontuário: https://app.plurifisio.com.br/agenda`;

        const sentProf = await whatsAppClient.sendTextMessage(profPhone, profAlertMsg);
        if (sentProf.success) {
          dispatches.push({
            key: "prof_at_event_time",
            sent_at: new Date().toISOString(),
            channel: "whatsapp",
            recipient: profPhone,
          });
        }
      }

      // Grava histórico de lembretes enviados
      await supabase
        .from("agenda_events")
        .update({
          reminder_dispatches: dispatches,
          last_reminder_dispatched_at: new Date().toISOString(),
        })
        .eq("id", ev.id);
    }

    return new Response(
      JSON.stringify({ success: true, dueEventsFound: dueEvents.length, dispatchedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[agenda-whatsapp-reminders] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Erro interno no servidor." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
