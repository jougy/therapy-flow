import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, FileText, HeartPulse, Loader2, MapPin, Phone, User } from "lucide-react";
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
import type { Database } from "@/integrations/supabase/types";
import {
  EMPTY_CLINICAL_PROFILE,
  EMPTY_EMERGENCY_CONTACT,
  FUNCTIONAL_INDEPENDENCE_OPTIONS,
  parseClinicalProfile,
  parseEmergencyContact,
  type PatientClinicalProfile,
  type PatientEmergencyContact,
} from "@/lib/patient-clinical-profile";
import { formatCep, formatCpf, formatPhone } from "@/lib/profile-settings";
import {
  buildPatientRegistrationPutPayload,
  putPatientRegistration,
} from "@/lib/patient-registration";
import { SubstanceUseClinicalSection } from "@/components/patients/SubstanceUseClinicalSection";
import {
  buildClinicalSnapshotSummaryPayload,
  buildPatientClinicalSnapshotState,
  diffPatientClinicalSnapshotStates,
} from "@/lib/patient-clinical-snapshots";
import {
  PATIENT_ORIGIN_OPTIONS,
  DEFAULT_PATIENT_ORIGIN_OTHER_DESCRIPTION,
  DEFAULT_PATIENT_ORIGIN_OTHER_NAME,
  DEFAULT_PATIENT_ORIGIN_TYPE,
  normalizePatientOriginType,
  type PatientOriginType,
} from "@/lib/patient-origin";

const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
type Patient = Database["public"]["Tables"]["patients"]["Row"];

interface AddressData {
  cep: string;
  erro?: boolean;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

const CadastroCompleto = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [patientRecord, setPatientRecord] = useState<Patient | null>(null);

