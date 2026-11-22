import React, { useEffect, useState } from "react";
import { Ban, Flame, Save, ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AntiBanConfig, MarketingOptOut, MarketingWhatsAppInstance } from "./types";
import {
  formatPhoneBr,
  getWarmupDailyLimit,
  getWarmupPhaseLabel,
} from "./antiBanEngine";
import { WarmupPoolsPanel, type WarmupPoolConfig } from "./WarmupPoolsPanel";

interface WarmupAntiBanSectionProps {
  primaryInstance: MarketingWhatsAppInstance;
  optOuts: MarketingOptOut[];
  onSaveAntiBan: (
    instance: MarketingWhatsAppInstance,
    config: AntiBanConfig,
    warmupDay: number,
  ) => Promise<void>;
  onAddOptOut: (phone: string) => Promise<boolean>;
  onRemoveOptOut: (id: string) => Promise<void>;
  pools?: WarmupPoolConfig[];
  instances?: MarketingWhatsAppInstance[];
  onSavePool?: (pool: WarmupPoolConfig) => Promise<void>;
}

const WARMUP_PHASES = [
  { label: "Dias 1–3", limit: 15, desc: "Aquecimento inicial seguro" },
  { label: "Dias 4–7", limit: 35, desc: "Tração moderada" },
  { label: "Dias 8–14", limit: 80, desc: "Consolidação de reputação" },
  { label: "Dia 15+", limit: 150, desc: "Velocidade plena protegida" },
];

export const WarmupAntiBanSection: React.FC<WarmupAntiBanSectionProps> = ({
  primaryInstance,
  optOuts,
  onSaveAntiBan,
  onAddOptOut,
  onRemoveOptOut,
  pools,
  instances,
  onSavePool,
}) => {
  const [config, setConfig] = useState<AntiBanConfig>(primaryInstance.anti_ban_config);
  const [warmupDay, setWarmupDay] = useState<number>(primaryInstance.warmup_day);
  const [blockPhone, setBlockPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setConfig(primaryInstance.anti_ban_config);
    setWarmupDay(primaryInstance.warmup_day);
  }, [primaryInstance]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSaveAntiBan(primaryInstance, config, warmupDay);
    setSaving(false);
  };

  const handleAddBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockPhone.trim()) return;
    const ok = await onAddOptOut(blockPhone);
    if (ok) setBlockPhone("");
  };

  const calculatedLimit = config.auto_warmup
    ? getWarmupDailyLimit(warmupDay)
    : primaryInstance.daily_limit;

  return (
    <div className="space-y-4 w-full max-w-full min-w-0">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Flame className="h-4 w-4 text-amber-500" />
              Aquecimento & Blindagem Anti-Ban — {formatPhoneBr(primaryInstance.phone_e164)}
            </CardTitle>
            <CardDescription className="text-xs">
              Rampa progressiva de 21 dias, Jitter Gaussiano (Box-Muller), presença realista e Circuit Breaker automático.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {WARMUP_PHASES.map((phase) => (
                  <div
                    key={phase.label}
                    className={`rounded-xl border p-2.5 text-xs ${
                      calculatedLimit === phase.limit
                        ? "border-primary bg-primary/10"
                        : "bg-muted/25"
                    }`}
                  >
                    <p className="font-semibold">{phase.label}</p>
                    <p className="text-sm font-bold">{phase.limit}/dia</p>
                    <p className="text-[10px] text-muted-foreground">{phase.desc}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="ab-warmup-day" className="text-xs">Dia de Warm-up</Label>
                  <Input
                    id="ab-warmup-day"
                    type="number"
                    min={1}
                    max={60}
                    value={warmupDay}
                    onChange={(e) => setWarmupDay(Math.max(1, Number(e.target.value) || 1))}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ab-jitter-mean" className="text-xs">Jitter Médio (s)</Label>
                  <Input
                    id="ab-jitter-mean"
                    type="number"
                    min={15}
                    max={120}
                    value={config.jitter_mean_sec}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, jitter_mean_sec: Number(e.target.value) || 42 }))
                    }
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ab-win-start" className="text-xs">Janela Início</Label>
                  <Input
                    id="ab-win-start"
                    type="time"
                    value={config.business_start}
                    onChange={(e) => setConfig((c) => ({ ...c, business_start: e.target.value }))}
                    className="min-h-[44px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ab-win-end" className="text-xs">Janela Fim</Label>
                  <Input
                    id="ab-win-end"
                    type="time"
                    value={config.business_end}
                    onChange={(e) => setConfig((c) => ({ ...c, business_end: e.target.value }))}
                    className="min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border bg-muted/25 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>Rampa automática (15 → 150/dia)</span>
                  <Switch
                    checked={config.auto_warmup}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, auto_warmup: v }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Simular "digitando..." (composing)</span>
                  <Switch
                    checked={config.presence_typing}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, presence_typing: v }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Validar onWhatsApp (cache 30d)</span>
                  <Switch
                    checked={config.validate_on_whatsapp}
                    onCheckedChange={(v) => setConfig((c) => ({ ...c, validate_on_whatsapp: v }))}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>Circuit Breaker ({config.circuit_breaker_error_pct}% erro)</span>
                  <Badge variant="outline">{getWarmupPhaseLabel(warmupDay)}</Badge>
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={saving} className="min-h-[44px] gap-2">
                  <Save className="h-4 w-4" />
                  <span>{saving ? "Salvando..." : "Salvar Blindagem"}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Ban className="h-4 w-4 text-rose-500" />
              Lista de Opt-Out LGPD (Bloqueio O(1))
            </CardTitle>
            <CardDescription className="text-xs">
              Números que responderam &quot;PARAR/SAIR&quot; ou bloqueados manualmente nunca mais recebem disparos.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <form onSubmit={handleAddBlock} className="flex gap-2">
              <Input
                value={blockPhone}
                onChange={(e) => setBlockPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className="min-h-[44px]"
              />
              <Button type="submit" variant="secondary" className="min-h-[44px] shrink-0">
                Bloquear
              </Button>
            </form>

            <div className="w-full overflow-x-auto touch-pan-x rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Telefone</TableHead>
                    <TableHead className="text-xs">Origem</TableHead>
                    <TableHead className="text-xs text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {optOuts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-6">
                        <ShieldCheck className="h-4 w-4 mx-auto mb-1 text-emerald-500" />
                        Nenhum opt-out registrado até o momento.
                      </TableCell>
                    </TableRow>
                  ) : (
                    optOuts.map((opt) => (
                      <TableRow key={opt.id}>
                        <TableCell className="text-xs font-mono">
                          {formatPhoneBr(opt.phone_e164)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {opt.source_channel}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label={`Remover opt-out ${opt.phone_e164}`}
                            onClick={() => void onRemoveOptOut(opt.id)}
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <WarmupPoolsPanel
        pools={pools}
        instances={instances ?? [primaryInstance]}
        onSavePool={onSavePool}
      />
    </div>
  );
};
