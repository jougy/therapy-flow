import { useCallback, useState } from "react";
import type { NavigateFunction } from "react-router-dom";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { createTrashToastAction } from "@/lib/trashUtils";
import { buildPatientExportData, downloadPatientDataJson } from "@/lib/patient-export";
import { getActiveBrand } from "@/hooks/useActiveBrand";
import type { ClinicalProfile, EmergencyContact } from "@/lib/patient-clinical-profile";
import type { Clinic, Profile } from "@/types";
import type { Patient, PatientStatus, PatientStatusSelectValue } from "../pacienteDetalheTypes";

interface Params {
  patient: Patient | null;
  realPatientId: string | undefined;
  clinicId: string | null | undefined;
  targetClinicKey: string | undefined;
  clinicHomePath: string;
  clinic: Clinic | null;
  profile: Profile | null;
  user: User | null;
  canDeletePatient: boolean;
  canExport: boolean;
  parsedClinicalProfile: ClinicalProfile;
  parsedEmergencyContact: EmergencyContact;
  navigate: NavigateFunction;
  trackDocumentPrint: (docType: string, entityId: string, meta?: Record<string, unknown>) => void;
  trackExportJson: (entityType: string, entityId: string, meta?: Record<string, unknown>) => void;
  invalidatePatientData: (patientId: string, clinicId?: string | null, keys?: string[]) => Promise<void>;
  optimisticUpdatePatientStatus: (status: PatientStatus) => void;
}

