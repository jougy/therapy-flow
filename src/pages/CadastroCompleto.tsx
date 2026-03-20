import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Loader2, User, MapPin, HeartPulse } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface AddressData {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

const CadastroCompleto = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [patientName, setPatientName] = useState("");

  // Dados pessoais
  const [gender, setGender] = useState("");
  const [rg, setRg] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [pronoun, setPronoun] = useState("");
  const [profession, setProfession] = useState("");

  // Endereço
  const [cep, setCep] = useState("");
  const [country, setCountry] = useState("Brasil");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [fetchingCep, setFetchingCep] = useState(false);

  // Histórico clínico
  const [chronicConditions, setChronicConditions] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [continuousMedications, setContinuousMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const fetchPatient = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      toast({ title: "Erro", description: "Paciente não encontrado.", variant: "destructive" });
      navigate("/");
      return;
    }

    setPatientName(data.name);
    setGender((data as any).gender ?? "");
    setRg((data as any).rg ?? "");
    setBloodType((data as any).blood_type ?? "");
    setPronoun((data as any).pronoun ?? "");
    setProfession((data as any).profession ?? "");
    setCep((data as any).cep ?? "");
    setCountry((data as any).country ?? "Brasil");
    setState((data as any).state ?? "");
    setCity((data as any).city ?? "");
    setNeighborhood((data as any).neighborhood ?? "");
    setStreet((data as any).street ?? "");
    setAddressNumber((data as any).address_number ?? "");
    setAddressComplement((data as any).address_complement ?? "");
    setChronicConditions((data as any).chronic_conditions ?? "");
    setSurgeries((data as any).surgeries ?? "");
    setContinuousMedications((data as any).continuous_medications ?? "");
    setAllergies((data as any).allergies ?? "");
    setClinicalNotes((data as any).clinical_notes ?? "");
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  const handleCepLookup = async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setCep(formatted);

    if (digits.length === 8) {
      setFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data: AddressData = await res.json();
        if (!(data as any).erro) {
          setStreet(data.logradouro || "");
          setNeighborhood(data.bairro || "");
          setCity(data.localidade || "");
          setState(data.uf || "");
          setCountry("Brasil");
        }
      } catch {
        // silent fail
      }
      setFetchingCep(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !id) return;
    setSubmitting(true);

    const { error } = await supabase
      .from("patients")
      .update({
        gender,
        rg: rg || null,
        blood_type: bloodType || null,
        pronoun: pronoun || null,
        profession: profession || null,
        cep: cep.replace(/\D/g, "") || null,
        country,
        state: state || null,
        city: city || null,
        neighborhood: neighborhood || null,
        street: street || null,
        address_number: addressNumber || null,
        address_complement: addressComplement || null,
        chronic_conditions: chronicConditions || null,
        surgeries: surgeries || null,
        continuous_medications: continuousMedications || null,
        allergies: allergies || null,
        clinical_notes: clinicalNotes || null,
        registration_complete: true,
      } as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Cadastro atualizado", description: "Informações salvas com sucesso." });
      navigate(`/pacientes/${id}`);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/pacientes/${id}`)} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastro Completo</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{patientName}</p>
        </div>
      </div>

      <Tabs defaultValue="pessoais" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pessoais" className="gap-2 text-xs sm:text-sm">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dados Pessoais</span>
            <span className="sm:hidden">Pessoais</span>
          </TabsTrigger>
          <TabsTrigger value="endereco" className="gap-2 text-xs sm:text-sm">
            <MapPin className="h-3.5 w-3.5" />
            Endereço
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2 text-xs sm:text-sm">
            <HeartPulse className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Histórico Clínico</span>
            <span className="sm:hidden">Clínico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pessoais">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Pessoais</CardTitle>
              <CardDescription>Informações fixas de identificação</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gênero</Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="gender"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="feminino">Feminino</SelectItem>
                      <SelectItem value="nao-binario">Não-binário</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                      <SelectItem value="nao-informar">Prefiro não informar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pronoun">Pronome</Label>
                  <Select value={pronoun} onValueChange={setPronoun}>
                    <SelectTrigger id="pronoun"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ele/dele">Ele/Dele</SelectItem>
                      <SelectItem value="ela/dela">Ela/Dela</SelectItem>
                      <SelectItem value="elu/delu">Elu/Delu</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rg">RG</Label>
                  <Input id="rg" value={rg} onChange={(e) => setRg(e.target.value)} placeholder="0000000-0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bloodType">Tipo Sanguíneo</Label>
                  <Select value={bloodType} onValueChange={setBloodType}>
                    <SelectTrigger id="bloodType"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {BLOOD_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="profession">Profissão</Label>
                <Input id="profession" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Ex: Engenheiro(a)" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endereco">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endereço</CardTitle>
              <CardDescription>Digite o CEP para preencher automaticamente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 items-end">
                <div className="space-y-2 flex-1 max-w-[200px]">
                  <Label htmlFor="cep">CEP</Label>
                  <Input id="cep" value={cep} onChange={(e) => handleCepLookup(e.target.value)} placeholder="00000-000" maxLength={9} />
                </div>
                {fetchingCep && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mb-2.5" />}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">País</Label>
                  <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input id="state" value={state} onChange={(e) => setState(e.target.value)} placeholder="UF" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input id="neighborhood" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="street">Rua</Label>
                <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="addressNumber">Número</Label>
                  <Input id="addressNumber" value={addressNumber} onChange={(e) => setAddressNumber(e.target.value)} placeholder="Ex: 123" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="addressComplement">Complemento</Label>
                  <Input id="addressComplement" value={addressComplement} onChange={(e) => setAddressComplement(e.target.value)} placeholder="Apt, Bloco, etc." />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico Clínico</CardTitle>
              <CardDescription>Condições pré-existentes e dados médicos relevantes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chronic">Problemas crônicos</Label>
                <Textarea id="chronic" value={chronicConditions} onChange={(e) => setChronicConditions(e.target.value)} placeholder="Hipertensão, diabetes, etc." rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surgeries">Cirurgias realizadas</Label>
                <Textarea id="surgeries" value={surgeries} onChange={(e) => setSurgeries(e.target.value)} placeholder="Liste cirurgias anteriores" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="meds">Medicamentos de uso contínuo</Label>
                <Textarea id="meds" value={continuousMedications} onChange={(e) => setContinuousMedications(e.target.value)} placeholder="Nome e dosagem dos medicamentos" rows={3} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="allergies">Alergias</Label>
                <Textarea id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Alergias conhecidas" rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clinicalNotes">Observações clínicas</Label>
                <Textarea id="clinicalNotes" value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} placeholder="Informações adicionais relevantes" rows={3} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-between pb-8">
        <Button variant="outline" onClick={() => navigate(`/pacientes/${id}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar ao paciente
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          Salvar Cadastro
        </Button>
      </div>
    </motion.div>
  );
};

export default CadastroCompleto;
