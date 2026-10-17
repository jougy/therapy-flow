import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { useAuth } from "@/hooks/useAuth";
import type { Session } from "@supabase/supabase-js";
import {
  asInviteSummary,
  ConviteExpiredCard,
  ConviteHeaderCard,
  ConviteJobDetails,
  ConviteLoggedInCard,
  ConviteLoginTab,
  ConviteSignupTab,
  isValidCpf,
  PENDING_INVITE_STORAGE_KEY,
  ROLE_LABELS,
  sanitizeDigits,
  type InviteSummary,
} from "./convite-clinica";

const ConviteClinica = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const [invite, setInvite] = useState<InviteSummary | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const autoAcceptAttemptedRef = useRef(false);
  const inviteRef = useRef<InviteSummary | null>(null);
  inviteRef.current = invite;

  // Form fields for new user onboarding
  const [fullName, setFullName] = useState("");
  const fullNameRef = useRef(fullName);
  fullNameRef.current = fullName;
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);

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

  const acceptInvite = async (name = fullName, tokenOverride?: string) => {
    setSubmitting(true);
    const tokenToUse = tokenOverride || token || sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY) || "";

    let error: { message: string } | null = null;

    if (tokenToUse) {
      const { error: rpcError } = await supabase.rpc("accept_clinic_collaborator_invitation", {
        _full_name: name || null,
        _token: tokenToUse,
      });
      error = rpcError;
    }

    if (error && !tokenToUse) {
      const { data: autoData, error: autoError } = await supabase.rpc(
        "auto_accept_pending_clinic_invitation_for_current_user"
      );
      if (autoError) {
        error = autoError;
      } else if ((autoData as any)?.accepted === false && (autoData as any)?.reason !== "no_pending_invitation") {
        error = { message: (autoData as any)?.reason || "Falha ao aceitar convite." };
      } else {
        error = null;
      }
    }

    if (error) {
      toast({
        title: "Não foi possível aceitar o convite",
        description: error.message,
        variant: "destructive",
      });
      setSubmitting(false);
      return false;
    }

    sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    toast({
      title: "Acesso ativado com sucesso!",
      description: `Bem-vindo(a) à equipe da ${invite?.clinic_name || "sua nova clínica"}! Seu acesso foi ativado com sucesso.`,
    });
    navigate("/espacopessoal", { replace: true });
    return true;
  };

  useEffect(() => {
    let isMounted = true;

    const checkAutoAccept = async (activeSession: Session | null) => {
      if (!activeSession?.user?.email) return;

      const pendingToken = sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY);
      if (!pendingToken) return;

      const userEmail = activeSession.user.email.trim().toLowerCase();
      const currentInvite = inviteRef.current;
      const currentInviteEmail = currentInvite?.email?.trim().toLowerCase();

      if (currentInviteEmail && userEmail !== currentInviteEmail) {
        return;
      }

      if (autoAcceptAttemptedRef.current) return;
      autoAcceptAttemptedRef.current = true;

      try {
        setSubmitting(true);
        let accepted = false;

        const tokenToUse = pendingToken || token;
        if (tokenToUse) {
          const { error: rpcError } = await supabase.rpc("accept_clinic_collaborator_invitation", {
            _token: tokenToUse,
            _full_name: fullNameRef.current.trim() || null,
          });
          if (!rpcError) {
            accepted = true;
          }
        }

        if (!accepted) {
          const { data: autoData, error: autoError } = await supabase.rpc(
            "auto_accept_pending_clinic_invitation_for_current_user"
          );
          if (!autoError && (autoData as any)?.accepted) {
            accepted = true;
          }
        }

        if (accepted && isMounted) {
          sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
          toast({
            title: "Acesso ativado com sucesso!",
            description: `Bem-vindo(a) à equipe da ${currentInvite?.clinic_name || "sua nova clínica"}! Seu acesso foi ativado com sucesso.`,
          });
          navigate("/espacopessoal", { replace: true });
        }
      } catch (err) {
        console.error("[ConviteClinica] Falha no auto-aceite pós-confirmação:", err);
      } finally {
        if (isMounted) {
          setSubmitting(false);
        }
      }
    };

    void loadInvite().then(() => {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session && sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY)) {
          void checkAutoAccept(data.session);
        }
      });
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession && sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY)) {
        void checkAutoAccept(nextSession);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadInvite, token, navigate]);

  const handleLoginAndAccept = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!invite) return;

    setSubmitting(true);
    const normalizedEmail = invite.email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
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

    const normalizedEmail = invite.email.trim().toLowerCase();
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
        email: normalizedEmail,
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

      const errorMsg = signUpError?.message?.toLowerCase() || "";
      const isAlreadyRegistered =
        Boolean(signUpError && (
          errorMsg.includes("already registered") ||
          errorMsg.includes("user_already_exists") ||
          errorMsg.includes("already exists") ||
          (signUpError as any).code === "user_already_exists"
        )) ||
        Boolean(authResult?.user && Array.isArray(authResult.user.identities) && authResult.user.identities.length === 0);

      if (isAlreadyRegistered) {
        toast({
          title: "Conta já cadastrada",
          description: "Você já possui uma conta no Pluri-Health. Basta digitar sua senha para ativar seu acesso à clínica.",
        });
        setMode("login");
        setSubmitting(false);
        setTimeout(() => {
          passwordInputRef.current?.focus();
        }, 100);
        return;
      }

      if (signUpError) {
        throw signUpError;
      }

      const createdUserId = authResult?.user?.id;

      if (createdUserId) {
        const { error: rpcError } = await supabase.rpc("handle_personal_signup", {
          _user_id: createdUserId,
          _full_name: fullName.trim(),
          _cpf: cleanCpf,
          _birth_date: birthDate,
          _phone: cleanPhone,
          _email: normalizedEmail,
        });

        if (rpcError) {
          throw rpcError;
        }
      }

      if (authResult?.session) {
        // Instant login session created -> accept invitation and enter
        sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
        await acceptInvite(fullName.trim());
      } else {
        // Confirmation required -> store pending token for auto-heal
        if (token) {
          sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
        }
        // Redirect to standard confirmation screen
        navigate(`/auth/confirmado?email=${encodeURIComponent(normalizedEmail)}&aguardando=true`, {
          replace: true,
          state: { email: normalizedEmail },
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
    return <ConviteExpiredCard />;
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
        <div className="text-center flex flex-col items-center">
          <img
            src="/branding/logo/pluri_health_icon_gradient.svg"
            alt="Pluri-Health"
            className="h-12 w-12 mb-2 drop-shadow-md"
          />
          <p className="text-xs font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">Pluri-Health</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Convite de Acesso à Clínica
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Você foi convidado para fazer parte da equipe de <strong>{invite.clinic_name}</strong>.
          </p>
        </div>

        <Card className="overflow-hidden border-sky-100 shadow-xl shadow-sky-950/5 backdrop-blur-sm">
          <ConviteHeaderCard invite={invite} roleLabel={roleLabel} />

          <CardContent className="space-y-5">
            <ConviteJobDetails invite={invite} />

            {isSameEmailLoggedIn || isDifferentEmailLoggedIn ? (
              <ConviteLoggedInCard
                isSameEmailLoggedIn={isSameEmailLoggedIn}
                currentUserEmail={currentUserEmail}
                inviteEmail={invite.email}
                submitting={submitting}
                onAccept={() => void acceptInvite()}
                onSwitchAccount={() => void handleSwitchAccount()}
              />
            ) : mode === "login" ? (
              <ConviteLoginTab
                email={invite.email}
                password={password}
                setPassword={setPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                submitting={submitting}
                passwordInputRef={passwordInputRef}
                onSubmit={handleLoginAndAccept}
                onSwitchToSignup={() => setMode("signup")}
              />
            ) : (
              <ConviteSignupTab
                invite={invite}
                fullName={fullName}
                setFullName={setFullName}
                cpf={cpf}
                setCpf={setCpf}
                birthDate={birthDate}
                setBirthDate={setBirthDate}
                phone={phone}
                setPhone={setPhone}
                password={password}
                setPassword={setPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                showPassword={showPassword}
                setShowPassword={setShowPassword}
                showConfirmPassword={showConfirmPassword}
                setShowConfirmPassword={setShowConfirmPassword}
                termsAccepted={termsAccepted}
                setTermsAccepted={setTermsAccepted}
                onOpenTermsModal={() => setTermsModalOpen(true)}
                submitting={submitting}
                onSubmit={handleSignupAndAccept}
                onSwitchToLogin={() => setMode("login")}
              />
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
