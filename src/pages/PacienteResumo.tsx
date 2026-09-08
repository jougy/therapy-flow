import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  FileText,
  HeartPulse,
  MapPin,
  Phone,
  RefreshCw,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { useTelemetry } from "@/hooks/useTelemetry";
import { toast } from "@/hooks/use-toast";
import { parseClinicalProfile, parseEmergencyContact } from "@/lib/patient-clinical-profile";
import { formatPatientOriginDetails } from "@/lib/patient-origin";
import { getClinicPatientPath, getPatientRouteKey } from "@/lib/patient-routing";
import { buildPatientExportData, downloadPatientDataJson } from "@/lib/patient-export";
import { usePatientSummary } from "@/hooks/usePatientSummary";
import { usePatientClinicalVersions } from "@/hooks/usePatientClinicalVersions";
import { PacienteResumoSkeleton } from "@/components/patients/PacienteResumoSkeleton";
import { SharePatientRegistrationModal } from "@/components/patients/SharePatientRegistrationModal";
import { PrintResponsibilityModal } from "@/components/PrintResponsibilityModal";
import { PatientRegistrationPrintView } from "@/components/patients/PatientRegistrationPrintView";
import {
  ClinicalHistoryNavigator,
  type ClinicalHistoryVersion,
} from "@/components/patients/ClinicalHistoryNavigator";
import { PatientSummaryHeader } from "@/components/patients/summary/PatientSummaryHeader";
import { PatientPersonalInfoTab } from "@/components/patients/summary/PatientPersonalInfoTab";
import { PatientContactsTab } from "@/components/patients/summary/PatientContactsTab";
import { PatientAddressTab } from "@/components/patients/summary/PatientAddressTab";
import { PatientHealthBaseTab } from "@/components/patients/summary/PatientHealthBaseTab";

export type { ClinicalHistoryVersion };

