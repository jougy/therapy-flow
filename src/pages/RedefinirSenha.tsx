import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const RedefinirSenha = () => {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setHasRecoverySession(Boolean(data.session));
      setLoadingSession(false);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(Boolean(session));
        setLoadingSession(false);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "Use pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    if (newPassword !== passwordConfirm) {
      toast({ title: "As senhas não conferem", description: "Digite a mesma senha nos dois campos.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({ title: "Erro ao atualizar senha", description: error.message, variant: "destructive" });
      setSaving(false);
      return;
    }

    await supabase.auth.signOut();
    toast({ title: "Senha atualizada", description: "Entre novamente usando sua nova senha." });
    navigate("/auth", { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pluri-Health</h1>
          <p className="mt-1 text-sm text-muted-foreground">Recuperação segura de acesso</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <CardTitle className="text-lg">Criar nova senha</CardTitle>
            <CardDescription>Digite uma nova senha para voltar a acessar sua conta na plataforma.</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingSession ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : hasRecoverySession ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova senha</Label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      minLength={6}
                      required
                      className="pl-9 pr-10"
                      autoFocus
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
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                  Confirmar nova senha
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  O link de recuperação não está ativo ou expirou. Peça um novo e-mail de recuperação para continuar.
                </p>
                <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                  Voltar para o login
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RedefinirSenha;
