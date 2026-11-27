import { useState } from "react";
import { Check, Copy, ExternalLink, Flame, ShieldCheck, Sparkles, Target, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { PlatformAutoLead } from "./types";

interface PainSignalMeta {
  sourceUrl?: string | null;
  painExcerpt?: string | null;
  painSummary?: string | null;
  painCategory?: string | null;
  intentScore5?: number | null;
  counterEvidencePassed?: boolean;
}

interface StrategyAlternativeMeta {
  id: string;
  shortLabel: string;
  estimatedSuccessPct: number;
}

interface OriginContextMeta {
  originType?: string | null;
  discoveryLabel?: string | null;
  canUseContentHook?: boolean;
  contentHook?: string | null;
}

interface PersonalityProfileMeta {
  id?: string | null;
  label?: string | null;
  communicationStyle?: string | null;
  pacing?: string | null;
}

interface StrategyAssignmentMeta {
  strategyId?: string | null;
  strategyName?: string | null;
  shortLabel?: string | null;
  estimatedSuccessPct?: number | null;
  mode?: string | null;
  alternatives?: StrategyAlternativeMeta[];
  topTalkingPoints?: string[];
}

interface WhatsappProfileMeta {
  uses_auto_reply?: boolean;
  detected_at?: string | null;
  sample?: string | null;
}

interface RecommendedPlanMeta {
  planId?: string | null;
  planName?: string | null;
  annualMonthlyPrice?: number | null;
  reason?: string | null;
}

const MATURITY_LABELS: Record<string, string> = {
  iniciante_solo: "Solo / Iniciando",
  clinica_recem_inaugurada: "Clínica Recém-Inaugurada",
  pequena_crescendo: "Consultório / Estúdio Enxuto",
  avancada_estabelecida: "Clínica Avançada",
};

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
          : lead.source_platform === "web_signal"
            ? "Sinal Web (Dor Ativa)"
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
    "Natural, humano e simpático, sem perder o profissionalismo e a formalidade. Tratar por Dr(a)./primeiro nome com cordialidade — evitar gírias e textão de telemarketing.";

  const likelyPains = [
    "Falta de tempo entre atendimentos para evoluir prontuário (CREFITO/CFM)",
    "Controle de agenda, faltas e recebimentos espalhado em papel, WhatsApp ou planilha",
    "Dificuldade em acompanhar retornos e histórico clínico completo do paciente",
  ];

  const approachTrigger = `Validar primeiro como organiza a rotina hoje (${originLabel}${igMention}), sem empurrar sistema logo na primeira frase.`;

  const rawMeta = (lead.raw_metadata as Record<string, unknown> | null) || null;
  const customDossier = rawMeta?.dossier as Partial<LeadDossier> | undefined;

  const defaultMessages: MessageBlock[] = [
    {
      id: "msg-1",
      label: "1. Abertura",
      timing: "Seg–Sex · 12h–14h ou 17h–20h",
      text: `Olá, ${firstName}, tudo bem? Vi seu perfil no ${originLabel}${igMention} e gostaria de fazer uma pergunta breve: hoje você organiza a agenda, os prontuários e o financeiro dos pacientes por planilha, papel ou já utiliza algum sistema?`,
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

  const rawMeta = (lead.raw_metadata as Record<string, unknown> | null) || null;
  const painSignal = (rawMeta?.pain_signal as PainSignalMeta | undefined) || undefined;
  const originContext =
    (rawMeta?.origin_context as OriginContextMeta | undefined) || undefined;
  const personalityProfile =
    (rawMeta?.personality_profile as PersonalityProfileMeta | undefined) || undefined;
  const strategyMeta =
    (rawMeta?.strategy_assignment as StrategyAssignmentMeta | undefined) || undefined;
  const whatsappProfile =
    (rawMeta?.whatsapp_profile as WhatsappProfileMeta | undefined) || undefined;
  const recommendedPlan =
    (rawMeta?.recommended_plan as RecommendedPlanMeta | undefined) || undefined;
  const maturityStage =
    typeof rawMeta?.maturity_stage === "string" ? rawMeta.maturity_stage : null;
  const signalUrl = painSignal?.sourceUrl || lead.source_post_url;
  const signalExcerpt = painSignal?.painExcerpt || painSignal?.painSummary;
  const contentHook = originContext?.contentHook;
  const hasBrainContext = Boolean(
    painSignal || originContext || personalityProfile || strategyMeta || whatsappProfile || recommendedPlan || maturityStage
  );

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
    <div className="w-full max-w-full min-w-0 space-y-3 overflow-x-hidden">
      {hasBrainContext && (
        <div className="w-full min-w-0 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 space-y-2 break-words">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold min-w-0">
              <Flame className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="truncate">Sinal de Dor Ativa & Super-Conversor</span>
            </div>
            {signalUrl && (
              <a
                href={signalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline min-h-[36px] px-1 shrink-0"
              >
                <span>Abrir origem</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {originContext?.discoveryLabel && (
              <Badge variant="outline" className="text-[11px] font-medium">
                {originContext.discoveryLabel}
              </Badge>
            )}
            {personalityProfile?.label && (
              <Badge variant="secondary" className="text-[11px] font-medium max-w-full">
                <span className="truncate">Perfil: {personalityProfile.label}</span>
              </Badge>
            )}
            {typeof painSignal?.intentScore5 === "number" && (
              <Badge variant="secondary" className="text-[11px] font-medium">
                Intenção: {painSignal.intentScore5.toFixed(1)}/5
              </Badge>
            )}
            {painSignal?.counterEvidencePassed && (
              <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-700 dark:text-emerald-300 gap-1">
                <ShieldCheck className="h-3 w-3 shrink-0" />
                Contra-evidência OK
              </Badge>
            )}
            {strategyMeta?.shortLabel && (
              <Badge variant="outline" className="text-[11px] border-primary/40 text-primary gap-1 max-w-full">
                <Target className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {strategyMeta.shortLabel}
                  {typeof strategyMeta.estimatedSuccessPct === "number"
                    ? ` · ~${strategyMeta.estimatedSuccessPct}% est.`
                    : ""}
                </span>
              </Badge>
            )}
            {strategyMeta?.mode && (
              <Badge variant="outline" className="text-[11px]">
                {strategyMeta.mode === "explore" ? "20% Teste" : "80% Principal"}
              </Badge>
            )}
            {whatsappProfile?.uses_auto_reply && (
              <Badge variant="outline" className="text-[11px] border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                Auto-Resposta WhatsApp
              </Badge>
            )}
            {maturityStage && (
              <Badge variant="outline" className="text-[11px]">
                Estágio: {MATURITY_LABELS[maturityStage] || maturityStage}
              </Badge>
            )}
            {recommendedPlan?.planName && (
              <Badge variant="outline" className="text-[11px] border-sky-500/40 text-sky-700 dark:text-sky-300 max-w-full">
                <span className="truncate">
                  Plano Ideal: {recommendedPlan.planName}
                  {typeof recommendedPlan.annualMonthlyPrice === "number"
                    ? ` (R$ ${recommendedPlan.annualMonthlyPrice}/mês anual)`
                    : ""}
                </span>
              </Badge>
            )}
          </div>

          {contentHook && (
            <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
              <span className="font-medium text-foreground">Gancho sugerido: </span>
              {contentHook}
            </p>
          )}

          {signalExcerpt && (
            <p className="text-xs text-muted-foreground italic leading-relaxed break-words">
              “{signalExcerpt}”
            </p>
          )}

          {Array.isArray(strategyMeta?.alternatives) && strategyMeta.alternatives.length > 0 && (
            <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
              <span className="font-medium text-foreground">Linhas ranqueadas p/ este lead: </span>
              {strategyMeta.alternatives
                .slice(0, 3)
                .map((alt) => `${alt.shortLabel} (${alt.estimatedSuccessPct}%)`)
                .join(" › ")}
            </p>
          )}

          {Array.isArray(strategyMeta?.topTalkingPoints) &&
            strategyMeta.topTalkingPoints.length > 0 && (
              <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
                <span className="font-medium text-foreground">Pontos priorizados: </span>
                {strategyMeta.topTalkingPoints.slice(0, 3).join(" • ")}
              </p>
            )}
        </div>
      )}

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
