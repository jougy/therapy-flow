import { useState } from "react";
import { Check, Copy, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { PlatformAutoLead } from "./types";

interface MessageBlock {
  id: string;
  label: string;
  timing: string;
  text: string;
}

interface LeadDossier {
  businessStage: string;
  toneOfVoice: string;
  likelyPains: string[];
  approachTrigger: string;
  messages: MessageBlock[];
}

function buildLeadDossier(lead: PlatformAutoLead): LeadDossier {
  const firstName = (lead.full_name || lead.clinic_name || "colega")
    .replace(/^(Dr\.?|Dra\.?)\s+/i, "")
    .split(/[\s|•-]+/)[0]
    ?.trim() || "colega";

  const igRaw = (lead.instagram_handle || "").trim();
  const igTag = igRaw
    ? igRaw.startsWith("@")
      ? igRaw
      : `@${igRaw}`
    : lead.website_url?.includes("instagram.com/")
      ? `@${lead.website_url.split("instagram.com/")[1]?.split(/[/?#]/)[0] || ""}`
      : "";

  const originLabel =
    lead.source_platform === "google_maps"
      ? "Google Maps"
      : lead.source_platform === "instagram"
        ? "Instagram"
        : lead.source_platform === "facebook_group"
          ? "Facebook"
          : lead.source_platform || "prospecção";

  const cityPart = lead.city ? ` em ${lead.city}` : "";
  const igMention = igTag && igTag !== "@" ? ` e seu Instagram (${igTag})` : "";

  const isClinic = lead.icp_tier === "clinic_owner";
  const isPilates = lead.icp_tier === "studio_pilates";

  const businessStage = isClinic
    ? `Consultório/clínica enxuta${cityPart}, em fase de estruturação e captação ativa via ${originLabel}.`
    : isPilates
      ? `Estúdio de Pilates/Fisioterapia${cityPart} buscando organizar turmas, evoluções e mensalidades.`
      : `Fisioterapeuta autônomo(a)${cityPart} com atendimento direto e marca pessoal.`;

  const toneOfVoice =
    "Pessoal, direto e próximo (1-a-1). Provavelmente a própria profissional responde no WhatsApp — evitar linguagem corporativa ou textão de telemarketing.";

  const likelyPains = [
    "Falta de tempo entre atendimentos para evoluir prontuário (CREFITO/CFM)",
    "Controle de agenda, faltas e recebimentos espalhado em papel, WhatsApp ou planilha",
    "Dificuldade em acompanhar retornos e histórico clínico completo do paciente",
  ];

  const approachTrigger = `Validar primeiro como organiza a rotina hoje (${originLabel}${igMention}), sem empurrar sistema logo na primeira frase.`;

  const customDossier = (lead.raw_metadata as Record<string, unknown> | null)?.dossier as
    | Partial<LeadDossier>
    | undefined;

  const defaultMessages: MessageBlock[] = [
    {
      id: "msg-1",
      label: "1. Abertura",
      timing: "Seg–Sex · 12h–14h ou 17h–20h",
      text: `Oi, ${firstName}! Tudo bem? Vi seu perfil no ${originLabel}${igMention} e queria te fazer uma pergunta rápida. Hoje você organiza a agenda, os prontuários e o financeiro dos seus pacientes por planilha, papel ou já usa algum sistema?`,
    },
    {
      id: "msg-2",
      label: "2. Conexão com a Dor",
      timing: "Após resposta (papel/planilha/agenda)",
      text: `Entendi! A maioria dos fisios que atendem de forma independente começa assim mesmo, mas chega uma hora que toma muito tempo fora do horário de atendimento (principalmente evolução e controle de quem já pagou/faltou). A gente criou a Pluri Fisio justamente para tirar esse peso das costas sem complicar — agenda, prontuário clínico e financeiro num lugar só, direto no celular. Posso te mandar um vídeo curtinho de 1 minuto mostrando como fica na prática?`,
    },
    {
      id: "msg-3",
      label: "3. Prova Visual & Convite",
      timing: "Após interesse",
      text: `Fica bem limpo assim! Você consegue testar na prática sem compromisso e ver se encaixa na sua rotina. Prefere que eu te libere um acesso de teste agora ou prefere bater um papo rápido de 10 minutos para eu te mostrar?`,
    },
    {
      id: "msg-4",
      label: "4. Follow-up Educado",
      timing: "48h úteis sem resposta",
      text: `Oi, ${firstName}, passando só para não deixar perdido aqui: se estiver na correria dos atendimentos, sem problema nenhum! Quando quiser dar uma olhada em como automatizar seus prontuários e agenda, é só me dar um oi por aqui. Bom trabalho aí!`,
    },
  ];

  return {
    businessStage: customDossier?.businessStage || businessStage,
    toneOfVoice: customDossier?.toneOfVoice || toneOfVoice,
    likelyPains:
      Array.isArray(customDossier?.likelyPains) && customDossier.likelyPains.length > 0
        ? customDossier.likelyPains
        : likelyPains,
    approachTrigger: customDossier?.approachTrigger || approachTrigger,
    messages:
      Array.isArray(customDossier?.messages) && customDossier.messages.length > 0
        ? customDossier.messages
        : defaultMessages,
  };
}

export function LeadDossierSection({ lead }: { lead: PlatformAutoLead }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const dossier = buildLeadDossier(lead);

  const handleCopy = async (id: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success(`${label} copiado!`);
      setTimeout(() => setCopiedId((curr) => (curr === id ? null : curr)), 1800);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const fullProfileText = [
    `Perfil: ${lead.full_name || lead.clinic_name}`,
    `Estágio: ${dossier.businessStage}`,
    `Tom de voz: ${dossier.toneOfVoice}`,
    `Dores prováveis:\n- ${dossier.likelyPains.join("\n- ")}`,
    `Gatilho: ${dossier.approachTrigger}`,
  ].join("\n\n");

  return (
    <div className="space-y-3">
      {/* Perfil & Personalidade */}
      <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <UserCheck className="h-3.5 w-3.5 text-primary" />
            <span>Perfil & Personalidade (Curador SDR)</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleCopy("profile", fullProfileText, "Perfil")}
            className="h-7 text-xs gap-1"
          >
            {copiedId === "profile" ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
            <span>{copiedId === "profile" ? "Copiado" : "Copiar"}</span>
          </Button>
        </div>

        <div className="space-y-1.5 text-xs leading-relaxed">
          <p><span className="font-medium text-foreground">Estágio:</span> <span className="text-muted-foreground">{dossier.businessStage}</span></p>
          <p><span className="font-medium text-foreground">Linguagem:</span> <span className="text-muted-foreground">{dossier.toneOfVoice}</span></p>
          <div>
            <span className="font-medium text-foreground">Dores prováveis:</span>
            <ul className="list-disc pl-4 mt-0.5 space-y-0.5 text-muted-foreground">
              {dossier.likelyPains.map((pain, idx) => (
                <li key={idx}>{pain}</li>
              ))}
            </ul>
          </div>
          <p><span className="font-medium text-foreground">Gatilho:</span> <span className="text-muted-foreground">{dossier.approachTrigger}</span></p>
        </div>
      </div>

      {/* Sequência de Mensagens Recomendadas */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Sequência Recomendada (Agente 3 — Pluri Fisio)</span>
        </div>

        <div className="space-y-2">
          {dossier.messages.map((msg) => (
            <div key={msg.id} className="rounded-lg border p-2.5 bg-card space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{msg.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{msg.timing}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(msg.id, msg.text, msg.label)}
                  className="h-7 px-2.5 text-xs gap-1 shrink-0"
                >
                  {copiedId === msg.id ? (
                    <Check className="h-3 w-3 text-emerald-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>{copiedId === msg.id ? "Copiado" : "Copiar"}</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {msg.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
