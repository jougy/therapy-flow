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
import { getPatientRegistrationPassword } from "@/lib/patient-registration";

const NovoPaciente = () => {
  const navigate = useNavigate();
  const { clinicId, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  const [nome, setNome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  const formatCpf = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const calculateAge = (birthDate: string): number | null => {
    if (!birthDate) return null;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  };

  const sharePassword = getPatientRegistrationPassword(cpf);
  const canSubmit = nome.trim().length > 0;

  const handleSubmit = async (shareWithPatient = false) => {
    if (!user || !canSubmit || !clinicId) return;
    setSubmitting(true);

    const { data, error } = await supabase.from("patients").insert({
      user_id: user.id,
      clinic_id: clinicId,
      name: nome.trim(),
      date_of_birth: dataNascimento || null,
      age: calculateAge(dataNascimento),
      cpf: cpf.replace(/\D/g, "") || null,
      phone: telefone.replace(/\D/g, "") || null,
      email: email.trim() || null,
      status: "ativo",
      registration_complete: false,
    }).select("id").single();

    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Paciente cadastrado",
        description: shareWithPatient
          ? `${nome} foi adicionado(a). Gere o link e compartilhe com o paciente.`
          : `${nome} foi adicionado(a). Complete o cadastro para mais detalhes.`,
      });
      navigate(`/pacientes/${data.id}`, {
        state: shareWithPatient ? { openShareDialog: true } : undefined,
      });
    }
    setSubmitting(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
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
          <CardDescription>Preencha o essencial para criar o paciente. O cadastro completo pode ser feito depois.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do paciente" autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nascimento">Data de nascimento</Label>
            <Input id="nascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="telefone">Número de contato</Label>
            <Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="paciente@email.com" />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pb-8">
        <Button variant="outline" onClick={() => navigate("/")}>
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
