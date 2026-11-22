import React, { useState } from "react";
import {
  Check,
  Copy,
  KeyRound,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Terminal,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_MARKETING_CHIP_DISPLAY,
  INSTANCE_STATUS_META,
  type MarketingWhatsAppInstance,
} from "./types";
import type { ZapDefenderReport } from "./suiteTypes";
import { formatPhoneBr, getWarmupPhaseLabel } from "./antiBanEngine";
import { PhoneSyncWizardCard } from "./PhoneSyncWizardCard";
import { ZapDefenderAuditCard } from "./ZapDefenderAuditCard";
import { AndroidBridgeSetupSheet } from "./AndroidBridgeSetupSheet";

interface ConnectionsQrSectionProps {
  instances: MarketingWhatsAppInstance[];
  qrCodeBase64: string | null;
  evolutionSetupHint: string | null;
  connectingInstanceKey: string | null;
  onConnectQr: (instanceKey: string) => Promise<void>;
  onCheckStatus: (instanceKey: string) => Promise<void>;
  onToggleCircuitBreaker: (instance: MarketingWhatsAppInstance, trip: boolean) => Promise<void>;
  onAddExtraInstance: (displayName: string, rawPhone: string) => Promise<boolean>;
  onRequestPairingCode?: (inst: MarketingWhatsAppInstance) => Promise<string | null>;
  defenderReports?: Record<string, ZapDefenderReport>;
  onRunDefenderAudit?: (inst: MarketingWhatsAppInstance) => Promise<ZapDefenderReport | void>;
  auditingInstanceId?: string | null;
}

const DOCKER_START_CMD = "npm run marketing:conectar-celular";