  // Dados básicos
  const [name, setName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [cpf, setCpf] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Dados pessoais
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
  const [clinicalProfile, setClinicalProfile] = useState<PatientClinicalProfile>(EMPTY_CLINICAL_PROFILE);
  const [emergencyContact, setEmergencyContact] = useState<PatientEmergencyContact>(EMPTY_EMERGENCY_CONTACT);
  const [snapshotNote, setSnapshotNote] = useState("");

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

    const patient: Patient = data;

    setPatientRecord(patient);
    setPatientName(patient.name);
    setName(patient.name);
    setDateOfBirth(patient.date_of_birth ?? "");
    setCpf(formatCpf(patient.cpf ?? ""));
    setPhone(formatPhone(patient.phone ?? ""));
    setEmail(patient.email ?? "");
    setGender(patient.gender ?? "");
    setRg(patient.rg ?? "");
    setBloodType(patient.blood_type ?? "");
    setPronoun(patient.pronoun ?? "");
    setProfession(patient.profession ?? "");
    setOriginType(normalizePatientOriginType(patient.origin_type));
    setOriginReferrerName(patient.origin_referrer_name ?? "");
    setOriginInsuranceProvider(patient.origin_insurance_provider ?? "");
    setOriginInsurancePlan(patient.origin_insurance_plan ?? "");
    setOriginInsuranceMemberId(patient.origin_insurance_member_id ?? "");
    setOriginOtherName(patient.origin_other_name ?? DEFAULT_PATIENT_ORIGIN_OTHER_NAME);
    setOriginOtherDescription(patient.origin_other_description ?? DEFAULT_PATIENT_ORIGIN_OTHER_DESCRIPTION);
    setCep(formatCep(patient.cep ?? ""));
    setCountry(patient.country ?? "Brasil");
    setState(patient.state ?? "");
    setCity(patient.city ?? "");
    setNeighborhood(patient.neighborhood ?? "");
    setStreet(patient.street ?? "");
    setAddressNumber(patient.address_number ?? "");
    setAddressComplement(patient.address_complement ?? "");
    setChronicConditions(patient.chronic_conditions ?? "");
    setSurgeries(patient.surgeries ?? "");
    setContinuousMedications(patient.continuous_medications ?? "");
    setAllergies(patient.allergies ?? "");
    setClinicalNotes(patient.clinical_notes ?? "");
    setClinicalProfile(parseClinicalProfile(patient.clinical_profile));
    setEmergencyContact(parseEmergencyContact(patient.emergency_contact));
    setLoading(false);
  }, [id, navigate]);

  useEffect(() => { fetchPatient(); }, [fetchPatient]);

  const updateClinicalProfile = <K extends keyof PatientClinicalProfile>(key: K, value: PatientClinicalProfile[K]) => {
    setClinicalProfile((current) => ({ ...current, [key]: value }));
  };

  const updateEmergencyContact = <K extends keyof PatientEmergencyContact>(key: K, value: PatientEmergencyContact[K]) => {
    setEmergencyContact((current) => ({ ...current, [key]: value }));
  };

  const handleCepLookup = async (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    const formatted = digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
    setCep(formatted);

    if (digits.length === 8) {
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
    }
  };

  const handleSubmit = async () => {
    if (!user || !id || !patientRecord) return;

    if (!session?.access_token) {
      toast({ title: "Sessão inválida", description: "Faça login novamente para salvar o cadastro.", variant: "destructive" });
      return;
    }

    if (!name.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe o nome completo do paciente.", variant: "destructive" });
      return;
    }

    setSubmitting(true);

    try {
      const payload = buildPatientRegistrationPutPayload(patientRecord, {
        addressComplement,
        addressNumber,
        allergies,
        bloodType,
        cep,
        clinicalProfile,
        cpf,
        chronicConditions,
        city,
        clinicalNotes,
        continuousMedications,
        country,
        dateOfBirth,
        email,
        emergencyContact,
        gender,
        name,
        neighborhood,
        originInsuranceMemberId,
        originInsurancePlan,
        originInsuranceProvider,
        originOtherDescription,
        originOtherName,
        originReferrerName,
        originType,
        phone,
        profession,
        pronoun,
        rg,
        state,
        street,
        surgeries,
      });

      const previousClinicalState = buildPatientClinicalSnapshotState(patientRecord);
      const nextClinicalState = buildPatientClinicalSnapshotState(payload);
      const clinicalChanges = diffPatientClinicalSnapshotStates(previousClinicalState, nextClinicalState);

      await putPatientRegistration({
        accessToken: session.access_token,
        apiKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        patient: payload,
        supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      });

      if (clinicalChanges.length > 0 && payload.clinic_id) {
        const { error: snapshotError } = await supabase
          .from("patient_clinical_snapshots")
          .insert({
            change_note: snapshotNote.trim() || null,
            change_summary: buildClinicalSnapshotSummaryPayload(clinicalChanges),
            changed_fields: clinicalChanges.map((change) => change.field),
            clinic_id: payload.clinic_id,
            created_by: user.id,
            patient_id: payload.id,
            snapshot_data: nextClinicalState as unknown as Database["public"]["Tables"]["patient_clinical_snapshots"]["Insert"]["snapshot_data"],
          });

        if (snapshotError) {
          toast({
            title: "Cadastro salvo com ressalva",
            description: "Os dados do paciente foram atualizados, mas não foi possível registrar o snapshot clínico.",
            variant: "destructive",
          });
        }
      }

      toast({ title: "Cadastro atualizado", description: "Informações salvas com sucesso." });
      navigate(`/pacientes/${id}`);
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Não foi possível atualizar o cadastro.",
        variant: "destructive",
      });
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="pessoais" className="gap-2 text-xs sm:text-sm">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dados Pessoais</span>
            <span className="sm:hidden">Pessoais</span>
          </TabsTrigger>
          <TabsTrigger value="contatos" className="gap-2 text-xs sm:text-sm">
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Contatos</span>
            <span className="sm:hidden">Contatos</span>
          </TabsTrigger>
          <TabsTrigger value="endereco" className="gap-2 text-xs sm:text-sm">
            <MapPin className="h-3.5 w-3.5" />
            Endereço
          </TabsTrigger>
          <TabsTrigger value="saude" className="gap-2 text-xs sm:text-sm">
            <HeartPulse className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Saúde Base</span>
            <span className="sm:hidden">Saúde</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2 text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Histórico Clínico</span>
            <span className="sm:hidden">Clínico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pessoais">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Pessoais</CardTitle>
              <CardDescription>Informações principais de identificação do paciente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input id="name" value={name} onChange={(e) => {
                    setName(e.target.value);
                    setPatientName(e.target.value);
                  }} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date-of-birth">Data de nascimento</Label>
                  <Input id="date-of-birth" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input id="cpf" value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} placeholder="000.000.000-00" maxLength={14} />
                </div>
              </div>
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="profession">Profissão</Label>
                <Input id="profession" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Ex: Engenheiro(a)" />
              </div>
              <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold">Origem do paciente</h3>
                  <p className="text-xs text-muted-foreground">Registre como o paciente chegou até a clínica.</p>
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
                        placeholder="Nome da pessoa ou profissional"
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
                          placeholder="Nome do convênio"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="origin-insurance-plan">Plano</Label>
                        <Input
                          id="origin-insurance-plan"
                          value={originInsurancePlan}
                          onChange={(event) => setOriginInsurancePlan(event.target.value.slice(0, 120))}
                          placeholder="Ex: enfermaria, executivo, empresarial"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="origin-insurance-member-id">Nº da carteirinha</Label>
                        <Input
                          id="origin-insurance-member-id"
                          value={originInsuranceMemberId}
                          onChange={(event) => setOriginInsuranceMemberId(event.target.value.slice(0, 80))}
                          placeholder="Opcional"
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
                          placeholder="Ex: campanha, empresa, evento"
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
              <CardTitle className="text-lg">Saúde Base</CardTitle>
              <CardDescription>Informações mais estáveis do perfil de saúde do paciente.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold">Condições e alertas permanentes</h3>
                  <p className="text-xs text-muted-foreground">Dados de referência clínica que tendem a mudar pouco e precisam ficar fáceis de consultar.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="alerts">Alertas clínicos e restrições relevantes</Label>
                    <Textarea
                      id="alerts"
                      value={clinicalProfile.clinical_alerts}
                      onChange={(e) => updateClinicalProfile("clinical_alerts", e.target.value)}
                      placeholder="Anticoagulante, convulsões, restrição de carga, marcapasso..."
                      rows={3}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="chronic">Problemas crônicos e comorbidades</Label>
                  <Textarea id="chronic" value={chronicConditions} onChange={(e) => setChronicConditions(e.target.value)} placeholder="Hipertensão, diabetes, asma, osteoporose..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allergies">Alergias</Label>
                  <Textarea id="allergies" value={allergies} onChange={(e) => setAllergies(e.target.value)} placeholder="Substância, reação e gravidade quando souber" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="congenitalGeneticConditions">Deficiências congênitas ou condições genéticas</Label>
                  <Textarea
                    id="congenitalGeneticConditions"
                    value={clinicalProfile.congenital_genetic_conditions}
                    onChange={(e) => updateClinicalProfile("congenital_genetic_conditions", e.target.value)}
                    placeholder="Síndromes, alterações genéticas, condições congênitas relevantes..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="familyHistory">Histórico familiar relevante</Label>
                  <Textarea
                    id="familyHistory"
                    value={clinicalProfile.family_history}
                    onChange={(e) => updateClinicalProfile("family_history", e.target.value)}
                    placeholder="Doenças hereditárias, histórico familiar cardiovascular, osteoporose, AVC..."
                    rows={3}
                  />
                </div>
              </section>

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contatos">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contatos</CardTitle>
              <CardDescription>Contatos pessoais do paciente e referência para emergência.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold">Contato pessoal</h3>
                  <p className="text-xs text-muted-foreground">Canais principais para comunicação com o paciente.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input id="phone" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="paciente@email.com" />
                  </div>
                </div>
              </section>

              <section className="space-y-4 rounded-xl border border-border/60 bg-background p-4">
                <div>
                  <h3 className="text-sm font-semibold">Contato de emergência</h3>
                  <p className="text-xs text-muted-foreground">Pessoa de referência para situações sensíveis ou comunicação assistencial rápida.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="emergencyContactName">Nome do contato</Label>
                    <Input
                      id="emergencyContactName"
                      value={emergencyContact.name}
                      onChange={(e) => updateEmergencyContact("name", e.target.value)}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emergencyContactRelationship">Parentesco ou vínculo</Label>
                    <Input
                      id="emergencyContactRelationship"
                      value={emergencyContact.relationship}
                      onChange={(e) => updateEmergencyContact("relationship", e.target.value)}
                      placeholder="Mãe, cônjuge, irmão..."
                    />
                  </div>
                </div>
                <div className="space-y-2 max-w-xs">
                  <Label htmlFor="emergencyContactPhone">Telefone</Label>
                  <Input
                    id="emergencyContactPhone"
                    value={emergencyContact.phone}
                    onChange={(e) => updateEmergencyContact("phone", formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
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
              <CardDescription>Eventos, antecedentes e trajetória clínica do paciente ao longo do tempo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div>
                  <h3 className="text-sm font-semibold">Antecedentes clínicos</h3>
                  <p className="text-xs text-muted-foreground">Aspectos que ajudam a reconstruir a história clínica e eventos importantes da saúde.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="diagnoses">Diagnósticos prévios ou hipóteses diagnósticas</Label>
                  <Textarea
                    id="diagnoses"
                    value={clinicalProfile.diagnoses}
                    onChange={(e) => updateClinicalProfile("diagnoses", e.target.value)}
                    placeholder="CID, hipóteses diagnósticas, condições que motivaram acompanhamento anterior..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="surgeries">Cirurgias e internações relevantes</Label>
                  <Textarea id="surgeries" value={surgeries} onChange={(e) => setSurgeries(e.target.value)} placeholder="Procedimento, data aproximada e intercorrências importantes" rows={3} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="implantsDevices">Implantes, próteses ou dispositivos</Label>
                  <Textarea
                    id="implantsDevices"
                    value={clinicalProfile.implants_devices}
                    onChange={(e) => updateClinicalProfile("implants_devices", e.target.value)}
                    placeholder="Prótese, órtese, marcapasso, parafusos, placa, stent..."
                    rows={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fallsHistory">Histórico de quedas</Label>
                  <Textarea
                    id="fallsHistory"
                    value={clinicalProfile.falls_history}
                    onChange={(e) => updateClinicalProfile("falls_history", e.target.value)}
                    placeholder="Quedas recentes, frequência, contexto e consequências"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meds">Medicamentos de uso contínuo</Label>
                  <Textarea id="meds" value={continuousMedications} onChange={(e) => setContinuousMedications(e.target.value)} placeholder="Nome, dose, frequência e motivo do uso" rows={3} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="functionalIndependence">Contexto funcional atual</Label>
                    <Select
                      value={clinicalProfile.functional_independence}
                      onValueChange={(value) => updateClinicalProfile("functional_independence", value as PatientClinicalProfile["functional_independence"])}
                    >
                      <SelectTrigger id="functionalIndependence"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {FUNCTIONAL_INDEPENDENCE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mobilityAids">Dispositivos de apoio em uso</Label>
                    <Textarea
                      id="mobilityAids"
                      value={clinicalProfile.mobility_aids}
                      onChange={(e) => updateClinicalProfile("mobility_aids", e.target.value)}
                      placeholder="Bengala, muletas, andador, cadeira de rodas..."
                      rows={3}
                    />
                  </div>
                </div>
                <SubstanceUseClinicalSection
                  clinicalProfile={clinicalProfile}
                  updateClinicalProfile={updateClinicalProfile}
                />
                <div className="space-y-2">
                  <Label htmlFor="clinicalNotes">Observações clínicas</Label>
                  <Textarea id="clinicalNotes" value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} placeholder="Informações adicionais relevantes" rows={3} />
                </div>
                <div className="space-y-2 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4">
                  <Label htmlFor="snapshotNote">Nota da atualização clínica</Label>
                  <Textarea
                    id="snapshotNote"
                    value={snapshotNote}
                    onChange={(e) => setSnapshotNote(e.target.value)}
                    placeholder="Opcional. Ex.: reavaliação após piora da dor, ajuste medicamentoso, mudança funcional..."
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Quando houver mudança clínica relevante, essa nota será salva junto ao snapshot da evolução.
                  </p>
                </div>
              </section>

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
