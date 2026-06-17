import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type EnsurePatientResponse = {
  id: string;
  matched_by: "cpf" | "name" | "created";
  status: "existing" | "created";
};

const isEnsurePatientResponse = (value: unknown): value is EnsurePatientResponse => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as Record<string, unknown>;
  return (
    typeof data.id === "string" &&
    (data.status === "existing" || data.status === "created") &&
    (data.matched_by === "cpf" || data.matched_by === "name" || data.matched_by === "created")
  );
};

const NovoPaciente = () => {
  const navigate = useNavigate();
  const { clinic, clinicId, user } = useAuth();
  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const [submitting, setSubmitting] = useState(false);

  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  const sharePassword = getPatientRegistrationPassword(cpf);
  const validation = validatePatientPreRegistration({
    cpf,
    dateOfBirth: dataNascimento,
    email,
    name: nome,
    phone: telefone,
  });
  const canSubmit = validation.isValid;

  const handleSubmit = async (shareWithPatient = false) => {
    if (!user || !clinicId) return;

    if (!validation.isValid) {
      const firstError = Object.values(validation.errors)[0] ?? "Revise os campos obrigatórios.";
      toast({ title: "Pré-cadastro incompleto", description: firstError, variant: "destructive" });
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
    });

    if (error || !isEnsurePatientResponse(data)) {
      toast({
        title: "Erro ao cadastrar",
        description: error?.message ?? "Não foi possível confirmar se o paciente já existe.",
        variant: "destructive",
      });
    } else {
      const alreadyExisted = data.status === "existing";
      toast({
        title: alreadyExisted ? "Paciente já cadastrado" : "Paciente cadastrado",
        description: alreadyExisted
          ? `Abrindo o cadastro existente encontrado por ${data.matched_by === "cpf" ? "CPF" : "nome"}.`
          : shareWithPatient
            ? `${validation.values.name} foi adicionado(a). Gere o link e compartilhe com o paciente.`
            : `${validation.values.name} foi adicionado(a). Complete o cadastro para mais detalhes.`,
      });
      navigate(`/pacientes/${data.id}/cadastro`, {
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
          <CardDescription>Preencha todos os dados obrigatórios para criar o paciente e seguir para o cadastro completo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
            <Label htmlFor="cpf">CPF *</Label>
            <Input id="cpf" value={cpf} onChange={(e) => setCpf(formatPatientCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Número de contato *</Label>
            <Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(formatPatientPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(sanitizeSingleLineInput(e.target.value, INPUT_LIMITS.email))}
              placeholder="paciente@email.com"
              maxLength={INPUT_LIMITS.email}
              required
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pb-8">
        <Button variant="outline" onClick={() => navigate(clinicHomePath)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={submitting || !canSubmit || !sharePassword}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Share2 className="h-4 w-4 mr-2" />}
            Cadastrar e compartilhar
          </Button>
          <Button onClick={() => handleSubmit(false)} disabled={submitting || !canSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Cadastrar Paciente
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default NovoPaciente;
