import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, CheckCircle2, ChevronLeft, ChevronRight, ClipboardEdit, FileText, HeartPulse, Loader2, MapPin, Phone, Share2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  buildPatientClinicalSnapshotState,
  type PatientClinicalSnapshotState,
} from "@/lib/patient-clinical-snapshots";
import {
  parseClinicalProfile,
  parseEmergencyContact,
} from "@/lib/patient-clinical-profile";
import { buildPatientRegistrationUrl, getPatientRegistrationPassword } from "@/lib/patient-registration";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type PatientClinicalSnapshot = Database["public"]["Tables"]["patient_clinical_snapshots"]["Row"];
type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "email" | "full_name" | "id">;
type ClinicalHistoryVersion = {
  authorLabel?: string;
  date: string;
  id: string;
  isCurrent?: boolean;
  note?: string | null;
  state: PatientClinicalSnapshotState;
};

const CLINICAL_HISTORY_FIELDS: Array<{ field: keyof PatientClinicalSnapshotState; label: string }> = [
  { field: "diagnoses", label: "Diagnósticos prévios" },
  { field: "surgeries", label: "Cirurgias e internações" },
  { field: "implants_devices", label: "Implantes e dispositivos" },
  { field: "falls_history", label: "Histórico de quedas" },
  { field: "continuous_medications", label: "Medicamentos de uso contínuo" },
  { field: "functional_independence", label: "Contexto funcional atual" },
  { field: "mobility_aids", label: "Dispositivos de apoio" },
  { field: "substance_use_history", label: "Uso de substâncias, vícios e compulsões" },
  { field: "clinical_notes", label: "Observações clínicas" },
];

