import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  ClipboardEdit,
  FileText,
  Globe,
  IdCard,
  List,
  Loader2,
  Mail,
  Phone,
  Share2,
  Sparkles,
  UserCheck,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  calculateAgeDetails,
  formatNameTitleCase,
  formatPatientCpf,
  formatPatientPhone,
  normalizePatientNameKey,
  suggestEmailTypo,
  validatePatientPreRegistration,
  type PatientDocumentType,
} from "@/lib/patient-registration";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";
import { getClinicPatientPath } from "@/lib/patient-routing";
import {
  SharePatientRegistrationModal,
  type SharePatientData,
} from "@/components/patients/SharePatientRegistrationModal";

import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";

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

const DOCUMENT_TYPE_OPTIONS: Array<{ value: PatientDocumentType; label: string; placeholder: string }> = [
  { value: "cpf", label: "CPF do paciente (Padrão)", placeholder: "000.000.000-00" },
  { value: "responsible_cpf", label: "CPF do responsável (Menor/Dependente)", placeholder: "000.000.000-00" },
  { value: "passport", label: "Passaporte / ID Estrangeiro", placeholder: "Ex: AB123456" },
  { value: "rg", label: "RG / Documento Nacional", placeholder: "Ex: 00.000.000-0" },
  { value: "none", label: "Não possui documento no momento", placeholder: "Identificação por Nome e Nascimento" },
];

const GENDER_OPTIONS = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "nao-binario", label: "Não-binário" },
  { value: "outro", label: "Outro" },
  { value: "nao-informar", label: "Prefiro não informar" },
];

const PRONOUN_OPTIONS = [
  { value: "ela/dela", label: "Ela / Dela" },
  { value: "ele/dele", label: "Ele / Dele" },
  { value: "elu/delu", label: "Elu / Delu" },
  { value: "outro", label: "Outro" },
];

