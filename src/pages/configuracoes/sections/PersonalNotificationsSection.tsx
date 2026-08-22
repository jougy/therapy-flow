import { useEffect, useState } from "react";
import { BellRing, Check, Loader2, Save, ShieldAlert, Volume2, VolumeX, Mail } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface SecurityAlertsState {
  alertPasswordChanged: boolean;
  alertNewLogin: boolean;
  alertOtherSessionsEnded: boolean;
  alertAccessChange: boolean;
}

interface SoundPreferencesState {
  enableSoundAlerts: boolean;
  patientArrivalAlert: boolean;
  sessionReminders: boolean;
}

const SOUND_PREFS_KEY = "pluri_notification_sound_prefs";

export const PersonalNotificationsSection = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [savingSounds, setSavingSounds] = useState(false);

  const [securityAlerts, setSecurityAlerts] = useState<SecurityAlertsState>({
    alertPasswordChanged: true,
    alertNewLogin: true,
    alertOtherSessionsEnded: true,
    alertAccessChange: true,
  });

  const [soundPrefs, setSoundPrefs] = useState<SoundPreferencesState>(() => {
    try {
      const saved = localStorage.getItem(SOUND_PREFS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Ignora erro de parsing
    }
    return {
      enableSoundAlerts: true,
      patientArrivalAlert: true,
      sessionReminders: true,
    };
  });

  useEffect(() => {
    if (!user?.id) return;

    const loadSecuritySettings = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_security_settings")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setSecurityAlerts({
            alertPasswordChanged: data.alert_password_changed ?? true,
            alertNewLogin: data.alert_new_login ?? true,
            alertOtherSessionsEnded: data.alert_other_sessions_ended ?? true,
            alertAccessChange: data.alert_access_change ?? true,
          });
        }
      } catch (err) {
        console.error("Erro ao carregar configurações de alertas:", err);
      } finally {
        setLoading(false);
      }
    };

    void loadSecuritySettings();
  }, [user?.id]);

  const handleSaveSecurityAlerts = async () => {
    if (!user?.id) return;
    setSavingSecurity(true);

    try {
      const { error } = await supabase.from("user_security_settings").upsert(
        {
          user_id: user.id,
          alert_password_changed: securityAlerts.alertPasswordChanged,
          alert_new_login: securityAlerts.alertNewLogin,
          alert_other_sessions_ended: securityAlerts.alertOtherSessionsEnded,
          alert_access_change: securityAlerts.alertAccessChange,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      if (error) throw error;

      toast({
        title: "Alertas de segurança atualizados",
        description: "Suas preferências de avisos por e-mail foram salvas com sucesso.",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({
        title: "Erro ao salvar alertas",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSavingSecurity(false);
    }
  };

  const handleSaveSoundPreferences = () => {
    setSavingSounds(true);
    try {
      localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify(soundPrefs));
      toast({
        title: "Preferências de áudio salvas",
        description: "As configurações de notificações sonoras foram atualizadas neste dispositivo.",
      });
    } catch {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as preferências locais.",
        variant: "destructive",
      });
    } finally {
      setSavingSounds(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <BellRing className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Alertas & Notificações</CardTitle>
              <CardDescription className="text-xs">
                Configure os avisos de segurança da sua conta, sons da interface e lembretes da plataforma.
              </CardDescription>
            </div>
          </div>
          <ComponentHelpButton helpId="settings-notifications-personal-block" size="sm" />
        </CardHeader>
      </Card>

      {/* Alertas de Segurança por E-mail */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Alertas de Segurança por E-mail</CardTitle>
              <CardDescription className="text-xs">
                Notificações imediatas enviadas para seu e-mail cadastrado quando eventos sensíveis ocorrerem.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                {[
                  {
                    key: "alertPasswordChanged" as const,
                    title: "Alerta ao trocar senha",
                    description: "Avise por e-mail imediatamente quando a senha desta conta for alterada.",
                  },
                  {
                    key: "alertNewLogin" as const,
                    title: "Alerta de novo login em dispositivo diferente",
                    description: "Avise quando um login for registrado a partir de um navegador ou IP não habitual.",
                  },
                  {
                    key: "alertOtherSessionsEnded" as const,
                    title: "Alerta ao encerrar outras sessões",
                    description: "Avise quando sessões abertas em outros dispositivos forem encerradas remotamente.",
                  },
                  {
                    key: "alertAccessChange" as const,
                    title: "Alerta de alteração de papel ou vínculos",
                    description: "Avise quando um administrador alterar permissões ou papéis da sua conta.",
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4 bg-card transition-colors hover:bg-muted/30"
                  >
                    <div className="space-y-0.5">
                      <Label htmlFor={item.key} className="text-sm font-semibold text-foreground cursor-pointer">
                        {item.title}
                      </Label>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      id={item.key}
                      checked={securityAlerts[item.key]}
                      onCheckedChange={(checked) =>
                        setSecurityAlerts((prev) => ({ ...prev, [item.key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => void handleSaveSecurityAlerts()}
                  disabled={savingSecurity}
                  className="gap-2"
                >
                  {savingSecurity ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar alertas de segurança
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sons e Alertas na Plataforma */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Volume2 className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">Sons e Notificações no Sistema</CardTitle>
              <CardDescription className="text-xs">
                Controle de efeitos sonoros e alertas interativos enquanto você utiliza a plataforma.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border p-4 bg-card">
              <div className="space-y-0.5">
                <Label htmlFor="sound-master" className="text-sm font-semibold text-foreground cursor-pointer flex items-center gap-1.5">
                  {soundPrefs.enableSoundAlerts ? <Volume2 className="h-4 w-4 text-emerald-600" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                  Efeitos sonoros da plataforma
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ativa sons suaves de confirmação para salvar atendimentos, ações importantes e alertas.
                </p>
              </div>
              <Switch
                id="sound-master"
                checked={soundPrefs.enableSoundAlerts}
                onCheckedChange={(checked) =>
                  setSoundPrefs((prev) => ({ ...prev, enableSoundAlerts: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border p-4 bg-card">
              <div className="space-y-0.5">
                <Label htmlFor="patient-arrival" className="text-sm font-semibold text-foreground cursor-pointer">
                  Aviso sonoro de chegada de paciente
                </Label>
                <p className="text-xs text-muted-foreground">
                  Emite um sinal acústico e destaque visual quando a recepção marca a chegada de um paciente.
                </p>
              </div>
              <Switch
                id="patient-arrival"
                disabled={!soundPrefs.enableSoundAlerts}
                checked={soundPrefs.patientArrivalAlert && soundPrefs.enableSoundAlerts}
                onCheckedChange={(checked) =>
                  setSoundPrefs((prev) => ({ ...prev, patientArrivalAlert: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border p-4 bg-card">
              <div className="space-y-0.5">
                <Label htmlFor="session-reminder" className="text-sm font-semibold text-foreground cursor-pointer">
                  Lembretes de atendimento pendente
                </Label>
                <p className="text-xs text-muted-foreground">
                  Avisos suaves caso haja atendimentos em rascunho abertos há mais de 24 horas.
                </p>
              </div>
              <Switch
                id="session-reminder"
                disabled={!soundPrefs.enableSoundAlerts}
                checked={soundPrefs.sessionReminders && soundPrefs.enableSoundAlerts}
                onCheckedChange={(checked) =>
                  setSoundPrefs((prev) => ({ ...prev, sessionReminders: checked }))
                }
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              onClick={handleSaveSoundPreferences}
              disabled={savingSounds}
              variant="outline"
              className="gap-2"
            >
              {savingSounds ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar preferências de som
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
