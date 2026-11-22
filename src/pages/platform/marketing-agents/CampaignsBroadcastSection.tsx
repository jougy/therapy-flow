import React, { useState } from "react";
import { Mic, Pause, Play, Send, Shuffle, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MarketingAiAgent, MarketingWhatsAppInstance, MarketingZapCampaign } from "./types";
import type { AudienceContactItem, CampaignMediaPayload, WhatsAppGroupRecord } from "./suiteTypes";
import type { CampaignDraftInput } from "./useMarketingAgents";
import type { ParsedContactsResult } from "./zapSuiteEngine";
import { estimateCampaignMinutes, formatPhoneBr, interpolateLeadTemplate, resolveSpintax } from "./antiBanEngine";
import { CsvAudienceImporter } from "./CsvAudienceImporter";
import { PushZapQuickSenderCard } from "./PushZapQuickSenderCard";

export type UiCampaignMode = "auto_lead" | "classic_fast" | "whatsapp_marketing" | "multi_chip" | "group_broadcast";

export type ExtendedCampaignDraftInput = CampaignDraftInput &
  Partial<Pick<MarketingZapCampaign, "campaign_mode" | "instance_pool_ids" | "target_group_jids" | "media_payload" | "require_turbo_filter">> & {
    parsed_contacts?: AudienceContactItem[];
    audience_list_name?: string;
  };

interface CampaignsBroadcastSectionProps {
  instances: MarketingWhatsAppInstance[];
  agents: MarketingAiAgent[];
  campaigns: MarketingZapCampaign[];
  eligibleLeadsCount: number;
  onCreateCampaign: (draft: ExtendedCampaignDraftInput) => Promise<boolean>;
  onToggleCampaignStatus: (campaign: MarketingZapCampaign) => Promise<void>;
  groups?: WhatsAppGroupRecord[];
  onSendPushAlert?: (payload: { instanceId: string; phone: string; message: string }) => Promise<boolean>;
}

const DEFAULT_SPINTAX_TEMPLATE =
  "{Olá|Oi|Tudo bem}, {{primeiro_nome}}! Vi seu contato sobre {fisioterapia|atendimentos clínicos} em {{cidade}} e queria te mostrar como o Pluri Fisio automatiza prontuários e agenda em 10 min. Posso te enviar?";

function mapUiModeToDbMode(mode: UiCampaignMode): MarketingZapCampaign["campaign_mode"] {
  return mode === "auto_lead" || mode === "whatsapp_marketing" ? "standard" : mode;
}

