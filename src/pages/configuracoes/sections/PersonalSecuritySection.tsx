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
  MessageSquare,
  QrCode,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  ExternalLink,
  Send,
  Stethoscope,
  RefreshCw,
  Wrench,
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
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";

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

  // Estados de 2FA TOTP (Ente Auth / WhatsApp Bot)
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpEnabledAt, setTotpEnabledAt] = useState<string | null>(null);
  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const [totpEnrolling, setTotpEnrolling] = useState(false);
  const [totpFactor, setTotpFactor] = useState<{ id: string; qr_code?: string; secret?: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpVerifying, setTotpVerifying] = useState(false);
  const [disablingTotp, setDisablingTotp] = useState(false);
  const [sendingIntroMessage, setSendingIntroMessage] = useState(false);

  // Estados de Diagnóstico do Bot de WhatsApp
  const [diagModalOpen, setDiagModalOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);
  const [testingPing, setTestingPing] = useState(false);

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
      const [sessionsRes, eventsRes, totpRes] = await Promise.all([
        supabase
          .from("user_security_sessions")
          .select("*")
          .eq("user_id", user.id)
          .is("ended_at", null)
          .order("last_seen_at", { ascending: false })
          .limit(5),
        supabase
          .from("platform_audit_events")
          .select("id, event_type, created_at, visibility_scope, payload")
          .eq("target_user_id", user.id)
          .neq("event_type", "login_success")
          .order("created_at", { ascending: false })
          .limit(8),
        supabase.rpc("get_user_totp_status"),
      ]);

      if (totpRes.data && typeof totpRes.data === "object") {
        const d = totpRes.data as { success?: boolean; totp_enabled?: boolean; totp_enabled_at?: string };
        setTotpEnabled(!!d.totp_enabled);
        setTotpEnabledAt(d.totp_enabled_at || null);
      }

      if (sessionsRes.data) {
        setSessionsList(sessionsRes.data as SecuritySessionRow[]);
      }
      if (eventsRes.data) {
        setEventsList(
          (eventsRes.data as Array<{
            id: string;
            event_type: string;
            created_at: string;
            visibility_scope: string;
            payload: unknown;
          }>).map((e) => ({
            id: e.id,
            event_type: e.event_type,
            created_at: e.created_at,
            visibility_scope: e.visibility_scope,
            payload: e.payload && typeof e.payload === "object" ? (e.payload as Record<string, unknown>) : null,
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

  // Handlers para 2FA TOTP (Ente Auth / WhatsApp Bot)
  const handleStartEnrollTotp = async () => {
    setTotpEnrolling(true);
    setTotpCode("");
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Pluri-Health WhatsApp Bot",
      });

      if (error) throw error;

      setTotpFactor({
        id: data.id,
        qr_code: data.totp?.qr_code,
        secret: data.totp?.secret,
      });
      setTotpModalOpen(true);
    } catch (err: unknown) {
      toast({
        title: "Erro ao iniciar 2FA",
        description: err instanceof Error ? err.message : "Não foi possível gerar o QR Code.",
        variant: "destructive",
      });
    } finally {
      setTotpEnrolling(false);
    }
  };

  const handleConfirmTotp = async () => {
    const clean = totpCode.trim().replace(/\D/g, "");
    if (!totpFactor || clean.length !== 6) {
      toast({ title: "Digite os 6 dígitos gerados no Ente Auth", variant: "destructive" });
      return;
    }

    setTotpVerifying(true);
    try {
      const challenge = await supabase.auth.mfa.challenge({ factorId: totpFactor.id });
      if (challenge.error) throw challenge.error;

      const verification = await supabase.auth.mfa.verify({
        factorId: totpFactor.id,
        challengeId: challenge.data.id,
        code: clean,
      });

      if (verification.error) throw verification.error;

      if (totpFactor.secret) {
        await supabase.rpc("setup_user_totp", { _totp_secret: totpFactor.secret });
      }

      setTotpEnabled(true);
      setTotpEnabledAt(new Date().toISOString());
      setTotpModalOpen(false);

      toast({
        title: "2FA Habilitado com Sucesso!",
        description: "Seu aplicativo Ente Auth agora está vinculado. Você já pode acessar o Bot do WhatsApp digitando 'login'.",
      });
    } catch (err: unknown) {
      toast({
        title: "Código inválido",
        description: err instanceof Error ? err.message : "Confira os 6 dígitos no Ente Auth e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setTotpVerifying(false);
    }
  };

  const handleDisableTotp = async () => {
    setDisablingTotp(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totpList = Array.isArray(factors?.totp) ? factors.totp : [];
      for (const f of totpList) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      await supabase.rpc("disable_user_totp");

      setTotpEnabled(false);
      setTotpEnabledAt(null);
      setTotpFactor(null);

      toast({
        title: "2FA Desativado",
        description: "A autenticação em dois fatores foi removida da sua conta.",
      });
    } catch (err: unknown) {
      toast({
        title: "Erro ao desativar 2FA",
        description: err instanceof Error ? err.message : "Não foi possível desativar.",
        variant: "destructive",
      });
    } finally {
      setDisablingTotp(false);
    }
  };

  const handleSendIntroMessage = async () => {
    if (!profile?.phone || !profile.phone.trim()) {
      toast({
        title: "Celular não cadastrado",
        description: "Adicione seu número de telefone com DDD no perfil pessoal antes de iniciar a conversa.",
        variant: "destructive",
      });
      return;
    }

    setSendingIntroMessage(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send-intro");

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || "Falha ao enviar mensagem de apresentação");
      }

      toast({
        title: "Mensagem Enviada!",
        description: "O bot do WhatsApp enviou uma mensagem de apresentação para o seu celular. Verifique seu aplicativo!",
      });
    } catch (err: unknown) {
      toast({
        title: "Erro ao enviar WhatsApp",
        description: err instanceof Error ? err.message : "Não foi possível enviar a mensagem de apresentação.",
        variant: "destructive",
      });
    } finally {
      setSendingIntroMessage(false);
    }
  };

  const handleOpenDiagnostics = async () => {
    setDiagModalOpen(true);
    setDiagLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-diagnostics");
      if (error) throw error;
      setDiagResult(data?.diagnostic || null);
    } catch (err: unknown) {
      toast({
        title: "Erro no diagnóstico",
        description: err instanceof Error ? err.message : "Não foi possível carregar o diagnóstico.",
        variant: "destructive",
      });
    } finally {
      setDiagLoading(false);
    }
  };

  const handleTestPing = async () => {
    setTestingPing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-diagnostics", {
        body: { action: "test_ping" },
      });
      if (error) throw error;
      setDiagResult(data?.diagnostic || null);

      if (data?.diagnostic?.test_send_result?.success) {
        toast({
          title: "Ping de Teste Enviado!",
          description: "O WhatsApp entregou a mensagem de teste com sucesso para o seu número.",
        });
      } else {
        toast({
          title: "Falha no Envio do Ping",
          description: data?.diagnostic?.test_send_result?.error || "Verifique as credenciais ou a conexão da instância.",
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Erro ao testar envio",
        description: err instanceof Error ? err.message : "Falha ao enviar mensagem de teste.",
        variant: "destructive",
      });
    } finally {
      setTestingPing(false);
    }
  };

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
        redirectTo: buildPublicAppUrl("/auth/redefinir-senha"),
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
      {/* Modal de Configuração de 2FA TOTP (Ente Auth / WhatsApp Bot) */}
      <Dialog open={totpModalOpen} onOpenChange={setTotpModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Configurar 2FA (Ente Auth)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Vincule sua conta ao aplicativo autenticador para liberar o acesso ao Bot do WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Passo a passo */}
            <div className="rounded-lg border p-3 bg-muted/20 space-y-2">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-primary" />
                1. Instale o Ente Auth no seu dispositivo:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <a
                  href="https://play.google.com/store/apps/details?id=io.ente.auth"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] bg-background hover:bg-muted border rounded px-2.5 py-1 text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Android (Play Store)
                </a>
                <a
                  href="https://apps.apple.com/app/ente-authenticator/id6444121398"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] bg-background hover:bg-muted border rounded px-2.5 py-1 text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> iPhone / iPad (App Store)
                </a>
                <a
                  href="https://ente.io/auth/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] bg-background hover:bg-muted border rounded px-2.5 py-1 text-primary transition-colors"
                >
                  <ExternalLink className="h-3 w-3" /> Computador / Web
                </a>
              </div>
            </div>

            {/* QR Code e Chave Manual */}
            <div className="rounded-lg border p-4 bg-card text-center space-y-3">
              <p className="font-semibold text-foreground">
                2. Escaneie o QR Code no app Ente Auth:
              </p>
              {totpFactor?.qr_code ? (
                <div className="flex justify-center p-2 bg-white rounded-lg inline-block mx-auto border shadow-sm">
                  <img
                    src={totpFactor.qr_code}
                    alt="QR Code Ente Auth"
                    className="h-44 w-44 object-contain"
                  />
                </div>
              ) : (
                <div className="flex items-center justify-center h-44 text-muted-foreground">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {totpFactor?.secret && (
                <div className="text-left bg-muted/40 p-2.5 rounded border space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    Ou digite a chave manualmente no Ente Auth:
                  </p>
                  <code className="block font-mono text-[11px] text-foreground break-all select-all">
                    {totpFactor.secret}
                  </code>
                </div>
              )}
            </div>

            {/* Confirmação do Código */}
            <div className="space-y-2">
              <Label htmlFor="totp-code" className="text-xs font-semibold">
                3. Digite o código de 6 dígitos gerado no app:
              </Label>
              <Input
                id="totp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="Ex: 123456"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center font-mono text-base tracking-widest"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleConfirmTotp();
                }}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTotpModalOpen(false)}
              disabled={totpVerifying}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-primary text-primary-foreground gap-2"
              onClick={handleConfirmTotp}
              disabled={totpVerifying || totpCode.trim().length !== 6}
            >
              {totpVerifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Confirmar e Ativar 2FA
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Diagnóstico e Debug do Bot de WhatsApp */}
      <Dialog open={diagModalOpen} onOpenChange={setDiagModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                Diagnóstico & Status do Bot de WhatsApp
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenDiagnostics}
                disabled={diagLoading}
                className="h-7 text-xs gap-1.5"
              >
                <RefreshCw className={`h-3 w-3 ${diagLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Inspecione o estado das credenciais, sessão ativa e logs de entrega do WhatsApp Bot.
            </DialogDescription>
          </DialogHeader>

          {diagLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Consultando status dos servidores e sessões...</p>
            </div>
          ) : !diagResult ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Não foi possível carregar as informações de diagnóstico.
            </div>
          ) : (
            <div className="space-y-4 py-1 text-xs">
              {/* Card 1: Conexão e Provedor */}
              <div className="rounded-lg border p-3.5 bg-muted/20 space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                  <Smartphone className="h-4 w-4 text-primary" />
                  1. Conexão & Credenciais da API
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div className="border rounded bg-background p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Provedor</span>
                    <p className="font-mono font-medium text-foreground capitalize">
                      {diagResult.whatsapp_config?.provider || "meta_cloud"}
                    </p>
                  </div>
                  <div className="border rounded bg-background p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Status API</span>
                    <div>
                      {diagResult.whatsapp_config?.is_configured ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">
                          Configurado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px]">
                          Não configurado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="border rounded bg-background p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">API Key / Token</span>
                    <div>
                      {diagResult.whatsapp_config?.has_api_key ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">
                          Presente
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px]">
                          Ausente no server
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="border rounded bg-background p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Phone ID / URL</span>
                    <div>
                      {diagResult.whatsapp_config?.has_phone_number_id || diagResult.whatsapp_config?.has_api_url ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">
                          Presente
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/40 text-[10px]">
                          Ausente
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
                  <span>Número oficial do bot: <strong className="font-mono">{diagResult.whatsapp_config?.business_phone || "-"}</strong></span>
                  <span>Canal comercial: <strong className="font-mono">{diagResult.whatsapp_config?.admin_commercial_phone || "-"}</strong></span>
                </div>
              </div>

              {/* Card 2: Usuário & Sessão do Chat */}
              <div className="rounded-lg border p-3.5 bg-card space-y-2">
                <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  2. Sessão & Autenticação do Usuário
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="border rounded bg-muted/10 p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Celular Sanitizado</span>
                    <p className="font-mono text-xs text-foreground font-semibold">
                      {diagResult.user?.clean_phone || "Não detectado"}
                    </p>
                  </div>
                  <div className="border rounded bg-muted/10 p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">2FA Ente Auth</span>
                    <div>
                      {diagResult.user?.totp_enabled ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">
                          Habilitado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-[10px]">
                          Desabilitado
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="border rounded bg-muted/10 p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Status no Bot</span>
                    <div>
                      {diagResult.session?.is_authenticated ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[10px]">
                          Sessão Autenticada
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">
                          Sessão Não Logada
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {diagResult.session && (
                  <div className="rounded bg-muted/30 p-2 font-mono text-[11px] text-muted-foreground space-y-0.5">
                    <div>Etapa atual (step): <strong className="text-foreground">{String(diagResult.session.current_step)}</strong></div>
                    {diagResult.session.auth_expires_at && (
                      <div>Expiração da sessão: <strong className="text-foreground">{formatDateTimeBr(String(diagResult.session.auth_expires_at))}</strong></div>
                    )}
                    {diagResult.session.last_message_at && (
                      <div>Última mensagem: <strong className="text-foreground">{formatDateTimeBr(String(diagResult.session.last_message_at))}</strong></div>
                    )}
                  </div>
                )}
              </div>

              {/* Card 3: Teste de Disparo ao Vivo (Ping) */}
              <div className="rounded-lg border p-3.5 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground text-xs flex items-center gap-1.5">
                    <Send className="h-3.5 w-3.5 text-primary" />
                    Enviar Mensagem de Teste (Ping ao Vivo)
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Testa se os servidores do WhatsApp conseguem entregar mensagens diretamente no seu número agora.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleTestPing}
                  disabled={testingPing || !diagResult.user?.clean_phone}
                  className="gap-1.5 text-xs bg-primary text-primary-foreground shrink-0 self-start sm:self-auto"
                >
                  {testingPing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Testar Envio Agora
                </Button>
              </div>

              {/* Card 4: Logs Recentes de Erro do WhatsApp */}
              <div className="rounded-lg border p-3.5 bg-card space-y-2">
                <p className="font-semibold text-foreground text-xs">
                  3. Logs Recentes do WhatsApp no Servidor
                </p>
                {diagResult.recent_error_logs && diagResult.recent_error_logs.length > 0 ? (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {diagResult.recent_error_logs.map((log: any) => (
                      <div key={log.id} className="rounded border bg-muted/20 p-2 text-[11px] space-y-0.5">
                        <div className="flex items-center justify-between font-semibold text-destructive">
                          <span>{log.error_type || "Erro WhatsApp"}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">
                            {formatDateTimeBr(log.created_at)}
                          </span>
                        </div>
                        <p className="text-foreground font-mono text-[10px] break-all">{log.message}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded border border-dashed p-3 text-center text-[11px] text-muted-foreground">
                    Nenhum log de erro registrado para o WhatsApp recentemente.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDiagModalOpen(false)}>
              Fechar Diagnóstico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

              <DismissibleInfoTip
                id="personal-security-password-rule-tip"
                variant="muted"
              >
                Sua nova senha deve ter no mínimo 8 caracteres. Ao salvar, se você estiver usando senha provisória, ela será marcada como definitiva.
              </DismissibleInfoTip>

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

            {/* Card de Autenticação em Dois Fatores (2FA) & WhatsApp Bot */}
            <div className="rounded-xl border p-5 bg-card space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <p className="font-semibold text-sm text-foreground">
                      Autenticação em Dois Fatores (2FA / Ente Auth)
                    </p>
                    {totpEnabled ? (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-[11px] gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        2FA Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground border-muted-foreground/40 text-[11px]">
                        Não configurado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                    Proteja sua conta utilizando o aplicativo <strong>Ente Auth</strong>. O 2FA é <strong>opcional</strong> para fazer login normal na plataforma web, mas é <strong>obrigatório</strong> para acessar o copiloto e comandos da clínica pelo WhatsApp.
                  </p>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3 pt-2 border-t border-muted/40">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>WhatsApp vinculado: <strong>{profile?.phone || "Não cadastrado no perfil pessoal"}</strong></span>
                    </div>

                    {profile?.phone && (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSendIntroMessage}
                          disabled={sendingIntroMessage}
                          className="h-7 text-[11px] gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 shrink-0"
                        >
                          {sendingIntroMessage ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Iniciar conversa com o bot
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleOpenDiagnostics}
                          className="h-7 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground shrink-0"
                        >
                          <Wrench className="h-3 w-3" />
                          Diagnóstico do Bot
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                  {totpEnabled ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs text-destructive hover:bg-destructive/10"
                      onClick={handleDisableTotp}
                      disabled={disablingTotp}
                    >
                      {disablingTotp ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Desativar 2FA"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      className="gap-2 bg-primary text-primary-foreground text-xs"
                      onClick={handleStartEnrollTotp}
                      disabled={totpEnrolling}
                    >
                      {totpEnrolling ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <QrCode className="h-3.5 w-3.5" />
                          Configurar 2FA (Ente Auth)
                        </>
                      )}
                    </Button>
                  )}
                </div>
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
