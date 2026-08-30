import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  IdCard,
  Loader2,
  LockKeyhole,
  Mail,
  MailCheck,
  Phone,
  UserRound,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { TermsOfServiceModal } from "@/components/TermsOfServiceModal";
import { supabase } from "@/integrations/supabase/client";
import { formatCpf, formatPhone } from "@/lib/profile-settings";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { toast } from "@/hooks/use-toast";

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const sanitizeText = (value: string, max = 120) =>
  Array.from(value.replace(/<[^>]*>/g, ""))
    .filter((char) => {
      const code = char.charCodeAt(0);
      return (code > 31 && code !== 127) || char === "\n" || char === "\t";
    })
    .join("")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, max);

const normalizeName = (value: string) => sanitizeText(value, 120);

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const isValidCpf = (value: string) => {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  const calc = (length: number) => {
    const sum = cpf
      .slice(0, length)
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * (length + 1 - index), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
};

const isValidBirthDate = (value: string) => {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const minDate = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());
  const adultDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return date >= minDate && date <= adultDate;
};

const isValidEmail = (value: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(value);

const isStrongEnoughPassword = (value: string) => /^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(value);

const getSignupRateLimitSeconds = (message: string) => {
  const match = message.match(/after\s+(\d+)\s+seconds/i);
  return match ? Number(match[1]) : null;
};

const getErrorMessage = (error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : "";

  const rateLimitSeconds = getSignupRateLimitSeconds(message);
  if (rateLimitSeconds !== null) {
    return `Por segurança, o sistema bloqueou novas tentativas muito rápidas. Aguarde ${rateLimitSeconds} segundos e tente novamente.`;
  }

  if (/already registered|already exists|user already/i.test(message)) {
    return "Este e-mail já possui uma conta. Tente entrar pelo login ou use outro e-mail.";
  }

  if (/duplicate key.*cpf|cpf.*already exists|cpf.*duplicado/i.test(message)) {
    return "Este CPF já está cadastrado em outra conta.";
  }

  if (message) return message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Não foi possível concluir o cadastro. Verifique os dados e tente novamente.";
};

const CadastroContaAlfa = () => {
  const navigate = useNavigate();
  const [ownerName, setOwnerName] = useState("");
  const [cpf, setCpf] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (signupCooldown <= 0) return;

    const timeoutId = window.setTimeout(() => {
      setSignupCooldown((current) => Math.max(current - 1, 0));
    }, 1_000);

    return () => window.clearTimeout(timeoutId);
  }, [signupCooldown]);

  const cleanCpf = useMemo(() => onlyDigits(cpf), [cpf]);
  const cleanPhone = useMemo(() => onlyDigits(phone), [phone]);

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const fieldErrors = useMemo(() => ({
    ownerName: ownerName && normalizeName(ownerName).trim().length < 3 ? "Nome precisa ter pelo menos 3 caracteres." : "",
    cpf: cpf && !isValidCpf(cpf) ? "CPF inválido." : "",
    birthDate: birthDate && !isValidBirthDate(birthDate) ? "Você precisa ter entre 18 e 120 anos." : "",
    phone: phone && ![10, 11].includes(cleanPhone.length) ? "Número precisa ter DDD e 10 ou 11 dígitos." : "",
    email: email && !isValidEmail(normalizeEmail(email)) ? "E-mail inválido." : "",
    password: password && !isStrongEnoughPassword(password) ? "Senha precisa ter pelo menos 8 caracteres, com letras e números." : "",
    passwordConfirmation: passwordConfirmation && password !== passwordConfirmation ? "A confirmação de senha não confere." : "",
    terms: !termsAccepted ? "É obrigatório aceitar os Termos de Uso e a Política de Privacidade." : "",
  }), [birthDate, cleanPhone.length, cpf, email, ownerName, password, passwordConfirmation, phone, termsAccepted]);

  const canSubmit =
    signupCooldown === 0 &&
    normalizeName(ownerName).trim().length >= 3 &&
    isValidEmail(normalizeEmail(email)) &&
    isValidCpf(cpf) &&
    isValidBirthDate(birthDate) &&
    [10, 11].includes(cleanPhone.length) &&
    isStrongEnoughPassword(password) &&
    password === passwordConfirmation &&
    termsAccepted;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    setTouched({
      ownerName: true,
      cpf: true,
      birthDate: true,
      phone: true,
      email: true,
      password: true,
      passwordConfirmation: true,
      terms: true,
    });

    if (!canSubmit || submitLockRef.current) return;

    submitLockRef.current = true;
    setLoading(true);
    try {
      const nextEmail = normalizeEmail(email);
      const nextOwnerName = normalizeName(ownerName).trim();
      const acceptedAt = new Date().toISOString();

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: nextEmail,
        password,
        options: {
          emailRedirectTo: buildPublicAppUrl("/auth/confirmado"),
          data: {
            birth_date: birthDate,
            cpf: cleanCpf,
            full_name: nextOwnerName,
            phone: cleanPhone,
            signup_source: "web_signup",
            terms_accepted_at: acceptedAt,
            privacy_policy_accepted: true,
          },
        },
      });
      if (signupError) throw signupError;

      const userId = signupData.user?.id;
      if (!userId) throw new Error("Conta criada sem ID de usuário. Tente entrar pelo login.");

      const { error: rpcError } = await supabase.rpc("handle_personal_signup", {
        _birth_date: birthDate,
        _cpf: cleanCpf,
        _email: nextEmail,
        _full_name: nextOwnerName,
        _phone: cleanPhone,
        _user_id: userId,
      });
      if (rpcError) throw rpcError;

      const sessionExists = Boolean(signupData.session);
      setHasSession(sessionExists);
      setCreated(true);

      toast({
        title: "Conta criada com sucesso",
        description: sessionExists
          ? "Sua conta foi criada. Você já pode acessar seu espaço pessoal."
          : "Enviamos um link de confirmação para o seu e-mail.",
      });
    } catch (error) {
      const message = getErrorMessage(error);
      const rateLimitSeconds = getSignupRateLimitSeconds(getErrorMessage(error)) ??
        getSignupRateLimitSeconds(error instanceof Error ? error.message : error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message) : "");

      if (rateLimitSeconds !== null) {
        setSignupCooldown(rateLimitSeconds);
      }

      toast({
        title: "Erro ao criar conta",
        description: message,
        variant: "destructive",
      });
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-8 pb-16">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto w-full max-w-2xl"
      >
        <Button variant="ghost" className="mb-4 px-0" onClick={() => navigate("/auth")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar para o login
        </Button>

        <div className="mb-6 flex items-center gap-3">
          <img
            src="/branding/logo/pluri_health_icon_gradient.svg"
            alt="Pluri-Health"
            className="h-10 w-10 shrink-0 drop-shadow-sm"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pluri-Health</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Criar conta</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{created ? "Conta criada" : "Dados da conta"}</CardTitle>
            <CardDescription>
              {created
                ? hasSession
                  ? "Sua conta pessoal foi configurada. Continue para o espaço pessoal."
                  : "Sua conta pessoal foi criada. Verifique seu e-mail para ativar o acesso."
                : "Crie sua conta pessoal para acessar e gerenciar suas clínicas."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {created ? (
              <div className="space-y-5">
                {hasSession ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-medium">Cadastro concluído com sucesso</p>
                        <p className="mt-1 text-sm">Você já está autenticado e pronto para acessar seu espaço de trabalho.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
                    <div className="flex items-start gap-3">
                      <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                      <div>
                        <p className="font-medium">Confirme seu e-mail para continuar</p>
                        <p className="mt-1 text-sm">
                          Enviamos um link de confirmação para <strong>{normalizeEmail(email)}</strong>. Abra sua caixa de entrada e clique no link para ativar seu acesso antes de fazer login.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {hasSession ? (
                    <Button className="w-full sm:w-auto" onClick={() => navigate("/espacopessoal", { replace: true })}>
                      Avançar para o espaço pessoal
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() =>
                          navigate(`/auth/confirmado?email=${encodeURIComponent(normalizeEmail(email))}&aguardando=true`, {
                            replace: true,
                            state: { email: normalizeEmail(email) },
                          })
                        }
                      >
                        <MailCheck className="mr-2 h-4 w-4" />
                        Acompanhar confirmação / Reenviar
                      </Button>
                      <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/auth", { replace: true })}>
                        Ir para o login
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Nome Completo (span 2 colunas) */}
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="owner-name">Seu nome completo</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="owner-name"
                        autoComplete="name"
                        value={ownerName}
                        onChange={(event) => setOwnerName(event.target.value)}
                        onBlur={() => markTouched("ownerName")}
                        className={`pl-9 ${touched.ownerName && fieldErrors.ownerName ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        maxLength={100}
                        placeholder="Nome e sobrenome"
                        required
                      />
                    </div>
                    {touched.ownerName && fieldErrors.ownerName && (
                      <p className="text-xs text-destructive">{fieldErrors.ownerName}</p>
                    )}
                  </div>

                  {/* CPF */}
                  <div className="space-y-2">
                    <Label htmlFor="owner-cpf">CPF</Label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="owner-cpf"
                        autoComplete="off"
                        inputMode="numeric"
                        value={cpf}
                        onChange={(event) => setCpf(formatCpf(event.target.value))}
                        onBlur={() => markTouched("cpf")}
                        className={`pl-9 ${touched.cpf && fieldErrors.cpf ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        maxLength={14}
                        placeholder="000.000.000-00"
                        required
                      />
                    </div>
                    {touched.cpf && fieldErrors.cpf && (
                      <p className="text-xs text-destructive">{fieldErrors.cpf}</p>
                    )}
                  </div>

                  {/* Data de Nascimento */}
                  <div className="space-y-2">
                    <Label htmlFor="birth-date">Data de nascimento</Label>
                    <div className="relative">
                      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="birth-date"
                        type="date"
                        autoComplete="bday"
                        value={birthDate}
                        onChange={(event) => setBirthDate(event.target.value)}
                        onBlur={() => markTouched("birthDate")}
                        className={`pl-9 ${touched.birthDate && fieldErrors.birthDate ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        required
                      />
                    </div>
                    {touched.birthDate && fieldErrors.birthDate && (
                      <p className="text-xs text-destructive">{fieldErrors.birthDate}</p>
                    )}
                  </div>

                  {/* Número de Contato */}
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Número de contato / WhatsApp</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="contact-phone"
                        autoComplete="tel"
                        inputMode="tel"
                        value={phone}
                        onChange={(event) => setPhone(formatPhone(event.target.value))}
                        onBlur={() => markTouched("phone")}
                        className={`pl-9 ${touched.phone && fieldErrors.phone ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        maxLength={15}
                        placeholder="(00) 00000-0000"
                        required
                      />
                    </div>
                    {touched.phone && fieldErrors.phone && (
                      <p className="text-xs text-destructive">{fieldErrors.phone}</p>
                    )}
                  </div>

                  {/* E-mail */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        onBlur={() => markTouched("email")}
                        className={`pl-9 ${touched.email && fieldErrors.email ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        maxLength={190}
                        placeholder="seu@email.com"
                        required
                      />
                    </div>
                    {touched.email && fieldErrors.email && (
                      <p className="text-xs text-destructive">{fieldErrors.email}</p>
                    )}
                  </div>

                  {/* Senha */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        onBlur={() => markTouched("password")}
                        className={`pl-9 pr-10 ${touched.password && fieldErrors.password ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        minLength={8}
                        maxLength={128}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
                    {touched.password && fieldErrors.password && (
                      <p className="text-xs text-destructive">{fieldErrors.password}</p>
                    )}
                  </div>

                  {/* Confirmar Senha */}
                  <div className="space-y-2">
                    <Label htmlFor="signup-password-confirmation">Confirmar senha</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-password-confirmation"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={passwordConfirmation}
                        onChange={(event) => setPasswordConfirmation(event.target.value)}
                        onBlur={() => markTouched("passwordConfirmation")}
                        className={`pl-9 pr-10 ${touched.passwordConfirmation && fieldErrors.passwordConfirmation ? "border-destructive focus-visible:ring-destructive" : ""}`}
                        minLength={8}
                        maxLength={128}
                        placeholder="••••••••"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showConfirmPassword ? "Ocultar confirmação de senha" : "Ver confirmação de senha"}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {touched.passwordConfirmation && fieldErrors.passwordConfirmation && (
                      <p className="text-xs text-destructive">{fieldErrors.passwordConfirmation}</p>
                    )}
                  </div>
                </div>

                {/* Termo de Consentimento LGPD */}
                <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <Checkbox
                      id="signup-terms-consent"
                      checked={termsAccepted}
                      onCheckedChange={(checked) => setTermsAccepted(Boolean(checked))}
                      className="mt-0.5"
                    />
                    <label
                      htmlFor="signup-terms-consent"
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
                  {touched.terms && fieldErrors.terms && (
                    <p className="text-xs text-destructive pl-6 font-medium">{fieldErrors.terms}</p>
                  )}
                </div>

                {signupCooldown > 0 && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                    Aguarde {signupCooldown}s para tentar criar a conta novamente. Isso evita bloqueios de segurança.
                  </div>
                )}

                <Button type="submit" className="w-full sm:w-auto" disabled={loading || !canSubmit}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {signupCooldown > 0 ? `Aguarde ${signupCooldown}s` : "Criar conta"}
                </Button>
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

export default CadastroContaAlfa;