const NovoPaciente = () => {
  const navigate = useNavigate();
  const { clinic, clinicId, user } = useAuth();
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";

  const [submitting, setSubmitting] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [documentType, setDocumentType] = useState<PatientDocumentType>("cpf");
  const [cpf, setCpf] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [genero, setGenero] = useState("");
  const [pronome, setPronome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  const [checkingExistingPatient, setCheckingExistingPatient] = useState(false);
  const [existingPatient, setExistingPatient] = useState<ExistingPatientMatch | null>(null);

  // Post-Submit Dialogs State
  const [askShareModalOpen, setAskShareModalOpen] = useState(false);
  const [askManualFillModalOpen, setAskManualFillModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createdPatient, setCreatedPatient] = useState<SharePatientData | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const birthDateInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const usesResponsibleCpf = documentType === "responsible_cpf";
  const isCpfType = documentType === "cpf" || documentType === "responsible_cpf";

  const validation = validatePatientPreRegistration({
    cpf: isCpfType ? cpf : "",
    dateOfBirth: dataNascimento,
    documentNumber: !isCpfType ? documentNumber : "",
    documentType,
    email,
    gender: genero,
    name: nome,
    phone: telefone,
    pronoun: pronome,
    usesResponsibleCpf,
  });

  const ageDetails = useMemo(() => calculateAgeDetails(dataNascimento), [dataNascimento]);
  const emailTypo = useMemo(() => suggestEmailTypo(email), [email]);

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const patientPagePath = (patientId: string) => getClinicPatientPath(clinic?.route_key, patientId);
  const patientCadastroPath = (patientId: string) => getClinicPatientPath(clinic?.route_key, patientId, "cadastro");

  // Duplicate patient check
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
      const selectFields = "id, name, status, date_of_birth, cpf, responsible_cpf";

      if (documentType === "cpf" && validation.values.cpf) {
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
        .limit(100);

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
    documentType,
    validation.errors.cpf,
    validation.errors.dateOfBirth,
    validation.errors.name,
    validation.values.cpf,
    validation.values.dateOfBirth,
    validation.values.name,
  ]);

  const handleSubmit = async (e?: FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!user || !clinicId) return;

    setSubmitAttempted(true);
    setTouched({
      cpf: true,
      dataNascimento: true,
      documentNumber: true,
      email: true,
      nome: true,
      telefone: true,
    });

    if (!validation.isValid) {
      const firstErrorKey = Object.keys(validation.errors)[0];
      const firstErrorMessage = Object.values(validation.errors)[0] ?? "Revise os campos obrigatórios.";

      toast({
        title: "Campos pendentes",
        description: firstErrorMessage,
        variant: "destructive",
      });

      if (firstErrorKey === "name") nameInputRef.current?.focus();
      else if (firstErrorKey === "dateOfBirth") birthDateInputRef.current?.focus();
      else if (firstErrorKey === "cpf" || firstErrorKey === "documentNumber") documentInputRef.current?.focus();
      else if (firstErrorKey === "phone") phoneInputRef.current?.focus();
      else if (firstErrorKey === "email") emailInputRef.current?.focus();

      return;
    }

    if (existingPatient) {
      toast({
        title: "Paciente já cadastrado",
        description: "Encontramos um cadastro existente com esses dados.",
      });
      return;
    }

    setSubmitting(true);

    try {
      const isCpfBased = documentType === "cpf" || documentType === "responsible_cpf";
      const finalCpf = isCpfBased ? validation.values.cpf : null;
      const finalRg = !isCpfBased && documentType !== "none" ? validation.values.documentNumber || null : null;

      const { data, error } = await supabase.rpc("ensure_clinic_patient", {
        _clinic_id: clinicId,
        _cpf: finalCpf,
        _date_of_birth: validation.values.dateOfBirth,
        _email: validation.values.email,
        _gender: genero || null,
        _name: validation.values.name,
        _name_key: normalizePatientNameKey(validation.values.name),
        _phone: validation.values.phone,
        _pronoun: pronome || null,
        _rg: finalRg,
        _uses_responsible_cpf: usesResponsibleCpf,
      });

      if (error || !isEnsurePatientResponse(data)) {
        toast({
          title: "Erro ao cadastrar",
          description: getRegistrationErrorMessage(error?.message),
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const alreadyExisted = data.status === "existing";

      if (alreadyExisted) {
        toast({
          title: "Paciente já existente",
          description: `Abrindo o cadastro encontrado por ${data.matched_by === "cpf" ? "CPF" : "nome e data de nascimento"}.`,
        });
        navigate(patientPagePath(data.patient_code || data.id));
        setSubmitting(false);
        return;
      }

      const patientData: SharePatientData = {
        id: data.id,
        name: validation.values.name,
        cpf: finalCpf,
        responsible_cpf: usesResponsibleCpf ? finalCpf : null,
        date_of_birth: validation.values.dateOfBirth,
        phone: validation.values.phone,
        email: validation.values.email,
        gender: genero,
        pronoun: pronome,
        patient_code: data.patient_code,
      };

      setCreatedPatient(patientData);
      toast({
        title: "Pré-cadastro concluído!",
        description: `${validation.values.name} foi adicionado(a) com sucesso.`,
      });

      // Abre o fluxo de perguntas pós-cadastro
      setAskShareModalOpen(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro inesperado";
      toast({
        title: "Erro no cadastro",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const nameError = (touched.nome || submitAttempted) && validation.errors.name;
  const birthError = (touched.dataNascimento || submitAttempted) && validation.errors.dateOfBirth;
  const docError = (touched.cpf || touched.documentNumber || submitAttempted) && (validation.errors.cpf || validation.errors.documentNumber);
  const phoneError = (touched.telefone || submitAttempted) && validation.errors.phone;
  const emailError = (touched.email || submitAttempted) && validation.errors.email;

  const currentDocConfig = DOCUMENT_TYPE_OPTIONS.find((opt) => opt.value === documentType) || DOCUMENT_TYPE_OPTIONS[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="max-w-2xl mx-auto space-y-6 pb-12"
    >
      {/* Breadcrumb & Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => navigate(clinicHomePath)}
            className="hover:text-foreground transition-colors"
          >
            Início
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <button
            type="button"
            onClick={() => navigate(clinicHomePath)}
            className="hover:text-foreground transition-colors"
          >
            Pacientes
          </button>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">Novo Paciente</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate(clinicHomePath)}
              aria-label="Voltar para a lista de pacientes"
              className="h-9 w-9 rounded-xl shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Novo Paciente</h1>
              <p className="text-muted-foreground text-sm">
                Pré-cadastro rápido para iniciar o prontuário eletrônico
              </p>
            </div>
          </div>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-6">
        <Card data-tutorial="new-patient-form-basic" className="rounded-2xl border bg-card shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <UserRound className="h-5 w-5 text-primary" />
                Dados do Paciente
              </CardTitle>
              <ComponentHelpButton
                helpId="new-patient-form-basic"
                size="xs"
              />
            </div>
            <CardDescription className="text-xs sm:text-sm">
              Preencha as informações essenciais. Os dados complementares poderão ser preenchidos a seguir ou compartilhados com o paciente.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Existing Patient Alert */}
            {existingPatient && (
              <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 rounded-xl">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <AlertTitle className="font-semibold">Paciente já cadastrado</AlertTitle>
                <AlertDescription className="mt-1 text-xs sm:text-sm space-y-3">
                  <p>
                    Encontramos um cadastro {existingPatient.status === "ativo" ? "ativo" : "existente"} para{" "}
                    <strong>{existingPatient.name}</strong> por{" "}
                    {existingPatient.matchedBy === "cpf" ? "CPF" : "nome e data de nascimento"}.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full sm:w-auto font-medium"
                    onClick={() => navigate(patientPagePath(existingPatient.id))}
                  >
                    Abrir cadastro existente
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Linha 1: Nome Completo (100%) */}
            <div data-tutorial="new-patient-name" className="space-y-1.5">
              <Label htmlFor="nome" className="text-sm font-medium flex items-center justify-between">
                <span>Nome completo <span className="text-destructive">*</span></span>
                {checkingExistingPatient && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1 font-normal">
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    Verificando...
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  ref={nameInputRef}
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(sanitizeSingleLineInput(e.target.value, INPUT_LIMITS.name))}
                  onBlur={() => {
                    markTouched("nome");
                    if (nome) {
                      setNome(formatNameTitleCase(nome));
                    }
                  }}
                  placeholder="Ex: Maria da Silva"
                  maxLength={INPUT_LIMITS.name}
                  aria-invalid={Boolean(nameError)}
                  aria-required="true"
                  className={nameError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </div>
              {nameError && (
                <p className="text-xs text-destructive font-medium">{nameError}</p>
              )}
            </div>

            {/* Linha 2: Data de Nascimento (100% ou 50%) */}
            <div data-tutorial="new-patient-birth" className="space-y-1.5">
              <Label htmlFor="nascimento" className="text-sm font-medium flex items-center justify-between">
                <span>Data de nascimento <span className="text-destructive">*</span></span>
                {ageDetails && (
                  <Badge variant={ageDetails.isMinor ? "secondary" : "outline"} className="text-xs font-normal">
                    {ageDetails.label}
                  </Badge>
                )}
              </Label>
              <div className="relative">
                <Input
                  ref={birthDateInputRef}
                  id="nascimento"
                  type="date"
                  max={todayStr}
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  onBlur={() => markTouched("dataNascimento")}
                  aria-invalid={Boolean(birthError)}
                  aria-required="true"
                  className={birthError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
              </div>
              {birthError && (
                <p className="text-xs text-destructive font-medium">{birthError}</p>
              )}
              {ageDetails?.isMinor && documentType === "cpf" && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl border border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/30 text-xs text-blue-900 dark:text-blue-200 mt-1">
                  <span>👶 Paciente menor de idade ({ageDetails.label}). Deseja usar o CPF do responsável?</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDocumentType("responsible_cpf");
                      markTouched("cpf");
                    }}
                    className="h-7 text-xs px-2.5 bg-background hover:bg-blue-100 dark:hover:bg-blue-900 font-medium shrink-0"
                  >
                    Usar CPF do responsável
                  </Button>
                </div>
              )}
            </div>

            {/* Linha 3: Documento (Tipo de documento + Número do documento) */}
            <div data-tutorial="new-patient-document" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="documentType" className="text-sm font-medium">
                  Tipo de documento
                </Label>
                <Select
                  value={documentType}
                  onValueChange={(val) => {
                    setDocumentType(val as PatientDocumentType);
                    markTouched("cpf");
                  }}
                >
                  <SelectTrigger id="documentType" className="w-full">
                    <SelectValue placeholder="Selecione o documento" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="docInput" className="text-sm font-medium">
                  {documentType === "cpf" && <span>CPF do paciente <span className="text-destructive">*</span></span>}
                  {documentType === "responsible_cpf" && <span>CPF do responsável <span className="text-destructive">*</span></span>}
                  {documentType === "passport" && <span>Número do Passaporte / ID</span>}
                  {documentType === "rg" && <span>Número do RG / Documento</span>}
                  {documentType === "none" && <span>Identificação sem documento</span>}
                </Label>
                <div className="relative">
                  {isCpfType ? (
                    <Input
                      ref={documentInputRef}
                      id="docInput"
                      value={cpf}
                      onChange={(e) => setCpf(formatPatientCpf(e.target.value))}
                      onBlur={() => markTouched("cpf")}
                      placeholder="000.000.000-00"
                      maxLength={14}
                      inputMode="numeric"
                      aria-invalid={Boolean(docError)}
                      aria-required="true"
                      className={docError ? "border-destructive focus-visible:ring-destructive font-mono" : "font-mono"}
                    />
                  ) : documentType === "none" ? (
                    <div className="h-10 px-3 py-2 rounded-md border border-border/60 bg-muted/40 text-xs text-muted-foreground flex items-center">
                      Identificação por Nome e Nascimento
                    </div>
                  ) : (
                    <Input
                      ref={documentInputRef}
                      id="docInput"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(sanitizeSingleLineInput(e.target.value, 32))}
                      onBlur={() => markTouched("documentNumber")}
                      placeholder={currentDocConfig.placeholder}
                      maxLength={32}
                      aria-invalid={Boolean(docError)}
                      className={docError ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                  )}
                </div>
                {docError && (
                  <p className="text-xs text-destructive font-medium">{docError}</p>
                )}
              </div>
            </div>

            {/* Linha 4: Gênero (50%) + Pronome (50%) */}
            <div data-tutorial="new-patient-gender-pronoun" className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="genero" className="text-sm font-medium">
                  Gênero <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Select value={genero} onValueChange={setGenero}>
                  <SelectTrigger id="genero" className="w-full">
                    <SelectValue placeholder="Selecione o gênero" />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pronome" className="text-sm font-medium">
                  Pronome de tratamento <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <Select value={pronome} onValueChange={setPronome}>
                  <SelectTrigger id="pronome" className="w-full">
                    <SelectValue placeholder="Selecione o pronome" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRONOUN_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 5: Contatos (WhatsApp 50% + E-mail 50%) */}
            <div data-tutorial="new-patient-contacts" className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="telefone" className="text-sm font-medium flex items-center gap-1.5">
                  <span>WhatsApp / Contato</span>
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <div className="relative">
                  <Input
                    ref={phoneInputRef}
                    id="telefone"
                    type="tel"
                    value={telefone}
                    onChange={(e) => setTelefone(formatPatientPhone(e.target.value))}
                    onBlur={() => markTouched("telefone")}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                    inputMode="tel"
                    aria-invalid={Boolean(phoneError)}
                    className={phoneError ? "border-destructive focus-visible:ring-destructive font-mono" : "font-mono"}
                  />
                </div>
                {phoneError && (
                  <p className="text-xs text-destructive font-medium">{phoneError}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium flex items-center gap-1.5">
                  <span>E-mail</span>
                  <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
                </Label>
                <div className="relative">
                  <Input
                    ref={emailInputRef}
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(sanitizeSingleLineInput(e.target.value, INPUT_LIMITS.email))}
                    onBlur={() => markTouched("email")}
                    placeholder="paciente@email.com"
                    maxLength={INPUT_LIMITS.email}
                    aria-invalid={Boolean(emailError)}
                    className={emailError ? "border-destructive focus-visible:ring-destructive" : ""}
                  />
                </div>
                {emailError && (
                  <p className="text-xs text-destructive font-medium">{emailError}</p>
                )}
                {emailTypo && (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30 text-xs text-amber-900 dark:text-amber-200 mt-1">
                    <span>💡 Você quis dizer <strong>{emailTypo}</strong>?</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEmail(emailTypo);
                        markTouched("email");
                      }}
                      className="h-6 text-xs px-2 hover:bg-amber-100 dark:hover:bg-amber-900 font-semibold"
                    >
                      Corrigir
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons Bar */}
        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(clinicHomePath)}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>

          <Button
            data-tutorial="new-patient-submit-btn"
            type="submit"
            disabled={submitting || checkingExistingPatient}
            className="w-full sm:w-auto font-semibold shadow-sm gap-2"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Concluir Pré-Cadastro
          </Button>
        </div>
      </form>

      {/* Step 1 Modal: Ask to Share */}
      <Dialog open={askShareModalOpen} onOpenChange={setAskShareModalOpen}>
        <DialogContent className="max-w-md p-6 sm:rounded-2xl space-y-4">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Share2 className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Deseja compartilhar a ficha de cadastro?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Você pode enviar um link temporário e seguro para {createdPatient?.name} preencher as informações complementares (endereço, histórico de saúde e contatos) pelo celular.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAskShareModalOpen(false);
                setAskManualFillModalOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              Agora não
            </Button>
            <Button
              type="button"
              onClick={() => {
                setAskShareModalOpen(false);
                setShareModalOpen(true);
              }}
              className="w-full sm:w-auto font-semibold gap-1.5"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Step 2 Modal: Ask to Manual Fill */}
      <Dialog open={askManualFillModalOpen} onOpenChange={setAskManualFillModalOpen}>
        <DialogContent className="max-w-md p-6 sm:rounded-2xl space-y-4">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-muted text-foreground flex items-center justify-center">
              <ClipboardEdit className="h-5 w-5" />
            </div>
            <DialogTitle className="text-lg font-bold">
              Deseja preencher o cadastro completo agora?
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Você pode continuar preenchendo todos os detalhes clínicos e endereço manualmente agora ou prosseguir para o atendimento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            <Button
              type="button"
              onClick={() => {
                setAskManualFillModalOpen(false);
                if (createdPatient) {
                  navigate(patientCadastroPath(createdPatient.patient_code || createdPatient.id));
                }
              }}
              className="w-full justify-start text-left h-auto p-3.5 gap-3 font-semibold"
            >
              <div className="h-8 w-8 rounded-lg bg-primary-foreground/20 flex items-center justify-center shrink-0">
                <ClipboardEdit className="h-4 w-4" />
              </div>
              <div>
                <div>Preencher cadastro completo agora</div>
                <div className="text-xs font-normal text-primary-foreground/80">Abrir formulário de cadastro com 8 abas</div>
              </div>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAskManualFillModalOpen(false);
                if (createdPatient) {
                  navigate(patientPagePath(createdPatient.patient_code || createdPatient.id));
                }
              }}
              className="w-full justify-start text-left h-auto p-3.5 gap-3"
            >
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="font-semibold text-sm">Ir para o prontuário do paciente</div>
                <div className="text-xs text-muted-foreground">Ver resumo e iniciar atendimento</div>
              </div>
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setAskManualFillModalOpen(false);
                navigate(clinicHomePath);
              }}
              className="w-full justify-start text-left h-auto p-3 gap-3 text-muted-foreground hover:text-foreground"
            >
              <List className="h-4 w-4 shrink-0" />
              <span className="text-xs">Concluir e voltar para lista de pacientes</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      <SharePatientRegistrationModal
        open={shareModalOpen}
        onOpenChange={(open) => {
          setShareModalOpen(open);
          if (!open && createdPatient) {
            setAskManualFillModalOpen(true);
          }
        }}
        patient={createdPatient}
        clinicName={clinic?.name}
        continueButtonLabel="Próximo passo"
        onContinueToPatient={() => {
          setShareModalOpen(false);
          setAskManualFillModalOpen(true);
        }}
      />
    </motion.div>
  );
};

export default NovoPaciente;
