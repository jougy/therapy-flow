import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, ArrowLeft, Loader2, LogIn, Mail, MailCheck, RefreshCw, Send } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { ConfirmationAnimationFlow } from "@/components/ui/clay-confirmation-art";

type ConfirmationState = "waiting_resend" | "checking" | "animating_success" | "expired" | "error";

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

  const queryEmail = readAuthParam("email", location.search, location.hash) || (location.state as { email?: string })?.email || "";
  const [emailInput, setEmailInput] = useState(queryEmail);
  const [cooldown, setCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  const [state, setState] = useState<ConfirmationState>("checking");
  const [animationPhase, setAnimationPhase] = useState<"confirmed" | "transforming" | "ready">("confirmed");
  const [message, setMessage] = useState("Estamos validando o link de confirmação.");
  const redirectTimeoutRef = useRef<number | null>(null);

  const errorDescription = useMemo(
    () => readAuthParam("error_description", location.search, location.hash) ?? readAuthParam("error", location.search, location.hash) ?? "",
    [location.search, location.hash]
  );

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = window.setInterval(() => {
      setCooldown((prev) => Math.max(prev - 1, 0));
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
        title: "E-mail inválido",
        description: "Por favor, informe um endereço de e-mail válido.",
        variant: "destructive",
      });
      return;
    }

    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: buildPublicAppUrl("/auth/confirmado"),
        },
      });

      if (error) throw error;

      setCooldown(60);
      toast({
        title: "E-mail enviado",
        description: `Novo link de confirmação enviado para ${targetEmail}. Verifique sua caixa de entrada e spam.`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Não foi possível reenviar o e-mail.";
      toast({
        title: "Erro ao reenviar",
        description: msg.includes("rate")
          ? "Muitas tentativas em pouco tempo. Por favor, aguarde alguns instantes."
          : msg,
        variant: "destructive",
      });
    } finally {
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
                  <label htmlFor="resend-email" className="text-xs font-medium text-muted-foreground">
                    E-mail cadastrado
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="resend-email"
                      type="email"
                      placeholder="seu@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="pl-9"
                    />
                  </div>
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
