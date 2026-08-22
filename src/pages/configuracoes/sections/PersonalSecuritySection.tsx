import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  History,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface SecuritySessionRow {
  id: string;
  session_key: string;
  device_label: string | null;
  browser: string | null;
  platform: string | null;
  last_seen_at: string;
  signed_in_at: string;
  ended_at: string | null;
}

interface SecurityEventRow {
  id: string;
  event_type: string;
  created_at: string;
  visibility_scope: string;
  payload: Record<string, unknown> | null;
}

const formatDateTimeBr = (isoStr: string | null | undefined): string => {
  if (!isoStr) return "Sem registro";
  try {
    const d = new Date(isoStr);
    return isNaN(d.getTime())
      ? isoStr
      : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoStr;
  }
};

const getEventLabelAndDescription = (eventType: string) => {
  switch (eventType) {
    case "password_changed":
      return {
        title: "Senha de acesso alterada",
        description: "A senha desta conta foi atualizada com sucesso.",
        tone: "success",
      };
    case "profile_data_updated":
      return {
        title: "Dados cadastrais alterados",
        description: "Informações pessoais previamente cadastradas foram modificadas.",
        tone: "info",
      };
    case "other_sessions_ended":
      return {
        title: "Outras sessões encerradas",
        description: "Sessões ativas em outros dispositivos foram encerradas remotamente.",
        tone: "warning",
      };
    case "login_anomaly_detected":
      return {
        title: "Aviso de segurança",
        description: "Tentativa ou atividade sensível identificada na conta.",
        tone: "destructive",
      };
    default:
      return {
        title: eventType.replace(/_/g, " "),
        description: "Evento de auditoria registrado na sua conta pessoal.",
        tone: "neutral",
      };
  }
};

