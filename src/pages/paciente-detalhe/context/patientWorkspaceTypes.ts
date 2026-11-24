import type { ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import type { DocumentTemplateItem } from "@/components/patients/generate-document";
import type { useInvalidatePatientData } from "@/hooks/queries/usePatientDataQueries";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import type {
  buildPatientAnamnesisDashboard,
  PatientAnamnesisChartType,
} from "@/lib/patient-anamnesis-dashboard";
import type { ClinicalProfile, EmergencyContact } from "@/lib/patient-clinical-profile";
import type { formatPatientOriginDetails } from "@/lib/patient-origin";
import type {
  buildPatientSessionsView,
  EvolutionGroupMetadata,
  ModularFilterItem,
  ModularGroupedSessionsResult,
} from "@/lib/patient-sessions-view";
import type { PatientPaymentPlanRow } from "@/lib/payment-plans";
import type { buildPatientOperationalSummary } from "@/lib/session-operations";
import type { SessionShareCollaborator, SessionShareSummary } from "@/lib/session-sharing";
import type { Clinic, Profile } from "@/types";
import type { User } from "@supabase/supabase-js";
import type {
  AgendaEvent,
  AgendaStatusAction,
  GroupSuggestion,
  Patient,
  PatientGroup,
  PatientGroupStatus,
  PatientStatusSelectValue,
  ProfileSummary,
  Session,
} from "../pacienteDetalheTypes";

export interface PatientWorkspaceContextValue {
  id: string | undefined;
  patient: Patient | null;
  realPatientId: string | undefined;
  clinicId: string | null | undefined;
  effectiveClinicId: string | null;
  targetClinicKey: string | undefined;
  clinicHomePath: string;
  loading: boolean;
  clinic: Clinic | null;
  profile: Profile | null;
  user: User | null;
  invalidatePatientData: ReturnType<typeof useInvalidatePatientData>;
  refetchAgenda: () => Promise<unknown>;

  // Permissions (exclusivamente via can(capability))
  isAccountOwner: boolean;
  canViewPatientContact: boolean;
  canViewFinancialData: boolean;
  canPrint: boolean;
  canExport: boolean;
  canDeletePatient: boolean;
  canManageAllSessions: boolean;
  canBulkManageSessions: boolean;
  canManageForms: boolean;
  canShareSelection: boolean;
  canDeleteSelection: boolean;

  // Core data
  groups: PatientGroup[];
  sessions: Session[];
  agendaEvents: AgendaEvent[];
  upcomingAgendaEvent: AgendaEvent | null;
  futureAgendaCount: number;
  groupSuggestions: GroupSuggestion[];
  anamnesisTemplates: Array<{ id: string; name: string; schema: AnamnesisTemplateSchema }>;
  baseSchema: AnamnesisTemplateSchema;
  resolvedClinicColorSlots: ClinicGroupColorSlot[];
  profiles: ProfileSummary[];
  profileMap: Map<string, ProfileSummary>;
  patientGroupsMap: Map<string, PatientGroup>;
  evolutionGroupsMetadata: EvolutionGroupMetadata[];
  paymentPlans: PatientPaymentPlanRow[];
  paymentPlanMap: Map<string, PatientPaymentPlanRow>;
  sessionShareSummaries: Record<string, SessionShareSummary>;
  shareCollaborators: SessionShareCollaborator[];
  customTemplates: DocumentTemplateItem[];

  // Derived patient metadata
  parsedClinicalProfile: ClinicalProfile;
  parsedEmergencyContact: EmergencyContact;
  patientOriginDetails: ReturnType<typeof formatPatientOriginDetails> | null;
  patientRegistrationStatus: string;
  patientWhatsAppHref: string | null;
  allAllergyAlertItems: string[];
  fallRiskAlertItems: string[];
  structuredRiskAlertItems: string[];
  latestSession: Session | null;
  totalSessionsCount: number;
  completedSessionsCount: number;
  canceledSessionsCount: number;
  operationalSummary: ReturnType<typeof buildPatientOperationalSummary>;
  settledPaymentCents: number;
  pendingPaymentsCount: number;
  patientRecurrenceLabel: string;

  // Sessions view & filters
  searchTerm: string;
  setSearchTerm: (v: string) => void;
  sessionStatusFilter: string;
  setSessionStatusFilter: (v: string) => void;
  selectedTagFilter: string;
  setSelectedTagFilter: (v: string) => void;
  sessionViewMode: "detailed" | "compact";
  handleSetSessionViewMode: (mode: "detailed" | "compact") => void;
  expandedSessionIds: string[];
  toggleSessionExpansion: (sessionId: string) => void;
  collapsedEvolutionGroupIds: string[];
  toggleEvolutionGroupCollapse: (groupId: string) => void;
  groupByEvolution: boolean;
  handleToggleGroupByEvolution: (checked: boolean) => void;
  groupByMode: string;
  setGroupByMode: (mode: string) => void;
  collapsedModularGroupKeys: string[];
  toggleModularGroupCollapse: (key: string) => void;
  sessionView: ReturnType<typeof buildPatientSessionsView<Session, PatientGroup>>;
  groupableModularFields: Array<{ id: string; label: string }>;
  modularGroupedSessions: ModularGroupedSessionsResult<Session> | null;
  filterableModularItems: ModularFilterItem[];

  // Selection mode
  selectionMode: boolean;
  selectedSessionIds: string[];
  bulkUpdating: boolean;
  handleSessionPressStart: (sessionId: string) => void;
  handleSessionPressCancel: () => void;
  toggleSessionSelection: (sessionId: string) => void;
  handleExitSelectionMode: () => void;
  handleSessionNavigate: (sessionId: string) => void;
  selectedShareRecipients: NonNullable<SessionShareSummary["recipients"]>;
  shareRecipientsSession: Session | null;
  shareRecipientsSummary: SessionShareSummary | undefined;

  // Stats dashboard
  anamnesisDashboard: ReturnType<typeof buildPatientAnamnesisDashboard>;
  dashboardTemplateFilter: string;
  setDashboardTemplateFilter: (v: string) => void;
  dashboardChartPreferences: Record<string, PatientAnamnesisChartType>;
  handleDashboardChartChange: (metricKey: string, chart: PatientAnamnesisChartType) => void;

  // Modals & sheets state + actions
  groupDialogOpen: boolean;
  setGroupDialogOpen: (open: boolean) => void;
  editingGroup: PatientGroup | null;
  groupName: string;
  setGroupName: (v: string) => void;
  groupComboboxOpen: boolean;
  setGroupComboboxOpen: (open: boolean) => void;
  groupColor: string;
  setGroupColor: (v: string) => void;
  groupColorSlotId: string | null;
  setGroupColorSlotId: (id: string | null) => void;
  groupStatus: PatientGroupStatus;
  setGroupStatus: (status: PatientGroupStatus) => void;
  savingGroup: boolean;
  existingPatientGroup: PatientGroup | undefined;
  existingSuggestion: GroupSuggestion | undefined;
  patientGroupNameSet: Set<string>;
  openNewGroup: () => void;
  openEditGroup: (g: PatientGroup) => void;
  handleSelectGroupSuggestion: (suggestion: GroupSuggestion) => void;
  handleCreateTypedGroupName: () => void;
  handleSaveGroup: () => Promise<void>;
  handleSaveClinicColorSlot: (slotIndex: number, colorHex: string, alpha: number) => Promise<void>;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  handleDeleteGroup: (groupId: string) => Promise<void>;

  shareDialogOpen: boolean;
  setShareDialogOpen: (open: boolean) => void;
  handleOpenShareDialog: () => void;
  sessionShareDialogOpen: boolean;
  setSessionShareDialogOpen: (open: boolean) => void;
  shareRecipientsSessionId: string | null;
  setShareRecipientsSessionId: (id: string | null) => void;
  patientInfoDialogOpen: boolean;
  setPatientInfoDialogOpen: (open: boolean) => void;
  deletePatientDialogOpen: boolean;
  setDeletePatientDialogOpen: (open: boolean) => void;
  deletingPatient: boolean;
  updatingPatientStatus: boolean;
  handlePatientStatusChange: (nextStatus: PatientStatusSelectValue) => Promise<void>;
  handleDeletePatient: () => Promise<void>;

  termsMenuOpen: boolean;
  setTermsMenuOpen: (open: boolean) => void;
  showPrintRegistrationModal: boolean;
  setShowPrintRegistrationModal: (open: boolean) => void;
  isPrintingRegistration: boolean;
  handleExecutePrintRegistration: () => void;
  showPrintAdultConsentModal: boolean;
  setShowPrintAdultConsentModal: (open: boolean) => void;
  showPrintGuardianConsentModal: boolean;
  setShowPrintGuardianConsentModal: (open: boolean) => void;
  showGenerateDocumentModal: boolean;
  setShowGenerateDocumentModal: (open: boolean) => void;
  initialGenerateTemplateId: string | undefined;
  setInitialGenerateTemplateId: (id?: string) => void;
  showDashboardPrintModal: boolean;
  setShowDashboardPrintModal: (open: boolean) => void;
  handleExecuteDashboardPrint: () => void;
  handleExportPatientJson: () => void;

  agendaDialogOpen: boolean;
  setAgendaDialogOpen: (open: boolean) => void;
  agendaDate: string;
  setAgendaDate: (v: string) => void;
  agendaTime: string;
  setAgendaTime: (v: string) => void;
  isAgendaDialogDateTimePast: boolean;
  savingAgendaEvent: boolean;
  handleOpenPatientAgendaDialog: () => void;
  handleSchedulePatientAgendaEvent: () => Promise<void>;

  selectedAgendaEvent: AgendaEvent | null;
  setSelectedAgendaEvent: (event: AgendaEvent | null) => void;
  selectedAgendaStatusAction: AgendaStatusAction;
  setSelectedAgendaStatusAction: (action: AgendaStatusAction) => void;
  selectedAgendaDate: string;
  setSelectedAgendaDate: (v: string) => void;
  selectedAgendaTime: string;
  setSelectedAgendaTime: (v: string) => void;
  isSelectedAgendaDateTimePast: boolean;
  savingAgendaDetails: boolean;
  handleOpenAgendaDetails: (event: AgendaEvent) => void;
  handleApplyAgendaStatus: (overrideAction?: AgendaStatusAction) => Promise<void>;
  handleUpdateAgendaDateTime: () => Promise<void>;

  recurrenceDialogOpen: boolean;
  setRecurrenceDialogOpen: (open: boolean) => void;
  recurrenceEnabled: boolean;
  setRecurrenceEnabled: (v: boolean) => void;
  recurrenceWeekdays: number[];
  setRecurrenceWeekdays: (days: number[]) => void;
  recurrenceTime: string;
  setRecurrenceTime: (v: string) => void;
  savingRecurrence: boolean;
  toggleRecurrenceWeekday: (weekday: number, checked: boolean | "indeterminate") => void;
  handleSaveRecurrence: () => Promise<void>;

  attendanceConfirmDialogOpen: boolean;
  setAttendanceConfirmDialogOpen: (open: boolean) => void;
  startAttendanceOptionsDialogOpen: boolean;
  setStartAttendanceOptionsDialogOpen: (open: boolean) => void;
  pendingAttendanceAgendaEvent: AgendaEvent | null;
  setPendingAttendanceAgendaEvent: (ev: AgendaEvent | null) => void;
  handleStartAttendanceNow: () => void;
  handleConfirmAttendanceWithPendingEvent: () => void;
  handleStartUnscheduledAttendance: () => void;
  handleStartUnlinkedSession: (templateId?: string | null) => void;
  handleCancelPendingAgendaEvent: () => Promise<void>;

  mobileStatusSheetOpen: boolean;
  setMobileStatusSheetOpen: (open: boolean) => void;
  mobileTermsSheetOpen: boolean;
  setMobileTermsSheetOpen: (open: boolean) => void;
  mobileShareSheetOpen: boolean;
  setMobileShareSheetOpen: (open: boolean) => void;
  mobileFilterDrawerOpen: boolean;
  setMobileFilterDrawerOpen: (open: boolean) => void;

  editingEvolutionGroup: { id: string; name: string } | null;
  setEditingEvolutionGroup: (val: { id: string; name: string } | null) => void;
  savingEvolutionGroupName: boolean;
  handleSaveEvolutionGroupName: () => Promise<void>;
  evolvingSessionId: string | null;
  sessionToEvolve: Session | null;
  setSessionToEvolve: (s: Session | null) => void;
  sessionToLinkGroup: Session | null;
  setSessionToLinkGroup: (s: Session | null) => void;
  handleEvolveSession: (
    session: Session,
    options?: { mode?: "copy" | "blank"; templateId?: string | null; agendaEvent?: AgendaEvent | null }
  ) => Promise<void>;
  handleLinkSessionEvolutionGroup: (session: Session, targetGroupId: string) => Promise<void>;
  handleBulkMove: (nextGroupId: string) => Promise<void>;
  handleBulkLinkEvolutionGroup: (targetGroupId: string) => Promise<void>;
  handleBulkStatusUpdate: (nextStatus: string) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleOpenSessionShareDialog: () => void;
}
