import {
  AUTO_LEAD_CHANNEL_LABELS,
  AUTO_LEAD_MEETING_STATUS_META,
  AUTO_LEAD_STAGE_META,
  type AutoLeadAffiliateSummary,
  type PlatformAutoLead,
} from "./types";

function escapeCsvField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).replace(/"/g, '""');
  if (str.includes(",") || str.includes(";") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
    return `"${str}"`;
  }
  return str;
}

export function exportAutoLeadsToCsv(
  leads: PlatformAutoLead[],
  affiliates: AutoLeadAffiliateSummary[],
  fileNamePrefix = "pluri-health-auto-leads"
): void {
  if (!leads || leads.length === 0) return;

  const affiliateMap = new Map<string, string>();
  for (const aff of affiliates) {
    affiliateMap.set(
      aff.id,
      aff.coupon_code ? `${aff.full_name} (${aff.coupon_code})` : aff.full_name
    );
  }

  const headers = [
    "ID",
    "Nome Completo",
    "Telefone",
    "E-mail",
    "Instagram",
    "LinkedIn",
    "Website",
    "Clínica / Consultório",
    "Cidade",
    "Estado",
    "Especialidade",
    "Perfil ICP",
    "Score Lindy IA",
    "Estágio do Funil",
    "Afiliado / Parceiro",
    "Data Atribuição",
    "Status da Reunião",
    "Data Agendada",
    "Duração (min)",
    "Canal de Agendamento",
    "Quem Marcou",
    "Última Tentativa de Contato",
    "Resumo da Tentativa",
    "Plataforma de Origem",
    "Grupo do Facebook",
    "URL do Perfil FB",
    "Trecho do Post Original",
    "URL do Post Original",
    "Mensagem Icebreaker IA",
    "Resumo da Qualificação IA",
    "Notas Internas",
    "Subagente Capturador",
    "ID Tarefa Lindy",
    "ID Run Apify",
    "Chave Externa",
    "Data de Cadastro",
    "Última Atualização",
  ];

  const rows: string[][] = leads.map((lead) => {
    const stageMeta = AUTO_LEAD_STAGE_META[lead.stage]?.label || lead.stage || "";
    const meetingMeta = AUTO_LEAD_MEETING_STATUS_META[lead.meeting_status]?.label || lead.meeting_status || "";
    const channelLabel = lead.meeting_channel
      ? AUTO_LEAD_CHANNEL_LABELS[lead.meeting_channel] || lead.meeting_channel
      : "";
    const affiliateName = lead.assigned_affiliate_id
      ? affiliateMap.get(lead.assigned_affiliate_id) || "Afiliado Removido"
      : "Sem afiliado (Backoffice)";

    return [
      lead.id,
      lead.full_name || "",
      lead.phone || "",
      lead.email || "",
      lead.instagram_handle || "",
      lead.linkedin_url || "",
      lead.website_url || "",
      lead.clinic_name || "",
      lead.city || "",
      lead.state || "",
      lead.specialty || "",
      lead.icp_tier || "",
      String(lead.ai_score ?? ""),
      stageMeta,
      affiliateName,
      lead.assigned_at || "",
      meetingMeta,
      lead.meeting_scheduled_at || "",
      lead.meeting_duration_minutes ? String(lead.meeting_duration_minutes) : "",
      channelLabel,
      lead.meeting_booked_by || "",
      lead.last_scheduling_attempt_at || "",
      lead.scheduling_attempt_summary || "",
      lead.source_platform || "",
      lead.facebook_group_name || "",
      lead.facebook_profile_url || "",
      lead.source_post_excerpt || "",
      lead.source_post_url || "",
      lead.ai_icebreaker_message || "",
      lead.ai_qualification_summary || "",
      lead.notes || "",
      lead.subagent_captured_by || "",
      lead.lindy_task_id || "",
      lead.apify_run_id || "",
      lead.external_lead_key || "",
      lead.created_at || "",
      lead.updated_at || "",
    ];
  });

  const csvContent =
    "\uFEFF" +
    [
      headers.map(escapeCsvField).join(";"),
      ...rows.map((row) => row.map(escapeCsvField).join(";")),
    ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStr = new Date().toISOString().slice(0, 10);
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileNamePrefix}-${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