export const PersonalSecuritySection = () => {
  const { profile, refreshAuthState, session, user } = useAuth();

  // Estados de dados
  const [loading, setLoading] = useState(true);
  const [sessionsList, setSessionsList] = useState<SecuritySessionRow[]>([]);
  const [eventsList, setEventsList] = useState<SecurityEventRow[]>([]);
  const [endingOtherSessions, setEndingOtherSessions] = useState(false);
  const [endSessionsDialogOpen, setEndSessionsDialogOpen] = useState(false);

  // Estados do Modal de Troca de Senha Segura
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [step, setStep] = useState<"verify_current" | "set_new">("verify_current");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifyingCurrent, setVerifyingCurrent] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);

  const loadSecurityData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    try {
      const [sessionsRes, eventsRes] = await Promise.all([
        supabase
          .from("user_security_sessions")
          .select("*")
          .eq("user_id", user.id)
          .is("ended_at", null)
          .order("last_seen_at", { ascending: false })
          .limit(5),
        supabase
          .from("security_events")
          .select("*")
          .eq("target_user_id", user.id)
          .neq("event_type", "login_success") // Exclui logins simples
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      if (sessionsRes.data) {
        setSessionsList(sessionsRes.data as SecuritySessionRow[]);
      }
      if (eventsRes.data) {
        setEventsList(
          (eventsRes.data as unknown[]).map((e: any) => ({
            id: e.id,
            event_type: e.event_type,
            created_at: e.created_at,
            visibility_scope: e.visibility_scope,
            payload: e.payload && typeof e.payload === "object" ? e.payload : null,
          }))
        );
      }
    } catch (err) {
      console.error("Erro ao carregar dados de segurança:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadSecurityData();
  }, [loadSecurityData]);

  // Abre modal e reseta formulário de senha
  const handleOpenPasswordModal = () => {
    setStep("verify_current");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setChangePasswordModalOpen(true);
  };

  // Etapa 1: Validar senha atual
  const handleVerifyCurrentPassword = async () => {
    if (!currentPassword) {
      toast({ title: "Informe sua senha atual", variant: "destructive" });
      return;
    }
    if (!user?.email) return;

    setVerifyingCurrent(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (error) {
        toast({
          title: "Senha atual incorreta",
          description: "A senha digitada não confere com a sua senha de acesso.",
          variant: "destructive",
        });
        return;
      }

      // Senha atual validada com sucesso
      setStep("set_new");
      toast({ title: "Identidade confirmada", description: "Defina sua nova senha de acesso abaixo." });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro na validação";
      toast({ title: "Erro na verificação", description: message, variant: "destructive" });
    } finally {
      setVerifyingCurrent(false);
    }
  };

  // Etapa 2: Atualizar senha diretamente
  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "Verifique os campos digitados.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8) {
      toast({ title: "Senha curta", description: "A nova senha deve ter no mínimo 8 caracteres.", variant: "destructive" });
      return;
    }

    setUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Atualiza timestamp e flags no profile
      if (user?.id) {
        await supabase
          .from("profiles")
          .update({
            last_password_changed_at: new Date().toISOString(),
            password_temporary: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);

        // Registra evento de auditoria
        await supabase.from("security_events").insert({
          actor_user_id: user.id,
          target_user_id: user.id,
          event_type: "password_changed",
          visibility_scope: "personal",
          payload: {
            method: "verified_authenticated_change",
            timestamp: new Date().toISOString(),
          },
        });
      }

      toast({
        title: "Senha atualizada com sucesso!",
        description: "Sua nova senha de acesso foi configurada e está protegida.",
      });

      setChangePasswordModalOpen(false);
      await refreshAuthState();
      await loadSecurityData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao alterar senha";
      toast({ title: "Erro ao atualizar senha", description: message, variant: "destructive" });
    } finally {
      setUpdatingPassword(false);
    }
  };

  // Alternativa: Enviar e-mail com link de uso único
  const handleSendResetEmail = async () => {
    if (!user?.email) return;
    setSendingResetEmail(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });

      if (error) throw error;

      toast({
        title: "E-mail de redefinição enviado!",
        description: `Enviamos um link seguro de uso único para ${user.email}.`,
      });

      setChangePasswordModalOpen(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar e-mail";
      toast({ title: "Erro ao enviar", description: message, variant: "destructive" });
    } finally {
      setSendingResetEmail(false);
    }
  };

  // Encerrar outras sessões
  const handleEndOtherSessions = async () => {
    if (!user?.id) return;
    setEndingOtherSessions(true);

    try {
      // Encerra sessões marcando ended_at
      const currentToken = session?.access_token;
      const { error } = await supabase
        .from("user_security_sessions")
        .update({ ended_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("ended_at", null);

      if (error) throw error;

      // Registra evento de segurança
      await supabase.from("security_events").insert({
        actor_user_id: user.id,
        target_user_id: user.id,
        event_type: "other_sessions_ended",
        visibility_scope: "personal",
        payload: {
          timestamp: new Date().toISOString(),
        },
      });

      toast({
        title: "Outras sessões encerradas",
        description: "Todas as conexões em outros navegadores ou dispositivos foram desativadas.",
      });

      await loadSecurityData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao encerrar sessões";
      toast({ title: "Erro ao encerrar sessões", description: message, variant: "destructive" });
    } finally {
      setEndingOtherSessions(false);
      setEndSessionsDialogOpen(false);
    }
  };

  const isPasswordTemporary = profile?.password_temporary ?? false;

  return (
    <>
      {/* Modal Seguro de Troca de Senha */}
      <Dialog open={changePasswordModalOpen} onOpenChange={setChangePasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              Trocar Senha de Acesso
            </DialogTitle>
            <DialogDescription>
              {step === "verify_current"
                ? "Por segurança, confirme sua senha atual antes de prosseguir com a alteração."
                : "Defina sua nova senha forte para proteger seu login em todas as clínicas."}
            </DialogDescription>
          </DialogHeader>

          {step === "verify_current" ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Senha atual</Label>
                <Input
                  type="password"
                  placeholder="Digite sua senha atual"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleVerifyCurrentPassword();
                  }}
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                Esqueceu sua senha atual? Você pode receber um link de redefinição seguro por e-mail.
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleSendResetEmail()}
                  disabled={sendingResetEmail || verifyingCurrent}
                  className="gap-1.5 w-full sm:w-auto text-xs"
                >
                  {sendingResetEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Enviar link por e-mail
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleVerifyCurrentPassword()}
                  disabled={verifyingCurrent || !currentPassword}
                  className="gap-1.5 w-full sm:w-auto text-xs bg-primary text-primary-foreground"
                >
                  {verifyingCurrent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                  Verificar e prosseguir
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nova senha</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Confirmar nova senha</Label>
                <Input
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleUpdatePassword();
                  }}
                />
              </div>

              <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
                Sua nova senha deve ter no mínimo 8 caracteres. Ao salvar, se você estiver usando senha provisória, ela será marcada como definitiva.
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStep("verify_current")}
                  disabled={updatingPassword}
                >
                  Voltar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleUpdatePassword()}
                  disabled={updatingPassword || !newPassword || !confirmPassword}
                  className="gap-1.5 bg-primary text-primary-foreground"
                >
                  {updatingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
                  Salvar nova senha
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de Confirmação para Encerrar Sessões */}
      <AlertDialog open={endSessionsDialogOpen} onOpenChange={setEndSessionsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              Encerrar outras sessões ativas?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Isso desconectará sua conta em todos os outros navegadores, computadores ou celulares onde ela estiver aberta no momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={endingOtherSessions}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleEndOtherSessions()}
              disabled={endingOtherSessions}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
            >
              {endingOtherSessions ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
              Encerrar sessões
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* Header com KPIs de Segurança Pessoal */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-xl">Segurança Pessoal</CardTitle>
                <CardDescription className="text-xs">
                  Proteja sua conta, acompanhe sessões abertas e revise eventos sensíveis com transparência total.
                </CardDescription>
              </div>
            </div>
            <ComponentHelpButton helpId="settings-security-personal-block" size="sm" />
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Grid com 4 KPIs: E-mail, Último Acesso, Última Troca, Status */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-muted/20 p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  E-mail de acesso
                </span>
                <p className="text-sm font-semibold text-foreground truncate pt-0.5" title={user?.email || ""}>
                  {user?.email || "-"}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Último acesso
                </span>
                <p className="text-sm font-semibold text-foreground pt-0.5">
                  {formatDateTimeBr(profile?.last_seen_at)}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Última troca de senha
                </span>
                <p className="text-sm font-semibold text-foreground pt-0.5">
                  {profile?.last_password_changed_at ? formatDateTimeBr(profile.last_password_changed_at) : "Sem registro"}
                </p>
              </div>

              <div className="rounded-xl border bg-muted/20 p-4 space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status da senha
                </span>
                <div className="pt-0.5">
                  {isPasswordTemporary ? (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-[11px]">
                      Senha provisória
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[11px]">
                      Senha protegida
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Card de Troca de Senha Segura (Não Direto) */}
            <div className="rounded-xl border p-5 bg-card space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" />
                    Senha de Entrada
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A alteração de senha exige a validação da sua senha atual ou envio de link de uso único por e-mail.
                  </p>
                </div>
                <Button
                  onClick={handleOpenPasswordModal}
                  size="sm"
                  className="gap-2 shrink-0 self-start sm:self-auto bg-primary text-primary-foreground"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Trocar senha de entrada
                </Button>
              </div>
            </div>

            {/* Sessões e Dispositivos */}
            <div className="rounded-xl border p-5 bg-card space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-primary" />
                    Sessões e Dispositivos
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Acompanhe os navegadores e dispositivos onde sua conta está conectada.
                  </p>
                </div>
                {sessionsList.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => setEndSessionsDialogOpen(true)}
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    Encerrar outras sessões
                  </Button>
                )}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : sessionsList.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                  Nenhuma sessão registrada no momento.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {sessionsList.map((s, idx) => {
                    const isCurrent = idx === 0; // Primeira é a mais recente/atual
                    return (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between gap-3 rounded-lg border p-3 text-xs ${
                          isCurrent ? "bg-primary/5 border-primary/30" : "bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-lg bg-muted p-2 text-foreground shrink-0">
                            {s.platform?.toLowerCase().includes("mobile") || s.platform?.toLowerCase().includes("android") || s.platform?.toLowerCase().includes("ios") ? (
                              <Smartphone className="h-4 w-4" />
                            ) : (
                              <Laptop className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-foreground">
                                {s.device_label || s.browser || "Navegador Web"}
                              </p>
                              {isCurrent ? (
                                <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-transparent">
                                  Esta sessão
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px]">
                                  Sessão ativa
                                </Badge>
                              )}
                            </div>
                            <p className="text-muted-foreground mt-0.5">
                              {s.platform || "Sistema"} • Conectado em {formatDateTimeBr(s.signed_in_at)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right text-[11px] text-muted-foreground shrink-0">
                          <span>Última atividade: {formatDateTimeBr(s.last_seen_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Histórico de Eventos Sensíveis */}
            <div className="rounded-xl border p-5 bg-card space-y-4">
              <div>
                <p className="font-semibold text-sm text-foreground flex items-center gap-2">
                  <History className="h-4 w-4 text-primary" />
                  Histórico de Eventos Sensíveis
                </p>
                <p className="text-xs text-muted-foreground">
                  Registro de auditoria de alterações de senha, troca de dados pessoais preenchidos e ações críticas.
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : eventsList.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Nenhum evento sensível registrado recentemente nesta conta.
                </div>
              ) : (
                <div className="space-y-2">
                  {eventsList.map((eventRow) => {
                    const meta = getEventLabelAndDescription(eventRow.event_type);
                    return (
                      <div
                        key={eventRow.id}
                        className="flex items-center justify-between gap-3 rounded-lg border p-3 text-xs bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="rounded-full bg-muted p-1.5 text-primary shrink-0">
                            <Clock3 className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{meta.title}</p>
                            <p className="text-muted-foreground mt-0.5 text-[11px]">{meta.description}</p>
                          </div>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {formatDateTimeBr(eventRow.created_at)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