const SummaryBlock = ({
  description,
  title,
  values,
}: {
  description?: string;
  title: string;
  values: Array<{ label: string; value?: string | null }>;
}) => {
  const visibleValues = values.filter((item) => item.value && item.value.trim().length > 0);

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleValues.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleValues.map((item) => (
              <div key={item.label} className="rounded-2xl bg-muted/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 px-4 py-6 text-sm text-muted-foreground">
            Nenhuma informação registrada nesta seção.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const formatPatientDate = (date?: string | null) => (
  date ? new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR") : null
);

const formatDateTime = (date?: string | null) => (
  date ? new Date(date).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Sem data registrada"
);

const formatAddress = (patient: Patient) => {
  const streetLine = [patient.street, patient.address_number].filter(Boolean).join(", ");
  const cityLine = [patient.neighborhood, patient.city, patient.state].filter(Boolean).join(", ");
  const address = [streetLine, patient.address_complement, cityLine, patient.cep, patient.country].filter(Boolean).join("\n");

  return address || null;
};

const isSnapshotState = (value: Json): value is unknown =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseSnapshotState = (value: Json): PatientClinicalSnapshotState => {
  const snapshot = isSnapshotState(value) ? value as Partial<Record<keyof PatientClinicalSnapshotState, unknown>> : {};
  const getValue = (field: keyof PatientClinicalSnapshotState) => {
    const fieldValue = snapshot[field];

    return typeof fieldValue === "string" ? fieldValue : "";
  };

  return {
    allergies: getValue("allergies"),
    blood_type: getValue("blood_type"),
    chronic_conditions: getValue("chronic_conditions"),
    clinical_notes: getValue("clinical_notes"),
    continuous_medications: getValue("continuous_medications"),
    surgeries: getValue("surgeries"),
    clinical_alerts: getValue("clinical_alerts"),
    congenital_genetic_conditions: getValue("congenital_genetic_conditions"),
    diagnoses: getValue("diagnoses"),
    falls_history: getValue("falls_history"),
    family_history: getValue("family_history"),
    functional_independence: getValue("functional_independence"),
    implants_devices: getValue("implants_devices"),
    mobility_aids: getValue("mobility_aids"),
    substance_use_history: getValue("substance_use_history"),
  };
};

const ClinicalHistoryNavigator = ({
  currentIndex,
  onChangeIndex,
  versions,
}: {
  currentIndex: number;
  onChangeIndex: (index: number) => void;
  versions: ClinicalHistoryVersion[];
}) => {
  const selectedVersion = versions[currentIndex] ?? versions[0];
  const canGoOlder = currentIndex < versions.length - 1;
  const canGoNewer = currentIndex > 0;

  if (!selectedVersion) {
    return null;
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Histórico Clínico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-3">
          <Button
            aria-label="Ver histórico anterior"
            disabled={!canGoOlder}
            onClick={() => onChangeIndex(currentIndex + 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="min-w-0 flex-1 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {selectedVersion.isCurrent ? "Registro atual" : `Registro anterior ${currentIndex} de ${versions.length - 1}`}
            </p>
            <p className="mt-1 text-base font-semibold text-foreground">{formatDateTime(selectedVersion.date)}</p>
            {selectedVersion.authorLabel ? (
              <p className="mt-1 text-xs text-muted-foreground">{selectedVersion.authorLabel}</p>
            ) : null}
          </div>

          <Button
            aria-label="Ver histórico mais recente"
            disabled={!canGoNewer}
            onClick={() => onChangeIndex(currentIndex - 1)}
            size="icon"
            type="button"
            variant="outline"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {selectedVersion.note ? (
          <div className="rounded-2xl border border-border/70 bg-background px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Nota da alteração</p>
            <p className="mt-1 text-sm leading-6 text-foreground">{selectedVersion.note}</p>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {CLINICAL_HISTORY_FIELDS.map(({ field, label }) => {
            const value = selectedVersion.state[field]?.trim();

            return (
              <div key={field} className="rounded-2xl bg-muted/20 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                <p className="mt-1 whitespace-pre-line text-sm leading-6 text-foreground">{value || "—"}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

const PacienteResumo = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clinicId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [clinicalSnapshots, setClinicalSnapshots] = useState<PatientClinicalSnapshot[]>([]);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  const [selectedClinicalHistoryIndex, setSelectedClinicalHistoryIndex] = useState(0);

  const fetchData = useCallback(async () => {
    if (!id) {
      return;
    }

    const [patientRes, profilesRes, snapshotsRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      clinicId ? supabase.from("profiles").select("id, full_name, email").eq("clinic_id", clinicId) : Promise.resolve({ data: [] }),
      supabase.from("patient_clinical_snapshots").select("*").eq("patient_id", id).order("created_at", { ascending: false }),
    ]);

    if (patientRes.error || !patientRes.data) {
      toast({ title: "Erro", description: "Paciente não encontrado.", variant: "destructive" });
      navigate("/");
      return;
    }

    setPatient(patientRes.data);
    setProfiles((profilesRes.data ?? []) as ProfileSummary[]);
    setClinicalSnapshots((snapshotsRes.data ?? []) as PatientClinicalSnapshot[]);
    setLoading(false);
  }, [clinicId, id, navigate]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const parsedClinicalProfile = useMemo(() => parseClinicalProfile(patient?.clinical_profile), [patient?.clinical_profile]);
  const parsedEmergencyContact = useMemo(() => parseEmergencyContact(patient?.emergency_contact), [patient?.emergency_contact]);
  const currentClinicalState = useMemo(() => patient ? buildPatientClinicalSnapshotState(patient) : null, [patient]);

  const profileNameById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.full_name?.trim() || profile.email?.trim() || "Colaborador"])),
    [profiles],
  );

  const clinicalHistoryVersions = useMemo<ClinicalHistoryVersion[]>(() => {
    if (!patient || !currentClinicalState) {
      return [];
    }

    return [
      {
        date: patient.updated_at,
        id: "current",
        isCurrent: true,
        state: currentClinicalState,
      },
      ...clinicalSnapshots.map((snapshot) => ({
        authorLabel: snapshot.created_by ? profileNameById.get(snapshot.created_by) ?? "Colaborador" : "Atualização sem autor identificado",
        date: snapshot.created_at,
        id: snapshot.id,
        note: snapshot.change_note,
        state: parseSnapshotState(snapshot.snapshot_data),
      })),
    ];
  }, [clinicalSnapshots, currentClinicalState, patient, profileNameById]);

  useEffect(() => {
    setSelectedClinicalHistoryIndex((currentIndex) => Math.min(currentIndex, Math.max(clinicalHistoryVersions.length - 1, 0)));
  }, [clinicalHistoryVersions.length]);

  const handleOpenShareDialog = useCallback(async () => {
    if (!patient || !clinicId || !user) {
      return;
    }

    const password = getPatientRegistrationPassword(patient.cpf);
    if (!password) {
      toast({
        title: "CPF incompleto",
        description: "O paciente precisa ter um CPF com ao menos 6 dígitos para gerar o compartilhamento.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingShareLink(true);
    const { data, error } = await supabase.rpc("create_patient_registration_link", {
      _patient_id: patient.id,
    });
    setGeneratingShareLink(false);

    if (error || !data || typeof data !== "object" || Array.isArray(data)) {
      toast({
        title: "Erro ao gerar compartilhamento",
        description: error?.message ?? "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      return;
    }

    const shareData = data as { token?: string };
    if (!shareData.token) {
      toast({
        title: "Erro ao gerar compartilhamento",
        description: "Resposta inválida ao criar o link do paciente.",
        variant: "destructive",
      });
      return;
    }

    const shareUrl = buildPatientRegistrationUrl(window.location.origin, shareData.token);

    await navigator.clipboard.writeText(`${shareUrl}\nSenha: ${password}`);
    toast({
      title: "Link copiado",
      description: "O link e a senha do cadastro foram copiados para a área de transferência.",
    });
  }, [clinicId, patient, user]);

  if (loading || !patient) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button variant="ghost" className="-ml-3 w-fit px-3" onClick={() => navigate(`/pacientes/${id}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao paciente
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Resumo Clínico</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{patient.name}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {patient.age ? <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {patient.age} anos</span> : null}
            {patient.phone ? <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {patient.phone}</span> : null}
            {patient.registration_complete ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Cadastro concluído
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => navigate(`/pacientes/${id}/cadastro`)}>
            <ClipboardEdit className="mr-2 h-4 w-4" />
            Editar cadastro
          </Button>
          <Button variant="outline" onClick={() => void handleOpenShareDialog()} disabled={generatingShareLink || patient.registration_complete}>
            {generatingShareLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
            Compartilhar cadastro
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pessoais" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-5 gap-1 rounded-2xl bg-muted/50 p-1">
          <TabsTrigger value="pessoais" className="gap-2 rounded-xl text-xs sm:text-sm">
            <User className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dados Pessoais</span>
            <span className="sm:hidden">Pessoais</span>
          </TabsTrigger>
          <TabsTrigger value="contatos" className="gap-2 rounded-xl text-xs sm:text-sm">
            <Phone className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Contatos</span>
            <span className="sm:hidden">Contatos</span>
          </TabsTrigger>
          <TabsTrigger value="endereco" className="gap-2 rounded-xl text-xs sm:text-sm">
            <MapPin className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Endereço</span>
            <span className="sm:hidden">End.</span>
          </TabsTrigger>
          <TabsTrigger value="saude" className="gap-2 rounded-xl text-xs sm:text-sm">
            <HeartPulse className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Saúde Base</span>
            <span className="sm:hidden">Saúde</span>
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-2 rounded-xl text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Histórico Clínico</span>
            <span className="sm:hidden">Clínico</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pessoais" className="mt-5">
          <SummaryBlock
            title="Dados Pessoais"
            description="Informações principais de identificação do paciente."
            values={[
              { label: "Nome completo", value: patient.name },
              { label: "Data de nascimento", value: formatPatientDate(patient.date_of_birth) },
              { label: "Idade", value: patient.age ? `${patient.age} anos` : null },
              { label: "CPF", value: patient.cpf },
              { label: "RG", value: patient.rg },
              { label: "Gênero", value: patient.gender },
              { label: "Pronome", value: patient.pronoun },
              { label: "Profissão", value: patient.profession },
              { label: "Status", value: patient.status },
            ]}
          />
        </TabsContent>

        <TabsContent value="contatos" className="mt-5">
          <div className="space-y-5">
            <SummaryBlock
              title="Contato pessoal"
              description="Canais principais para comunicação com o paciente."
              values={[
                { label: "Telefone", value: patient.phone },
                { label: "E-mail", value: patient.email },
              ]}
            />

            <SummaryBlock
              title="Contato de emergência"
              description="Pessoa de referência para situações sensíveis ou comunicação assistencial rápida."
              values={[
                { label: "Nome", value: parsedEmergencyContact.name },
                { label: "Parentesco ou vínculo", value: parsedEmergencyContact.relationship },
                { label: "Telefone", value: parsedEmergencyContact.phone },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="endereco" className="mt-5">
          <SummaryBlock
            title="Endereço"
            description="Dados de localização registrados no cadastro completo."
            values={[
              { label: "Endereço completo", value: formatAddress(patient) },
              { label: "CEP", value: patient.cep },
              { label: "País", value: patient.country },
              { label: "Estado", value: patient.state },
              { label: "Cidade", value: patient.city },
              { label: "Bairro", value: patient.neighborhood },
            ]}
          />
        </TabsContent>

        <TabsContent value="saude" className="mt-5">
          <SummaryBlock
            title="Saúde Base"
            description="Informações mais estáveis do perfil de saúde do paciente."
            values={[
              { label: "Tipo sanguíneo", value: patient.blood_type },
              { label: "Problemas crônicos", value: patient.chronic_conditions },
              { label: "Alergias", value: patient.allergies },
              { label: "Alertas clínicos", value: parsedClinicalProfile.clinical_alerts },
              { label: "Condições congênitas ou genéticas", value: parsedClinicalProfile.congenital_genetic_conditions },
              { label: "Histórico familiar", value: parsedClinicalProfile.family_history },
            ]}
          />
        </TabsContent>

        <TabsContent value="historico" className="mt-5">
          <ClinicalHistoryNavigator
            currentIndex={selectedClinicalHistoryIndex}
            onChangeIndex={setSelectedClinicalHistoryIndex}
            versions={clinicalHistoryVersions}
          />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default PacienteResumo;
