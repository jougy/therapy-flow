import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert,
  Sliders,
  Clock,
  Ban,
  Lock,
  EyeOff,
  Printer,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  FileText,
  Settings,
  Scale,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { TermsConfigModal } from "@/components/TermsConfigModal";

export interface GovernanceRulesConfig {
  max_actions: number;
  time_window_minutes: number;
  cooldown_minutes: number;
  enabled_punishments: Record<string, boolean>;
  default_durations_minutes: Record<string, number>;
}

export const PUNISHMENT_LABELS: Record<string, { label: string; description: string; icon: React.ReactNode; defaultDuration: number }> = {
  sync_throttle: {
    label: "Pausa de Sincronização",
    description: "Represa requisições de sincronização no cliente PWA sem travar a navegação local.",
    icon: <Clock className="w-4 h-4 text-amber-500" />,
    defaultDuration: 15,
  },
  warning_modal: {
    label: "Advertência em Modal",
    description: "Exibe pop-up de alerta obrigatório exigindo confirmação do usuário antes de prosseguir.",
    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
    defaultDuration: 0,
  },
  read_only_mode: {
    label: "Modo Somente Leitura",
    description: "Bloqueia criação, edição e exclusão de fichas ou pacientes, permitindo apenas leitura.",
    icon: <Lock className="w-4 h-4 text-orange-600" />,
    defaultDuration: 60,
  },
  revoke_print_export: {
    label: "Bloqueio de Impressão e PDF",
    description: "Revoga permissões para imprimir prontuários ou exportar arquivos PDF.",
    icon: <Printer className="w-4 h-4 text-blue-600" />,
    defaultDuration: 1440, // 24h
  },
  temporary_suspension: {
    label: "Suspensão Temporária de Acesso",
    description: "Desloga a conta e impede novo login durante o período da punição.",
    icon: <EyeOff className="w-4 h-4 text-red-600" />,
    defaultDuration: 60,
  },
  permanent_ban: {
    label: "Banimento Permanente de Conta",
    description: "Desativa a conta permanentemente em todas as clínicas até liberação manual Master.",
    icon: <Ban className="w-4 h-4 text-red-700" />,
    defaultDuration: 0,
  },
};

