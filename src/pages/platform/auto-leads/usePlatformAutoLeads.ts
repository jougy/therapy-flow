import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  WHATSAPP_BOT_PHONE,
  WHATSAPP_COMMERCIAL_PHONE,
  type AutoLeadAffiliateSummary,
  type AutoLeadChannel,
  type AutoLeadFilterState,
  type AutoLeadIcpTier,
  type AutoLeadMeetingStatus,
  type AutoLeadStage,
  type PlatformAutoLead,
} from "./types";

export function normalizeBrPhoneKey(raw?: string | null): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    return digits.slice(2);
  }
  return digits.length > 11 ? digits.slice(-11) : digits;
}

export function formatWhatsAppE164(raw?: string | null): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

export function buildLeadWhatsAppUrl(lead: PlatformAutoLead): string {
  const phone = formatWhatsAppE164(lead.phone);
  if (!phone) return "#";
  const firstName = lead.full_name.trim().split(/\s+/)[0] || "Dr(a).";
  const message =
    lead.ai_icebreaker_message?.trim() ||
    (lead.meeting_status === "attempted_bot"
      ? `Olá ${firstName}! Notei que você iniciou um agendamento no nosso WhatsApp Bot da Pluri-Health. Prefere que eu finalize seu horário por aqui?`
      : `Olá ${firstName}! Vi sua participação no grupo ${lead.facebook_group_name || "de Fisioterapia"} e queria te apresentar a Pluri-Health para gestão de prontuários e agenda.`);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function inferMeetingChannel(meeting: Record<string, unknown>): AutoLeadChannel {
  const line = String(meeting.whatsapp_line || "");
  const conf = String(meeting.confirmation_channel || "");
  const origin = String(meeting.origin || "");
  const notes = String(meeting.notes || "").toLowerCase();
  if (
    line === WHATSAPP_BOT_PHONE ||
    conf.includes(WHATSAPP_BOT_PHONE) ||
    origin.includes("bot") ||
    notes.includes("whatsapp bot")
  ) {
    return "whatsapp_bot_5511960474566";
  }
  if (
    line === WHATSAPP_COMMERCIAL_PHONE ||
    conf.includes(WHATSAPP_COMMERCIAL_PHONE) ||
    origin.includes("commercial") ||
    origin.includes("comercial")
  ) {
    return "whatsapp_commercial_5511980113936";
  }
  return "backoffice_agenda";
}

function inferBookedBy(meeting: Record<string, unknown>, channel: AutoLeadChannel): string {
  const explicit = String(meeting.booked_by_name || "").trim();
  if (explicit) return explicit;
  const leadName = String(meeting.lead_name || "Lead").trim();
  if (channel === "whatsapp_bot_5511960474566") return `${leadName} (Bot +55 11 96047-4566)`;
  if (channel === "whatsapp_commercial_5511980113936") return "Equipe Comercial (+55 11 98011-3936)";
  return "Backoffice Master";
}

export function usePlatformAutoLeads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<PlatformAutoLead[]>([]);
  const [affiliates, setAffiliates] = useState<AutoLeadAffiliateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAgendas, setSyncingAgendas] = useState(false);

  const [filters, setFilters] = useState<AutoLeadFilterState>({
    search: "",
    stage: "all",
    agendaFilter: "all",
    minScore: "all",
    onlyWithPhone: false,
    affiliateId: "all",
  });

  const db = supabase as any;

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [leadsRes, meetingsRes, sessionsRes, affRes] = await Promise.all([
        db.from("platform_auto_leads").select("*").is("deleted_at", null).order("created_at", { ascending: false }),
        db.from("platform_onboarding_meetings").select("*").order("scheduled_at", { ascending: false }),
        db.from("whatsapp_chat_sessions").select("*").order("last_message_at", { ascending: false }).limit(200),
        db.from("affiliates").select("id, coupon_code, referral_slug, tier, profile:profiles!user_id(full_name)").is("deleted_at", null),
      ]);

      const rawMeetings = Array.isArray(meetingsRes?.data) ? meetingsRes.data : [];
      const rawSessions = Array.isArray(sessionsRes?.data) ? sessionsRes.data : [];
      const rawLeads: PlatformAutoLead[] = Array.isArray(leadsRes?.data) ? leadsRes.data : [];

      const reconciledLeads = rawLeads.map((lead) => {
        const phoneKey = normalizeBrPhoneKey(lead.phone);
        const emailLower = (lead.email || "").trim().toLowerCase();

        const matchedMeeting = rawMeetings.find((m: Record<string, unknown>) => {
          const mKey = normalizeBrPhoneKey(String(m.phone || ""));
          const mEmail = String(m.email || "").trim().toLowerCase();
          return (phoneKey && mKey === phoneKey) || (emailLower && mEmail === emailLower) || m.id === lead.meeting_id;
        });

        if (matchedMeeting) {
          const channel = inferMeetingChannel(matchedMeeting);
          return {
            ...lead,
            meeting_id: String(matchedMeeting.id),
            meeting_status: (matchedMeeting.status as AutoLeadMeetingStatus) || lead.meeting_status || "scheduled",
            meeting_scheduled_at: String(matchedMeeting.scheduled_at),
            meeting_duration_minutes: Number(matchedMeeting.duration_minutes || 15),
            meeting_channel: channel,
            meeting_booked_by: inferBookedBy(matchedMeeting, channel),
          };
        }

        if (phoneKey && ["none", "attempted_bot", "handed_off_commercial"].includes(lead.meeting_status)) {
          const session = rawSessions.find(
            (s: Record<string, unknown>) => normalizeBrPhoneKey(String(s.phone || "")) === phoneKey
          );
          const step = String(session?.current_step || "");
          if (session && ["waiting_day", "waiting_time", "owner_support_menu", "support_handoff", "support_active"].includes(step)) {
            const isCommercial = step === "support_handoff" || step === "support_active";
            return {
              ...lead,
              meeting_status: (isCommercial ? "handed_off_commercial" : "attempted_bot") as AutoLeadMeetingStatus,
              meeting_channel: (isCommercial ? "whatsapp_commercial_5511980113936" : "whatsapp_bot_5511960474566") as AutoLeadChannel,
              last_scheduling_attempt_at: String(session.last_message_at || ""),
              scheduling_attempt_summary:
                lead.scheduling_attempt_summary ||
                (isCommercial
                  ? "Em atendimento no WhatsApp Comercial (+55 11 98011-3936)"
                  : `Tentou agendar no Bot (+55 11 96047-4566) — parou em: ${step}`),
            };
          }
        }

        return lead;
      });

      setLeads(reconciledLeads);
      if (Array.isArray(affRes?.data)) {
        setAffiliates(
          affRes.data.map((a: Record<string, unknown>) => ({
            id: String(a.id),
            coupon_code: a.coupon_code as string | null,
            referral_slug: a.referral_slug as string | null,
            tier: a.tier as string | null,
            full_name: String((a.profile as Record<string, unknown> | null)?.full_name || a.coupon_code || "Afiliado"),
          }))
        );
      }
    } catch (err) {
      console.warn("[AUTO_LEAD] Erro ao carregar tabela de leads:", err);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredLeads = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (q) {
        const hay = [
          lead.full_name,
          lead.phone,
          lead.email,
          lead.instagram_handle,
          lead.facebook_group_name,
          lead.clinic_name,
          lead.city,
          lead.meeting_booked_by,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (filters.stage !== "all" && lead.stage !== filters.stage) return false;
      if (filters.agendaFilter === "scheduled" && !["scheduled", "rescheduled", "completed"].includes(lead.meeting_status)) return false;
      if (filters.agendaFilter === "attempted" && !["attempted_bot", "handed_off_commercial", "no_show", "canceled"].includes(lead.meeting_status)) return false;
      if (filters.agendaFilter === "none" && lead.meeting_status !== "none") return false;
      if (filters.minScore !== "all" && lead.ai_score < Number(filters.minScore)) return false;
      if (filters.onlyWithPhone && !lead.phone) return false;
      if (filters.affiliateId !== "all" && lead.assigned_affiliate_id !== filters.affiliateId) return false;
      return true;
    });
  }, [leads, filters]);

  const kpis = useMemo(() => {
    const total = leads.length;
    const qualified = leads.filter((l) => l.ai_score >= 70).length;
    const withWhatsapp = leads.filter((l) => Boolean(l.phone)).length;
    const scheduledCount = leads.filter((l) => ["scheduled", "rescheduled", "completed"].includes(l.meeting_status)).length;
    const attemptedCount = leads.filter((l) => ["attempted_bot", "handed_off_commercial"].includes(l.meeting_status)).length;
    return { total, qualified, withWhatsapp, scheduledCount, attemptedCount };
  }, [leads]);

  const updateLeadStage = useCallback(async (leadId: string, stage: AutoLeadStage) => {
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    const { error } = await db.from("platform_auto_leads").update({ stage }).eq("id", leadId);
    if (error) {
      toast({ title: "Erro ao atualizar estágio", description: error.message, variant: "destructive" });
      void loadData(true);
    }
  }, [db, loadData]);

  const assignLeadsToAffiliate = useCallback(async (leadIds: string[], affiliateId: string | null) => {
    if (leadIds.length === 0) return;
    const now = new Date().toISOString();
    setLeads((prev) =>
      prev.map((l) =>
        leadIds.includes(l.id)
          ? {
              ...l,
              assigned_affiliate_id: affiliateId,
              assigned_at: affiliateId ? now : null,
              stage: affiliateId && ["new", "qualified"].includes(l.stage) ? "assigned" : l.stage,
            }
          : l
      )
    );
    const { error } = await db
      .from("platform_auto_leads")
      .update({
        assigned_affiliate_id: affiliateId,
        assigned_at: affiliateId ? now : null,
      })
      .in("id", leadIds);

    if (error) {
      toast({ title: "Erro ao distribuir leads", description: error.message, variant: "destructive" });
      void loadData(true);
    } else {
      toast({
        title: affiliateId ? "Leads distribuídos para afiliado" : "Atribuição removida",
        description: `${leadIds.length} contato(s) atualizado(s).`,
      });
    }
  }, [db, loadData]);

  const updateLeadDetails = useCallback(
    async (leadId: string, patch: Partial<Pick<PlatformAutoLead, "ai_icebreaker_message" | "notes" | "phone" | "email" | "instagram_handle">>) => {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...patch } : l)));
      const { error } = await db.from("platform_auto_leads").update(patch).eq("id", leadId);
      if (error) {
        toast({ title: "Erro ao salvar alterações do lead", description: error.message, variant: "destructive" });
        return false;
      }
      toast({ title: "Contato atualizado", description: "Dados salvos com sucesso." });
      return true;
    },
    [db]
  );

  const scheduleLeadMeeting = useCallback(
    async (
      lead: PlatformAutoLead,
      payload: {
        scheduled_at: string;
        duration_minutes: number;
        channel: AutoLeadChannel;
        booked_by_name: string;
        notes?: string;
      }
    ) => {
      const whatsappLine =
        payload.channel === "whatsapp_bot_5511960474566"
          ? WHATSAPP_BOT_PHONE
          : payload.channel === "whatsapp_commercial_5511980113936"
          ? WHATSAPP_COMMERCIAL_PHONE
          : null;

      const meetingInsert = {
        lead_name: lead.full_name,
        phone: lead.phone || "Não informado",
        email: lead.email || null,
        clinic_name: lead.clinic_name || null,
        scheduled_at: payload.scheduled_at,
        duration_minutes: payload.duration_minutes,
        status: "scheduled",
        notes: payload.notes || `Agendamento originado na aba Auto-Lead (${payload.booked_by_name}).`,
        origin: payload.channel,
        confirmation_channel: payload.channel,
        booked_by_name: payload.booked_by_name,
        whatsapp_line: whatsappLine,
        auto_lead_id: lead.id,
        created_by: user?.id || null,
      };

      const { data: meetingData, error: meetErr } = await db
        .from("platform_onboarding_meetings")
        .insert([meetingInsert])
        .select()
        .single();

      if (meetErr) {
        toast({ title: "Erro ao agendar reunião", description: meetErr.message, variant: "destructive" });
        return false;
      }

      await db
        .from("platform_auto_leads")
        .update({
          meeting_id: meetingData?.id || null,
          meeting_status: "scheduled",
          meeting_scheduled_at: payload.scheduled_at,
          meeting_duration_minutes: payload.duration_minutes,
          meeting_channel: payload.channel,
          meeting_booked_by: payload.booked_by_name,
          stage: "meeting_scheduled",
        })
        .eq("id", lead.id);

      toast({
        title: "Reunião sincronizada nas agendas!",
        description: `${lead.full_name} agendado(a) com ${payload.booked_by_name}.`,
      });
      await loadData(true);
      return true;
    },
    [db, loadData, user?.id]
  );

  const importLeadsBatch = useCallback(
    async (rawItems: Record<string, unknown>[]) => {
      const { data, error } = await db.rpc("upsert_platform_auto_leads_batch", {
        p_leads: rawItems,
        p_run_id: null,
        p_routine_id: null,
      });
      if (error) {
        toast({ title: "Erro ao importar lote", description: error.message, variant: "destructive" });
        return false;
      }
      toast({
        title: "Leads adicionados à tabela!",
        description: `${data?.inserted_count || 0} novo(s), ${data?.updated_count || 0} atualizado(s).`,
      });
      await loadData(true);
      return true;
    },
    [db, loadData]
  );

  const createManualLead = useCallback(
    async (payload: {
      full_name: string;
      phone?: string;
      email?: string;
      instagram_handle?: string;
      facebook_group_name?: string;
      clinic_name?: string;
      city?: string;
      icp_tier?: AutoLeadIcpTier;
      ai_score?: number;
      source_post_excerpt?: string;
      ai_icebreaker_message?: string;
    }) => {
      return importLeadsBatch([
        {
          ...payload,
          source_platform: "facebook_group",
          subagent_captured_by: "manual_or_antigravity",
        },
      ]);
    },
    [importLeadsBatch]
  );

  const syncAgendasNow = useCallback(async () => {
    setSyncingAgendas(true);
    try {
      await loadData(true);
      toast({
        title: "Agendas sincronizadas!",
        description: "Contatos cruzados com WhatsApp Bot (+55 11 96047-4566), Comercial (+55 11 98011-3936) e Agenda Master.",
      });
    } finally {
      setSyncingAgendas(false);
    }
  }, [loadData]);

  return {
    leads,
    filteredLeads,
    affiliates,
    kpis,
    filters,
    setFilters,
    loading,
    syncingAgendas,
    reload: loadData,
    updateLeadStage,
    assignLeadsToAffiliate,
    updateLeadDetails,
    scheduleLeadMeeting,
    importLeadsBatch,
    createManualLead,
    syncAgendasNow,
  };
}
