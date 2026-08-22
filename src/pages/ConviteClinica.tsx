import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Phone,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { useAuth } from "@/hooks/useAuth";
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
  admin: "Administrador(a)",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário(a)",
};

const sanitizeDigits = (value: string) => value.replace(/\D/g, "");

const formatCpf = (value: string) => {
  const digits = sanitizeDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const formatPhone = (value: string) => {
  const digits = sanitizeDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const isValidCpf = (cpf: string) => {
  const digits = sanitizeDigits(cpf);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(digits.charAt(i), 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits.charAt(9), 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(digits.charAt(i), 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(digits.charAt(10), 10);
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
  const { signOut } = useAuth();

  const [invite, setInvite] = useState<InviteSummary | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  // Form fields for new user onboarding
  const [fullName, setFullName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const roleLabel = useMemo(
    () => ROLE_LABELS[invite?.operational_role || ""] || invite?.operational_role || "Profissional",
    [invite]
  );

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
      toast({
        title: "Não foi possível aceitar o convite",
        description: error.message,
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    toast({
      title: "Acesso confirmado!",
      description: `Você agora faz parte da equipe de ${invite?.clinic_name || "sua nova clínica"}.`,
    });
    navigate("/espacopessoal", { replace: true });
  };

  const handleLoginAndAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    });

    if (error) {
      toast({
        title: "Erro ao entrar",
        description:
          error.message === "Invalid login credentials"
            ? "Senha incorreta. Verifique os dados digitados."
            : error.message,
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    await acceptInvite();
  };

  const handleSignupAndAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;

    const cleanCpf = sanitizeDigits(cpf);
    const cleanPhone = sanitizeDigits(phone);

    if (!isValidCpf(cleanCpf)) {
      toast({
        title: "CPF inválido",
        description: "Por favor, informe um CPF válido com 11 dígitos.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: "Senha muito curta",
        description: "A senha deve conter no mínimo 8 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A confirmação de senha precisa ser idêntica.",
        variant: "destructive",
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        title: "Termos de Uso e LGPD",
        description: "Você precisa concordar com os Termos de Uso e a Política de Privacidade para concluir o cadastro.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const acceptedAt = new Date().toISOString();
      const { data: authResult, error: signUpError } = await supabase.auth.signUp({
        email: invite.email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            cpf: cleanCpf,
            birth_date: birthDate,
            phone: cleanPhone,
            signup_source: "clinic_invitation",
            terms_accepted_at: acceptedAt,
            privacy_policy_accepted: true,
          },
          emailRedirectTo: buildPublicAppUrl(`/convite/clinica/${token}`),
        },
      });

      if (signUpError) {
        const isAlreadyRegistered =
          signUpError.message.toLowerCase().includes("already registered") ||
          signUpError.message.toLowerCase().includes("user_already_exists");

        if (isAlreadyRegistered) {
          toast({
            title: "Conta já existente",
            description: "Este e-mail já possui uma conta no Pluri-Health. Por favor, insira sua senha para entrar.",
          });
          setMode("login");
          setSubmitting(false);
          return;
        }

        throw signUpError;
      }

      const createdUserId = authResult.user?.id;

      if (createdUserId) {
        await supabase.rpc("handle_personal_signup", {
          _user_id: createdUserId,
          _full_name: fullName.trim(),
          _cpf: cleanCpf,
          _birth_date: birthDate,
          _phone: cleanPhone,
          _email: invite.email,
        });
      }

      if (authResult.session) {
        // Instant login session created -> accept invitation and enter
        await acceptInvite(fullName.trim());
      } else {
        // Confirmation required -> redirect to standard confirmation screen
        navigate(`/auth/confirmado?email=${encodeURIComponent(invite.email)}&aguardando=true`, {
          replace: true,
          state: { email: invite.email },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao concluir cadastro.";
      toast({
        title: "Erro ao criar conta",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    await signOut();
    setSession(null);
    setMode("login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!invite || invite.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-amber-200 bg-card shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
              <AlertCircle className="h-7 w-7" />
            </div>
            <CardTitle className="mt-2 text-xl font-bold">Convite indisponível</CardTitle>
            <CardDescription className="mt-1 text-sm">
              Este convite já foi aceito, cancelado, expirou ou não existe mais no sistema.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button className="w-full" asChild>
              <Link to="/auth">Ir para o login</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/auth/cadastro">Criar uma nova conta</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentUserEmail = session?.user?.email?.toLowerCase() || "";
  const inviteEmail = invite.email.toLowerCase();
  const isSameEmailLoggedIn = Boolean(currentUserEmail && currentUserEmail === inviteEmail);
  const isDifferentEmailLoggedIn = Boolean(currentUserEmail && currentUserEmail !== inviteEmail);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_40%),linear-gradient(180deg,#f8fbff_0%,#eef8f7_100%)] px-4 py-10 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full max-w-xl space-y-6"
      >
        <div className="text-center">
          <p className="text-sm font-semibold tracking-wide text-sky-700">Pluri-Health</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Convite de Acesso à Clínica
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Você foi convidado para fazer parte da equipe de <strong>{invite.clinic_name}</strong>.
          </p>
        </div>

        <Card className="overflow-hidden border-sky-100 shadow-xl shadow-sky-950/5 backdrop-blur-sm">
          <div className="h-1.5 bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400" />
          
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 shadow-sm">
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold text-foreground">{invite.clinic_name}</CardTitle>
                  <CardDescription className="text-sm text-sky-800 font-medium">{invite.email}</CardDescription>
                </div>
              </div>
              <Badge className="w-fit bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200">
                {roleLabel}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {(invite.job_title || invite.specialty) && (
              <div className="grid gap-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3.5 text-sm sm:grid-cols-2">
                {invite.job_title && (
                  <div>
                    <p className="text-xs font-medium text-sky-900/70">Cargo pré-definido</p>
                    <p className="font-semibold text-sky-950">{invite.job_title}</p>
                  </div>
                )}
                {invite.specialty && (
                  <div>
                    <p className="text-xs font-medium text-sky-900/70">Especialidade</p>
                    <p className="font-semibold text-sky-950">{invite.specialty}</p>
                  </div>
                )}
              </div>
            )}

            {isSameEmailLoggedIn ? (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                  <div className="flex items-start gap-3">
                    <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div>
                      <p className="font-medium">Você já está conectado como {currentUserEmail}</p>
                      <p className="mt-1 text-xs text-emerald-800">
                        Clique no botão abaixo para aceitar o convite e vincular a clínica ao seu espaço pessoal.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-2 h-11 text-base font-semibold"
                  onClick={() => void acceptInvite()}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}
                  Aceitar convite e entrar na clínica
                </Button>
              </div>
            ) : isDifferentEmailLoggedIn ? (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium">Conta conectada diferente</p>
                      <p className="mt-1 text-xs text-amber-800">
                        Você está conectado como <strong>{currentUserEmail}</strong>, mas este convite foi enviado para <strong>{invite.email}</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full gap-2 border-amber-300 text-amber-900 hover:bg-amber-100"
                  onClick={() => void handleSwitchAccount()}
                >
                  <LogOut className="h-4 w-4" />
                  Sair e entrar como {invite.email}
                </Button>
              </div>
            ) : mode === "login" ? (
              <form className="space-y-4" onSubmit={handleLoginAndAccept}>
                <div className="space-y-2">
                  <Label>E-mail convidado</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input value={invite.email} readOnly className="pl-9 bg-muted/50 cursor-not-allowed" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Sua senha de acesso</Label>
                    <Link to="/auth" className="text-xs text-primary hover:underline font-medium">
                      Esqueci minha senha
                    </Link>
                  </div>
                  <div className="relative">
                    <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      required
                      className="pl-9 pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-2 h-11 text-base font-semibold"
                  disabled={submitting || !password}
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                  Entrar e aceitar convite
                </Button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline font-medium"
                    onClick={() => setMode("signup")}
                  >
                    Ainda não possui senha? Completar meu cadastro
                  </button>
                </div>
              </form>
            ) : (
              <form className="space-y-4" onSubmit={handleSignupAndAccept}>
                <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-3.5 text-xs text-sky-950">
                  <p className="font-semibold text-sky-900">Finalização de Cadastro</p>
                  <p className="mt-0.5 text-sky-800">
                    Seu e-mail <strong>{invite.email}</strong> já está validado. Preencha seus dados para ingressar na equipe de <strong>{invite.clinic_name}</strong>.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="signup-name">Nome completo</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ex: Dra. Maria Santos"
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-cpf">CPF</Label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-cpf"
                        value={cpf}
                        onChange={(e) => setCpf(formatCpf(e.target.value))}
                        placeholder="000.000.000-00"
                        required
                        className="pl-9 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-birth">Data de nascimento</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-birth"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        required
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="signup-phone">Telefone / WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-phone"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        required
                        className="pl-9 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-pass">Criar senha</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-pass"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 8 caracteres"
                        minLength={8}
                        required
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="signup-pass-confirm">Confirmar senha</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-pass-confirm"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita sua senha"
                        minLength={8}
                        required
                        className="pl-9 pr-10"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Termo de Consentimento LGPD */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="invite-terms-consent"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="invite-terms-consent"
                      className="text-xs leading-relaxed text-muted-foreground cursor-pointer select-none"
                    >
                      Li, compreendi e concordo integralmente com os{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsModalOpen(true);
                        }}
                        className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        Termos de Uso
                      </button>{" "}
                      e a{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setTermsModalOpen(true);
                        }}
                        className="font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                      >
                        Política de Privacidade e Proteção de Dados (LGPD)
                      </button>
                      .
                    </label>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-2 h-11 text-base font-semibold"
                  disabled={submitting || !termsAccepted}
                >
                  {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />}
                  Concluir cadastro e entrar na clínica
                </Button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline font-medium"
                    onClick={() => setMode("login")}
                  >
                    Já tem uma conta cadastrada? Entrar com minha senha
                  </button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Modal de Termos de Uso e LGPD */}
        <TermsOfServiceModal
          isOpen={termsModalOpen}
          onClose={() => setTermsModalOpen(false)}
          onAccept={() => {
            setTermsAccepted(true);
            setTermsModalOpen(false);
          }}
        />
      </motion.div>
    </div>
  );
};

export default ConviteClinica;
