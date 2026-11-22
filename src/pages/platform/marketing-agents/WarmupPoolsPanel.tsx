import React, { useState } from "react";
import { Check, Copy, Flame, Network, Plus, Radio, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import type { MarketingWhatsAppInstance } from "./types";
import { formatPhoneBr } from "./antiBanEngine";
import { invokeZapGateway, marketingDb } from "./marketingAgentsService";

export interface WarmupPoolConfig {
  id: string;
  name: string;
  poolMode: "private_chips" | "collaborative_optin";
  inviteToken: string;
  dailyInteractionsTarget: number;
  enableMedia: boolean;
  enableAudioPtt: boolean;
  enableReactions: boolean;
  enableGroupInteractions: boolean;
  instanceIds: string[];
  isActive: boolean;
}

export interface WarmupPoolsPanelProps {
  pools?: WarmupPoolConfig[];
  instances?: MarketingWhatsAppInstance[];
  onSavePool?: (pool: WarmupPoolConfig) => Promise<void>;
}

const DEFAULT_POOLS: WarmupPoolConfig[] = [
  {
    id: "pool-multsender-principal",
    name: "Pool Privado Pluri (MultSender)",
    poolMode: "private_chips",
    inviteToken: "PLURI-WARM-2026A",
    dailyInteractionsTarget: 16,
    enableMedia: true,
    enableAudioPtt: false,
    enableReactions: true,
    enableGroupInteractions: false,
    instanceIds: ["inst-primary-5511965120431"],
    isActive: true,
  },
];

function generateInviteToken(): string {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `MMZAP-${rand}`;
}

export const WarmupPoolsPanel: React.FC<WarmupPoolsPanelProps> = ({
  pools,
  instances = [],
  onSavePool,
}) => {
  const [localPools, setLocalPools] = useState<WarmupPoolConfig[]>(DEFAULT_POOLS);
  const activePools = pools ?? localPools;

  const [poolMode, setPoolMode] = useState<"private_chips" | "collaborative_optin">("private_chips");
  const [poolName, setPoolName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [dailyTarget, setDailyTarget] = useState(14);
  const [enableMedia, setEnableMedia] = useState(true);
  const [enableAudioPtt, setEnableAudioPtt] = useState(false);
  const [enableReactions, setEnableReactions] = useState(true);
  const [enableGroupInteractions, setEnableGroupInteractions] = useState(false);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>(() =>
    instances.map((i) => i.id),
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleChipSelection = (id: string) => {
    setSelectedInstanceIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleCopyToken = async (pool: WarmupPoolConfig) => {
    try {
      await navigator.clipboard?.writeText(pool.inviteToken);
    } catch {
      // Clipboard opcional em ambientes headless
    }
    setCopiedId(pool.id);
    toast({ title: "Código copiado!", description: pool.inviteToken });
    setTimeout(() => setCopiedId(null), 1800);
  };

  const persistPool = async (pool: WarmupPoolConfig) => {
    if (onSavePool) {
      await onSavePool(pool);
      return;
    }
    try {
      await marketingDb.from("marketing_warmup_pools").upsert({
        id: pool.id.startsWith("pool-") ? undefined : pool.id,
        tenant_scope: "platform",
        name: pool.name,
        pool_mode: pool.poolMode,
        invite_token: pool.inviteToken,
        daily_interactions_target: pool.dailyInteractionsTarget,
        enable_media: pool.enableMedia,
        enable_audio_ptt: pool.enableAudioPtt,
        enable_reactions: pool.enableReactions,
        enable_group_interactions: pool.enableGroupInteractions,
        is_active: pool.isActive,
      });
      await invokeZapGateway("sync_warmup_pool", { pool }).catch(() => undefined);
    } catch {
      // Preview fallback local
    }
  };

  const handleCreateOrJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isJoining = poolMode === "collaborative_optin" && joinCode.trim().length > 0;
      const nextPool: WarmupPoolConfig = {
        id: `pool-${Date.now()}`,
        name: isJoining
          ? `Rede MMZap (${joinCode.trim().toUpperCase()})`
          : poolName.trim() ||
            (poolMode === "private_chips"
              ? "Pool Privado MultSender"
              : "Sala Mútua MMZap PRO"),
        poolMode,
        inviteToken: isJoining ? joinCode.trim().toUpperCase() : generateInviteToken(),
        dailyInteractionsTarget: dailyTarget,
        enableMedia,
        enableAudioPtt,
        enableReactions,
        enableGroupInteractions,
        instanceIds: selectedInstanceIds,
        isActive: true,
      };

      await persistPool(nextPool);
      setLocalPools((prev) => [nextPool, ...prev]);
      setPoolName("");
      setJoinCode("");
      toast({
        title: isJoining
          ? "Chip inscrito na rede mútua MMZap PRO!"
          : "Pool de aquecimento salvo!",
        description: `${nextPool.dailyInteractionsTarget} interações/dia configuradas.`,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePoolActive = async (pool: WarmupPoolConfig) => {
    const updated = { ...pool, isActive: !pool.isActive };
    setLocalPools((prev) => prev.map((p) => (p.id === pool.id ? updated : p)));
    await persistPool(updated);
  };

  return (
    <Card data-testid="warmup-pools-panel" className="w-full max-w-full min-w-0">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5 min-w-0">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-primary shrink-0" />
              Aquecimento Multi-Chip (MultSender + GrowSender + MMZap PRO)
            </CardTitle>
            <CardDescription className="text-xs">
              Troca orgânica de mensagens, áudios PTT, figurinhas e reações entre seus chips ou via rede opt-in por convite.
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-[11px]">
            {activePools.filter((p) => p.isActive).length} pool(s) ativo(s)
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Seletor de Modo: MultSender vs MMZap PRO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            type="button"
            variant={poolMode === "private_chips" ? "default" : "outline"}
            onClick={() => setPoolMode("private_chips")}
            className="min-h-[44px] sm:min-h-[38px] justify-start gap-2 text-xs"
          >
            <Radio className="h-4 w-4 shrink-0" />
            <span>MultSender (Pool Privado entre seus chips)</span>
          </Button>
          <Button
            type="button"
            variant={poolMode === "collaborative_optin" ? "default" : "outline"}
            onClick={() => setPoolMode("collaborative_optin")}
            className="min-h-[44px] sm:min-h-[38px] justify-start gap-2 text-xs"
          >
            <Users className="h-4 w-4 shrink-0" />
            <span>MMZap PRO (Rede Mútua Opt-In)</span>
          </Button>
        </div>

        {/* Formulário de Criação / Entrada + GrowSender Switches */}
        <form onSubmit={handleCreateOrJoin} className="rounded-xl border bg-muted/20 p-3.5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pool-name-input" className="text-xs">
                {poolMode === "private_chips"
                  ? "Nome do Pool Privado"
                  : "Criar Nova Sala MMZap PRO"}
              </Label>
              <Input
                id="pool-name-input"
                value={poolName}
                onChange={(e) => setPoolName(e.target.value)}
                placeholder={
                  poolMode === "private_chips"
                    ? "Ex: Pool Comercial + SDR"
                    : "Ex: Rede Clínicas Pilates SP"
                }
                className="min-h-[44px] sm:min-h-[38px] text-xs"
              />
            </div>

            {poolMode === "collaborative_optin" ? (
              <div className="space-y-1.5">
                <Label htmlFor="pool-join-code" className="text-xs">
                  Ou entrar com Código de Convite (Opcional)
                </Label>
                <Input
                  id="pool-join-code"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Ex: MMZAP-9K2PL"
                  className="min-h-[44px] sm:min-h-[38px] text-xs font-mono uppercase"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">Chips participantes ({selectedInstanceIds.length})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {instances.length === 0 ? (
                    <span className="text-xs text-muted-foreground">
                      Chip principal incluído automaticamente.
                    </span>
                  ) : (
                    instances.map((inst) => {
                      const selected = selectedInstanceIds.includes(inst.id);
                      return (
                        <Button
                          key={inst.id}
                          type="button"
                          size="sm"
                          variant={selected ? "secondary" : "outline"}
                          onClick={() => toggleChipSelection(inst.id)}
                          className="min-h-[38px] text-[11px] font-mono"
                        >
                          {formatPhoneBr(inst.phone_e164)}
                        </Button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cadência Diária (Slider + Input) */}
          <div className="space-y-2 rounded-lg border bg-background p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label htmlFor="pool-daily-target" className="text-xs font-semibold flex items-center gap-1.5">
                <Flame className="h-3.5 w-3.5 text-amber-500" />
                Meta Diária de Interações por Par
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pool-daily-target"
                  type="number"
                  min={1}
                  max={60}
                  value={dailyTarget}
                  onChange={(e) =>
                    setDailyTarget(Math.max(1, Math.min(60, Number(e.target.value) || 1)))
                  }
                  className="w-20 min-h-[38px] text-xs text-center font-mono"
                />
                <span className="text-xs text-muted-foreground">msgs/dia</span>
              </div>
            </div>
            <Slider
              value={[dailyTarget]}
              min={1}
              max={60}
              step={1}
              onValueChange={(vals) => setDailyTarget(vals[0] ?? 12)}
            />
          </div>

          {/* GrowSender Interaction Switches */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5">
              <span>Mídia / Figurinhas</span>
              <Switch checked={enableMedia} onCheckedChange={setEnableMedia} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5">
              <span>Áudio PTT realista</span>
              <Switch checked={enableAudioPtt} onCheckedChange={setEnableAudioPtt} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5">
              <span>Reações de Emoji</span>
              <Switch checked={enableReactions} onCheckedChange={setEnableReactions} />
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border bg-background p-2.5">
              <span>Interação em Grupos</span>
              <Switch
                checked={enableGroupInteractions}
                onCheckedChange={setEnableGroupInteractions}
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving}
              className="min-h-[44px] sm:min-h-[38px] gap-1.5 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>
                {joinCode.trim() && poolMode === "collaborative_optin"
                  ? "Entrar na Rede MMZap"
                  : "Criar / Salvar Pool"}
              </span>
            </Button>
          </div>
        </form>

        {/* Lista de Pools Configurados + Invite Code Copy Box */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activePools.map((pool) => (
            <div
              key={pool.id}
              className="rounded-xl border bg-card p-3.5 space-y-2.5 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-semibold truncate">{pool.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="text-[10px]">
                      {pool.poolMode === "private_chips" ? "MultSender Privado" : "MMZap PRO Opt-In"}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {pool.dailyInteractionsTarget}/dia
                    </Badge>
                  </div>
                </div>
                <Switch
                  checked={pool.isActive}
                  aria-label={`Ativar pool ${pool.name}`}
                  onCheckedChange={() => void handleTogglePoolActive(pool)}
                />
              </div>

              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                <span className="text-[11px] font-mono truncate">
                  Convite: <strong>{pool.inviteToken}</strong>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleCopyToken(pool)}
                  className="min-h-[38px] px-2 text-xs gap-1 shrink-0"
                >
                  {copiedId === pool.id ? (
                    <Check className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>Copiar</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
