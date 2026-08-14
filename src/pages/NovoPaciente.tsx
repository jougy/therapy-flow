import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, Loader2, Share2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  formatPatientCpf,
  formatPatientPhone,
  getPatientRegistrationPassword,
  normalizePatientNameKey,
  validatePatientPreRegistration,
} from "@/lib/patient-registration";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import { getPatientPath } from "@/lib/patient-routing";

type EnsurePatientResponse = {
  id: string;
  patient_code?: string | null;
  matched_by: "cpf" | "name_birth" | "created";
  status: "existing" | "created";
};

type ExistingPatientMatch = {
  id: string;
  matchedBy: "cpf" | "name_birth";
  name: string;
  status: string | null;
};

const isEnsurePatientResponse = (value: unknown): value is EnsurePatientResponse => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as Record<string, unknown>;
  return (
    typeof data.id === "string" &&
    (data.status === "existing" || data.status === "created") &&
    (data.matched_by === "cpf" || data.matched_by === "name_birth" || data.matched_by === "created")
  );
};

const getRegistrationErrorMessage = (message: string | undefined) => {
  if (!message) {
    return "Não foi possível cadastrar agora. Revise os dados e tente novamente.";
  }

  if (message.includes("Could not find the function") && message.includes("ensure_clinic_patient")) {
    return "O banco de dados ainda não está com a atualização do cadastro aplicada. Atualize as migrations e tente novamente.";
  }

  if (message.includes("CPF inválido")) return "Informe um CPF válido.";
  if (message.includes("Telefone inválido")) return "Informe um telefone com DDD ou deixe o campo em branco.";
  if (message.includes("E-mail inválido")) return "Informe um e-mail válido ou deixe o campo em branco.";
  if (message.includes("Data de nascimento inválida")) return "Informe uma data de nascimento válida.";
  if (message.includes("Sem permissão")) return "Você não tem permissão para cadastrar pacientes nesta clínica.";

  return "Não foi possível cadastrar o paciente agora. Tente novamente em instantes.";
};

