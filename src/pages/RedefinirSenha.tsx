import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Eye, EyeOff, IdCard, KeyRound, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatCpf } from "@/lib/profile-settings";
import { isValidCpfDigits } from "@/lib/patient-registration";
import { useAuth } from "@/hooks/useAuth";

const isStrongEnoughPassword = (value: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(value);

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const RedefinirSenha = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearPasswordRecovery, refreshAuthState } = useAuth();
  const isRegularizarQuery = new URLSearchParams(location.search).get("regularizar") === "true";

  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Campos adicionais de regularização de cadastro caso o perfil não possua CPF
  const [needsCpf, setNeedsCpf] = useState(isRegularizarQuery);
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");

  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Garante que a flag de recovery não fique ativa caso o usuário navegue para fora da tela
  useEffect(() => {
    return () => {
      clearPasswordRecovery?.();
    };
  }, [clearPasswordRecovery]);

  const checkUserProfile = async (userId: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, cpf")
        .eq("id", userId)
        .maybeSingle();

      if (profile) {
        if (profile.full_name && !fullName) {
          setFullName(profile.full_name);
        }
        const cleanCpf = profile.cpf ? onlyDigits(profile.cpf) : "";
        if (cleanCpf.length === 11) {
          setNeedsCpf(false);
        } else {
          setNeedsCpf(true);
        }
      } else {
        setNeedsCpf(true);
      }
    } catch {
      // Caso ocorra erro ao consultar perfil, mantém estado baseado na query string
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      const params = new URLSearchParams(location.search);
      const code = params.get("code");

      if (code && typeof supabase.auth.exchangeCodeForSession === "function") {
        try {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (!mounted) return;
          if (error) {
            console.error("Erro ao validar código de recuperação:", error);
            toast({
              title: "Código inválido ou expirado",
              description: error.message || "O link de recuperação expirou ou é inválido. Por favor, solicite um novo link.",
              variant: "destructive",
            });
            setHasRecoverySession(false);
            setLoadingSession(false);
            return;
          }
          if (data?.session) {
            setHasRecoverySession(true);
            try {
              const url = new URL(window.location.href);
              if (url.searchParams.has("code")) {
                url.searchParams.delete("code");
                window.history.replaceState({}, document.title, url.pathname + (url.search ? url.search : ""));
              }
            } catch {
              // Silencioso em caso de limitação de URL no ambiente
            }
            if (data.session.user?.id) {
              await checkUserProfile(data.session.user.id);
            }
            setLoadingSession(false);
            return;
          }
        } catch (err) {
          if (!mounted) return;
          console.error("Exceção ao validar código de recuperação:", err);
          toast({
            title: "Erro na verificação",
            description: "Não foi possível validar o link de recuperação.",
            variant: "destructive",
          });
          setHasRecoverySession(false);
          setLoadingSession(false);
          return;
        }
      }

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const session = data.session;
      setHasRecoverySession(Boolean(session));
      if (session?.user?.id) {
        await checkUserProfile(session.user.id);
      }
      setLoadingSession(false);
    };

    void initAuth();

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(Boolean(session));
        if (session?.user?.id) {
          void checkUserProfile(session.user.id).finally(() => {
            if (mounted) setLoadingSession(false);
          });
        } else {
          setLoadingSession(false);
        }
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [location.search]);

  const handleGoToEspacoPessoal = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    clearPasswordRecovery?.();
    navigate("/espacopessoal", { replace: true });
  };

  const handleBackToLogin = () => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    clearPasswordRecovery?.();
    navigate("/auth", { replace: true });
  };

  useEffect(() => {
    if (!success) return;

    setCountdown(5);

    countdownTimerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    redirectTimerRef.current = setTimeout(() => {
      clearPasswordRecovery?.();
      navigate("/espacopessoal", { replace: true });
    }, 5000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
    };
  }, [success, navigate, clearPasswordRecovery]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isStrongEnoughPassword(newPassword)) {
      toast({
        title: "Senha fraca",
        description: "A senha precisa ter pelo menos 8 caracteres, contendo letras e números.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== passwordConfirm) {
      toast({ title: "As senhas não conferem", description: "Digite a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }

    if (needsCpf) {
      const cleanCpf = onlyDigits(cpf);
      if (!isValidCpfDigits(cleanCpf)) {
        toast({
          title: "CPF inválido",
          description: "Por favor, informe um CPF válido com 11 dígitos para regularizar seu cadastro.",
          variant: "destructive",
        });
        return;
      }

      if (!fullName.trim()) {
        toast({
          title: "Nome completo obrigatório",
          description: "Por favor, informe seu nome completo para completar o cadastro.",
          variant: "destructive",
        });
        return;
      }
    }

    setSaving(true);
    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });

      if (passwordError) {
        toast({ title: "Erro ao atualizar senha", description: passwordError.message, variant: "destructive" });
        setSaving(false);
        return;
      }

      if (needsCpf) {
        const cleanCpf = onlyDigits(cpf);
        const { error: rpcError } = await supabase.rpc("complete_unregistered_cpf_profile", {
          _full_name: fullName.trim(),
          _cpf: cleanCpf,
        });

        if (rpcError) {
          // Fallback para update direto em profiles
          const { data: authData } = await supabase.auth.getUser();
          if (authData.user) {
            await supabase
              .from("profiles")
              .update({
                full_name: fullName.trim(),
                cpf: cleanCpf,
              })
              .eq("id", authData.user.id);
          }
        }
      }

      // Renova a sessão para atualizar JWT e tokens antes de permitir a transição para /espacopessoal
      try {
        if (typeof supabase.auth.refreshSession === "function") {
          await supabase.auth.refreshSession();
        }
      } catch {
        // Fallback gracioso caso haja falha temporária de rede
      }

      // Sincroniza o useAuth com o estado atualizado do usuário/clínica
      try {
        await refreshAuthState?.();
      } catch {
        // Sincronização em background
      }

      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua senha foi redefinida com segurança.",
      });
      setSaving(false);
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocorreu um erro ao atualizar os dados.";
      toast({
        title: "Erro ao processar alteração",
        description: msg,
        variant: "destructive",
      });
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center flex flex-col items-center">
          <img
            src="/branding/logo/pluri_health_icon_gradient.svg"
            alt="Pluri-Health"
            className="h-14 w-14 mb-3 drop-shadow-md"
          />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pluri-Health</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Recuperação segura de acesso</p>
        </div>

        <Card>
          {success ? (
            <>
              <CardHeader className="pb-4 text-center items-center">
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg text-foreground">
                  Sua senha foi alterada com sucesso!
                </CardTitle>
                <CardDescription className="text-center">
                  Sua senha foi atualizada. Você está sendo redirecionado para o seu espaço pessoal.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-muted/50 p-3 text-center">
                  <p className="text-sm font-medium text-muted-foreground">
                    Redirecionando em {countdown} segundo{countdown === 1 ? "" : "s"}...
                  </p>
                </div>
                <Button
                  className="w-full flex items-center justify-center gap-2"
                  onClick={handleGoToEspacoPessoal}
                >
                  <span>Ir para o Espaço Pessoal agora</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader className="pb-4">
                <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${
                  !loadingSession && !hasRecoverySession
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}>
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">
                  {loadingSession
                    ? "Verificando link de recuperação..."
                    : hasRecoverySession
                    ? (needsCpf ? "Completar cadastro e criar senha" : "Criar nova senha")
                    : "Link expirado ou inválido"}
                </CardTitle>
                <CardDescription>
                  {loadingSession
                    ? "Aguarde enquanto validamos suas credenciais de segurança."
                    : hasRecoverySession
                    ? (needsCpf
                        ? "Regularize seu cadastro informando seu CPF e defina uma senha segura."
                        : "Digite uma nova senha para voltar a acessar sua conta na plataforma.")
                    : "Este link de recuperação não é mais válido para redefinição."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSession ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : hasRecoverySession ? (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {needsCpf && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="full-name">Nome completo</Label>
                          <div className="relative">
                            <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="full-name"
                              type="text"
                              value={fullName}
                              onChange={(event) => setFullName(event.target.value)}
                              placeholder="Seu nome completo"
                              required
                              className="pl-9"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="cpf">CPF</Label>
                          <div className="relative">
                            <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              id="cpf"
                              inputMode="numeric"
                              value={cpf}
                              onChange={(event) => setCpf(formatCpf(onlyDigits(event.target.value)))}
                              placeholder="000.000.000-00"
                              required
                              className="pl-9"
                            />
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Obrigatório para conformidade regulatória e segurança de acesso à clínica.
                          </p>
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="new-password">Nova senha</Label>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="new-password"
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(event) => setNewPassword(event.target.value)}
                          minLength={8}
                          required
                          className="pl-9 pr-10"
                          autoFocus={!needsCpf}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((current) => !current)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password-confirm">Confirmar senha</Label>
                      <Input
                        id="password-confirm"
                        type={showPassword ? "text" : "password"}
                        value={passwordConfirm}
                        onChange={(event) => setPasswordConfirm(event.target.value)}
                        minLength={6}
                        required
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ShieldCheck className="h-4 w-4 mr-2" />
                      )}
                      {needsCpf ? "Salvar dados e confirmar senha" : "Confirmar nova senha"}
                    </Button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      O link de recuperação não está ativo ou expirou. Peça um novo e-mail de recuperação para continuar.
                    </p>
                    <Button className="w-full" onClick={handleBackToLogin}>
                      Voltar para o login
                    </Button>
                  </div>
                )}
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default RedefinirSenha;
