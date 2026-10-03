import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, Lock, LogIn, Mail, MailCheck, Send, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { ConfirmationAnimationFlow } from "@/components/ui/clay-confirmation-art";

import { useAuth } from "@/hooks/useAuth";

type ConfirmationState = "waiting_resend" | "checking" | "animating_success" | "expired" | "error";

const STORAGE_COOLDOWN_KEY = "pluri_auth_resend_cooldown";

const getRemainingCooldown = (): number => {
  try {
    const expiresAt = sessionStorage.getItem(STORAGE_COOLDOWN_KEY);
    if (!expiresAt) return 0;
    const diff = Math.ceil((Number(expiresAt) - Date.now()) / 1000);
    return diff > 0 ? diff : 0;
  } catch {
    return 0;
  }
};

const setStoredCooldown = (seconds: number) => {
  try {
    if (seconds <= 0) {
      sessionStorage.removeItem(STORAGE_COOLDOWN_KEY);
    } else {
      sessionStorage.setItem(STORAGE_COOLDOWN_KEY, String(Date.now() + seconds * 1000));
    }
  } catch {
    // Ignore sessionStorage errors
  }
};

const readAuthParam = (name: string, locationSearch = "", locationHash = "") => {
  const searchStr = locationSearch || (typeof window !== "undefined" ? window.location.search : "");
  const hashStr = locationHash || (typeof window !== "undefined" ? window.location.hash : "");
  const searchParams = new URLSearchParams(searchStr);
  const hashParams = new URLSearchParams(hashStr.replace(/^#/, ""));
  return searchParams.get(name) ?? hashParams.get(name);
};

const ContaConfirmada = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const queryEmail = readAuthParam("email", location.search, location.hash) || (location.state as { email?: string })?.email || user?.email || "";
  const [emailInput, setEmailInput] = useState(queryEmail);
  const [cooldown, setCooldown] = useState<number>(() => getRemainingCooldown());
  const [isResending, setIsResending] = useState(false);
  const isResendingRef = useRef(false);

  useEffect(() => {
    if (!emailInput && (queryEmail || user?.email)) {
      setEmailInput(queryEmail || user?.email || "");
    }
  }, [emailInput, queryEmail, user?.email]);

  const [state, setState] = useState<ConfirmationState>("checking");
  const [animationPhase, setAnimationPhase] = useState<"confirmed" | "transforming" | "ready">("confirmed");
  const [message, setMessage] = useState("Estamos validando o link de confirmação.");
  const redirectTimeoutRef = useRef<number | null>(null);

  const errorDescription = useMemo(
    () => readAuthParam("error_description", location.search, location.hash) ?? readAuthParam("error", location.search, location.hash) ?? "",
    [location.search, location.hash]
  );

  // Cooldown countdown timer sincronizado com sessionStorage
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = window.setInterval(() => {
      const remaining = getRemainingCooldown();
      setCooldown(remaining);
      if (remaining <= 0) {
        setStoredCooldown(0);
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cooldown]);

  // Main confirmation and token validation effect
  useEffect(() => {
    let active = true;

    const finish = (nextState: ConfirmationState, nextMessage: string) => {
      if (!active) return;
      setState(nextState);
      setMessage(nextMessage);
    };

    const validateConfirmation = async () => {
      if (errorDescription) {
        const normalizedError = decodeURIComponent(errorDescription).toLowerCase();
        finish(
          /expired|invalid|otp|token/.test(normalizedError) ? "expired" : "error",
          decodeURIComponent(errorDescription)
        );
        return;
      }

      const code = readAuthParam("code", location.search, location.hash);
      const accessToken = readAuthParam("access_token", location.search, location.hash);
      const aguardando = readAuthParam("aguardando", location.search, location.hash);
      const type = readAuthParam("type", location.search, location.hash);

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          finish("error", error.message);
          return;
        }
      } else if (!accessToken && (aguardando === "true" || !type)) {
        // Just arrived at the waiting page without code/token
        finish("waiting_resend", "Aguardando confirmação do seu e-mail.");
        return;
      }

      // Successful confirmation detected -> start sequence
      if (!active) return;
      setState("animating_success");
      setAnimationPhase("confirmed");
      setMessage("Conta confirmada com sucesso!");

      // Phase 1 -> Phase 2: explode & morph to Clinical Report
      window.setTimeout(() => {
        if (!active) return;
        setAnimationPhase("transforming");
        setMessage("Você está sendo redirecionado para seu espaço pessoal...");

        // Phase 2 -> Navigate to personal space
        redirectTimeoutRef.current = window.setTimeout(() => {
          if (!active) return;
          navigate("/espacopessoal", { replace: true });
        }, 2000);
      }, 1600);
    };

    void validateConfirmation();

    return () => {
      active = false;
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, [errorDescription, navigate]);

  const handleResendConfirmation = async () => {
    const targetEmail = emailInput.trim().toLowerCase();
    if (!targetEmail || !targetEmail.includes("@")) {
      toast({
        title: "E-mail não identificado",
        description: "Não identificamos o endereço cadastrado para reenvio.",
        variant: "destructive",
      });
      return;
    }

    if (cooldown > 0 || isResending || isResendingRef.current) return;

    isResendingRef.current = true;
    setIsResending(true);
    try {
      // 1. Invoca Edge Function dedicada de envio de e-mail via Resend
      const { data: fnData, error: fnError } = await supabase.functions.invoke("send-auth-confirmation", {
        body: {
          email: targetEmail,
          actionType: "signup",
        },
      });

      if (fnError) {
        // Se for erro de rate limit explícito da Edge Function
        const errorText = fnError.message || "";
        if (errorText.includes("429") || errorText.toLowerCase().includes("limite")) {
          setStoredCooldown(60);
          setCooldown(60);
          toast({
            title: "Muitas tentativas",
            description: "Por favor, aguarde alguns instantes antes de solicitar um novo e-mail.",
            variant: "destructive",
          });
          return;
        }

        console.warn("[ContaConfirmada] Edge function falhou, acionando fallback auth.resend:", fnError);
        // Fallback para o endpoint nativo do Supabase Auth
        const { error: fallbackError } = await supabase.auth.resend({
          type: "signup",
          email: targetEmail,
          options: {
            emailRedirectTo: buildPublicAppUrl("/auth/confirmado"),
          },
        });

        if (fallbackError) throw fallbackError;
      }

      setStoredCooldown(60);
      setCooldown(60);
      toast({
        title: "E-mail enviado",
        description: `Novo link de confirmação enviado para ${targetEmail}. Verifique sua caixa de entrada e spam.`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Não foi possível reenviar o e-mail.";
      const isRate = /rate|muitas tentativas|limite|429/i.test(msg);
      if (isRate) {
        setStoredCooldown(60);
        setCooldown(60);
      }
      toast({
        title: "Erro ao reenviar",
        description: isRate
          ? "Muitas tentativas em pouco tempo. Por favor, aguarde 60 segundos."
          : msg,
        variant: "destructive",
      });
    } finally {
      isResendingRef.current = false;
      setIsResending(false);
    }
  };

  const isChecking = state === "checking";
  const isAnimating = state === "animating_success";
  const isWaitingResend = state === "waiting_resend";
  const isExpired = state === "expired";
  const isError = state === "error";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_38%),linear-gradient(180deg,#f8fbff_0%,#eef8f7_100%)] px-4 py-8 text-foreground flex items-center justify-center">
      {/* Liquid fluid decorative background circles */}
      <motion.div
        animate={{
          scale: [1, 1.15, 1],
          x: [0, 20, 0],
          y: [0, -20, 0],
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-emerald-300/20 blur-3xl"
      />
      <motion.div
        animate={{
          scale: [1, 1.2, 1],
          x: [0, -25, 0],
          y: [0, 25, 0],
        }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 mx-auto w-full max-w-lg"
      >
        <Card className="w-full overflow-hidden border-sky-100/80 bg-card/95 shadow-2xl shadow-sky-950/10 backdrop-blur-xl transition-all duration-500">
          <div className="h-1.5 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400" />
          
          <CardHeader className="space-y-4 text-center pb-4">
            {isAnimating ? (
              <ConfirmationAnimationFlow phase={animationPhase} />
            ) : (
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 shadow-sm">
                {isChecking ? (
                  <Loader2 className="h-8 w-8 animate-spin text-sky-500" />
                ) : isWaitingResend ? (
                  <MailCheck className="h-8 w-8 text-sky-600" />
                ) : isExpired ? (
                  <AlertCircle className="h-8 w-8 text-amber-600" />
                ) : (
                  <AlertCircle className="h-8 w-8 text-destructive" />
                )}
              </div>
            )}

            <div>
              <p className="text-sm font-semibold tracking-wide text-sky-700">Pluri-Health</p>
              <CardTitle className="mt-1 text-2xl font-bold tracking-tight">
                {isChecking
                  ? "Confirmando sua conta"
                  : isAnimating
                    ? animationPhase === "confirmed"
                      ? "Conta Confirmada!"
                      : "Acesso Liberado"
                    : isWaitingResend
                      ? "Confirme seu e-mail"
                      : isExpired
                        ? "Link Expirado"
                        : "Não foi possível confirmar"}
              </CardTitle>
              <CardDescription className="mt-2 text-base transition-all duration-300">
                {message}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 text-center">
            {isAnimating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 text-sm text-emerald-950 backdrop-blur-sm shadow-inner"
              >
                <p className="font-semibold">Tudo pronto para seu atendimento!</p>
                <p className="mt-1 text-xs text-emerald-800">
                  {animationPhase === "confirmed"
                    ? "Validando suas credenciais com segurança..."
                    : "Carregando clínicas e espaço de trabalho..."}
                </p>
              </motion.div>
            )}

            {(isWaitingResend || isExpired || isError) && (
              <div className="space-y-4 text-left">
                <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4 text-sm text-sky-950">
                  <p className="font-medium text-sky-900">Não encontrou o e-mail de ativação?</p>
                  <p className="mt-1 text-xs text-sky-800">
                    Verifique a pasta de <strong>Spam/Lixo Eletrônico</strong>. Você também pode solicitar um novo envio para o seu e-mail abaixo.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="resend-email" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-sky-600" />
                      E-mail cadastrado
                    </label>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 bg-sky-100/80 px-2 py-0.5 rounded-full border border-sky-200/60">
                      <Lock className="h-3 w-3 text-sky-600" />
                      Somente leitura
                    </span>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="resend-email"
                      type="email"
                      readOnly
                      disabled
                      placeholder="seu@email.com"
                      value={emailInput}
                      className="pl-9 pr-9 bg-muted/60 text-foreground font-medium border-dashed border-sky-200 cursor-not-allowed select-all"
                    />
                    <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60 pointer-events-none" />
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Por segurança, o reenvio é realizado exclusivamente para o e-mail previamente cadastrado na sua conta.
                  </p>
                </div>

                <Button
                  onClick={() => void handleResendConfirmation()}
                  disabled={cooldown > 0 || isResending || !emailInput}
                  className="w-full gap-2 shadow-md shadow-sky-500/10"
                >
                  {isResending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {cooldown > 0 ? `Reenviar disponível em ${cooldown}s` : "Enviar novo e-mail de confirmação"}
                </Button>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-center">
              {!isAnimating && (
                <>
                  <Button variant="outline" asChild className="gap-2">
                    <Link to="/auth">
                      <LogIn className="h-4 w-4" />
                      Ir para o login
                    </Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to="/auth/cadastro">Criar outra conta</Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
};

export default ContaConfirmada;