const PacienteResumo = () => {
  const { id, clinicKey } = useParams<{ id?: string; clinicKey?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { clinic, clinicId, profile, user, can } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const { trackEvent, trackDocumentPrint, trackExportJson } = useTelemetry();

  const clinicHomePath = clinic?.route_key ? `/clinica/${clinic.route_key}` : "/espacopessoal";
  const targetClinicKey = clinic?.route_key || clinicKey;

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedClinicalHistoryIndex, setSelectedClinicalHistoryIndex] = useState(0);
  const [showPrintResponsibilityModal, setShowPrintResponsibilityModal] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  // React Query otimizado
  const {
    data: summaryData,
    isLoading,
    isError,
    error,
    refetch,
  } = usePatientSummary({
    patientRef: id,
    clinicId,
    clinicKey: targetClinicKey,
  });

  const patient = summaryData?.patient ?? null;
  const clinicalSnapshots = summaryData?.clinicalSnapshots ?? [];
  const profileNameById = summaryData?.profileNameById ?? {};

  // Canonical route key anti-loop (preserva casing oficial e evita loop)
  useEffect(() => {
    if (!patient || !id) return;
    const canonicalKey = getPatientRouteKey(patient).trim();
    if (id.trim().toLowerCase() !== canonicalKey.toLowerCase() && targetClinicKey) {
      navigate(`/clinica/${targetClinicKey}/pacientes/${canonicalKey}/resumo${location.search}`, {
        replace: true,
      });
    }
  }, [id, patient, targetClinicKey, location.search, navigate]);

  // Permissões e LGPD
  const canPrint = Boolean(typeof can === "function" ? can("system.print") : true) && isFeatureEnabled("print_general");
  const canExport = Boolean(typeof can === "function" ? can("patients.read") && can("system.print") : true);
  const canViewContacts = Boolean(typeof can === "function" ? can("patients.read") : true);

  const parsedClinicalProfile = useMemo(() => parseClinicalProfile(patient?.clinical_profile), [patient?.clinical_profile]);
  const parsedEmergencyContact = useMemo(() => parseEmergencyContact(patient?.emergency_contact), [patient?.emergency_contact]);
  const patientOriginDetails = useMemo(() => (patient ? formatPatientOriginDetails(patient) : null), [patient]);

  // Histórico clínico temporal via hook dedicado
  const { clinicalHistoryVersions } = usePatientClinicalVersions({
    patient,
    clinicalSnapshots,
    profileNameById,
  });

  useEffect(() => {
    setSelectedClinicalHistoryIndex((idx) => Math.min(idx, Math.max(clinicalHistoryVersions.length - 1, 0)));
  }, [clinicalHistoryVersions.length]);

  // Exportação segura JSON com auditoria LGPD
  const handleExportJson = useCallback(() => {
    if (!canExport) {
      void trackEvent({
        eventType: "page_view",
        metadata: {
          action: "unauthorized_export_attempt",
          patient_id: patient?.id,
          reason: "missing_patients_read_or_system_print_permission",
        },
      });
      toast({
        title: "Acesso não autorizado",
        description: "Seu perfil não possui autorização para exportar os dados cadastrais deste paciente (LGPD).",
        variant: "destructive",
      });
      return;
    }

    if (!patient) return;

    try {
      const payload = buildPatientExportData({
        patient,
        clinicalProfile: parsedClinicalProfile,
        emergencyContact: parsedEmergencyContact,
        snapshots: clinicalSnapshots,
        clinicName: clinic?.name || "Clínica Pluri-Health",
        exportedBy: profile?.full_name || profile?.social_name || user?.email || "Profissional autorizado",
      });

      downloadPatientDataJson(payload, patient.name);
      trackExportJson("patient", patient.id, {
        patient_code: patient.patient_code,
        patient_name: patient.name,
        action: "lgpd_data_export",
      });

      toast({
        title: "Exportação concluída",
        description: "Arquivo JSON gerado e baixado com sucesso em conformidade com a LGPD (Art. 18, V).",
      });
    } catch (err) {
      console.error("Erro ao exportar dados do paciente:", err);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível gerar o arquivo de exportação.",
        variant: "destructive",
      });
    }
  }, [canExport, clinic?.name, clinicalSnapshots, parsedClinicalProfile, parsedEmergencyContact, patient, profile?.full_name, profile?.social_name, trackEvent, trackExportJson, user?.email]);

  const handleExecutePrint = () => {
    setShowPrintResponsibilityModal(false);
    setIsPrinting(true);
    if (patient) {
      trackDocumentPrint("patient_registration", patient.id, { patient_code: patient.patient_code });
    }
    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrinting(false), 1000);
    }, 150);
  };

  if (isLoading) return <PacienteResumoSkeleton onRetry={() => refetch()} />;

  if (isError || !patient) {
    return (
      <div className="mx-auto max-w-2xl py-16 px-4 text-center space-y-5 animate-in fade-in duration-300">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive border border-destructive/20">
          <AlertCircle className="h-7 w-7" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-foreground tracking-tight">Paciente não encontrado ou indisponível</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {error instanceof Error ? error.message : "Não foi possível carregar os dados do resumo clínico deste paciente no momento."}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Button variant="outline" onClick={() => refetch()} className="gap-2 text-xs sm:text-sm">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Button onClick={() => navigate(clinicHomePath)} className="gap-2 text-xs sm:text-sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar para o início
          </Button>
        </div>
      </div>
    );
  }

  const hasResponsible = Boolean(patient.uses_responsible_cpf || patient.responsible_cpf);
  const responsibleName = parsedEmergencyContact.name?.trim() || null;
  const responsibleCpf = (patient.responsible_cpf || (patient.uses_responsible_cpf ? patient.cpf : null))?.trim() || null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="mx-auto max-w-5xl space-y-6">
      {/* Cabeçalho Desacoplado */}
      <PatientSummaryHeader
        patient={patient}
        riskFlagsCount={(parsedClinicalProfile.risk_flags || []).length}
        canPrint={canPrint}
        onBack={() => navigate(getClinicPatientPath(targetClinicKey, patient))}
        onDashboard={() => navigate(getClinicPatientPath(targetClinicKey, patient, "dashboard"))}
        onEdit={() => navigate(getClinicPatientPath(targetClinicKey, patient, "cadastro"))}
        onShare={() => setShareDialogOpen(true)}
        onPrint={() => setShowPrintResponsibilityModal(true)}
        onExportJson={handleExportJson}
      />

      {/* Abas Mobile-First Ergonômicas com Affordance de Rolagem */}
      <Tabs defaultValue="pessoais" className="w-full">
        <div className="relative w-full">
          <TabsList className="flex w-full overflow-x-auto overscroll-x-contain gap-1.5 p-1.5 rounded-2xl bg-muted/50 [-webkit-overflow-scrolling:touch] no-scrollbar [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsTrigger value="pessoais" className="shrink-0 min-w-fit px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium gap-2 touch-manipulation">
              <User className="h-4 w-4" />
              <span>Dados Pessoais</span>
            </TabsTrigger>
            <TabsTrigger value="contatos" className="shrink-0 min-w-fit px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium gap-2 touch-manipulation">
              <Phone className="h-4 w-4" />
              <span>Contatos</span>
            </TabsTrigger>
            <TabsTrigger value="endereco" className="shrink-0 min-w-fit px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium gap-2 touch-manipulation">
              <MapPin className="h-4 w-4" />
              <span>Endereço</span>
            </TabsTrigger>
            <TabsTrigger value="saude" className="shrink-0 min-w-fit px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium gap-2 touch-manipulation">
              <HeartPulse className="h-4 w-4" />
              <span>Saúde Base</span>
            </TabsTrigger>
            <TabsTrigger value="historico" className="shrink-0 min-w-fit px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium gap-2 touch-manipulation">
              <FileText className="h-4 w-4" />
              <span>Histórico Clínico</span>
            </TabsTrigger>
          </TabsList>
          <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/80 to-transparent rounded-r-2xl sm:hidden" />
        </div>

        <TabsContent value="pessoais" className="mt-5">
          <PatientPersonalInfoTab
            patient={patient}
            hasResponsible={hasResponsible}
            responsibleName={responsibleName}
            responsibleCpf={responsibleCpf}
            patientOriginDetails={patientOriginDetails}
          />
        </TabsContent>

        <TabsContent value="contatos" className="mt-5">
          <PatientContactsTab
            patient={patient}
            emergencyContact={parsedEmergencyContact}
            canViewContacts={canViewContacts}
          />
        </TabsContent>

        <TabsContent value="endereco" className="mt-5">
          <PatientAddressTab patient={patient} />
        </TabsContent>

        <TabsContent value="saude" className="mt-5">
          <PatientHealthBaseTab
            patient={patient}
            clinicalProfile={parsedClinicalProfile}
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

      {/* Modal Compartilhar Cadastro */}
      <SharePatientRegistrationModal
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        patient={patient}
        clinicName={clinic?.name}
      />

      {/* Dossiê de Impressão (Renderizado sob demanda para proteção LGPD) */}
      {(showPrintResponsibilityModal || isPrinting) && (
        <PatientRegistrationPrintView
          patient={patient}
          clinic={clinic}
          profile={profile}
          user={user}
          clinicalProfile={parsedClinicalProfile}
          emergencyContact={parsedEmergencyContact}
          snapshots={clinicalSnapshots}
          profileNameById={profileNameById}
        />
      )}

      {/* Modal de Confirmação & Termo LGPD de Impressão */}
      <PrintResponsibilityModal
        isOpen={showPrintResponsibilityModal}
        onConfirm={handleExecutePrint}
        onCancel={() => setShowPrintResponsibilityModal(false)}
        documentTitle={`cadastro completo do paciente ${patient.name}`}
      />
    </motion.div>
  );
};

export default PacienteResumo;
