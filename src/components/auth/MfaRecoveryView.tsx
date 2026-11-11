import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, MessageSquare, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";

interface MfaRecoveryViewProps {
  title: string;
  description: string;
  onSuccessRedirect: string;
  backRedirect: string;
}

interface ChannelInfo {
  id: string;
  name: string;
  email_available: boolean;
  email_masked: string | null;
  whatsapp_available: boolean;
  whatsapp_masked: string | null;
}

const normalizeCode = (value: string) => value.replace(/\D/g, "").slice(0, 6);

export const MfaRecoveryView = ({
  title,
  description,
  onSuccessRedirect,
  backRedirect,
}: MfaRecoveryViewProps) => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [channels, setChannels] = useState<ChannelInfo | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [step, setStep] = useState<"select_channel" | "verify_code">("select_channel");
  const [code, setCode] = useState("");
  const [targetMasked, setTargetMasked] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadChannels = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("mfa-recovery", {
          body: { action: "get_channels" },
        });

        if (error) throw error;
        if (!data?.success) throw new Error(data?.error || "Não foi possível carregar os canais.");

        if (mounted) {
          setChannels(data.user);
          if (!data.user.whatsapp_available && data.user.email_available) {
            setSelectedChannel("email");
          }
        }
      } catch (err: unknown) {
        toast({
          title: "Erro ao consultar canais",
          description: err instanceof Error ? err.message : "Falha na comunicação com o servidor.",
          variant: "destructive",
        });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadChannels();

    return () => {
      mounted = false;
    };
  }, []);

  const handleRequestCode = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("mfa-recovery", {
        body: { action: "request_code", channel: selectedChannel },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao solicitar código.");

      setTargetMasked(data.target_masked || "");
      setStep("verify_code");
      setCode("");
      toast({
        title: "Código enviado!",
        description: `Enviamos um código de 6 dígitos para ${data.target_masked}.`,
      });
    } catch (err: unknown) {
      toast({
        title: "Falha no envio",
        description: err instanceof Error ? err.message : "Não foi possível enviar o código.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length !== 6) return;

    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("mfa-recovery", {
        body: { action: "verify_code", code },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Código inválido.");

      setResetSuccess(true);
      toast({
        title: "2FA Redefinido com Sucesso!",
        description: "Você será redirecionado para cadastrar o novo QR Code.",
      });

      setTimeout(() => {
        navigate(onSuccessRedirect, { replace: true });
      }, 1800);
    } catch (err: unknown) {
      toast({
        title: "Código inválido",
        description: err instanceof Error ? err.message : "Não foi possível validar o código.",
        variant: "destructive",
      });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            {resetSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-5 w-5" />
            )}
          </div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex min-h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : resetSuccess ? (
            <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-50/50 p-4 text-center dark:bg-emerald-950/20">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <p className="font-medium text-emerald-800 dark:text-emerald-300">
                Acesso de 2 fatores redefinido!
              </p>
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Redirecionando para escanear seu novo QR Code no Ente Auth...
              </p>
            </div>
          ) : step === "select_channel" ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escolha por onde deseja receber seu código de verificação temporário de 6 dígitos:
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSelectedChannel("whatsapp")}
                  disabled={!channels?.whatsapp_available}
                  className={`flex w-full min-h-[44px] items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    selectedChannel === "whatsapp"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  } ${!channels?.whatsapp_available ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5 text-emerald-600" />
                    <div>
                      <p className="font-medium text-foreground">WhatsApp</p>
                      <p className="text-xs text-muted-foreground">
                        {channels?.whatsapp_available
                          ? `Enviar para ${channels.whatsapp_masked}`
                          : "Telefone não configurado no perfil"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      selectedChannel === "whatsapp" ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}
                  >
                    {selectedChannel === "whatsapp" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedChannel("email")}
                  disabled={!channels?.email_available}
                  className={`flex w-full min-h-[44px] items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                    selectedChannel === "email"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  } ${!channels?.email_available ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-sky-600" />
                    <div>
                      <p className="font-medium text-foreground">E-mail</p>
                      <p className="text-xs text-muted-foreground">
                        {channels?.email_available
                          ? `Enviar para ${channels.email_masked}`
                          : "E-mail não disponível"}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                      selectedChannel === "email" ? "border-primary bg-primary" : "border-muted-foreground"
                    }`}
                  >
                    {selectedChannel === "email" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </button>
              </div>

              <Button
                type="button"
                className="w-full min-h-[44px]"
                onClick={handleRequestCode}
                disabled={sending || (!channels?.whatsapp_available && !channels?.email_available)}
              >
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando código...
                  </>
                ) : (
                  "Enviar código de verificação"
                )}
              </Button>
            </div>
          ) : (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <KeyRound className="h-4 w-4 text-primary" />
                  Código enviado para {targetMasked}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Digite os 6 dígitos recebidos para confirmar a recuperação da sua conta.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recovery-code">Código de 6 dígitos</Label>
                <Input
                  id="recovery-code"
                  value={code}
                  onChange={(e) => setCode(normalizeCode(e.target.value))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  className="text-center font-mono text-lg tracking-[0.35em] min-h-[44px]"
                  autoFocus
                />
              </div>

              <Button
                type="submit"
                className="w-full min-h-[44px]"
                disabled={verifying || code.length !== 6}
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verificando e resetando...
                  </>
                ) : (
                  "Confirmar e recadastrar Ente Auth"
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep("select_channel")}
                  className="text-xs text-primary hover:underline min-h-[44px] inline-flex items-center justify-center px-2"
                >
                  Não recebeu? Tentar outro canal ou reenviar
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px]"
              onClick={() => navigate(backRedirect)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full min-h-[44px]"
              onClick={signOut}
            >
              Sair da conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