export function usePatientProfileActions(params: Params) {
  const {
    patient, realPatientId, clinicId, targetClinicKey, clinicHomePath, clinic, profile, user,
    canDeletePatient, canExport, parsedClinicalProfile, parsedEmergencyContact, navigate,
    trackDocumentPrint, trackExportJson, invalidatePatientData, optimisticUpdatePatientStatus,
  } = params;

  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [patientInfoDialogOpen, setPatientInfoDialogOpen] = useState(false);
  const [updatingPatientStatus, setUpdatingPatientStatus] = useState(false);
  const [deletePatientDialogOpen, setDeletePatientDialogOpen] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);

  const [termsMenuOpen, setTermsMenuOpen] = useState(false);
  const [showPrintRegistrationModal, setShowPrintRegistrationModal] = useState(false);
  const [isPrintingRegistration, setIsPrintingRegistration] = useState(false);
  const [showPrintAdultConsentModal, setShowPrintAdultConsentModal] = useState(false);
  const [showPrintGuardianConsentModal, setShowPrintGuardianConsentModal] = useState(false);
  const [showGenerateDocumentModal, setShowGenerateDocumentModal] = useState(false);
  const [initialGenerateTemplateId, setInitialGenerateTemplateId] = useState<string | undefined>(undefined);
  const [showDashboardPrintModal, setShowDashboardPrintModal] = useState(false);

  const handleOpenShareDialog = useCallback(() => {
    if (patient) setShareDialogOpen(true);
  }, [patient]);

  const handlePatientStatusChange = async (nextStatus: PatientStatusSelectValue) => {
    if (nextStatus === "delete") {
      if (canDeletePatient) setDeletePatientDialogOpen(true);
      return;
    }
    if (!patient || patient.status === nextStatus) return;
    optimisticUpdatePatientStatus(nextStatus as PatientStatus);
    setUpdatingPatientStatus(true);
    const { error } = await supabase.from("patients").update({ status: nextStatus }).eq("id", patient.id);
    if (error) {
      toast({ title: "Erro ao atualizar status do paciente", description: error.message, variant: "destructive" });
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["patient"]);
    } else {
      toast({ title: "Status do paciente atualizado" });
    }
    setUpdatingPatientStatus(false);
  };

  const handleDeletePatient = async () => {
    if (!patient || !canDeletePatient) return;
    setDeletingPatient(true);
    const { error } = await supabase.rpc("move_entity_to_trash", { _entity_type: "patients", _entity_ids: [patient.id] });
    if (error) {
      toast({ title: "Erro ao mover paciente para a lixeira", description: error.message, variant: "destructive" });
      setDeletingPatient(false);
      return;
    }
    toast({
      title: "Paciente movido para a lixeira",
      description: "O paciente e seus dados foram enviados para a lixeira da clínica e podem ser restaurados até domingo.",
      action: createTrashToastAction(targetClinicKey, navigate),
    });
    setDeletePatientDialogOpen(false);
    setDeletingPatient(false);
    navigate(clinicHomePath, { replace: true, state: { deletedPatientId: patient.id, refreshPatientsAt: Date.now() } });
  };

  const runPrintWithTitle = (title: string, after?: () => void) => {
    const previousTitle = document.title;
    document.title = title;
    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = previousTitle;
        after?.();
      }, 1000);
    }, 150);
  };

  const handleExecutePrintRegistration = () => {
    setShowPrintRegistrationModal(false);
    setIsPrintingRegistration(true);
    if (patient) trackDocumentPrint("patient_registration", patient.id, { patient_code: patient.patient_code });
    const pName = (patient?.name ?? "Paciente").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    const cName = (clinic?.name ?? "Clínica").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    runPrintWithTitle(`Cadastro Completo - ${pName} - ${cName}`, () => setIsPrintingRegistration(false));
  };

  const handleExecuteDashboardPrint = () => {
    setShowDashboardPrintModal(false);
    const pName = (patient?.name ?? "Paciente").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    const cName = (clinic?.name ?? "Clínica").replace(/[^a-zA-Z0-9-_\s]/g, " ").replaceAll(/\s+/g, " ").trim();
    runPrintWithTitle(`Estatísticas de Anamnese - ${pName} - ${cName}`);
  };

  const handleExportPatientJson = () => {
    if (!canExport) {
      toast({ title: "Acesso não autorizado", description: "Seu perfil não possui autorização para exportar os dados cadastrais deste paciente (LGPD).", variant: "destructive" });
      return;
    }
    if (!patient) return;
    try {
      const payload = buildPatientExportData({
        patient, clinicalProfile: parsedClinicalProfile, emergencyContact: parsedEmergencyContact,
        clinicName: clinic?.name || `Clínica ${getActiveBrand().name}`,
        exportedBy: profile?.full_name || profile?.social_name || user?.email || "Profissional autorizado",
      });
      downloadPatientDataJson(payload, patient.name);
      trackExportJson("patient", patient.id, { patient_code: patient.patient_code, patient_name: patient.name, action: "lgpd_data_export" });
      toast({ title: "Exportação concluída", description: "Arquivo JSON gerado e baixado com sucesso em conformidade com a LGPD (Art. 18, V)." });
    } catch {
      toast({ title: "Erro na exportação", description: "Não foi possível gerar o arquivo de exportação.", variant: "destructive" });
    }
  };

  return {
    shareDialogOpen, setShareDialogOpen, handleOpenShareDialog,
    patientInfoDialogOpen, setPatientInfoDialogOpen,
    updatingPatientStatus, deletePatientDialogOpen, setDeletePatientDialogOpen, deletingPatient,
    handlePatientStatusChange, handleDeletePatient,
    termsMenuOpen, setTermsMenuOpen,
    showPrintRegistrationModal, setShowPrintRegistrationModal, isPrintingRegistration, handleExecutePrintRegistration,
    showPrintAdultConsentModal, setShowPrintAdultConsentModal,
    showPrintGuardianConsentModal, setShowPrintGuardianConsentModal,
    showGenerateDocumentModal, setShowGenerateDocumentModal, initialGenerateTemplateId, setInitialGenerateTemplateId,
    showDashboardPrintModal, setShowDashboardPrintModal, handleExecuteDashboardPrint, handleExportPatientJson,
  };
}