export const PlatformGovernanceSettings: React.FC = () => {
  const [config, setConfig] = useState<GovernanceRulesConfig>({
    max_actions: 80,
    time_window_minutes: 5,
    cooldown_minutes: 15,
    enabled_punishments: {
      sync_throttle: true,
      warning_modal: true,
      read_only_mode: true,
      revoke_print_export: true,
      temporary_suspension: true,
      permanent_ban: true,
    },
    default_durations_minutes: {
      sync_throttle: 15,
      warning_modal: 0,
      read_only_mode: 60,
      revoke_print_export: 1440,
      temporary_suspension: 60,
      permanent_ban: 0,
    },
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsRaw, setTermsRaw] = useState<Record<string, unknown>>({});

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const [govRes, termsRes] = await Promise.all([
        supabase.from("governance_rules").select("value").eq("key", "rate_limit_config").single(),
        supabase.from("feature_flags").select("value").eq("key", "terms_of_service_management").eq("scope", "global").maybeSingle(),
      ]);

      if (govRes.data && govRes.data.value) {
        setConfig(govRes.data.value as unknown as GovernanceRulesConfig);
      }
      if (termsRes.data && termsRes.data.value) {
        setTermsRaw(termsRes.data.value as Record<string, unknown>);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao carregar regras de governança";
      toast({ title: "Erro de Governança", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("governance_rules")
        .upsert({
          key: "rate_limit_config",
          value: config as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Regras de Governança Salvas",
        description: "Os parâmetros de rate-limiting e catálogo de punições foram atualizados globalmente.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao salvar configurações";
      toast({ title: "Erro ao salvar", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishTerms = async (payload?: Record<string, unknown>) => {
    const targetPayload = payload || termsRaw;
    const newVersion = new Date().toISOString();
    const updated = { ...targetPayload, publishedVersion: newVersion, publishedAt: newVersion };

    try {
      const { error } = await supabase.rpc("upsert_feature_flag", {
        _key: "terms_of_service_management",
        _scope: "global",
        _value: updated,
        _description: "Termos de Uso e Consentimento atualizados pela Governança.",
      });

      if (error) throw error;

      setTermsRaw(updated);
      toast({
        title: "Termos de Uso Atualizados!",
        description: "Nova versão publicada com sucesso. O aceite será exigido para todos os usuários.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao publicar termos";
      toast({ title: "Erro ao publicar versão", description: message, variant: "destructive" });
    }
  };

  const togglePunishment = (key: string, enabled: boolean) => {
    setConfig((prev) => ({
      ...prev,
      enabled_punishments: {
        ...prev.enabled_punishments,
        [key]: enabled,
      },
    }));
  };

  const updateDuration = (key: string, minutes: number) => {
    setConfig((prev) => ({
      ...prev,
      default_durations_minutes: {
        ...prev.default_durations_minutes,
        [key]: Math.max(0, minutes),
      },
    }));
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" /> Governança & Segurança Global
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Defina limites de requisições por usuário, parâmetros de rate-limiting, catálogo de punições e Termos de Uso.
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving || loading} className="gap-2 shrink-0">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Salvar Regras Globais
        </Button>
      </div>

      {/* Terms of Service & Consent Section */}
      <Card className="shadow-sm border-neutral-200/80 bg-neutral-50/40 dark:bg-neutral-900/40">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-600" /> Termos de Uso, Consentimento & Compliance
          </CardTitle>
          <CardDescription>
            Gerencie as versões oficiais dos Termos de Uso, responsabilidade de impressão e disparo de aceite obrigatório.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl border border-neutral-200 bg-white dark:bg-neutral-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">Termos de Uso e Consentimento Ativos</h4>
              <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                {termsRaw.publishedVersion ? `Versão ${String(termsRaw.publishedVersion).slice(0, 10)}` : "Ativo"}
              </Badge>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Controla os modais de aceite do cliente, consentimento de impressão de prontuários e termos internacionais.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3"
              onClick={() => setTermsModalOpen(true)}
            >
              <Settings className="w-3.5 h-3.5 mr-2" /> Configurar Termos
            </Button>
            <Button
              size="sm"
              className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => void handlePublishTerms()}
            >
              <RefreshCw className="w-3.5 h-3.5 mr-2" /> Disparar Atualização
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Global Rate Limiting Parameters */}
      <Card className="shadow-sm border-neutral-200/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sliders className="w-4 h-4 text-primary" /> Parâmetros de Rate-Limiting por Usuário
          </CardTitle>
          <CardDescription>
            Regras de medição de frequência acumulada no cliente (PWA) antes de acionar respostas de proteção.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label>Limite de Ações (Ações)</Label>
            <Input
              type="number"
              min="10"
              max="500"
              value={config.max_actions}
              onChange={(e) => setConfig({ ...config, max_actions: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground">Máximo de cliques/navegações permitidas na janela.</p>
          </div>

          <div className="space-y-2">
            <Label>Janela de Medição (Minutos)</Label>
            <Input
              type="number"
              min="1"
              max="60"
              value={config.time_window_minutes}
              onChange={(e) => setConfig({ ...config, time_window_minutes: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground">Período de avaliação contínua no cliente.</p>
          </div>

          <div className="space-y-2">
            <Label>Pausa de Cooldown (Minutos)</Label>
            <Input
              type="number"
              min="1"
              max="120"
              value={config.cooldown_minutes}
              onChange={(e) => setConfig({ ...config, cooldown_minutes: Number(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground">Tempo de repouso obrigatório entre sincronizações.</p>
          </div>
        </CardContent>
      </Card>

      {/* Punishments Catalog */}
      <Card className="shadow-sm border-neutral-200/80">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-600" /> Catálogo de Punições Habilitadas na Plataforma
          </CardTitle>
          <CardDescription>
            Configure quais punições estão disponíveis no sistema e suas durabilidades padrão ao aplicar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(PUNISHMENT_LABELS).map(([key, item]) => {
            const isEnabled = config.enabled_punishments[key] ?? true;
            const duration = config.default_durations_minutes[key] ?? item.defaultDuration;

            return (
              <div
                key={key}
                className="flex flex-col justify-between p-4 rounded-xl border border-neutral-200/70 bg-neutral-50/50 dark:bg-neutral-800/40 gap-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {item.icon}
                      <h4 className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">{item.label}</h4>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(v) => togglePunishment(key, v)}
                  />
                </div>

                {isEnabled && key !== "warning_modal" && key !== "permanent_ban" && (
                  <div className="flex items-center gap-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400 whitespace-nowrap">Duração Padrão:</span>
                    <Input
                      type="number"
                      min="1"
                      className="w-24 h-8 text-xs font-mono"
                      value={duration}
                      onChange={(e) => updateDuration(key, Number(e.target.value))}
                    />
                    <span className="text-xs text-neutral-500">minutos (~{Math.round(duration / 60)}h)</span>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <TermsConfigModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        initialData={termsRaw}
        onSave={(payload) => {
          void handlePublishTerms(payload);
        }}
      />
    </div>
  );
};
