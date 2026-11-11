import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Eye, EyeOff, Loader2, LogIn, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignupIntent, clearSignupIntent, saveSignupIntent } from "@/lib/signup-intent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { BrowserAppDownloadBanner } from "@/components/BrowserAppDownloadBanner";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { AuthRecoveryForm } from "@/components/auth/AuthRecoveryForm";

const Auth = () => {
  const navigate = useNavigate();
  const { isApp } = usePWAInstall();
  const [mode, setMode] = useState<"login" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();

  // Capturar e persistir intenção caso venha por query param direto na tela de login
  useEffect(() => {
    const planParam = searchParams.get("plan");
    const cycleParam = searchParams.get("cycle");
    const trialParam = searchParams.get("trial");
    const couponParam = searchParams.get("coupon") || searchParams.get("cupom");

    if (planParam || trialParam === "true") {
      saveSignupIntent({
        plan: planParam,
        cycle: cycleParam,
        trial: trialParam,
        coupon: couponParam,
      });
    }
  }, [searchParams]);

  const signupCadastroUrl = useMemo(() => {
    const params = new URLSearchParams();
    const plan = searchParams.get("plan");
    const cycle = searchParams.get("cycle");
    const trial = searchParams.get("trial");
    const coupon = searchParams.get("coupon") || searchParams.get("cupom");

    if (plan) params.set("plan", plan);
    if (cycle) params.set("cycle", cycle);
    if (trial) params.set("trial", trial);
    if (coupon) params.set("coupon", coupon);

    const qs = params.toString();
    return qs ? `/auth/cadastro?${qs}` : "/auth/cadastro";
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const errorMsg = error.message || "";
      const isUnconfirmed =
        /email not confirmed|não confirmado|confirm/i.test(errorMsg);

      if (isUnconfirmed) {
        toast({
          title: "E-mail não confirmado",
          description: "Por segurança, confirme seu e-mail antes de entrar. Redirecionando para a página de confirmação...",
          variant: "destructive",
        });
        navigate(`/auth/confirmado?email=${encodeURIComponent(email)}&aguardando=true`, {
          state: { email },
        });
        setLoading(false);
        return;
      }

      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setLoading(false);
  };


  return (
    <main id="main-content" role="main" className="min-h-screen flex flex-col bg-background">
      <BrowserAppDownloadBanner variant="top" />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="mb-3 flex justify-center">
            {/* Logo adaptável: Gradiente ciano/azul com ícone nítido e otimização LCP */}
            <img
              src="/branding/logo/pluri_health_icon_gradient.svg"
              alt="Pluri-Health"
              width={64}
              height={64}
              {...{ fetchpriority: "high" }}
              decoding="sync"
              className="h-16 w-16 drop-shadow-md transition-transform hover:scale-105"
            />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pluri-Health</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Gestão clínica simplificada</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            {mode === "recovery" ? (
              <>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </button>
                <CardTitle className="text-lg">Recuperar acesso</CardTitle>
                <CardDescription>
                  Escolha como deseja localizar sua conta para redefinir sua senha.
                </CardDescription>
              </>
            ) : (
              <>
                <CardTitle className="text-lg">Entrar</CardTitle>
                <DismissibleInfoTip
                  id="auth-login-hint-tip"
                  scope="global"
                  variant="subtle"
                  className="mt-2 text-left"
                >
                  Use seu e-mail e senha. A clínica será escolhida na próxima etapa.
                </DismissibleInfoTip>
              </>
            )}
          </CardHeader>
          <CardContent>
            {mode === "recovery" ? (
              <AuthRecoveryForm initialEmail={email} onSuccess={() => setMode("login")} />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    className="pl-9 h-11"
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    className="pr-12 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                    title={showPassword ? "Ocultar senha" : "Ver senha"}
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Entrar
                  </>
                )}
              </Button>

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground font-medium">ou continue com</span>
                </div>
              </div>

              <GoogleAuthButton mode="signin" />
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setMode("recovery")}
                    className="w-full min-h-[44px] py-2 px-3 text-center text-sm font-semibold text-sky-900 dark:text-sky-200 transition-colors hover:text-sky-950 dark:hover:text-sky-100 flex items-center justify-center underline underline-offset-4"
                  >
                    Esqueci minha senha
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(signupCadastroUrl)}
                    className="w-full min-h-[44px] py-2 px-3 text-center text-sm font-semibold text-foreground transition-colors hover:text-foreground/80 flex items-center justify-center"
                  >
                    Não tem uma conta? Criar conta
                  </button>
                  {!isApp && (
                    <button
                      type="button"
                      onClick={() => navigate("/download")}
                      className="w-full min-h-[44px] py-2 px-3 text-center text-xs font-semibold text-sky-900 dark:text-sky-200 transition-colors hover:text-sky-950 dark:hover:text-sky-100 inline-flex items-center justify-center gap-1.5"
                    >
                      <Download className="h-4 w-4" />
                      Baixar aplicativo (Windows, Mac, Linux, Celular)
                    </button>
                  )}
                  <nav aria-label="Documentos Legais" className="flex items-center justify-center gap-4 pt-3 text-xs text-muted-foreground border-t border-border/50">
                    <Link
                      to="/termos"
                      className="min-h-[44px] py-2 px-2 inline-flex items-center hover:text-foreground transition-colors underline underline-offset-2"
                    >
                      Termos de Uso
                    </Link>
                    <span aria-hidden="true">•</span>
                    <Link
                      to="/privacidade"
                      className="min-h-[44px] py-2 px-2 inline-flex items-center hover:text-foreground transition-colors underline underline-offset-2"
                    >
                      Privacidade (LGPD)
                    </Link>
                  </nav>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </main>
  );
};

export default Auth;
