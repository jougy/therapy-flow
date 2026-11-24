import type { FC } from "react";
import { PrintResponsibilityModal } from "@/components/PrintResponsibilityModal";
import { SharePatientRegistrationModal } from "@/components/patients/SharePatientRegistrationModal";
import { SessionShareDialog } from "@/components/SessionShareDialog";
import { EvolveSessionModal } from "@/components/sessions";
import { PatientStatsPrintView } from "@/pages/PacienteAnamnesisDashboard";
import { normalizePatientRecurringTime, normalizePatientRecurringWeekdays } from "@/lib/patient-recurrence";
import { getClinicPatientPath } from "@/lib/patient-routing";
import {
  AttendanceConfirmDialog, CareLineGroupDialog, DeleteCareLineDialog, DeletePatientDialog,
  EditEvolutionGroupDialog, LinkSessionEvolutionGroupDialog, PatientInfoSummaryDialog,
  PatientMobileSheets, PatientPrintModals, PatientRecurrenceDialog,
  PatientScheduleAttendanceDialog, SelectedAgendaEventDialog, SessionShareRecipientsDialog,
  formatAgendaEventDateTime,
} from "./index";
import { usePatientWorkspace } from "./context/PatientWorkspaceContext";

export const PatientGlobalModals: FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const ws = usePatientWorkspace();
  const { patient, targetClinicKey } = ws;

  const hasPrintModalOpen = ws.showPrintRegistrationModal || ws.isPrintingRegistration || ws.showPrintAdultConsentModal || ws.showPrintGuardianConsentModal || ws.showGenerateDocumentModal;
  const hasMobileSheetOpen = ws.mobileStatusSheetOpen || ws.mobileShareSheetOpen || ws.mobileTermsSheetOpen;

  return (
    <>
      {ws.editingEvolutionGroup && (
        <EditEvolutionGroupDialog
          editingEvolutionGroup={ws.editingEvolutionGroup}
          savingEvolutionGroupName={ws.savingEvolutionGroupName}
          onClose={() => ws.setEditingEvolutionGroup(null)}
          onChangeName={(name) => ws.setEditingEvolutionGroup(ws.editingEvolutionGroup ? { ...ws.editingEvolutionGroup, name } : null)}
          onSave={() => void ws.handleSaveEvolutionGroupName()}
        />
      )}

      {ws.groupDialogOpen && (
        <CareLineGroupDialog
          open={ws.groupDialogOpen}
          onOpenChange={ws.setGroupDialogOpen}
          editingGroup={ws.editingGroup}
          groupName={ws.groupName}
          onGroupNameChange={ws.setGroupName}
          groupComboboxOpen={ws.groupComboboxOpen}
          onGroupComboboxOpenChange={ws.setGroupComboboxOpen}
          groupSuggestions={ws.groupSuggestions}
          patientGroupNameSet={ws.patientGroupNameSet}
          existingPatientGroup={ws.existingPatientGroup}
          existingSuggestion={ws.existingSuggestion}
          onCreateTypedGroupName={ws.handleCreateTypedGroupName}
          onSelectGroupSuggestion={ws.handleSelectGroupSuggestion}
          groupStatus={ws.groupStatus}
          onGroupStatusChange={ws.setGroupStatus}
          groupColor={ws.groupColor}
          groupColorSlotId={ws.groupColorSlotId}
          resolvedClinicColorSlots={ws.resolvedClinicColorSlots}
          onSaveClinicColorSlot={ws.handleSaveClinicColorSlot}
          onSelectSlot={(slot) => { ws.setGroupColorSlotId(slot.id); ws.setGroupColor(slot.color_hex); }}
          savingGroup={ws.savingGroup}
          onSaveGroup={ws.handleSaveGroup}
        />
      )}

      {ws.deleteConfirmId && <DeleteCareLineDialog deleteConfirmId={ws.deleteConfirmId} onClose={() => ws.setDeleteConfirmId(null)} onConfirmDelete={ws.handleDeleteGroup} />}

      {ws.deletePatientDialogOpen && (
        <DeletePatientDialog open={ws.deletePatientDialogOpen} onOpenChange={ws.setDeletePatientDialogOpen} deletingPatient={ws.deletingPatient} onConfirmDelete={ws.handleDeletePatient} />
      )}

      {ws.recurrenceDialogOpen && (
        <PatientRecurrenceDialog
          open={ws.recurrenceDialogOpen}
          onOpenChange={(open) => {
            ws.setRecurrenceDialogOpen(open);
            if (open && patient) {
              ws.setRecurrenceEnabled(Boolean(patient.is_recurring));
              ws.setRecurrenceWeekdays(normalizePatientRecurringWeekdays(patient.recurring_weekdays));
              ws.setRecurrenceTime(normalizePatientRecurringTime(patient.recurring_time));
            }
          }}
          recurrenceEnabled={ws.recurrenceEnabled}
          onRecurrenceEnabledChange={ws.setRecurrenceEnabled}
          recurrenceWeekdays={ws.recurrenceWeekdays}
          onToggleRecurrenceWeekday={ws.toggleRecurrenceWeekday}
          recurrenceTime={ws.recurrenceTime}
          onRecurrenceTimeChange={ws.setRecurrenceTime}
          savingRecurrence={ws.savingRecurrence}
          onSaveRecurrence={ws.handleSaveRecurrence}
        />
      )}

      {ws.agendaDialogOpen && (
        <PatientScheduleAttendanceDialog
          open={ws.agendaDialogOpen}
          onOpenChange={ws.setAgendaDialogOpen}
          patientName={patient?.name || ""}
          agendaDate={ws.agendaDate}
          onAgendaDateChange={ws.setAgendaDate}
          agendaTime={ws.agendaTime}
          onAgendaTimeChange={ws.setAgendaTime}
          isAgendaDialogDateTimePast={ws.isAgendaDialogDateTimePast}
          savingAgendaEvent={ws.savingAgendaEvent}
          onConfirmSchedule={ws.handleSchedulePatientAgendaEvent}
        />
      )}

      {ws.selectedAgendaEvent && (
        <SelectedAgendaEventDialog
          selectedAgendaEvent={ws.selectedAgendaEvent}
          onClose={() => ws.setSelectedAgendaEvent(null)}
          patientName={patient?.name || ""}
          patientPhone={patient?.phone}
          clinicName={ws.clinic?.name}
          selectedAgendaStatusAction={ws.selectedAgendaStatusAction}
          onSelectAgendaStatusAction={ws.setSelectedAgendaStatusAction}
          selectedAgendaDate={ws.selectedAgendaDate}
          onSelectAgendaDateChange={ws.setSelectedAgendaDate}
          selectedAgendaTime={ws.selectedAgendaTime}
          onSelectAgendaTimeChange={ws.setSelectedAgendaTime}
          isSelectedAgendaDateTimePast={ws.isSelectedAgendaDateTimePast}
          savingAgendaDetails={ws.savingAgendaDetails}
          onUpdateAgendaDateTime={ws.handleUpdateAgendaDateTime}
          onApplyAgendaStatus={ws.handleApplyAgendaStatus}
        />
      )}

      {ws.attendanceConfirmDialogOpen && (
        <AttendanceConfirmDialog
          open={ws.attendanceConfirmDialogOpen}
          onOpenChange={ws.setAttendanceConfirmDialogOpen}
          pendingAttendanceAgendaEvent={ws.pendingAttendanceAgendaEvent}
          onClose={() => ws.setAttendanceConfirmDialogOpen(false)}
          onCancelPendingAgendaEvent={ws.handleCancelPendingAgendaEvent}
          onConfirmAttendanceWithPendingEvent={ws.handleConfirmAttendanceWithPendingEvent}
          onStartUnscheduledAttendance={ws.handleStartUnscheduledAttendance}
        />
      )}

      {patient && ws.patientInfoDialogOpen && (
        <PatientInfoSummaryDialog
          open={ws.patientInfoDialogOpen}
          onOpenChange={ws.setPatientInfoDialogOpen}
          patient={patient}
          patientRegistrationStatus={ws.patientRegistrationStatus}
          canViewPatientContact={ws.canViewPatientContact}
          patientOriginDetails={ws.patientOriginDetails}
          parsedClinicalProfile={ws.parsedClinicalProfile}
          parsedEmergencyContact={ws.parsedEmergencyContact}
          onViewFullRegistration={() => navigate(getClinicPatientPath(targetClinicKey, patient || ws.id!, "resumo"))}
          onEditRegistration={() => navigate(getClinicPatientPath(targetClinicKey, patient || ws.id!, "cadastro"))}
          onOpenShareDialog={ws.handleOpenShareDialog}
        />
      )}

      {ws.shareDialogOpen && (
        <SharePatientRegistrationModal
          open={ws.shareDialogOpen}
          onOpenChange={ws.setShareDialogOpen}
          patient={patient ? { id: patient.id, name: patient.name, cpf: patient.cpf, responsible_cpf: patient.responsible_cpf, date_of_birth: patient.date_of_birth, phone: patient.phone, email: patient.email, gender: patient.gender, pronoun: patient.pronoun, patient_code: patient.patient_code } : null}
          clinicName={ws.clinic?.name}
        />
      )}

      {ws.sessionShareDialogOpen && (
        <SessionShareDialog
          collaborators={ws.shareCollaborators}
          currentUserId={ws.user?.id}
          existingRecipients={ws.selectedShareRecipients}
          onOpenChange={ws.setSessionShareDialogOpen}
          onShared={() => { ws.handleExitSelectionMode(); if (ws.realPatientId) void ws.invalidatePatientData(ws.realPatientId, ws.clinicId ?? undefined, ["sessions"]); }}
          open={ws.sessionShareDialogOpen}
          sessionCount={ws.selectedSessionIds.length}
          sessionIds={ws.selectedSessionIds}
        />
      )}

      {ws.shareRecipientsSessionId && (
        <SessionShareRecipientsDialog open={Boolean(ws.shareRecipientsSessionId)} onOpenChange={(open) => !open && ws.setShareRecipientsSessionId(null)} session={ws.shareRecipientsSession} shareRecipientsSummary={ws.shareRecipientsSummary} />
      )}

      {ws.sessionToLinkGroup && (
        <LinkSessionEvolutionGroupDialog open={Boolean(ws.sessionToLinkGroup)} onOpenChange={(open) => !open && ws.setSessionToLinkGroup(null)} session={ws.sessionToLinkGroup} evolutionGroupsMetadata={ws.evolutionGroupsMetadata} evolutionGroupsView={ws.sessionView.evolutionGroups} onLinkGroup={(s, gId) => void ws.handleLinkSessionEvolutionGroup(s, gId)} />
      )}

      {ws.sessionToEvolve && (
        <EvolveSessionModal
          isOpen={Boolean(ws.sessionToEvolve)}
          onClose={() => ws.setSessionToEvolve(null)}
          onEvolveCopy={() => { if (ws.sessionToEvolve) void ws.handleEvolveSession(ws.sessionToEvolve, { mode: "copy" }); }}
          onEvolveBlank={(templateId) => { if (ws.sessionToEvolve) void ws.handleEvolveSession(ws.sessionToEvolve, { mode: "blank", templateId }); }}
          onStartUnlinked={(templateId) => { ws.setSessionToEvolve(null); ws.handleStartUnlinkedSession(templateId); }}
          templates={ws.anamnesisTemplates as never}
          defaultTemplateId={ws.sessionToEvolve?.anamnesis_template_id ?? null}
          isEvolving={Boolean(ws.evolvingSessionId)}
        />
      )}

      {ws.startAttendanceOptionsDialogOpen && (
        <EvolveSessionModal
          isOpen={ws.startAttendanceOptionsDialogOpen}
          onClose={() => { ws.setStartAttendanceOptionsDialogOpen(false); ws.setPendingAttendanceAgendaEvent(null); }}
          title="Iniciar Atendimento"
          description="Escolha como deseja iniciar este atendimento no histórico do paciente:"
          linkedAgendaEventDescription={ws.pendingAttendanceAgendaEvent ? `Vinculado ao agendamento de ${formatAgendaEventDateTime(ws.pendingAttendanceAgendaEvent.scheduled_for)}` : null}
          canEvolveFromPrevious={Boolean(ws.latestSession)}
          onEvolveCopy={() => { if (ws.latestSession) { ws.setStartAttendanceOptionsDialogOpen(false); void ws.handleEvolveSession(ws.latestSession, { mode: "copy", agendaEvent: ws.pendingAttendanceAgendaEvent }); } }}
          onEvolveBlank={(templateId) => { ws.setStartAttendanceOptionsDialogOpen(false); if (ws.latestSession) void ws.handleEvolveSession(ws.latestSession, { mode: "blank", templateId, agendaEvent: ws.pendingAttendanceAgendaEvent }); else ws.handleStartUnlinkedSession(templateId); }}
          onStartUnlinked={(templateId) => ws.handleStartUnlinkedSession(templateId)}
          templates={ws.anamnesisTemplates as never}
          defaultTemplateId={ws.latestSession?.anamnesis_template_id ?? null}
          isEvolving={Boolean(ws.evolvingSessionId)}
        />
      )}

      {patient && ws.showDashboardPrintModal && (
        <>
          <PatientStatsPrintView chartPreferences={ws.dashboardChartPreferences} clinic={ws.clinic} dashboard={ws.anamnesisDashboard} patient={patient} profile={ws.profile} selectedTemplateId={ws.dashboardTemplateFilter} user={ws.user} />
          <PrintResponsibilityModal isOpen={ws.showDashboardPrintModal} onConfirm={ws.handleExecuteDashboardPrint} onCancel={() => ws.setShowDashboardPrintModal(false)} documentTitle={`estatísticas do paciente ${patient.name}`} />
        </>
      )}

      {hasPrintModalOpen && (
        <PatientPrintModals
          patient={patient} clinic={ws.clinic} profile={ws.profile} user={ws.user}
          clinicId={ws.clinicId ?? undefined} realPatientId={ws.realPatientId}
          parsedClinicalProfile={ws.parsedClinicalProfile} parsedEmergencyContact={ws.parsedEmergencyContact}
          showPrintRegistrationModal={ws.showPrintRegistrationModal} setShowPrintRegistrationModal={ws.setShowPrintRegistrationModal}
          isPrintingRegistration={ws.isPrintingRegistration} handleExecutePrintRegistration={ws.handleExecutePrintRegistration}
          showPrintAdultConsentModal={ws.showPrintAdultConsentModal} setShowPrintAdultConsentModal={ws.setShowPrintAdultConsentModal}
          showPrintGuardianConsentModal={ws.showPrintGuardianConsentModal} setShowPrintGuardianConsentModal={ws.setShowPrintGuardianConsentModal}
          showGenerateDocumentModal={ws.showGenerateDocumentModal} setShowGenerateDocumentModal={ws.setShowGenerateDocumentModal}
          initialGenerateTemplateId={ws.initialGenerateTemplateId} setInitialGenerateTemplateId={ws.setInitialGenerateTemplateId}
          invalidatePatientData={ws.invalidatePatientData}
        />
      )}

      {hasMobileSheetOpen && (
        <PatientMobileSheets
          patient={patient}
          mobileStatusSheetOpen={ws.mobileStatusSheetOpen} setMobileStatusSheetOpen={ws.setMobileStatusSheetOpen}
          handlePatientStatusChange={(st) => void ws.handlePatientStatusChange(st)}
          mobileShareSheetOpen={ws.mobileShareSheetOpen} setMobileShareSheetOpen={ws.setMobileShareSheetOpen}
          canExport={ws.canExport} handleOpenShareDialog={ws.handleOpenShareDialog} navigate={navigate}
          getPatientPath={(p, sub) => getClinicPatientPath(targetClinicKey, p, sub)}
          handleExportPatientJson={ws.handleExportPatientJson}
          mobileTermsSheetOpen={ws.mobileTermsSheetOpen} setMobileTermsSheetOpen={ws.setMobileTermsSheetOpen}
          canPrint={ws.canPrint} setShowGenerateDocumentModal={ws.setShowGenerateDocumentModal}
          setInitialGenerateTemplateId={ws.setInitialGenerateTemplateId} setShowPrintAdultConsentModal={ws.setShowPrintAdultConsentModal}
          setShowPrintGuardianConsentModal={ws.setShowPrintGuardianConsentModal} setShowPrintRegistrationModal={ws.setShowPrintRegistrationModal}
          customTemplates={ws.customTemplates}
        />
      )}
    </>
  );
};
