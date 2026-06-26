import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, LockKeyhole, Mail, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCpf, formatPhone } from "@/lib/profile-settings";
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
    .trim()
    .slice(0, max);

const normalizeName = (value: string) => sanitizeText(value, 120);

const normalizeEmail = (value: string) => value.trim().toLowerCase();

const formatCnpj = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

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

const isValidCnpj = (value: string) => {
  const cnpj = onlyDigits(value);
  if (!cnpj) return true;
  if (cnpj.length !== 14 || /^(\d)\1+$/.test(cnpj)) return false;
  const calc = (weights: number[]) => {
    const sum = weights.reduce((total, weight, index) => total + Number(cnpj[index]) * weight, 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[12]) &&
    calc([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) === Number(cnpj[13]);
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
    return `Por segurança, o Supabase bloqueou uma nova tentativa muito rápida. Aguarde ${rateLimitSeconds} segundos e tente novamente.`;
  }

  if (/already registered|already exists|user already/i.test(message)) {
    return "Este e-mail já possui uma conta. Tente entrar pelo login ou use outro e-mail.";
  }

  if (message) return message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Não foi possível concluir o cadastro.";
};

const CadastroContaAlfa = () => {
  const navigate = useNavigate();
  const [ownerName, setOwnerName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [cpf, setCpf] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [plan, setPlan] = useState<"clinic" | "solo">("clinic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [signupCooldown, setSignupCooldown] = useState(0);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (signupCooldown <= 0) return;

    const timeoutId = window.setTimeout(() => {
      setSignupCooldown((current) => Math.max(current - 1, 0));
    }, 1_000);

    return () => window.clearTimeout(timeoutId);
  }, [signupCooldown]);

  const cleanCpf = useMemo(() => onlyDigits(cpf), [cpf]);
  const cleanCnpj = useMemo(() => onlyDigits(cnpj), [cnpj]);
  const cleanPhone = useMemo(() => onlyDigits(phone), [phone]);
  const clinicDocument = cleanCnpj || cleanCpf;
  const hasStartedForm = Boolean(ownerName || clinicName || cpf || cnpj || birthDate || phone || email || password || passwordConfirmation);
  const formErrors = useMemo(() => {
    const errors: string[] = [];
    if (ownerName && normalizeName(ownerName).length < 3) errors.push("Nome precisa ter pelo menos 3 caracteres.");
    if (cpf && !isValidCpf(cpf)) errors.push("CPF inválido.");
    if (cnpj && !isValidCnpj(cnpj)) errors.push("CNPJ inválido.");
    if (birthDate && !isValidBirthDate(birthDate)) errors.push("Data de nascimento deve indicar uma pessoa maior de 18 anos e com até 120 anos.");
    if (phone && ![10, 11].includes(cleanPhone.length)) errors.push("Contato precisa ter DDD e 10 ou 11 dígitos.");
    if (email && !isValidEmail(normalizeEmail(email))) errors.push("E-mail inválido.");
    if (password && !isStrongEnoughPassword(password)) errors.push("Senha precisa ter pelo menos 8 caracteres, com letras e números.");
    if (passwordConfirmation && password !== passwordConfirmation) errors.push("Confirmação de senha não confere.");
    return errors;
  }, [birthDate, cleanPhone.length, cnpj, cpf, email, ownerName, password, passwordConfirmation, phone]);

  const canSubmit =
    signupCooldown === 0 &&
    normalizeName(ownerName).length >= 3 &&
    isValidEmail(normalizeEmail(email)) &&
    isValidCpf(cpf) &&
    isValidCnpj(cnpj) &&
    isValidBirthDate(birthDate) &&
    [10, 11].includes(cleanPhone.length) &&
    isStrongEnoughPassword(password) &&
    password === passwordConfirmation;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit || submitLockRef.current) return;

    submitLockRef.current = true;
    setLoading(true);
    try {
      const nextEmail = normalizeEmail(email);
      const nextOwnerName = normalizeName(ownerName);
      const nextClinicName = sanitizeText(clinicName, 120);

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: nextEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirmado`,
          data: {
            birth_date: birthDate,
            cnpj: cleanCnpj || null,
            clinic_name: nextClinicName || null,
            cpf: cleanCpf,
            full_name: nextOwnerName,
            phone: cleanPhone,
            signup_source: "alpha_closed_link",
          },
        },
      });
      if (signupError) throw signupError;

      const userId = signupData.user?.id;
      if (!userId) throw new Error("Conta criada sem ID de usuário. Tente entrar pelo login.");

      const { data: rpcData, error: rpcError } = await supabase.rpc("handle_signup", {
        _cnpj: clinicDocument,
        _clinic_name: nextClinicName || null,
        _email: nextEmail,
        _full_name: nextOwnerName,
        _subscription_plan: plan,
        _user_id: userId,
      });
      if (rpcError) throw rpcError;

      const result = (rpcData ?? {}) as { clinic_id?: string };
      if (result.clinic_id) {
        await supabase
          .from("profiles")
          .update({ birth_date: birthDate, cpf: cleanCpf, phone: cleanPhone })
          .eq("id", userId);
      }
      if (result.clinic_id && nextClinicName) {
        await supabase
          .from("clinics")
          .update({ email: nextEmail, legal_name: nextClinicName, name: nextClinicName, phone: cleanPhone })
          .eq("id", result.clinic_id);
      }

      setCreated(true);
      toast({
        title: "Conta criada",
        description: "Seu acesso alfa foi criado. Você já pode escolher sua clínica.",
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
    <div className="min-h-screen bg-background px-4 py-6">
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

        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Pluri-Health</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Criar conta alfa</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{created ? "Conta criada" : "Dados da conta"}</CardTitle>
            <CardDescription>
              {created
                ? "Sua conta foi preparada. Continue para selecionar a clínica."
                : "Crie o owner inicial e a clínica vinculada a esta conta."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {created ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-medium">Cadastro alfa concluído</p>
                      <p className="mt-1 text-sm">Se a confirmação de e-mail estiver ativa, confirme seu e-mail antes de entrar.</p>
                    </div>
                  </div>
                </div>
                <Button className="w-full sm:w-auto" onClick={() => navigate("/espacopessoal", { replace: true })}>
                  Ir para minhas clínicas
                </Button>
              </div>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="owner-name">Seu nome</Label>
                    <div className="relative">
                      <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="owner-name"
                        value={ownerName}
                        onChange={(event) => setOwnerName(event.target.value)}
                        className="pl-9"
                        maxLength={120}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="owner-cpf">CPF</Label>
                    <Input
                      id="owner-cpf"
                      value={cpf}
                      onChange={(event) => setCpf(formatCpf(event.target.value))}
                      inputMode="numeric"
                      maxLength={32}
                      placeholder="000.000.000-00"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clinic-name">Nome da clínica</Label>
                    <Input
                      id="clinic-name"
                      value={clinicName}
                      onChange={(event) => setClinicName(sanitizeText(event.target.value, 120))}
                      maxLength={120}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="clinic-cnpj">CNPJ da clínica</Label>
                    <Input
                      id="clinic-cnpj"
                      value={cnpj}
                      onChange={(event) => setCnpj(formatCnpj(event.target.value))}
                      inputMode="numeric"
                      maxLength={32}
                      placeholder="Opcional"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Número de contato</Label>
                    <Input
                      id="contact-phone"
                      value={phone}
                      onChange={(event) => setPhone(formatPhone(event.target.value))}
                      inputMode="tel"
                      maxLength={32}
                      placeholder="(00) 00000-0000"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="birth-date">Data de nascimento</Label>
                    <Input
                      id="birth-date"
                      type="date"
                      value={birthDate}
                      onChange={(event) => setBirthDate(event.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="pl-9"
                        maxLength={160}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo de conta</Label>
                    <Select value={plan} onValueChange={(value) => setPlan(value as "clinic" | "solo")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="clinic">Clínica com equipe</SelectItem>
                        <SelectItem value="solo">Profissional solo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Senha</Label>
                    <div className="relative">
                      <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className="pl-9 pr-10"
                        minLength={8}
                        maxLength={128}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                        aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password-confirmation">Confirmar senha</Label>
                    <Input
                      id="signup-password-confirmation"
                      type={showPassword ? "text" : "password"}
                      value={passwordConfirmation}
                      onChange={(event) => setPasswordConfirmation(event.target.value)}
                      minLength={8}
                      maxLength={128}
                      required
                    />
                  </div>
                </div>

                {hasStartedForm && formErrors.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <p className="font-medium">Pendências para criar a conta</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {formErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {signupCooldown > 0 && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950">
                    Aguarde {signupCooldown}s para tentar criar a conta novamente. Isso evita bloqueios do provedor de autenticação.
                  </div>
                )}

                <Button type="submit" className="w-full sm:w-auto" disabled={loading || !canSubmit}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {signupCooldown > 0 ? `Aguarde ${signupCooldown}s` : "Criar conta alfa"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default CadastroContaAlfa;
