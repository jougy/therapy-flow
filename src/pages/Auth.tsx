import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Eye, EyeOff, KeyRound, Loader2, LogIn, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { formatCpf } from "@/lib/profile-settings";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { BrowserAppDownloadBanner } from "@/components/BrowserAppDownloadBanner";

const normalizeCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11);

const Auth = () => {
  const navigate = useNavigate();
  const { isApp } = usePWAInstall();
  const [mode, setMode] = useState<"login" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCpf, setRecoveryCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [recoveryTab, setRecoveryTab] = useState<"email" | "cpf">("email");

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

  const handleRecoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (recoveryTab === "cpf") {
      const normalizedCpf = normalizeCpf(recoveryCpf);
      if (normalizedCpf.length !== 11) {
        toast({
          title: "CPF inválido",
          description: "Informe os 11 dígitos do CPF cadastrado.",
          variant: "destructive",
        });
        return;
      }

      setRecovering(true);
      try {
        const { data: statusRes, error: rpcError } = await supabase.rpc("request_account_recovery_status", {
          _identifier: normalizedCpf,
        });

        if (rpcError) {
          toast({
            title: "Erro na verificação",
            description: rpcError.message,
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        const res = statusRes as Record<string, unknown> | null;
        const status = String(res?.status ?? "");

        if (status === "cpf_not_found" || status === "invalid_cpf" || !res?.email) {
          toast({
            title: "CPF não registrado",
            description: "Não encontramos nenhuma conta com o CPF informado. Verifique os dados ou crie uma conta.",
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        const targetEmail = String(res.email);

        const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: buildPublicAppUrl("/auth/redefinir-senha"),
        });

        if (resetError) {
          toast({
            title: "Erro ao enviar e-mail",
            description: resetError.message,
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        toast({
          title: "Recuperação enviada",
          description: `Um e-mail de recuperação foi enviado para o endereço ${targetEmail}.`,
        });
        setRecovering(false);
        setMode("login");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
        toast({
          title: "Erro ao solicitar recuperação",
          description: msg,
          variant: "destructive",
        });
        setRecovering(false);
      }
    } else {
      // Envio por E-mail
      const targetEmail = recoveryEmail.trim().toLowerCase();
      if (!targetEmail) {
        toast({
          title: "E-mail obrigatório",
          description: "Informe seu e-mail cadastrado.",
          variant: "destructive",
        });
        return;
      }

      setRecovering(true);
      try {
        const { data: statusRes, error: rpcError } = await supabase.rpc("request_account_recovery_status", {
          _identifier: targetEmail,
        });

        if (rpcError) {
          toast({
            title: "Erro na verificação",
            description: rpcError.message,
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        const res = statusRes as Record<string, unknown> | null;
        const status = String(res?.status ?? "");

        if (status === "email_not_found") {
          toast({
            title: "E-mail não registrado",
            description: "Não encontramos nenhuma conta com o e-mail informado. Verifique a digitação ou crie uma conta.",
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        if (status === "email_found_without_cpf") {
          // Dispara fluxo para completar o cadastro (enviando e-mail para definir nova senha e cadastrar os dados)
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
            redirectTo: buildPublicAppUrl("/auth/redefinir-senha?regularizar=true"),
          });

          if (resetError) {
            toast({
              title: "Erro ao enviar e-mail",
              description: resetError.message,
              variant: "destructive",
            });
            setRecovering(false);
            return;
          }

          toast({
            title: "Instruções enviadas",
            description: "Identificamos que seu cadastro precisa ser completado. Enviamos um link para você definir sua senha e registrar seus dados com segurança.",
          });
          setRecovering(false);
          setMode("login");
          return;
        }

        // status === "email_found_with_cpf" ou padrão
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(targetEmail, {
          redirectTo: buildPublicAppUrl("/auth/redefinir-senha"),
        });

        if (resetError) {
          toast({
            title: "Erro ao enviar recuperação",
            description: resetError.message,
            variant: "destructive",
          });
          setRecovering(false);
          return;
        }

        toast({
          title: "E-mail enviado",
          description: "Abra o e-mail de recuperação e siga o botão para criar uma nova senha.",
        });
        setRecovering(false);
        setMode("login");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Ocorreu um erro inesperado.";
        toast({
          title: "Erro ao solicitar recuperação",
          description: msg,
          variant: "destructive",
        });
        setRecovering(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <BrowserAppDownloadBanner variant="top" />
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-sm"
        >
        <div className="text-center mb-6 flex flex-col items-center">
          <div className="mb-3 flex justify-center">
            {/* Logo adaptável: Gradiente ciano/azul com ícone nítido */}
            <img
              src="/branding/logo/pluri_health_icon_gradient.svg"
              alt="Pluri-Health"
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
                <CardDescription>Use seu e-mail e senha. A clínica será escolhida na próxima etapa.</CardDescription>
              </>
            )}
          </CardHeader>
          <CardContent>
            {mode === "recovery" ? (
              <div className="space-y-4">
                <form onSubmit={handleRecoverySubmit} className="space-y-4">
                  <Tabs
                    value={recoveryTab}
                    onValueChange={(val) => setRecoveryTab(val as "email" | "cpf")}
                    className="w-full"
                  >
                    <TabsList className="grid w-full grid-cols-2 mb-3">
                      <TabsTrigger value="email" className="text-xs">
                        <Mail className="h-3.5 w-3.5 mr-1.5" />
                        Por E-mail
                      </TabsTrigger>
                      <TabsTrigger value="cpf" className="text-xs">
                        <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                        Por CPF
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="email" className="space-y-3 mt-0">
                      <div className="space-y-2">
                        <Label htmlFor="recovery-email">E-mail cadastrado</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="recovery-email"
                            type="email"
                            value={recoveryEmail}
                            onChange={(e) => setRecoveryEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required={recoveryTab === "email"}
                            className="pl-9"
                            autoFocus
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Enviaremos um link de redefinição ou instruções caso seu cadastro precise de regularização.
                        </p>
                      </div>
                    </TabsContent>

                    <TabsContent value="cpf" className="space-y-3 mt-0">
                      <div className="space-y-2">
                        <Label htmlFor="recovery-cpf">CPF cadastrado</Label>
                        <div className="relative">
                          <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="recovery-cpf"
                            inputMode="numeric"
                            value={recoveryCpf}
                            onChange={(e) => setRecoveryCpf(formatCpf(normalizeCpf(e.target.value)))}
                            placeholder="000.000.000-00"
                            required={recoveryTab === "cpf"}
                            className="pl-9"
                            autoFocus
                          />
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Localizaremos sua conta e enviaremos o link de recuperação para o e-mail associado.
                        </p>
                      </div>
                    </TabsContent>

                    <Button type="submit" className="w-full mt-4" disabled={recovering}>
                      {recovering ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          {recoveryTab === "email" ? "Enviar e-mail de recuperação" : "Localizar conta e enviar link"}
                        </>
                      )}
                    </Button>
                  </Tabs>
                </form>
              </div>
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
                    className="pl-9"
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
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryEmail(email);
                      setMode("recovery");
                    }}
                    className="w-full text-center text-sm font-medium text-primary transition-colors hover:text-primary/80"
                  >
                    Esqueci minha senha
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/auth/cadastro")}
                    className="w-full text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Não tem uma conta? Criar conta
                  </button>
                  {!isApp && (
                    <button
                      type="button"
                      onClick={() => navigate("/download")}
                      className="w-full text-center text-xs font-medium text-primary/80 transition-colors hover:text-primary inline-flex items-center justify-center gap-1.5 pt-1"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar aplicativo (Windows, Mac, Linux, Celular)
                    </button>
                  )}
                </div>
              </form>
            )}
          </CardContent>
        </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default Auth;
