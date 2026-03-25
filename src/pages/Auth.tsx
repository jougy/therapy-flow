import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { LogIn, UserPlus, Loader2, Building2, Eye, EyeOff } from "lucide-react";
import { ensureTestLogin, isLocalSupabaseUrl, TEST_LOGIN } from "@/lib/test-login";

const formatCNPJ = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const cnpjDigits = cnpj.replace(/\D/g, "");
  const isCnpjValid = cnpjDigits.length === 14;
  const isDev = import.meta.env.DEV;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const canUseLocalTestLogin = isDev && isLocalSupabaseUrl(supabaseUrl);

  const handleTestLogin = async () => {
    setLoading(true);
    setCnpj(TEST_LOGIN.cnpjFormatted);
    setEmail(TEST_LOGIN.email);
    setPassword(TEST_LOGIN.password);

    try {
      const result = await ensureTestLogin(supabase, window.location.origin);
      if ("requiresEmailConfirmation" in result && result.requiresEmailConfirmation) {
        toast({
          title: "Conta de teste criada",
          description: "O Supabase atual exige confirmacao por e-mail antes do primeiro login.",
        });
      } else {
        toast({
          title: result.created ? "Conta de teste criada" : "Conta de teste carregada",
          description: `${TEST_LOGIN.email} / ${TEST_LOGIN.password}`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nao foi possivel preparar a conta de teste.";
      toast({ title: "Erro no login de teste", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCnpjValid) {
      toast({ title: "CNPJ inválido", description: "Informe um CNPJ com 14 dígitos.", variant: "destructive" });
      return;
    }
    setLoading(true);

    if (isLogin) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      // Validate CNPJ matches user's clinic
      const { data: valid } = await supabase.rpc("validate_user_clinic", {
        _user_id: data.user.id,
        _cnpj: cnpjDigits,
      });

      if (!valid) {
        await supabase.auth.signOut();
        toast({ title: "CNPJ incorreto", description: "Este CNPJ não corresponde à sua conta.", variant: "destructive" });
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) {
        toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (data.user) {
        // Create clinic + profile + role
        const { error: setupError } = await supabase.rpc("handle_signup", {
          _user_id: data.user.id,
          _email: email,
          _cnpj: cnpjDigits,
        });

        if (setupError) {
          toast({ title: "Erro ao configurar conta", description: setupError.message, variant: "destructive" });
        } else {
          toast({
            title: "Cadastro realizado!",
            description: "Verifique seu e-mail para confirmar a conta.",
          });
        }
      }
    }
    setLoading(false);
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
          <h1 className="text-2xl font-bold tracking-tight text-foreground">TherapyFlow</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão clínica simplificada</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {isLogin ? "Entrar" : "Criar conta"}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Acesse sua conta para gerenciar pacientes"
                : "Crie sua conta para começar a usar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ da Clínica</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cnpj"
                    value={cnpj}
                    onChange={(e) => setCnpj(formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    required
                    className="pl-9"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
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
              <Button type="submit" className="w-full" disabled={loading || !isCnpjValid}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isLogin ? (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Entrar
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar conta
                  </>
                )}
              </Button>
            </form>
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-sm text-primary hover:underline"
              >
                {isLogin ? "Não tem conta? Cadastre-se" : "Já tem conta? Entre"}
              </button>
            </div>
            {isDev && canUseLocalTestLogin && (
              <div className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Login de teste local</p>
                <p>CNPJ: {TEST_LOGIN.cnpjFormatted}</p>
                <p>E-mail: {TEST_LOGIN.email}</p>
                <p>Senha: {TEST_LOGIN.password}</p>
                <Button type="button" variant="outline" className="mt-3 w-full" onClick={handleTestLogin} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Entrar com login de teste"}
                </Button>
              </div>
            )}
            {isDev && !canUseLocalTestLogin && (
              <div className="mt-4 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">Login de teste local indisponivel</p>
                <p>O frontend esta apontando para um Supabase remoto.</p>
                <p className="break-all">URL atual: {supabaseUrl ?? "nao configurada"}</p>
                <p className="mt-2">Para usar a conta de teste local, rode `npm run dev:local` com o Docker/Supabase local ativos.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Auth;
