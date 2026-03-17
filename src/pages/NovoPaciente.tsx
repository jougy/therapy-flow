import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, User, Stethoscope, History, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const steps = [
  { id: "cadastro", label: "Dados Cadastrais", icon: User },
  { id: "anamnese", label: "Anamnese", icon: Stethoscope },
  { id: "historico", label: "Histórico", icon: History },
  { id: "exame", label: "Exame Físico", icon: Activity },
];

const NovoPaciente = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1
  const [nome, setNome] = useState("");
  const [sexo, setSexo] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [profissao, setProfissao] = useState("");
  const [rg, setRg] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  // Step 2
  const [diagnosticoMedico, setDiagnosticoMedico] = useState("");
  const [queixaPrincipal, setQueixaPrincipal] = useState("");
  const [intensidadeDor, setIntensidadeDor] = useState([0]);
  const [dorObs, setDorObs] = useState("");
  const [hmpHma, setHmpHma] = useState("");
  const [doencasAssociadas, setDoencasAssociadas] = useState("");

  // Step 3
  const [historicoFamiliar, setHistoricoFamiliar] = useState("");
  const [medicacao, setMedicacao] = useState("");
  const [fumante, setFumante] = useState("");
  const [dieta, setDieta] = useState("");
  const [atividadeFisica, setAtividadeFisica] = useState("");
  const [objetivos, setObjetivos] = useState("");

  // Step 4
  const [massa, setMassa] = useState("");
  const [altura, setAltura] = useState("");
  const [pa, setPa] = useState("");
  const [fcc, setFcc] = useState("");
  const [fr, setFr] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const canGoNext = () => {
    if (currentStep === 0) return nome.trim().length > 0;
    return true;
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

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);

    const anamnesis = {
      diagnostico_medico: diagnosticoMedico,
      queixa_principal: queixaPrincipal,
      intensidade_dor: intensidadeDor[0],
      dor_obs: dorObs,
      hmp_hma: hmpHma,
      doencas_associadas: doencasAssociadas,
      historico_familiar: historicoFamiliar,
      medicacao,
      fumante,
      dieta,
      atividade_fisica: atividadeFisica,
      objetivos,
      exame_fisico: { massa, altura, pa, fcc, fr, observacoes },
    };

    const { error } = await supabase.from("patients").insert({
      user_id: user.id,
      name: nome,
      age: calculateAge(dataNascimento),
      phone: telefone || null,
      cpf: cpf || null,
      status: "ativo",
    });

    if (error) {
      toast({ title: "Erro ao cadastrar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paciente cadastrado", description: `${nome} foi adicionado(a) com sucesso.` });
      navigate("/");
    }
    setSubmitting(false);
  };

  const getPainColor = (value: number) => {
    if (value <= 3) return "text-success";
    if (value <= 6) return "text-warning";
    return "text-destructive";
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novo Paciente</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Ficha de avaliação inicial</p>
        </div>
      </div>

      <nav aria-label="Progresso do formulário" className="flex items-center gap-1">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          return (
            <button
              key={step.id}
              onClick={() => i <= currentStep && setCurrentStep(i)}
              disabled={i > currentStep}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                isActive ? "bg-primary/10 text-primary" : isDone ? "text-success cursor-pointer hover:bg-muted" : "text-muted-foreground"
              }`}
              aria-current={isActive ? "step" : undefined}
            >
              <div className={`flex items-center justify-center h-6 w-6 rounded-full text-xs ${
                isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              </div>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>
          {currentStep === 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados Cadastrais</CardTitle>
                <CardDescription>Informações pessoais do paciente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome completo *</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do paciente" autoFocus />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sexo">Sexo</Label>
                    <Select value={sexo} onValueChange={setSexo}>
                      <SelectTrigger id="sexo"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                        <SelectItem value="nao-informar">Prefiro não informar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nascimento">Data de nascimento</Label>
                    <Input id="nascimento" type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profissao">Profissão</Label>
                  <Input id="profissao" value={profissao} onChange={(e) => setProfissao(e.target.value)} placeholder="Ex: Engenheiro(a)" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rg">RG</Label>
                    <Input id="rg" value={rg} onChange={(e) => setRg(e.target.value)} placeholder="0000000-0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cpf">CPF</Label>
                    <Input id="cpf" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endereco">Endereço</Label>
                  <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" type="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="paciente@email.com" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Anamnese</CardTitle>
                <CardDescription>Avaliação clínica inicial</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="diagnostico">Diagnóstico Médico</Label>
                  <Textarea id="diagnostico" value={diagnosticoMedico} onChange={(e) => setDiagnosticoMedico(e.target.value)} placeholder="Diagnóstico médico do paciente" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="queixa">Queixa Principal</Label>
                  <Textarea id="queixa" value={queixaPrincipal} onChange={(e) => setQueixaPrincipal(e.target.value)} placeholder="Descreva a queixa principal" rows={3} />
                </div>
                <div className="space-y-3">
                  <Label>Intensidade da Dor (0 a 10)</Label>
                  <div className="flex items-center gap-4">
                    <Slider value={intensidadeDor} onValueChange={setIntensidadeDor} max={10} step={1} className="flex-1" />
                    <span className={`text-2xl font-bold tabular-nums min-w-[2ch] text-center ${getPainColor(intensidadeDor[0])}`}>{intensidadeDor[0]}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dorObs">Observações sobre a dor</Label>
                  <Input id="dorObs" value={dorObs} onChange={(e) => setDorObs(e.target.value)} placeholder="Localização, tipo, frequência..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="hmp">HMP e HMA</Label>
                  <Textarea id="hmp" value={hmpHma} onChange={(e) => setHmpHma(e.target.value)} placeholder="Histórico Médico Pregresso e Atual" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="doencas">Doenças Associadas</Label>
                  <Textarea id="doencas" value={doencasAssociadas} onChange={(e) => setDoencasAssociadas(e.target.value)} placeholder="Liste doenças associadas" rows={2} />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico</CardTitle>
                <CardDescription>Hábitos e histórico do paciente</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="histFamiliar">Histórico Familiar</Label>
                  <Textarea id="histFamiliar" value={historicoFamiliar} onChange={(e) => setHistoricoFamiliar(e.target.value)} placeholder="Doenças relevantes na família" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="medicacao">Medicação em uso</Label>
                  <Textarea id="medicacao" value={medicacao} onChange={(e) => setMedicacao(e.target.value)} placeholder="Liste medicações e dosagens" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Fumante</Label>
                  <RadioGroup value={fumante} onValueChange={setFumante} className="flex gap-4">
                    <div className="flex items-center gap-2"><RadioGroupItem value="sim" id="fumante-sim" /><Label htmlFor="fumante-sim" className="font-normal cursor-pointer">Sim</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="nao" id="fumante-nao" /><Label htmlFor="fumante-nao" className="font-normal cursor-pointer">Não</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="ex" id="fumante-ex" /><Label htmlFor="fumante-ex" className="font-normal cursor-pointer">Ex-fumante</Label></div>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dieta">Dieta</Label>
                  <Textarea id="dieta" value={dieta} onChange={(e) => setDieta(e.target.value)} placeholder="Descreva a dieta habitual" rows={2} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="atividade">Atividade Física</Label>
                  <Input id="atividade" value={atividadeFisica} onChange={(e) => setAtividadeFisica(e.target.value)} placeholder="Tipo e frequência" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="objetivos">Objetivos do Tratamento</Label>
                  <Textarea id="objetivos" value={objetivos} onChange={(e) => setObjetivos(e.target.value)} placeholder="Objetivos esperados com o tratamento" rows={3} />
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Exame Físico</CardTitle>
                <CardDescription>Medidas e sinais vitais</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label htmlFor="massa">Massa (kg)</Label><Input id="massa" type="number" value={massa} onChange={(e) => setMassa(e.target.value)} placeholder="Ex: 70" /></div>
                  <div className="space-y-2"><Label htmlFor="altura">Altura (cm)</Label><Input id="altura" type="number" value={altura} onChange={(e) => setAltura(e.target.value)} placeholder="Ex: 175" /></div>
                </div>
                <p className="text-sm font-medium text-muted-foreground pt-2">Sinais Vitais</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2"><Label htmlFor="pa">P.A. (mmHg)</Label><Input id="pa" value={pa} onChange={(e) => setPa(e.target.value)} placeholder="120/80" /></div>
                  <div className="space-y-2"><Label htmlFor="fcc">F.C.C. (bpm)</Label><Input id="fcc" type="number" value={fcc} onChange={(e) => setFcc(e.target.value)} placeholder="Ex: 72" /></div>
                  <div className="space-y-2"><Label htmlFor="fr">F.R. (irpm)</Label><Input id="fr" type="number" value={fr} onChange={(e) => setFr(e.target.value)} placeholder="Ex: 18" /></div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="obs">Observações</Label>
                  <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações gerais do exame físico" rows={4} />
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between pt-2 pb-8">
        <Button variant="outline" onClick={() => currentStep === 0 ? navigate("/") : setCurrentStep(currentStep - 1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {currentStep === 0 ? "Cancelar" : "Voltar"}
        </Button>
        {currentStep < steps.length - 1 ? (
          <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={!canGoNext()}>
            Próximo
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Cadastrar Paciente
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default NovoPaciente;
