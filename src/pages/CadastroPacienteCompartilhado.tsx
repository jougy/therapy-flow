import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, LockKeyhole, Send, UserRoundCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useParams } from "react-router-dom";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const COMPLETED_MESSAGE =
  "Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.";

interface AddressData {
  cep: string;
  erro?: boolean;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

interface SharedPatientFormData {
  id: string;
  name: string;
  cpf: string | null;
  date_of_birth: string | null;
  phone: string | null;
  email: string | null;
  gender: string | null;
  rg: string | null;
  blood_type: string | null;
  pronoun: string | null;
  profession: string | null;
  cep: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  neighborhood: string | null;
  street: string | null;
  address_number: string | null;
  address_complement: string | null;
  chronic_conditions: string | null;
  surgeries: string | null;
  continuous_medications: string | null;
  allergies: string | null;
  clinical_notes: string | null;
}

interface SharedPatientResponse {
  completed: boolean;
  message: string | null;
  patient: SharedPatientFormData;
}

const isSharedPatientResponse = (value: unknown): value is SharedPatientResponse => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as Record<string, Json | undefined>;
  const patient = data.patient;

  return typeof data.completed === "boolean" && !!patient && typeof patient === "object" && !Array.isArray(patient);
};

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

const formatCep = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
};

const CadastroPacienteCompartilhado = () => {
  const { token } = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [unlocking, setUnlocking] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [completedMessage, setCompletedMessage] = useState(COMPLETED_MESSAGE);
  const [patientId, setPatientId] = useState("");
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [rg, setRg] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [pronoun, setPronoun] = useState("");
  const [profession, setProfession] = useState("");
  const [cep, setCep] = useState("");
  const [country, setCountry] = useState("Brasil");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [street, setStreet] = useState("");
  const [addressNumber, setAddressNumber] = useState("");
  const [addressComplement, setAddressComplement] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [surgeries, setSurgeries] = useState("");
  const [continuousMedications, setContinuousMedications] = useState("");
  const [allergies, setAllergies] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");

  const canSubmit = useMemo(() => name.trim().length > 0 && !locked, [name, locked]);
  const canUnlock = password.replace(/\D/g, "").length >= 6;

  const fillForm = (data: SharedPatientFormData) => {
    setPatientId(data.id);
    setName(data.name ?? "");
    setCpf(formatCpf(data.cpf ?? ""));
    setDateOfBirth(data.date_of_birth ?? "");
    setPhone(formatPhone(data.phone ?? ""));
    setEmail(data.email ?? "");
    setGender(data.gender ?? "");
    setRg(data.rg ?? "");
    setBloodType(data.blood_type ?? "");
    setPronoun(data.pronoun ?? "");
    setProfession(data.profession ?? "");
    setCep(formatCep(data.cep ?? ""));
    setCountry(data.country ?? "Brasil");
    setState(data.state ?? "");
    setCity(data.city ?? "");
    setNeighborhood(data.neighborhood ?? "");
    setStreet(data.street ?? "");
    setAddressNumber(data.address_number ?? "");
    setAddressComplement(data.address_complement ?? "");
    setChronicConditions(data.chronic_conditions ?? "");
    setSurgeries(data.surgeries ?? "");
    setContinuousMedications(data.continuous_medications ?? "");
    setAllergies(data.allergies ?? "");
    setClinicalNotes(data.clinical_notes ?? "");
  };

  const handleUnlock = async () => {
    if (!token || !canUnlock) return;
    setUnlocking(true);

    const { data, error } = await supabase.rpc("get_patient_registration_form", {
      _password: password,
      _token: token,
    });

    if (error || !data || !isSharedPatientResponse(data)) {
      toast({
        title: "Não foi possível abrir o cadastro",
        description: error?.message ?? "Confira a senha e tente novamente.",
        variant: "destructive",
      });
      setUnlocking(false);
      return;
    }

    fillForm(data.patient);
    if (data.completed) {
      setLocked(true);
      setCompletedMessage(data.message ?? COMPLETED_MESSAGE);
    }
    setUnlocking(false);
  };

  const handleCepLookup = async (value: string) => {
    const formatted = formatCep(value);
    const digits = formatted.replace(/\D/g, "");
    setCep(formatted);

    if (digits.length !== 8) return;

    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data: AddressData = await res.json();
      if (!data.erro) {
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
  };

  const handleSubmit = async () => {
    if (!token || !canSubmit) return;
    setSubmitting(true);

    const { data, error } = await supabase.rpc("submit_patient_registration_form", {
      _password: password,
      _payload: {
        address_complement: addressComplement,
        address_number: addressNumber,
        allergies: allergies,
        blood_type: bloodType,
        cep,
        chronic_conditions: chronicConditions,
        city,
        clinical_notes: clinicalNotes,
        continuous_medications: continuousMedications,
        country,
        date_of_birth: dateOfBirth || null,
        email,
        gender,
        name,
        neighborhood,
        phone,
        profession,
        pronoun,
        rg,
        state,
        street,
        surgeries,
      },
      _token: token,
    });

    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      toast({
        title: "Erro ao concluir cadastro",
        description: error?.message ?? "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }

    const response = data as Record<string, Json | undefined>;
    setLocked(true);
    setCompletedMessage(typeof response.message === "string" ? response.message : COMPLETED_MESSAGE);
    setSubmitting(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Cadastro do paciente</CardTitle>
            <CardDescription>
              Preencha seus dados cadastrais e clínicos. Você usará os 6 primeiros dígitos do seu CPF para abrir este formulário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="registration-password">Senha de acesso</Label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  id="registration-password"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6 primeiros dígitos do CPF"
                  disabled={locked || !!patientId}
                />
                <Button onClick={handleUnlock} disabled={!canUnlock || unlocking || locked || !!patientId}>
                  {unlocking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LockKeyhole className="h-4 w-4 mr-2" />}
                  Abrir cadastro
                </Button>
              </div>
            </div>

            {locked && (
              <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success flex gap-3">
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{completedMessage}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {!!patientId && !locked && (
          <>
            <Tabs defaultValue="basicos" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="basicos" className="gap-2 text-xs sm:text-sm">
                  <UserRoundCog className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Dados Básicos</span>
                  <span className="sm:hidden">Básicos</span>
                </TabsTrigger>
                <TabsTrigger value="endereco" className="text-xs sm:text-sm">Endereço</TabsTrigger>
                <TabsTrigger value="historico" className="text-xs sm:text-sm">Clínico</TabsTrigger>
              </TabsList>

              <TabsContent value="basicos">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dados básicos</CardTitle>
                    <CardDescription>Revise e complete seus dados principais.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="name">Nome completo *</Label>
                        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="date-of-birth">Data de nascimento</Label>
                        <Input id="date-of-birth" type="date" value={dateOfBirth} onChange={(event) => setDateOfBirth(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cpf">CPF</Label>
                        <Input id="cpf" value={cpf} disabled readOnly />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input id="phone" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                      </div>
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
                      <div className="space-y-2">
                        <Label htmlFor="rg">RG</Label>
                        <Input id="rg" value={rg} onChange={(event) => setRg(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="blood-type">Tipo sanguíneo</Label>
                        <Select value={bloodType} onValueChange={setBloodType}>
                          <SelectTrigger id="blood-type"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            {BLOOD_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>{type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="profession">Profissão</Label>
                        <Input id="profession" value={profession} onChange={(event) => setProfession(event.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="endereco">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Endereço</CardTitle>
                    <CardDescription>Use o CEP para agilizar o preenchimento.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-3 items-end">
                      <div className="space-y-2 flex-1 max-w-[220px]">
                        <Label htmlFor="cep">CEP</Label>
                        <Input id="cep" value={cep} onChange={(event) => handleCepLookup(event.target.value)} placeholder="00000-000" maxLength={9} />
                      </div>
                      {fetchingCep && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mb-2.5" />}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="country">País</Label>
                        <Input id="country" value={country} onChange={(event) => setCountry(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="state">Estado</Label>
                        <Input id="state" value={state} onChange={(event) => setState(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="city">Cidade</Label>
                        <Input id="city" value={city} onChange={(event) => setCity(event.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="neighborhood">Bairro</Label>
                      <Input id="neighborhood" value={neighborhood} onChange={(event) => setNeighborhood(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="street">Rua</Label>
                      <Input id="street" value={street} onChange={(event) => setStreet(event.target.value)} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="address-number">Número</Label>
                        <Input id="address-number" value={addressNumber} onChange={(event) => setAddressNumber(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address-complement">Complemento</Label>
                        <Input id="address-complement" value={addressComplement} onChange={(event) => setAddressComplement(event.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="historico">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Histórico clínico</CardTitle>
                    <CardDescription>Conte ao profissional informações importantes sobre sua saúde.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="chronic">Problemas crônicos</Label>
                      <Textarea id="chronic" value={chronicConditions} onChange={(event) => setChronicConditions(event.target.value)} rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="surgeries">Cirurgias realizadas</Label>
                      <Textarea id="surgeries" value={surgeries} onChange={(event) => setSurgeries(event.target.value)} rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="medications">Medicamentos de uso contínuo</Label>
                      <Textarea id="medications" value={continuousMedications} onChange={(event) => setContinuousMedications(event.target.value)} rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="allergies">Alergias</Label>
                      <Textarea id="allergies" value={allergies} onChange={(event) => setAllergies(event.target.value)} rows={3} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clinical-notes">Observações clínicas</Label>
                      <Textarea id="clinical-notes" value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} rows={4} />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end pb-8">
              <Button onClick={handleSubmit} disabled={submitting || !canSubmit || locked}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Enviar cadastro
              </Button>
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default CadastroPacienteCompartilhado;