export const ConnectionsQrSection: React.FC<ConnectionsQrSectionProps> = ({
  instances,
  qrCodeBase64,
  evolutionSetupHint,
  connectingInstanceKey,
  onConnectQr,
  onCheckStatus,
  onToggleCircuitBreaker,
  onAddExtraInstance,
  onRequestPairingCode,
  defenderReports,
  onRunDefenderAudit,
  auditingInstanceId,
}) => {
  const [newChipName, setNewChipName] = useState("");
  const [newChipPhone, setNewChipPhone] = useState("");
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [pairingCodes, setPairingCodes] = useState<Record<string, string>>({});
  const [requestingCodeId, setRequestingCodeId] = useState<string | null>(null);
  const [expandedDefenderId, setExpandedDefenderId] = useState<string | null>(null);
  const [androidBridgeInstance, setAndroidBridgeInstance] = useState<MarketingWhatsAppInstance | null>(null);

  const handleCopyCmd = async () => {
    try {
      await navigator.clipboard.writeText(DOCKER_START_CMD);
      setCopiedCmd(true);
      toast({ title: "Comando copiado!" });
      setTimeout(() => setCopiedCmd(false), 2000);
    } catch {
      toast({ title: "Copie manualmente o comando abaixo" });
    }
  };

  const handleAddPoolChip = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await onAddExtraInstance(newChipName, newChipPhone);
    if (ok) {
      setNewChipName("");
      setNewChipPhone("");
    }
  };

  const handlePairingCode = async (inst: MarketingWhatsAppInstance) => {
    if (!onRequestPairingCode) {
      toast({
        title: "Pareamento por Código de 8 Dígitos",
        description: `Abra WhatsApp → Aparelhos conectados → Conectar com número de telefone para ${formatPhoneBr(inst.phone_e164)}.`,
      });
      return;
    }
    setRequestingCodeId(inst.id);
    try {
      const code = await onRequestPairingCode(inst);
      if (code) {
        setPairingCodes((prev) => ({ ...prev, [inst.id]: code }));
        toast({ title: `Código de pareamento gerado: ${code}` });
      }
    } finally {
      setRequestingCodeId(null);
    }
  };

  const handleToggleDefender = async (inst: MarketingWhatsAppInstance) => {
    if (expandedDefenderId === inst.id) {
      setExpandedDefenderId(null);
      return;
    }
    setExpandedDefenderId(inst.id);
    if (!defenderReports?.[inst.id] && onRunDefenderAudit) {
      await onRunDefenderAudit(inst);
    }
  };

  const primary = instances[0];

  return (
    <div className="space-y-4 w-full max-w-full min-w-0">
      {primary && (
        <PhoneSyncWizardCard
          isConnected={primary.status === "connected"}
          isConnecting={connectingInstanceKey === primary.instance_key}
          onGenerateQr={() => onConnectQr(primary.instance_key)}
          onVerifyConnection={() => onCheckStatus(primary.instance_key)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {instances.map((inst) => {
          const statusMeta = INSTANCE_STATUS_META[inst.status];
          const isConnecting = connectingInstanceKey === inst.instance_key;
          const isTripped = inst.status === "circuit_broken";
          const usagePct =
            inst.daily_limit > 0
              ? Math.min(100, Math.round((inst.daily_sent_count / inst.daily_limit) * 100))
              : 0;
          const activePairingCode = pairingCodes[inst.id] || inst.pairing_code;
          const defenderOpen = expandedDefenderId === inst.id;

          return (
            <Card
              key={inst.id}
              data-testid={`instance-card-${inst.instance_key}`}
              className="border-primary/25"
            >
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{inst.display_name}</span>
                    </CardTitle>
                    <CardDescription className="text-xs font-mono break-all">
                      {formatPhoneBr(inst.phone_e164)} • instância: {inst.instance_key}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className={statusMeta.badgeClass}>
                    {statusMeta.label}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1">
                    <span className="text-muted-foreground">Health Score Anti-Ban</span>
                    <div className="flex items-center justify-between font-bold">
                      <span>{inst.health_score}/100</span>
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {inst.health_score >= 80 ? "Saudável" : "Atenção"}
                      </span>
                    </div>
                    <Progress value={inst.health_score} className="h-1.5" />
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-2.5 space-y-1">
                    <span className="text-muted-foreground">Cota Hoje ({getWarmupPhaseLabel(inst.warmup_day)})</span>
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        {inst.daily_sent_count} / {inst.daily_limit}
                      </span>
                      <span>Dia {inst.warmup_day}</span>
                    </div>
                    <Progress value={usagePct} className="h-1.5" />
                  </div>
                </div>

                {activePairingCode && (
                  <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <span>Código de Pareamento 8 Dígitos:</span>
                    <Badge className="font-mono text-sm tracking-widest">{activePairingCode}</Badge>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    data-testid={`connect-qr-btn-${inst.instance_key}`}
                    disabled={isConnecting || isTripped}
                    onClick={() => void onConnectQr(inst.instance_key)}
                    className="min-h-[44px] sm:min-h-[38px] gap-1.5"
                  >
                    <QrCode className="h-4 w-4" />
                    <span>{isConnecting ? "Gerando QR..." : "Gerar QR Code"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={requestingCodeId === inst.id || isTripped}
                    onClick={() => void handlePairingCode(inst)}
                    className="min-h-[44px] sm:min-h-[38px] gap-1.5"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>{requestingCodeId === inst.id ? "Gerando..." : "Código 8 Dígitos"}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void onCheckStatus(inst.instance_key)}
                    className="min-h-[44px] sm:min-h-[38px] gap-1.5"
                  >
                    <RefreshCw className="h-4 w-4" />
                    <span>Verificar Conexão</span>
                  </Button>

                  <Button
                    type="button"
                    variant={defenderOpen ? "secondary" : "outline"}
                    size="sm"
                    onClick={() => void handleToggleDefender(inst)}
                    className="min-h-[44px] sm:min-h-[38px] gap-1.5"
                  >
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span>Check-up Defender</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAndroidBridgeInstance(inst)}
                    className="min-h-[44px] sm:min-h-[38px] gap-1.5"
                  >
                    <Smartphone className="h-4 w-4 text-emerald-600" />
                    <span>Bridge Android (MobZap)</span>
                  </Button>

                  <Button
                    type="button"
                    variant={isTripped ? "secondary" : "destructive"}
                    size="sm"
                    onClick={() => void onToggleCircuitBreaker(inst, !isTripped)}
                    className="min-h-[44px] sm:min-h-[38px] gap-1.5"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    <span>{isTripped ? "Rearmar Chip" : "Circuit Breaker"}</span>
                  </Button>
                </div>

                {defenderOpen && (
                  <ZapDefenderAuditCard
                    instance={inst}
                    report={defenderReports?.[inst.id]}
                    auditing={auditingInstanceId === inst.id}
                    onRunAudit={(target) => onRunDefenderAudit?.(target)}
                  />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {qrCodeBase64 && (
        <Card data-testid="evolution-qr-preview" className="border-sky-500/40 bg-sky-500/5">
          <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-4">
            <img
              src={qrCodeBase64.startsWith("data:") ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`}
              alt={`QR Code WhatsApp ${DEFAULT_MARKETING_CHIP_DISPLAY}`}
              className="w-48 h-48 rounded-xl border bg-white p-2 shrink-0"
            />
            <div className="space-y-2 text-xs">
              <p className="text-sm font-semibold">
                Escaneie no WhatsApp do chip {DEFAULT_MARKETING_CHIP_DISPLAY}
              </p>
              <p className="text-muted-foreground">
                Abra o WhatsApp no aparelho do número {DEFAULT_MARKETING_CHIP_DISPLAY} →{" "}
                <strong>Aparelhos conectados → Conectar aparelho</strong> → aponte para o QR Code e depois clique em{" "}
                <strong>Verificar Conexão</strong>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="h-4 w-4 text-primary" />
            Ativação do Container Evolution API v2 (Custo R$ 0)
          </CardTitle>
          <CardDescription className="text-xs">
            {evolutionSetupHint ||
              "Use o script pronto para parear o chip (11) 96512-0431 localmente via Cloudflare Tunnel ou na Oracle Cloud Always Free ARM."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-muted/50 p-3 flex items-center justify-between gap-2">
            <code className="text-[11px] font-mono break-all text-foreground">{DOCKER_START_CMD}</code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleCopyCmd()}
              className="min-h-[44px] sm:min-h-[36px] shrink-0 gap-1"
            >
              {copiedCmd ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedCmd ? "Copiado" : "Copiar"}</span>
            </Button>
          </div>

          <form onSubmit={handleAddPoolChip} className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t">
            <div className="space-y-1">
              <Label htmlFor="pool-chip-name" className="text-xs">
                Adicionar chip extra ao Pool (opcional)
              </Label>
              <Input
                id="pool-chip-name"
                value={newChipName}
                onChange={(e) => setNewChipName(e.target.value)}
                placeholder="Ex: Chip Backup 02"
                className="min-h-[44px]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pool-chip-phone" className="text-xs">
                Número WhatsApp (DDD + Número)
              </Label>
              <Input
                id="pool-chip-phone"
                value={newChipPhone}
                onChange={(e) => setNewChipPhone(e.target.value)}
                placeholder="(11) 99999-0000"
                className="min-h-[44px]"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="secondary" className="w-full min-h-[44px] gap-1.5">
                <Plus className="h-4 w-4" />
                <span>Adicionar ao Pool</span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AndroidBridgeSetupSheet
        open={androidBridgeInstance !== null}
        onOpenChange={(isOpen) => !isOpen && setAndroidBridgeInstance(null)}
        instance={androidBridgeInstance}
      />
    </div>
  );
};
