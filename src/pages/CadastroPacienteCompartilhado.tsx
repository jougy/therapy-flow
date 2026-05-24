import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, FileText, HeartPulse, Loader2, LockKeyhole, MapPin, Phone, Send, UserRoundCog } from "lucide-react";

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
import {
  EMPTY_CLINICAL_PROFILE,
  EMPTY_EMERGENCY_CONTACT,
  FUNCTIONAL_INDEPENDENCE_OPTIONS,
  parseClinicalProfile,
  parseEmergencyContact,
  type PatientClinicalProfile,
  type PatientEmergencyContact,
} from "@/lib/patient-clinical-profile";
import {
  PATIENT_ORIGIN_OPTIONS,
  DEFAULT_PATIENT_ORIGIN_OTHER_DESCRIPTION,
  DEFAULT_PATIENT_ORIGIN_OTHER_NAME,
  DEFAULT_PATIENT_ORIGIN_TYPE,
  normalizePatientOriginType,
  type PatientOriginType,
} from "@/lib/patient-origin";
import { SubstanceUseClinicalSection } from "@/components/patients/SubstanceUseClinicalSection";
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
  origin_type: string | null;
  origin_referrer_name: string | null;
  origin_insurance_provider: string | null;
  origin_insurance_plan: string | null;
  origin_insurance_member_id: string | null;
  origin_other_name: string | null;
  origin_other_description: string | null;
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
  clinical_profile: Json | null;
  emergency_contact: Json | null;
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
  const [originType, setOriginType] = useState<PatientOriginType>(DEFAULT_PATIENT_ORIGIN_TYPE);
  const [originReferrerName, setOriginReferrerName] = useState("");
  const [originInsuranceProvider, setOriginInsuranceProvider] = useState("");
  const [originInsurancePlan, setOriginInsurancePlan] = useState("");
  const [originInsuranceMemberId, setOriginInsuranceMemberId] = useState("");
  const [originOtherName, setOriginOtherName] = useState("");
  const [originOtherDescription, setOriginOtherDescription] = useState("");
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
  const [clinicalProfile, setClinicalProfile] = useState<PatientClinicalProfile>(EMPTY_CLINICAL_PROFILE);
  const [emergencyContact, setEmergencyContact] = useState<PatientEmergencyContact>(EMPTY_EMERGENCY_CONTACT);

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
    setOriginType(normalizePatientOriginType(data.origin_type));
    setOriginReferrerName(data.origin_referrer_name ?? "");
    setOriginInsuranceProvider(data.origin_insurance_provider ?? "");
    setOriginInsurancePlan(data.origin_insurance_plan ?? "");
    setOriginInsuranceMemberId(data.origin_insurance_member_id ?? "");
    setOriginOtherName(data.origin_other_name ?? DEFAULT_PATIENT_ORIGIN_OTHER_NAME);
    setOriginOtherDescription(data.origin_other_description ?? DEFAULT_PATIENT_ORIGIN_OTHER_DESCRIPTION);
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
    setClinicalProfile(parseClinicalProfile(data.clinical_profile));
    setEmergencyContact(parseEmergencyContact(data.emergency_contact));
  };

  const updateClinicalProfile = <K extends keyof PatientClinicalProfile>(key: K, value: PatientClinicalProfile[K]) => {
    setClinicalProfile((current) => ({ ...current, [key]: value }));
  };

  const updateEmergencyContact = <K extends keyof PatientEmergencyContact>(key: K, value: PatientEmergencyContact[K]) => {
    setEmergencyContact((current) => ({ ...current, [key]: value }));
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
        clinical_profile: clinicalProfile,
        continuous_medications: continuousMedications,
        country,
        date_of_birth: dateOfBirth || null,
        email,
        emergency_contact: {
          ...emergencyContact,
          phone: emergencyContact.phone.replace(/\D/g, ""),
        },
        gender,
        name,
        neighborhood,
        origin_insurance_member_id: originInsuranceMemberId,
        origin_insurance_plan: originInsurancePlan,
        origin_insurance_provider: originInsuranceProvider,
        origin_other_description: originOtherDescription,
        origin_other_name: originOtherName,
        origin_referrer_name: originReferrerName,
        origin_type: originType,
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
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="basicos" className="gap-2 text-xs sm:text-sm">
                  <UserRoundCog className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Dados Básicos</span>
                  <span className="sm:hidden">Básicos</span>
                </TabsTrigger>
                <TabsTrigger value="contatos" className="gap-2 text-xs sm:text-sm">
                  <Phone className="h-3.5 w-3.5" />
                  Contatos
                </TabsTrigger>
                <TabsTrigger value="endereco" className="gap-2 text-xs sm:text-sm">
                  <MapPin className="h-3.5 w-3.5" />
                  Endereço
                </TabsTrigger>
                <TabsTrigger value="saude" className="gap-2 text-xs sm:text-sm">
                  <HeartPulse className="h-3.5 w-3.5" />
                  Saúde
                </TabsTrigger>
                <TabsTrigger value="historico" className="gap-2 text-xs sm:text-sm">
                  <FileText className="h-3.5 w-3.5" />
                  Clínico
                </TabsTrigger>
              </TabsList>

              <TabsContent value="basicos">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Dados básicos</CardTitle>
                    <CardDescription>Revise e complete seus dados principais de identificação.</CardDescription>
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
                      <div className="space-y-2 sm:col-span-2">
                        <Label htmlFor="profession">Profissão</Label>
                        <Input id="profession" value={profession} onChange={(event) => setProfession(event.target.value)} />
                      </div>
                    </div>
                    <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div>
                        <h3 className="text-sm font-semibold">Origem</h3>
                        <p className="text-xs text-muted-foreground">Como você chegou até a clínica.</p>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="origin-type">Origem</Label>
                          <Select value={originType} onValueChange={(value) => setOriginType(normalizePatientOriginType(value))}>
                            <SelectTrigger id="origin-type"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {PATIENT_ORIGIN_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {originType === "indicacao" ? (
                          <div className="space-y-2">
                            <Label htmlFor="origin-referrer-name">Nome de quem indicou</Label>
                            <Input
                              id="origin-referrer-name"
                              value={originReferrerName}
                              onChange={(event) => setOriginReferrerName(event.target.value.slice(0, 120))}
                            />
                          </div>
                        ) : null}
                        {originType === "convenio" ? (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="origin-insurance-provider">Convênio</Label>
                              <Input
                                id="origin-insurance-provider"
                                value={originInsuranceProvider}
                                onChange={(event) => setOriginInsuranceProvider(event.target.value.slice(0, 120))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="origin-insurance-plan">Plano</Label>
                              <Input
                                id="origin-insurance-plan"
                                value={originInsurancePlan}
                                onChange={(event) => setOriginInsurancePlan(event.target.value.slice(0, 120))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="origin-insurance-member-id">Nº da carteirinha</Label>
                              <Input
                                id="origin-insurance-member-id"
                                value={originInsuranceMemberId}
                                onChange={(event) => setOriginInsuranceMemberId(event.target.value.slice(0, 80))}
                              />
                            </div>
                          </>
                        ) : null}
                        {originType === "outros" ? (
                          <>
                            <div className="space-y-2">
                              <Label htmlFor="origin-other-name">Nome da origem</Label>
                              <Input
                                id="origin-other-name"
                                value={originOtherName}
                                onChange={(event) => setOriginOtherName(event.target.value.slice(0, 120))}
                              />
                            </div>
                            <div className="space-y-2 sm:col-span-2">
                              <Label htmlFor="origin-other-description">Descrição</Label>
                              <Textarea
                                id="origin-other-description"
                                value={originOtherDescription}
                                onChange={(event) => setOriginOtherDescription(event.target.value.slice(0, 500))}
                                placeholder="Opcional"
                                rows={3}
                              />
                            </div>
                          </>
                        ) : null}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="saude">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Saúde base</CardTitle>
                    <CardDescription>Informações mais estáveis do seu perfil de saúde.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div>
                        <h3 className="text-sm font-semibold">Condições e alertas permanentes</h3>
                        <p className="text-xs text-muted-foreground">Dados que ajudam a equipe a te atender com mais segurança.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        <div className="space-y-2">
                          <Label htmlFor="alerts">Alertas e restrições importantes</Label>
                          <Textarea id="alerts" value={clinicalProfile.clinical_alerts} onChange={(event) => updateClinicalProfile("clinical_alerts", event.target.value)} rows={3} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="chronic">Problemas crônicos</Label>
                        <Textarea id="chronic" value={chronicConditions} onChange={(event) => setChronicConditions(event.target.value)} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="allergies">Alergias</Label>
                        <Textarea id="allergies" value={allergies} onChange={(event) => setAllergies(event.target.value)} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="congenital-genetic-conditions">Deficiências congênitas ou condições genéticas</Label>
                        <Textarea id="congenital-genetic-conditions" value={clinicalProfile.congenital_genetic_conditions} onChange={(event) => updateClinicalProfile("congenital_genetic_conditions", event.target.value)} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="family-history">Histórico familiar relevante</Label>
                        <Textarea id="family-history" value={clinicalProfile.family_history} onChange={(event) => updateClinicalProfile("family_history", event.target.value)} rows={3} />
                      </div>
                    </section>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contatos">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Contatos</CardTitle>
                    <CardDescription>Seus contatos pessoais e uma referência para emergência.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div>
                        <h3 className="text-sm font-semibold">Contato pessoal</h3>
                        <p className="text-xs text-muted-foreground">Usado pela clínica para falar com você quando necessário.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Telefone</Label>
                          <Input id="phone" value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">E-mail</Label>
                          <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                        </div>
                      </div>
                    </section>

                    <section className="space-y-4 rounded-xl border border-border/60 bg-background p-4">
                      <div>
                        <h3 className="text-sm font-semibold">Contato de emergência</h3>
                        <p className="text-xs text-muted-foreground">Opcional, mas importante para situações delicadas.</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="emergency-contact-name">Nome</Label>
                          <Input id="emergency-contact-name" value={emergencyContact.name} onChange={(event) => updateEmergencyContact("name", event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="emergency-contact-relationship">Parentesco ou vínculo</Label>
                          <Input id="emergency-contact-relationship" value={emergencyContact.relationship} onChange={(event) => updateEmergencyContact("relationship", event.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-2 max-w-xs">
                        <Label htmlFor="emergency-contact-phone">Telefone</Label>
                        <Input
                          id="emergency-contact-phone"
                          value={emergencyContact.phone}
                          onChange={(event) => updateEmergencyContact("phone", formatPhone(event.target.value))}
                          maxLength={15}
                        />
                      </div>
                    </section>
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
                    <CardDescription>Antecedentes, eventos e trajetória clínica ao longo do tempo.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                      <div>
                        <h3 className="text-sm font-semibold">Antecedentes clínicos</h3>
                        <p className="text-xs text-muted-foreground">Aspectos importantes para reconstruir sua história de saúde.</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="diagnoses">Diagnósticos prévios</Label>
                        <Textarea id="diagnoses" value={clinicalProfile.diagnoses} onChange={(event) => updateClinicalProfile("diagnoses", event.target.value)} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="surgeries">Cirurgias e internações</Label>
                        <Textarea id="surgeries" value={surgeries} onChange={(event) => setSurgeries(event.target.value)} rows={3} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="implants-devices">Implantes, próteses ou dispositivos</Label>
                        <Textarea id="implants-devices" value={clinicalProfile.implants_devices} onChange={(event) => updateClinicalProfile("implants_devices", event.target.value)} rows={2} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="falls-history">Histórico de quedas</Label>
                          <Textarea id="falls-history" value={clinicalProfile.falls_history} onChange={(event) => updateClinicalProfile("falls_history", event.target.value)} rows={3} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="medications">Medicamentos de uso contínuo</Label>
                        <Textarea id="medications" value={continuousMedications} onChange={(event) => setContinuousMedications(event.target.value)} rows={3} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="functional-independence">Contexto funcional atual</Label>
                          <Select
                            value={clinicalProfile.functional_independence}
                            onValueChange={(value) => updateClinicalProfile("functional_independence", value as PatientClinicalProfile["functional_independence"])}
                          >
                            <SelectTrigger id="functional-independence"><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                              {FUNCTIONAL_INDEPENDENCE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mobility-aids">Dispositivos de apoio em uso</Label>
                          <Textarea id="mobility-aids" value={clinicalProfile.mobility_aids} onChange={(event) => updateClinicalProfile("mobility_aids", event.target.value)} rows={3} />
                        </div>
                      </div>
                      <SubstanceUseClinicalSection
                        clinicalProfile={clinicalProfile}
                        updateClinicalProfile={updateClinicalProfile}
                      />
                      <div className="space-y-2">
                        <Label htmlFor="clinical-notes">Observações clínicas</Label>
                        <Textarea id="clinical-notes" value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} rows={4} />
                      </div>
                    </section>

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