export const CampaignsBroadcastSection: React.FC<CampaignsBroadcastSectionProps> = ({
  instances,
  agents,
  campaigns,
  eligibleLeadsCount,
  onCreateCampaign,
  onToggleCampaignStatus,
  groups = [],
  onSendPushAlert,
}) => {
  const [mode, setMode] = useState<UiCampaignMode>("auto_lead");
  const [name, setName] = useState("Campanha Boas-Vindas Auto-Lead");
  const [instanceId, setInstanceId] = useState(instances[0]?.id || "");
  const [poolIds, setPoolIds] = useState<string[]>(instances.map((i) => i.id));
  const [selectedGroupJids, setSelectedGroupJids] = useState<string[]>([]);
  const [agentId, setAgentId] = useState(agents[0]?.id || "");
  const [minScore, setMinScore] = useState(70);
  const [template, setTemplate] = useState(DEFAULT_SPINTAX_TEMPLATE);
  const [enableSpintax, setEnableSpintax] = useState(true);
  const [requireTurboFilter, setRequireTurboFilter] = useState(true);
  const [mediaType, setMediaType] = useState<CampaignMediaPayload["mediaType"]>("none");
  const [mediaUrl, setMediaUrl] = useState("");
  const [ttsScript, setTtsScript] = useState("");
  const [parsedAudience, setParsedAudience] = useState<ParsedContactsResult | null>(null);
  const [audienceListName, setAudienceListName] = useState("Lista Importada CSV");
  const [spintaxPreview, setSpintaxPreview] = useState(() =>
    interpolateLeadTemplate(resolveSpintax(DEFAULT_SPINTAX_TEMPLATE), { primeiro_nome: "Dra. Camila", clinica: "Clínica Movimento", cidade: "São Paulo" }),
  );
  const [submitting, setSubmitting] = useState(false);

  const activeInstance = instances.find((i) => i.id === instanceId) || instances[0];
  const usesCsvAudience = mode === "classic_fast" || mode === "whatsapp_marketing";
  const targetPoolCount = usesCsvAudience ? parsedAudience?.contacts.length || 0 : eligibleLeadsCount || 15;
  const estimatedTargets = Math.min(targetPoolCount, activeInstance?.daily_limit || 15);
  const estimatedMins = estimateCampaignMinutes(
    Math.max(1, estimatedTargets),
    activeInstance?.anti_ban_config.jitter_mean_sec || 42,
    activeInstance?.anti_ban_config.block_size || 15,
    activeInstance?.anti_ban_config.block_pause_min || 3,
  );

  const handleTestSpintax = () => {
    const interpolated = interpolateLeadTemplate(template, { primeiro_nome: "Dra. Camila", clinica: "Clínica Movimento", cidade: "São Paulo" });
    setSpintaxPreview(enableSpintax ? resolveSpintax(interpolated) : interpolated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !template.trim() || !activeInstance) return;
    setSubmitting(true);
    const mediaPayload: Record<string, unknown> =
      mediaType && mediaType !== "none"
        ? { mediaType, mediaUrl: mediaUrl.trim() || undefined, ttsScript: ttsScript.trim() || undefined, simulateRecordingSec: mediaType === "audio_ptt" ? 4 : undefined }
        : {};
    await onCreateCampaign({
      name: name.trim(),
      instance_id: activeInstance.id,
      agent_id: agentId || null,
      min_score: Math.max(0, Math.min(100, Number(minScore) || 70)),
      message_template: template.trim(),
      enable_ai_spintax: enableSpintax,
      campaign_mode: mapUiModeToDbMode(mode),
      instance_pool_ids: mode === "multi_chip" ? poolIds : [activeInstance.id],
      target_group_jids: mode === "group_broadcast" ? selectedGroupJids : [],
      media_payload: mediaPayload,
      require_turbo_filter: requireTurboFilter,
      parsed_contacts: usesCsvAudience ? parsedAudience?.contacts : undefined,
      audience_list_name: usesCsvAudience ? audienceListName : undefined,
    });
    setSubmitting(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full max-w-full min-w-0">
      <Card className="lg:col-span-7">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-primary" />
            Nova Campanha de Disparo Seguro (Auto-Lead / CSV / UltraSender)
          </CardTitle>
          <CardDescription className="text-xs">
            Enfileira leads respeitando aquecimento, Filtro Turbo, Opt-Out LGPD e Jitter Gaussiano.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="camp-mode">Modo de Disparo</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as UiCampaignMode)}>
                  <SelectTrigger id="camp-mode" className="min-h-[44px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto_lead">Auto-Lead Qualificado</SelectItem>
                    <SelectItem value="classic_fast">Wa Sender Clássico (CSV)</SelectItem>
                    <SelectItem value="whatsapp_marketing">WhatsApp Marketing (CSV + Mídia/PTT)</SelectItem>
                    <SelectItem value="multi_chip">UltraSender (Pool Multi-Chip)</SelectItem>
                    <SelectItem value="group_broadcast">GroupMaster (Grupos)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-name">Nome da Campanha</Label>
                <Input id="camp-name" value={name} onChange={(e) => setName(e.target.value)} className="min-h-[44px]" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-score">Score Mínimo (0–100)</Label>
                <Input id="camp-score" type="number" min={0} max={100} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="min-h-[44px]" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="camp-instance">Chip Disparador Principal</Label>
                <Select value={instanceId} onValueChange={setInstanceId}>
                  <SelectTrigger id="camp-instance" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {instances.map((i) => (
                      <SelectItem key={i.id} value={i.id}>{formatPhoneBr(i.phone_e164)} (teto {i.daily_limit}/dia)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="camp-agent">Agente IA que Assume a Resposta</Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger id="camp-agent" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {mode === "multi_chip" && (
              <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                <p className="text-xs font-semibold">Pool Multi-Chip UltraSender (Rodízio Ponderado)</p>
                <div className="flex flex-wrap gap-3">
                  {instances.map((inst) => (
                    <label key={inst.id} className="flex items-center gap-2 text-xs cursor-pointer min-h-[36px]">
                      <Checkbox checked={poolIds.includes(inst.id)} onCheckedChange={() => setPoolIds((p) => (p.includes(inst.id) ? p.filter((x) => x !== inst.id) : [...p, inst.id]))} />
                      <span>{formatPhoneBr(inst.phone_e164)} ({inst.health_score} pts)</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {mode === "group_broadcast" && (
              <div className="rounded-xl border bg-muted/20 p-3 space-y-2 text-xs">
                <p className="font-semibold">Grupos de Destino ({selectedGroupJids.length})</p>
                {groups.length === 0 ? (
                  <p className="text-muted-foreground">Sincronize grupos na aba Filtro Turbo & Grupos para listá-los aqui.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {groups.map((grp) => (
                      <label key={grp.groupJid} className="flex items-center gap-1.5 border rounded-lg px-2 py-1 bg-background cursor-pointer">
                        <Checkbox checked={selectedGroupJids.includes(grp.groupJid)} onCheckedChange={() => setSelectedGroupJids((p) => (p.includes(grp.groupJid) ? p.filter((x) => x !== grp.groupJid) : [...p, grp.groupJid]))} />
                        <span>{grp.subject}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {usesCsvAudience && (
              <CsvAudienceImporter
                value={parsedAudience}
                onAudienceParsed={(res, listName) => {
                  setParsedAudience(res);
                  if (listName) setAudienceListName(listName);
                }}
                onInsertVariable={(token) => setTemplate((prev) => `${prev} ${token}`)}
              />
            )}

            <div className="rounded-xl border bg-muted/20 p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="camp-media-type" className="text-xs flex items-center gap-1.5">
                  <Mic className="h-3.5 w-3.5 text-primary" />Mídia / Áudio OGG PTT &ldquo;Gravado na Hora&rdquo;
                </Label>
                <Select value={mediaType} onValueChange={(v) => setMediaType(v as CampaignMediaPayload["mediaType"])}>
                  <SelectTrigger id="camp-media-type" className="w-full sm:w-56 min-h-[40px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Somente Texto</SelectItem>
                    <SelectItem value="audio_ptt">Áudio OGG PTT (Gravado na Hora)</SelectItem>
                    <SelectItem value="image">Imagem / Banner</SelectItem>
                    <SelectItem value="document">Documento PDF</SelectItem>
                    <SelectItem value="video">Vídeo Curto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {mediaType !== "none" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="URL pública (.ogg / .png / .pdf)" className="min-h-[44px] text-xs" />
                  {mediaType === "audio_ptt" && (
                    <Input value={ttsScript} onChange={(e) => setTtsScript(e.target.value)} placeholder="Roteiro TTS opcional" className="min-h-[44px] text-xs" />
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="camp-template">Template com Spintax Anti-Hash</Label>
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer"><Switch checked={requireTurboFilter} onCheckedChange={setRequireTurboFilter} /><span>Exigir Filtro Turbo</span></label>
                  <label className="flex items-center gap-2 cursor-pointer"><Switch checked={enableSpintax} onCheckedChange={setEnableSpintax} /><span>Spintax ativo</span></label>
                </div>
              </div>
              <Textarea id="camp-template" rows={3} value={template} onChange={(e) => setTemplate(e.target.value)} required />
            </div>

            <div className="rounded-xl border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-primary" />Preview Anti-Ban Gerado</span>
                <Button type="button" variant="ghost" size="sm" onClick={handleTestSpintax} className="h-8 gap-1 text-xs"><Shuffle className="h-3.5 w-3.5" />Sortear Variação</Button>
              </div>
              <p className="text-muted-foreground italic">{spintaxPreview}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Users className="h-4 w-4 text-primary" />
                <span>Alvos: <strong>{targetPoolCount}</strong> • Lote seguro: <strong>{estimatedTargets}</strong> (~{estimatedMins} min com Jitter)</span>
              </div>
              <Button type="submit" data-testid="enqueue-campaign-btn" disabled={submitting} className="min-h-[44px] gap-2">
                <Send className="h-4 w-4" /><span>{submitting ? "Enfileirando..." : "Agendar Disparo Seguro"}</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="lg:col-span-5 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Campanhas & Filas Criadas</CardTitle>
            <CardDescription className="text-xs">Acompanhe progresso de entrega, respostas e pausas de segurança.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaigns.length === 0 ? (
              <p className="text-xs text-muted-foreground py-5 text-center">
                Nenhuma campanha agendada ainda. Chip principal: {activeInstance ? formatPhoneBr(activeInstance.phone_e164) : "(11) 96512-0431"}.
              </p>
            ) : (
              campaigns.map((camp) => (
                <div key={camp.id} className="rounded-xl border p-3 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{camp.name}</p>
                      <p className="text-[11px] text-muted-foreground">Alvos: {camp.total_targets} • Enviados: {camp.sent_count} • Respostas: {camp.replied_count}</p>
                    </div>
                    <Badge variant="outline">{camp.status}</Badge>
                  </div>
                  <div className="flex justify-end">
                    <Button type="button" variant="outline" size="sm" onClick={() => void onToggleCampaignStatus(camp)} className="min-h-[36px] gap-1 text-xs">
                      {camp.status === "paused" ? <><Play className="h-3.5 w-3.5" /> Retomar</> : <><Pause className="h-3.5 w-3.5" /> Pausar</>}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <PushZapQuickSenderCard instances={instances} onSendPush={onSendPushAlert} />
      </div>
    </div>
  );
};
