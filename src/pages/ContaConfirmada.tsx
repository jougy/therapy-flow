import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2, LogIn, MailCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type ConfirmationState = "checking" | "confirmed" | "expired" | "error";

const readAuthParam = (name: string) => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return searchParams.get(name) ?? hashParams.get(name);
};

const ContaConfirmada = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<ConfirmationState>("checking");
  const [message, setMessage] = useState("Estamos validando o link de confirmação.");

  const errorDescription = useMemo(
    () => readAuthParam("error_description") ?? readAuthParam("error") ?? "",
    []
  );

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

      const code = readAuthParam("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          finish("error", error.message);
          return;
        }
      }

      finish("confirmed", "Sua conta foi confirmada e já pode acessar o Pluri-Health.");
    };

    void validateConfirmation();

    return () => {
      active = false;
    };
  }, [errorDescription]);

  const isChecking = state === "checking";
  const isConfirmed = state === "confirmed";
  const isExpired = state === "expired";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_34%),linear-gradient(180deg,#f8fbff_0%,#eef8f7_100%)] px-4 py-8 text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center"
      >
        <Card className="w-full overflow-hidden border-sky-100 shadow-xl shadow-sky-950/10">
          <div className="h-1.5 bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400" />
          <CardHeader className="space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              {isChecking ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isConfirmed ? (
                <CheckCircle2 className="h-8 w-8" />
              ) : isExpired ? (
                <AlertCircle className="h-8 w-8 text-amber-600" />
              ) : (
                <AlertCircle className="h-8 w-8 text-destructive" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-sky-700">Pluri-Health</p>
              <CardTitle className="mt-2 text-2xl">
                {isChecking
                  ? "Confirmando sua conta"
                  : isConfirmed
                    ? "Conta confirmada"
                    : isExpired
                      ? "Link expirado"
                      : "Não foi possível confirmar"}
              </CardTitle>
              <CardDescription className="mt-2 text-base">
                {message}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {isConfirmed ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left text-sm text-emerald-950">
                <div className="flex gap-3">
                  <MailCheck className="mt-0.5 h-5 w-5 shrink-0" />
                  <p>Seu e-mail foi validado. Agora você pode entrar e escolher seu espaço de trabalho.</p>
                </div>
              </div>
            ) : null}

            {isExpired ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-950">
                O link pode ter sido usado antes ou expirado. Tente entrar com seu e-mail; se necessário, solicite um novo link de confirmação.
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button disabled={isChecking} onClick={() => navigate("/auth", { replace: true })}>
                <LogIn className="mr-2 h-4 w-4" />
                Entrar no Pluri-Health
              </Button>
              <Button asChild variant="outline">
                <Link to="/cadastro/conta-alfa">Criar outra conta</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
};

export default ContaConfirmada;
