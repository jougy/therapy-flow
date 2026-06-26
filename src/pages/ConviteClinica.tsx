import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Eye, EyeOff, Loader2, LogIn, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Session } from "@supabase/supabase-js";

type InviteSummary = {
  clinic_name: string;
  email: string;
  existing_user: boolean;
  expires_at: string;
  job_title: string | null;
  operational_role: string;
  specialty: string | null;
  status: "pending" | "accepted" | "cancelled" | "expired";
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário",
};

const asInviteSummary = (value: unknown): InviteSummary | null => {
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<InviteSummary>;
  if (!data.email || !data.clinic_name || !data.status) return null;
  return {
    clinic_name: String(data.clinic_name),
    email: String(data.email),
    existing_user: Boolean(data.existing_user),
    expires_at: String(data.expires_at || ""),
    job_title: data.job_title ? String(data.job_title) : null,
    operational_role: String(data.operational_role || "professional"),
    specialty: data.specialty ? String(data.specialty) : null,
    status: data.status,
  };
};

const ConviteClinica = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState<InviteSummary | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const roleLabel = useMemo(() => ROLE_LABELS[invite?.operational_role || ""] || invite?.operational_role || "Profissional", [invite]);

  const loadInvite = useCallback(async () => {
    setLoading(true);
    const [{ data: sessionData }, { data, error }] = await Promise.all([
      supabase.auth.getSession(),
      supabase.rpc("get_clinic_collaborator_invitation", { _token: token }),
    ]);

    setSession(sessionData.session);

    if (error) {
      toast({ title: "Convite indisponível", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const parsedInvite = asInviteSummary(data);
    setInvite(parsedInvite);
    setMode(parsedInvite?.existing_user ? "login" : "signup");
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void loadInvite();

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, [loadInvite]);

  const acceptInvite = async (name = fullName) => {
    setSubmitting(true);
    const { error } = await supabase.rpc("accept_clinic_collaborator_invitation", {
      _full_name: name || null,
      _token: token,
    });

    if (error) {
      toast({ title: "Não foi possível aceitar o convite", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    toast({ title: "Acesso confirmado", description: "Você já pode acessar a clínica pela Pluri-Health." });
    navigate("/espacopessoal", { replace: true });
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    await acceptInvite();
  };

  const handleSignup = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: invite.email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.href,
      },
    });

    if (error) {
      toast({ title: "Erro ao criar conta", description: error.message, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    if (data.session) {
      await acceptInvite(fullName);
      return;
    }

    toast({
      title: "Confirme seu e-mail",
      description: "Depois de confirmar o e-mail, volte a este convite para ativar o acesso da clínica.",
    });
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!invite || invite.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Convite indisponível</CardTitle>
            <CardDescription>Este convite foi aceito, cancelado, expirou ou não existe mais.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/auth")}>Ir para o login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sameEmailLoggedIn = session?.user.email?.toLowerCase() === invite.email.toLowerCase();

  return (
    <div className="min-h-screen bg-muted/30 px-4 py-10">
      <div className="mx-auto w-full max-w-xl space-y-6">
        <div>
          <p className="text-sm font-medium text-primary">Pluri-Health</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Convite para acessar a clínica</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Você foi convidado para participar de {invite.clinic_name}. Confirme os dados abaixo para liberar o acesso.
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>{invite.clinic_name}</CardTitle>
                <CardDescription>{invite.email}</CardDescription>
              </div>
              <Badge variant="secondary">{roleLabel}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(invite.job_title || invite.specialty) && (
              <div className="grid gap-3 rounded-lg border p-3 text-sm sm:grid-cols-2">
                {invite.job_title && (
                  <div>
                    <p className="text-muted-foreground">Cargo</p>
                    <p className="font-medium">{invite.job_title}</p>
                  </div>
                )}
                {invite.specialty && (
                  <div>
                    <p className="text-muted-foreground">Especialidade</p>
                    <p className="font-medium">{invite.specialty}</p>
                  </div>
                )}
              </div>
            )}

            {sameEmailLoggedIn ? (
              <Button className="w-full" onClick={() => void acceptInvite()} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                Aceitar convite
              </Button>
            ) : mode === "login" ? (
              <form className="space-y-4" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <Label>E-mail convidado</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={invite.email} readOnly className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={6}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
                  Entrar e aceitar
                </Button>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleSignup}>
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>E-mail convidado</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={invite.email} readOnly className="pl-9" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Criar senha</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      minLength={6}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                  Completar cadastro e entrar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ConviteClinica;
