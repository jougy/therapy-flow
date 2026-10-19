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
  ConviteBrandingHeader,
  isValidCpf,
  PENDING_INVITE_STORAGE_KEY,
  ROLE_LABELS,
  sanitizeDigits,
  type InviteSummary,
} from "./convite-clinica";

const ConviteClinica = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { signOut, refreshAuthState } = useAuth();

  const [invite, setInvite] = useState<InviteSummary | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");

  const passwordInputRef = useRef<HTMLInputElement>(null);
  const autoAcceptAttemptedRef = useRef(false);
  const inviteRef = useRef<InviteSummary | null>(null);
  inviteRef.current = invite;
  const refreshAuthStateRef = useRef(refreshAuthState);
  refreshAuthStateRef.current = refreshAuthState;

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

  const handleAcceptSuccess = useCallback(async (
    rpcData: unknown,
    fallbackClinicName?: string,
    isAlreadyAccepted?: boolean
  ) => {
    sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
    toast({
      title: isAlreadyAccepted ? "Convite já ativado!" : "Acesso ativado com sucesso!",
      description: isAlreadyAccepted
        ? `Este convite para a clínica ${fallbackClinicName || "sua clínica"} já foi aceito.`
        : `Bem-vindo(a) à equipe da ${fallbackClinicName || "sua nova clínica"}! Seu acesso foi ativado com sucesso.`,
    });

    await refreshAuthStateRef.current?.().catch(() => undefined);

    const targetRouteKey = (rpcData as any)?.clinic_route_key || inviteRef.current?.clinic_route_key;
    if (targetRouteKey) {
      navigate(`/clinica/${targetRouteKey}`, { replace: true });
    } else {
      navigate("/espacopessoal", { replace: true });
    }
  }, [navigate]);

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
      return null;
    }

    const parsedInvite = asInviteSummary(data);
    setInvite(parsedInvite);
    setMode(parsedInvite?.existing_user ? "login" : "signup");
    setLoading(false);
    return parsedInvite;
  }, [token]);

  const acceptInvite = async (name = fullName, tokenOverride?: string) => {
    setSubmitting(true);
    const tokenToUse = tokenOverride || token || sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY) || "";

    let error: { message: string } | null = null;
    let rpcData: unknown = null;

    if (tokenToUse) {
      const { data: acceptData, error: rpcError } = await supabase.rpc("accept_clinic_collaborator_invitation", {
        _full_name: name || null,
        _token: tokenToUse,
      });
      error = rpcError;
      rpcData = acceptData;
    }

    if (!tokenToUse || error) {
      const { data: autoData, error: autoError } = await supabase.rpc(
        "auto_accept_pending_clinic_invitation_for_current_user"
      );
      if (autoError) {
        error = autoError;
      } else if ((autoData as any)?.accepted === false && (autoData as any)?.reason !== "no_pending_invitation") {
        error = { message: (autoData as any)?.reason || "Falha ao aceitar convite." };
      } else {
        error = null;
        rpcData = autoData;
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

    await handleAcceptSuccess(rpcData, invite?.clinic_name);
    return true;
  };

  useEffect(() => {
    let isMounted = true;

    const checkAutoAccept = async (activeSession: Session | null, currentLoadedInvite?: InviteSummary | null) => {
      if (!activeSession?.user?.email) return;

      const pendingToken = sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY);
      const currentInvite = currentLoadedInvite || inviteRef.current;
      const isAccepted = currentInvite?.status === "accepted";

      if (!pendingToken && !isAccepted) return;

      const userEmail = activeSession.user.email.trim().toLowerCase();
      const currentInviteEmail = currentInvite?.email?.trim().toLowerCase();

      if (currentInviteEmail && userEmail !== currentInviteEmail) {
        return;
      }

      if (autoAcceptAttemptedRef.current) return;
      autoAcceptAttemptedRef.current = true;

      try {
        setSubmitting(true);
        let accepted = false;
        let rpcData: unknown = null;

        if (isAccepted) {
          accepted = true;
        } else {
          const tokenToUse = pendingToken || token;
          if (tokenToUse) {
            const { data: acceptData, error: rpcError } = await supabase.rpc("accept_clinic_collaborator_invitation", {
              _token: tokenToUse,
              _full_name: fullNameRef.current.trim() || null,
            });
            if (!rpcError) {
              accepted = true;
              rpcData = acceptData;
            }
          }

          if (!accepted) {
            const { data: autoData, error: autoError } = await supabase.rpc(
              "auto_accept_pending_clinic_invitation_for_current_user"
            );
            if (!autoError && (autoData as any)?.accepted) {
              accepted = true;
              rpcData = autoData;
            }
          }
        }

        if (accepted && isMounted) {
          await handleAcceptSuccess(rpcData, currentInvite?.clinic_name, isAccepted);
        }
      } catch (err) {
        console.error("[ConviteClinica] Falha no auto-aceite pós-confirmação:", err);
      } finally {
        if (isMounted) {
          setSubmitting(false);
        }
      }
    };

    void loadInvite().then((loadedInvite) => {
      supabase.auth.getSession().then(({ data }) => {
        const hasPendingStorage = Boolean(sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY));
        const isAccepted = loadedInvite?.status === "accepted";
        if (data.session && (hasPendingStorage || isAccepted)) {
          void checkAutoAccept(data.session, loadedInvite);
        }
      });
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      const hasPendingStorage = Boolean(sessionStorage.getItem(PENDING_INVITE_STORAGE_KEY));
      const isAccepted = inviteRef.current?.status === "accepted";
      if (nextSession && (hasPendingStorage || isAccepted)) {
        void checkAutoAccept(nextSession);
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [loadInvite, token, handleAcceptSuccess]);

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
      toast({ title: "CPF inválido", description: "Por favor, informe um CPF válido com 11 dígitos.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Senha muito curta", description: "A senha deve conter no mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "A confirmação de senha precisa ser idêntica.", variant: "destructive" });
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
        setTimeout(() => passwordInputRef.current?.focus(), 100);
        return;
      }

      if (signUpError) throw signUpError;

      const createdUserId = authResult?.user?.id;
      if (createdUserId) {
        try {
          const { error: rpcError } = await supabase.rpc("handle_personal_signup", {
            _user_id: createdUserId,
            _full_name: fullName.trim(),
            _cpf: cleanCpf,
            _birth_date: birthDate,
            _phone: cleanPhone,
            _email: normalizedEmail,
          });

          if (rpcError) {
            const rpcMsg = rpcError.message?.toLowerCase() || "";
            if (rpcMsg.includes("cpf já está cadastrado") || rpcError.code === "23505") {
              throw new Error("Este CPF já está cadastrado em outra conta no Pluri-Health. Verifique os dados informados.");
            }
            console.warn("[ConviteClinica] Aviso não-bloqueante no handle_personal_signup:", rpcError);
          }
        } catch (profileErr: unknown) {
          const pMsg = (profileErr instanceof Error ? profileErr.message : String(profileErr)).toLowerCase();
          const pCode = (profileErr as { code?: string })?.code;
          if (pMsg.includes("cpf já está cadastrado") || pCode === "23505") {
            throw profileErr;
          }
          console.warn("[ConviteClinica] Falha não-fatal no handle_personal_signup, prosseguindo com aceite do convite:", profileErr);
        }
      }

      if (authResult?.session) {
        sessionStorage.removeItem(PENDING_INVITE_STORAGE_KEY);
        await acceptInvite(fullName.trim());
      } else {
        if (token) {
          sessionStorage.setItem(PENDING_INVITE_STORAGE_KEY, token);
        }
        navigate(`/auth/confirmado?email=${encodeURIComponent(normalizedEmail)}&aguardando=true`, {
          replace: true,
          state: { email: normalizedEmail },
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao concluir cadastro.";
      toast({ title: "Erro ao criar conta", description: msg, variant: "destructive" });
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
      <ConviteExpiredCard
        isAccepted={invite?.status === "accepted"}
        clinicName={invite?.clinic_name}
        clinicRouteKey={invite?.clinic_route_key}
      />
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
        <ConviteBrandingHeader clinicName={invite.clinic_name} />

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
