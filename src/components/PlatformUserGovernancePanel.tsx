import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Ban,
  Lock,
  Clock,
  Printer,
  EyeOff,
  AlertTriangle,
  Plus,
  Trash2,
  CheckCircle2,
  Sliders,
  UserCheck,
  UserX,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PUNISHMENT_LABELS } from "@/components/PlatformGovernanceSettings";

export interface UserPunishmentRecord {
  punishment_id: string;
  punishment_type: string;
  applied_at: string;
  expires_at: string | null;
  reason: string;
  is_manual: boolean;
  applied_by_name: string;
}

export interface PlatformUserGovernancePanelProps {
  userId: string;
  userName?: string;
  onRefresh?: () => void;
}

export const PlatformUserGovernancePanel: React.FC<PlatformUserGovernancePanelProps> = ({
  userId,
  userName,
  onRefresh,
}) => {
  const [activePunishments, setActivePunishments] = useState<UserPunishmentRecord[]>([]);
  const [userOverride, setUserOverride] = useState<{ max_actions: number; time_window_minutes: number } | null>(null);
  const [loading, setLoading] = useState(true);

  // Manual Punishment Modal State
  const [punishModalOpen, setPunishModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("read_only_mode");
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [reason, setReason] = useState("");
  const [submittingPunishment, setSubmittingPunishment] = useState(false);

  // VIP Override Modal State
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [overrideMaxActions, setOverrideMaxActions] = useState<number>(150);
  const [overrideTimeWindow, setOverrideTimeWindow] = useState<number>(5);
  const [submittingOverride, setSubmittingOverride] = useState(false);

  const loadGovernanceData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [punishRes, overrideRes] = await Promise.all([
        supabase.rpc("get_user_active_governance", { _user_id: userId }),
        supabase.from("user_governance_overrides").select("max_actions, time_window_minutes").eq("user_id", userId).single(),
      ]);

      if (punishRes.error) throw punishRes.error;
      setActivePunishments((punishRes.data || []) as UserPunishmentRecord[]);

      if (overrideRes.data) {
        setUserOverride(overrideRes.data);
        setOverrideMaxActions(overrideRes.data.max_actions);
        setOverrideTimeWindow(overrideRes.data.time_window_minutes);
      } else {
        setUserOverride(null);
      }
    } catch (err: unknown) {
      console.warn("[GovernancePanel] Error loading user governance:", err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadGovernanceData();
  }, [loadGovernanceData]);

  const handleApplyPunishment = async () => {
    if (!reason.trim() || reason.trim().length < 5) {
      toast({ title: "Motivo Obrigatório", description: "Escreva um motivo com pelo menos 5 caracteres.", variant: "destructive" });
      return;
    }
    setSubmittingPunishment(true);

    try {
      const { error } = await supabase.rpc("apply_user_punishment", {
        _user_id: userId,
        _punishment_type: selectedType,
        _duration_minutes: durationMinutes > 0 ? durationMinutes : null,
        _reason: reason.trim(),
        _is_manual: true,
      });

      if (error) throw error;

      toast({
        title: "Punição Aplicada com Sucesso",
        description: `A punição "${PUNISHMENT_LABELS[selectedType]?.label}" foi registrada no perfil do usuário.`,
      });

      setPunishModalOpen(false);
      setReason("");
      void loadGovernanceData();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao aplicar punição";
      toast({ title: "Erro ao aplicar punição", description: message, variant: "destructive" });
    } finally {
      setSubmittingPunishment(false);
    }
  };

  const handleRevokePunishment = async (punishmentId: string) => {
    try {
      const { error } = await supabase.rpc("revoke_user_punishment", {
        _punishment_id: punishmentId,
        _reason: "Revogado manualmente pelo administrador do Backoffice",
      });

      if (error) throw error;

      toast({
        title: "Punição Revogada",
        description: "A restrição foi removida imediatamente da conta do colaborador.",
      });

      void loadGovernanceData();
      if (onRefresh) onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao revogar punição";
      toast({ title: "Erro ao revogar", description: message, variant: "destructive" });
    }
  };

  const handleSaveOverride = async () => {
    setSubmittingOverride(true);
    try {
      const { error } = await supabase.from("user_governance_overrides").upsert({
        user_id: userId,
        max_actions: overrideMaxActions,
        time_window_minutes: overrideTimeWindow,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      toast({
        title: "Sobrescrita VIP Salva",
        description: `Limites personalizados ajustados para ${overrideMaxActions} ações / ${overrideTimeWindow}min.`,
      });

      setOverrideModalOpen(false);
      void loadGovernanceData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar sobrescrita";
      toast({ title: "Erro na sobrescrita", description: message, variant: "destructive" });
    } finally {
      setSubmittingOverride(false);
    }
  };

  return (
    <Card className="shadow-sm border-neutral-200/80">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" /> Governança & Punições da Conta
          </CardTitle>
          <CardDescription>
            Controle mestre de punições ativas, restrições e limites customizados para {userName || "este usuário"}.
          </CardDescription>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setOverrideModalOpen(true)} className="gap-1.5 text-xs">
            <Sliders className="w-3.5 h-3.5" /> Limite VIP ({userOverride ? `${userOverride.max_actions} ac/5m` : "Padrão"})
          </Button>
          <Button size="sm" onClick={() => setPunishModalOpen(true)} className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white">
            <UserX className="w-3.5 h-3.5" /> Aplicar Punição Manual
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        
        {/* Status Overview */}
        <div className="p-4 rounded-xl border border-neutral-200/80 bg-neutral-50/50 dark:bg-neutral-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {activePunishments.length === 0 ? (
              <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
            ) : (
              <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <UserX className="w-5 h-5" />
              </div>
            )}
            <div>
              <p className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                {activePunishments.length === 0 ? "Status: Conta sem Restrições Ativas" : `Status: ${activePunishments.length} Punição(ões) Vigente(s)`}
              </p>
              <p className="text-xs text-muted-foreground">
                {activePunishments.length === 0
                  ? "Esta conta possui acesso normal conforme permissões do papel."
                  : "Restrições de segurança ativas aplicadas por rate-limit ou ação manual."}
              </p>
            </div>
          </div>

          <Badge variant={activePunishments.length === 0 ? "secondary" : "destructive"} className="self-start sm:self-auto font-medium">
            {activePunishments.length === 0 ? "Normal / Regular" : "Restrito"}
          </Badge>
        </div>

        {/* Active Punishments List */}
        {activePunishments.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Punições Vigentes</p>
            <div className="space-y-2">
              {activePunishments.map((p) => {
                const info = PUNISHMENT_LABELS[p.punishment_type] || { label: p.punishment_type, icon: <Ban className="w-4 h-4" /> };
                return (
                  <div
                    key={p.punishment_id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-red-200/80 bg-red-50/40 dark:bg-red-950/20 gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        {info.icon}
                        <span className="font-semibold text-sm text-red-950 dark:text-red-200">{info.label}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {p.is_manual ? `Manual (${p.applied_by_name})` : "Automático"}
                        </Badge>
                      </div>
                      <p className="text-xs text-red-900/80 dark:text-red-300">{p.reason}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        Expira em: {p.expires_at ? new Date(p.expires_at).toLocaleString("pt-BR") : "Permanente (até revogação)"}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokePunishment(p.punishment_id)}
                      className="h-8 px-3 text-xs border-red-300 text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" /> Revogar Punição
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </CardContent>

      {/* Modal: Aplicar Punição Manual */}
      <Dialog open={punishModalOpen} onOpenChange={setPunishModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Aplicar Punição Manual</DialogTitle>
            <DialogDescription>
              Selecione o tipo de restrição e a duração aplicável para {userName || "esta conta"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3">
            <div className="space-y-2">
              <Label>Tipo de Punição</Label>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PUNISHMENT_LABELS).map(([key, item]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        {item.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{PUNISHMENT_LABELS[selectedType]?.description}</p>
            </div>

            {selectedType !== "warning_modal" && selectedType !== "permanent_ban" && (
              <div className="space-y-2">
                <Label>Duração em Minutos (0 = Permanente)</Label>
                <Input
                  type="number"
                  min="0"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">Ex: 60 min (1h), 1440 min (24h).</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Motivo Auditável <span className="text-red-500">*</span></Label>
              <Textarea
                placeholder="Ex: Suspeita de vazamento de dados ou violação das regras de uso da plataforma."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={submittingPunishment}>Cancelar</Button>
            </DialogClose>
            <Button
              onClick={handleApplyPunishment}
              disabled={submittingPunishment || !reason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {submittingPunishment ? "Aplicando..." : "Confirmar Punição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: VIP Override */}
      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Sobrescrever Limites de Rate-Limit (VIP)</DialogTitle>
            <DialogDescription>
              Defina limites personalizados de requisições por minuto para {userName || "este usuário"}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-3">
            <div className="space-y-2">
              <Label>Máximo de Ações Permitidas</Label>
              <Input
                type="number"
                min="10"
                value={overrideMaxActions}
                onChange={(e) => setOverrideMaxActions(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Janela de Tempo (Minutos)</Label>
              <Input
                type="number"
                min="1"
                value={overrideTimeWindow}
                onChange={(e) => setOverrideTimeWindow(Number(e.target.value))}
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={submittingOverride}>Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveOverride} disabled={submittingOverride}>
              {submittingOverride ? "Salvando..." : "Salvar Sobrescrita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
