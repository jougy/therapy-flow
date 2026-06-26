import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, LogIn, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCpf } from "@/lib/profile-settings";

const normalizeCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11);

const Auth = () => {
  const [mode, setMode] = useState<"login" | "recovery">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryCpf, setRecoveryCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  const handleRecoverySubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const normalizedCpf = normalizeCpf(recoveryCpf);
    if (normalizedCpf.length !== 11) {
      toast({ title: "CPF inválido", description: "Informe os 11 dígitos do CPF cadastrado.", variant: "destructive" });
      return;
    }

    setRecovering(true);
    const { data: verified, error: verifyError } = await supabase.rpc("verify_password_recovery_identity", {
      _cpf: normalizedCpf,
      _email: recoveryEmail,
    });

    if (verifyError || !verified) {
      toast({
        title: "Dados não encontrados",
        description: verifyError?.message || "Confira o e-mail e CPF cadastrados para solicitar a recuperação.",
        variant: "destructive",
      });
      setRecovering(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail, {
      redirectTo: `${window.location.origin}/auth/redefinir-senha`,
    });

    if (error) {
      toast({ title: "Erro ao enviar recuperação", description: error.message, variant: "destructive" });
      setRecovering(false);
      return;
    }

    toast({
      title: "E-mail enviado",
      description: "Abra o e-mail de recuperação e siga o botão para criar uma nova senha.",
    });
    setRecovering(false);
    setMode("login");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pluri-Health</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão clínica simplificada</p>
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
                <CardTitle className="text-lg">Recuperar senha</CardTitle>
                <CardDescription>Confirme seu e-mail e CPF para receber o link de recuperação.</CardDescription>
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
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="recovery-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="recovery-email"
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="recovery-cpf">CPF</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="recovery-cpf"
                      inputMode="numeric"
                      value={recoveryCpf}
                      onChange={(e) => setRecoveryCpf(formatCpf(normalizeCpf(e.target.value)))}
                      placeholder="000.000.000-00"
                      required
                      className="pl-9"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={recovering}>
                  {recovering ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Enviar e-mail de recuperação
                    </>
                  )}
                </Button>
              </form>
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
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