const NovoPaciente = () => {
  const navigate = useNavigate();
  const { clinic, clinicId, user } = useAuth();
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cpf, setCpf] = useState("");
  const [usesResponsibleCpf, setUsesResponsibleCpf] = useState(false);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [checkingExistingPatient, setCheckingExistingPatient] = useState(false);
  const [existingPatient, setExistingPatient] = useState<ExistingPatientMatch | null>(null);

  const sharePassword = usesResponsibleCpf ? null : getPatientRegistrationPassword(cpf);
  const validation = validatePatientPreRegistration({
    cpf,
    dateOfBirth: dataNascimento,
    email,
    name: nome,
    phone: telefone,
    usesResponsibleCpf,
  });
  const canSubmit = validation.isValid && !checkingExistingPatient && !existingPatient;
  const validationIssues = Object.values(validation.errors);
  const hasStartedForm = [nome, dataNascimento, cpf, telefone, email].some((value) => value.trim().length > 0) || usesResponsibleCpf;
  const shouldShowValidationIssues = validationIssues.length > 0 && (hasStartedForm || submitAttempted);
  const patientPagePath = (patientId: string) => `/pacientes/${patientId}`;

  useEffect(() => {
    const hasValidIdentity =
      clinicId &&
      validation.values.name.length >= 3 &&
      validation.values.dateOfBirth.length > 0 &&
      !validation.errors.name &&
      !validation.errors.dateOfBirth &&
      !validation.errors.cpf;

    if (!hasValidIdentity) {
      setExistingPatient(null);
      setCheckingExistingPatient(false);
      return;
    }

    let cancelled = false;
    setCheckingExistingPatient(true);

    const timeoutId = window.setTimeout(async () => {
      const selectFields = "id, name, status, date_of_birth, cpf";

      if (!validation.values.usesResponsibleCpf) {
        const { data, error } = await supabase
          .from("patients")
          .select(selectFields)
          .eq("clinic_id", clinicId)
          .eq("cpf", validation.values.cpf)
          .limit(1);

        if (cancelled) return;

        if (!error && data && data.length > 0) {
          const patient = data[0];
          setExistingPatient({
            id: patient.id,
            matchedBy: "cpf",
            name: patient.name,
            status: patient.status,
          });
          setCheckingExistingPatient(false);
          return;
        }
      }

      const { data, error } = await supabase
        .from("patients")
        .select(selectFields)
        .eq("clinic_id", clinicId)
        .eq("date_of_birth", validation.values.dateOfBirth)
        .limit(50);

      if (cancelled) return;

      if (error) {
        setExistingPatient(null);
        setCheckingExistingPatient(false);
        return;
      }

      const nameKey = normalizePatientNameKey(validation.values.name);
      const patient = (data ?? []).find((candidate) => normalizePatientNameKey(candidate.name) === nameKey);
      setExistingPatient(
        patient
          ? {
              id: patient.id,
              matchedBy: "name_birth",
              name: patient.name,
              status: patient.status,
            }
          : null,
      );
      setCheckingExistingPatient(false);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    clinicId,
    validation.errors.cpf,
    validation.errors.dateOfBirth,
    validation.errors.name,
    validation.values.cpf,
    validation.values.dateOfBirth,
    validation.values.name,
    validation.values.usesResponsibleCpf,
  ]);

  const handleSubmit = async (shareWithPatient = false) => {
    if (!user || !clinicId) return;

    setSubmitAttempted(true);

    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0] ?? "Revise os campos obrigatórios.";
      toast({ title: "Pré-cadastro incompleto", description: firstError, variant: "destructive" });
      return;
    }

    if (existingPatient) {
      toast({
        title: "Paciente já cadastrado",
        description: "Abra o cadastro existente pelo aviso no topo da tela.",
      });
      return;
    }

    setSubmitting(true);

    const { data, error } = await supabase.rpc("ensure_clinic_patient", {
      _clinic_id: clinicId,
      _cpf: validation.values.cpf,
      _date_of_birth: validation.values.dateOfBirth,
      _email: validation.values.email,
      _name: validation.values.name,
      _name_key: normalizePatientNameKey(validation.values.name),
      _phone: validation.values.phone,
      _uses_responsible_cpf: validation.values.usesResponsibleCpf,
    });

    if (error || !isEnsurePatientResponse(data)) {
      toast({
        title: "Erro ao cadastrar",
        description: getRegistrationErrorMessage(error?.message),
        variant: "destructive",
      });
    } else {
      const alreadyExisted = data.status === "existing";
      toast({
        title: alreadyExisted ? "Paciente já cadastrado" : "Paciente cadastrado",
        description: alreadyExisted
          ? `Abrindo o cadastro existente encontrado por ${data.matched_by === "cpf" ? "CPF" : "nome e data de nascimento"}.`
          : shareWithPatient
            ? `${validation.values.name} foi adicionado(a). Gere o link e compartilhe com o paciente.`
            : `${validation.values.name} foi adicionado(a). Complete o cadastro para mais detalhes.`,
      });
      navigate(getPatientPath(data.patient_code || data.id, "cadastro"), {
        state: shareWithPatient && !alreadyExisted ? { openShareDialog: true } : undefined,
      });
    }
    setSubmitting(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(clinicHomePath)} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Paciente</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Pré-cadastro rápido</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dados Básicos</CardTitle>
          <CardDescription>Nome, nascimento e CPF do paciente ajudam a evitar duplicidades. Contatos são opcionais.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {existingPatient ? (
            <Alert className="border-amber-300 bg-amber-50 text-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle>Paciente já cadastrado</AlertTitle>
              <AlertDescription>
                <div className="space-y-3">
                  <p>
                    Encontramos um cadastro {existingPatient.status === "ativo" ? "ativo" : "existente"} para {existingPatient.name} por{" "}
                    {existingPatient.matchedBy === "cpf" ? "CPF" : "nome e data de nascimento"}.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => navigate(patientPagePath(existingPatient.id))}
                  >
                    Abrir cadastro existente
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
          {shouldShowValidationIssues ? (
            <Alert variant="destructive" className="bg-destructive/5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Revise os dados para cadastrar</AlertTitle>
              <AlertDescription>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {validationIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(sanitizeSingleLineInput(e.target.value, INPUT_LIMITS.name))}
              placeholder="Nome do paciente"
              maxLength={INPUT_LIMITS.name}
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nascimento">Data de nascimento *</Label>
            <Input id="nascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">{usesResponsibleCpf ? "CPF do responsável *" : "CPF do paciente *"}</Label>
            <Input id="cpf" value={cpf} onChange={(e) => setCpf(formatPatientCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} required />
            <div className="flex items-start gap-2 rounded-md border border-border/70 bg-muted/30 p-3">
              <Checkbox
                id="usesResponsibleCpf"
                checked={usesResponsibleCpf}
                onCheckedChange={(checked) => setUsesResponsibleCpf(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="usesResponsibleCpf" className="cursor-pointer text-sm font-normal leading-5">
                Paciente não possui CPF próprio; usar CPF do responsável.
              </Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Número de contato</Label>
            <Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(formatPatientPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(sanitizeSingleLineInput(e.target.value, INPUT_LIMITS.email))}
              placeholder="paciente@email.com"
              maxLength={INPUT_LIMITS.email}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 pb-8 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" onClick={() => navigate(clinicHomePath)} className="w-full sm:w-auto">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <div className="grid gap-2 sm:flex sm:items-center">
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={submitting || !canSubmit || !sharePassword}
            className="w-full sm:w-auto"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
            Cadastrar e compartilhar
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={submitting || !canSubmit} className="w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Cadastrar Paciente
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default NovoPaciente;
