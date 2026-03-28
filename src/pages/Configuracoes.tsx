import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  BellRing,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock3,
  ClipboardList,
  CreditCard,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UsersRound,
  Wallet,
  Save,
  Trash2,
  UserRound,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  ANAMNESIS_FIELD_LIBRARY,
  countTemplateQuestionFields,
  countTemplateSections,
  createDefaultTemplateSchema,
  isAnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";
import {
  formatLastSeenAt,
  getMembershipStatusMeta,
  getSubaccountCapacity,
  shouldShowTeamSettingsSection,
  sortMembershipsForDisplay,
} from "@/lib/subaccounts";
import {
  buildProfileAddress,
  formatCep,
  formatCpf,
  formatPhone,
  getProfilePublicCodeLabel,
  isSelfServiceProfileAddressLocked,
  isSelfServiceProfileDateLocked,
  isSelfServiceProfileFieldLocked,
  readProfileAddress,
  type ProfileAddress,
} from "@/lib/profile-settings";
import {
  buildBusinessHours,
  getClinicBrandName,
  readBusinessHours,
  type ClinicBusinessHours,
} from "@/lib/clinic-settings";
import {
  createSecuritySessionKey,
  formatSecurityEventTimestamp,
  getSecurityEventMeta,
  getSecurityPostureMeta,
  parseSecurityUserAgent,
  shouldShowAdminSecuritySection,
} from "@/lib/security-settings";
import {
  buildOnboardingChecklist,
  buildTeamDevelopmentSummary,
  getDevelopmentDashboardTone,
  getDevelopmentLevelMeta,
  getDevelopmentStatusScore,
  getDevelopmentStatusMeta,
  type DevelopmentLevel,
  type DevelopmentStatus,
} from "@/lib/team-development";

type TemplateRow = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
type ClinicRow = Database["public"]["Tables"]["clinics"]["Row"];
type MembershipRow = Database["public"]["Tables"]["clinic_memberships"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type SecurityEventRow = Database["public"]["Tables"]["security_events"]["Row"];
type SecuritySessionRow = Database["public"]["Tables"]["user_security_sessions"]["Row"];
type SecuritySettingsRow = Database["public"]["Tables"]["user_security_settings"]["Row"];
type TeamDevelopmentRow = Database["public"]["Tables"]["team_development_profiles"]["Row"];
type SubaccountOperationalRole = Exclude<MembershipRow["operational_role"], "owner">;
type TeamProfileRow = Pick<
  ProfileRow,
  | "address"
  | "birth_date"
  | "cpf"
  | "email"
  | "full_name"
  | "id"
  | "job_title"
  | "last_password_changed_at"
  | "last_seen_at"
  | "password_temporary"
  | "phone"
  | "professional_license"
  | "public_code"
  | "social_name"
  | "specialty"
  | "working_hours"
>;

type EditableSubaccountState = {
  address: ProfileAddress;
  birthDate: string;
  cpf: string;
  email: string;
  fullName: string;
  jobTitle: string;
  membershipStatus: MembershipRow["membership_status"];
  operationalRole: SubaccountOperationalRole;
  phone: string;
  professionalLicense: string;
  socialName: string;
  resetPassword: string;
  specialty: string;
  workingHours: string;
};

type EditableOwnProfileState = {
  address: ProfileAddress;
  birthDate: string;
  cpf: string;
  email: string;
  fullName: string;
  phone: string;
  professionalLicense: string;
  socialName: string;
};

type SecurityAlertState = {
  alertAccessChange: boolean;
  alertNewLogin: boolean;
  alertOtherSessionsEnded: boolean;
  alertPasswordChanged: boolean;
};

type EditableTeamDevelopmentState = {
  developmentStatus: DevelopmentStatus;
  goals: string;
  internalLevel: DevelopmentLevel;
  lastReviewAt: string;
  nextReviewAt: string;
  onboardingFlowRead: boolean;
  onboardingInitialTraining: boolean;
  reviewNotes: string;
};

type SettingsSection =
  | "profile"
  | "clinic"
  | "team"
  | "billing"
  | "treasury"
  | "analytics"
  | "security"
  | "forms"
  | "signout";

const OPERATIONAL_ROLE_LABELS: Record<SubaccountOperationalRole | "owner", string> = {
  admin: "Admin",
  assistant: "Assistente",
  owner: "Owner",
  professional: "Profissional",
};

const SECURITY_TONE_BADGE_CLASSNAMES = {
  admin: "border-sky-200 bg-sky-50 text-sky-700",
  default: "border-emerald-200 bg-emerald-50 text-emerald-700",
  muted: "border-slate-200 bg-slate-50 text-slate-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
} as const;

const DEVELOPMENT_DASHBOARD_TONE_CLASSNAMES = {
  healthy: "text-emerald-700",
  highlight: "text-violet-700",
  muted: "text-slate-700",
  progress: "text-sky-700",
  warning: "text-amber-700",
} as const;

const DEVELOPMENT_STATUS_OPTIONS: DevelopmentStatus[] = [
  "onboarding",
  "em_evolucao",
  "consolidado",
  "precisa_supervisao",
  "em_pausa",
];

const DEVELOPMENT_LEVEL_OPTIONS: DevelopmentLevel[] = [
  "estagiario",
  "junior",
  "pleno",
  "senior",
  "referencia",
];

const Configuracoes = () => {
  const navigate = useNavigate();
  const { accountRole, can, clinic: authClinic, clinicId, profile, refreshAuthState, session, signOut, subscriptionPlan, user } = useAuth();
  const [clinic, setClinic] = useState<ClinicRow | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [sessions, setSessions] = useState<Pick<SessionRow, "anamnesis_template_id" | "provider_id" | "session_date" | "status" | "user_id">[]>([]);
  const [memberships, setMemberships] = useState<MembershipRow[]>([]);
  const [profiles, setProfiles] = useState<TeamProfileRow[]>([]);
  const [teamDevelopmentProfiles, setTeamDevelopmentProfiles] = useState<TeamDevelopmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SettingsSection>("profile");
  const [mobileDescriptionSection, setMobileDescriptionSection] = useState<SettingsSection | null>(null);
  const [savingClinic, setSavingClinic] = useState(false);
  const [savingMembershipId, setSavingMembershipId] = useState<string | null>(null);
  const [savingOwnProfile, setSavingOwnProfile] = useState(false);
  const [creatingSubaccount, setCreatingSubaccount] = useState(false);
  const [expandedSubaccountIds, setExpandedSubaccountIds] = useState<string[]>([]);
  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null);
  const [editingSubaccount, setEditingSubaccount] = useState<EditableSubaccountState | null>(null);
  const [teamDevelopmentForms, setTeamDevelopmentForms] = useState<Record<string, EditableTeamDevelopmentState>>({});
  const [savingTeamDevelopmentUserId, setSavingTeamDevelopmentUserId] = useState<string | null>(null);
  const [securitySettings, setSecuritySettings] = useState<SecurityAlertState>({
    alertAccessChange: false,
    alertNewLogin: true,
    alertOtherSessionsEnded: true,
    alertPasswordChanged: true,
  });
  const [securityEvents, setSecurityEvents] = useState<SecurityEventRow[]>([]);
  const [adminSecurityEvents, setAdminSecurityEvents] = useState<SecurityEventRow[]>([]);
  const [securitySessions, setSecuritySessions] = useState<SecuritySessionRow[]>([]);
  const [securityPassword, setSecurityPassword] = useState("");
  const [securityPasswordConfirm, setSecurityPasswordConfirm] = useState("");
  const [savingSecuritySettings, setSavingSecuritySettings] = useState(false);
  const [savingSecurityPassword, setSavingSecurityPassword] = useState(false);
  const [endingOtherSessions, setEndingOtherSessions] = useState(false);
  const [currentSecuritySessionKey, setCurrentSecuritySessionKey] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState("");
  const [clinicLegalName, setClinicLegalName] = useState("");
  const [clinicEmail, setClinicEmail] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [clinicLogoUrl, setClinicLogoUrl] = useState("");
  const [clinicAddress, setClinicAddress] = useState<ProfileAddress>(readProfileAddress(null));
  const [clinicBusinessHours, setClinicBusinessHours] = useState<ClinicBusinessHours>({ summary: "" });
  const [ownProfileForm, setOwnProfileForm] = useState<EditableOwnProfileState>({
    address: readProfileAddress(null),
    birthDate: "",
    cpf: "",
    email: "",
    fullName: "",
    phone: "",
    professionalLicense: "",
    socialName: "",
  });
  const [newSubaccountName, setNewSubaccountName] = useState("");
  const [newSubaccountEmail, setNewSubaccountEmail] = useState("");
  const [newSubaccountPassword, setNewSubaccountPassword] = useState("123456");
  const [newSubaccountJobTitle, setNewSubaccountJobTitle] = useState("");
  const [newSubaccountSpecialty, setNewSubaccountSpecialty] = useState("");
  const [newSubaccountRole, setNewSubaccountRole] = useState<SubaccountOperationalRole>("professional");
  const mobileLongPressTimerRef = useRef<number | null>(null);
  const mobileLongPressTriggeredRef = useRef(false);
  const mobileDescriptionTimerRef = useRef<number | null>(null);

  const fetchData = useCallback(async () => {
    if (!clinicId || !user?.id) return;

    setLoading(true);
    const [clinicRes, templatesRes, sessionsRes, membershipsRes, profilesRes, teamDevelopmentRes, securitySettingsRes, securitySessionsRes, securityEventsRes, adminSecurityEventsRes] = await Promise.all([
      supabase.from("clinics").select("*").eq("id", clinicId).single(),
      supabase
        .from("anamnesis_form_templates")
        .select("*")
        .eq("clinic_id", clinicId)
        .eq("is_system_default", false)
        .order("updated_at", { ascending: false }),
      supabase
        .from("sessions")
        .select("anamnesis_template_id, provider_id, session_date, status, user_id")
        .eq("clinic_id", clinicId),
      supabase
        .from("clinic_memberships")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("address, birth_date, cpf, email, full_name, id, job_title, last_password_changed_at, last_seen_at, password_temporary, phone, professional_license, public_code, social_name, specialty, working_hours")
        .eq("clinic_id", clinicId),
      supabase
        .from("team_development_profiles")
        .select("*")
        .eq("clinic_id", clinicId),
      supabase
        .from("user_security_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_security_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("last_seen_at", { ascending: false })
        .limit(8),
      supabase
        .from("security_events")
        .select("*")
        .or(`actor_user_id.eq.${user.id},target_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false })
        .limit(12),
      shouldShowAdminSecuritySection(subscriptionPlan, can("subaccounts.manage"))
        ? supabase
            .from("security_events")
            .select("*")
            .eq("visibility_scope", "admin")
            .order("created_at", { ascending: false })
            .limit(12)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (templatesRes.error) {
      toast({ title: "Erro ao carregar formulários", description: templatesRes.error.message, variant: "destructive" });
    }

    setClinic(clinicRes.data ?? null);
    setTemplates(templatesRes.data ?? []);
    setSessions(sessionsRes.data ?? []);
    setMemberships(membershipsRes.data ?? []);
    setProfiles(profilesRes.data ?? []);
    setTeamDevelopmentProfiles(teamDevelopmentRes.data ?? []);
    setTeamDevelopmentForms(
      Object.fromEntries(
        (teamDevelopmentRes.data ?? []).map((row) => [
          row.user_id,
          {
            developmentStatus: row.development_status as DevelopmentStatus,
            goals: row.goals ?? "",
            internalLevel: row.internal_level as DevelopmentLevel,
            lastReviewAt: row.last_review_at ?? "",
            nextReviewAt: row.next_review_at ?? "",
            onboardingFlowRead: row.onboarding_flow_read,
            onboardingInitialTraining: row.onboarding_initial_training,
            reviewNotes: row.review_notes ?? "",
          },
        ])
      )
    );
    setSecuritySettings({
      alertAccessChange: securitySettingsRes.data?.alert_access_change ?? false,
      alertNewLogin: securitySettingsRes.data?.alert_new_login ?? true,
      alertOtherSessionsEnded: securitySettingsRes.data?.alert_other_sessions_ended ?? true,
      alertPasswordChanged: securitySettingsRes.data?.alert_password_changed ?? true,
    });
    setSecuritySessions(securitySessionsRes.data ?? []);
    setSecurityEvents(securityEventsRes.data ?? []);
    setAdminSecurityEvents((adminSecurityEventsRes.data as SecurityEventRow[] | null) ?? []);
    setClinicName(clinicRes.data?.name ?? "");
    setClinicLegalName(clinicRes.data?.legal_name ?? "");
    setClinicEmail(clinicRes.data?.email ?? "");
    setClinicPhone(formatPhone(clinicRes.data?.phone ?? ""));
    setClinicLogoUrl(clinicRes.data?.logo_url ?? "");
    setClinicAddress(readProfileAddress(clinicRes.data?.address));
    setClinicBusinessHours(readBusinessHours(clinicRes.data?.business_hours));
    const ownProfileRow = (profilesRes.data ?? []).find((row) => row.id === user?.id) ?? null;
    setOwnProfileForm({
      address: readProfileAddress(ownProfileRow?.address),
      birthDate: ownProfileRow?.birth_date ?? "",
      cpf: formatCpf(ownProfileRow?.cpf ?? ""),
      email: ownProfileRow?.email ?? user?.email ?? "",
      fullName: ownProfileRow?.full_name ?? "",
      phone: formatPhone(ownProfileRow?.phone ?? ""),
      professionalLicense: ownProfileRow?.professional_license ?? "",
      socialName: ownProfileRow?.social_name ?? "",
    });
    setSelectedTemplateId((current) => current ?? templatesRes.data?.[0]?.id ?? null);
    setLoading(false);
  }, [can, clinicId, subscriptionPlan, user?.email, user?.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!session?.access_token) {
      setCurrentSecuritySessionKey(null);
      return;
    }

    void createSecuritySessionKey(session.access_token).then(setCurrentSecuritySessionKey);
  }, [session?.access_token]);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [selectedTemplateId, templates]
  );

  const selectedSchema = useMemo(
    () => (selectedTemplate && isAnamnesisTemplateSchema(selectedTemplate.schema) ? selectedTemplate.schema : []),
    [selectedTemplate]
  );

  const selectedStats = useMemo(() => {
    if (!selectedTemplate) {
      return { fieldCount: 0, lastUsedAt: null as string | null, sectionCount: 0, totalUses: 0 };
    }

    const relatedSessions = sessions.filter((session) => session.anamnesis_template_id === selectedTemplate.id);
    const sortedDates = relatedSessions
      .map((session) => session.session_date)
      .filter(Boolean)
      .sort((left, right) => right.localeCompare(left));

    return {
      fieldCount: countTemplateQuestionFields(selectedSchema),
      lastUsedAt: sortedDates[0] ?? null,
      sectionCount: countTemplateSections(selectedSchema),
      totalUses: relatedSessions.length,
    };
  }, [selectedSchema, selectedTemplate, sessions]);

  const baseSchema = useMemo(
    () => (clinic && isAnamnesisTemplateSchema(clinic.anamnesis_base_schema) ? clinic.anamnesis_base_schema : createDefaultTemplateSchema()),
    [clinic]
  );

  const profileMap = useMemo(
    () => new Map(profiles.map((row) => [row.id, row])),
    [profiles]
  );

  const sortedMemberships = useMemo(
    () => sortMembershipsForDisplay(memberships),
    [memberships]
  );

  const canManageTeam = can("subaccounts.manage") || can("subaccounts_roles.manage");
  const canViewAdminSecurity = shouldShowAdminSecuritySection(subscriptionPlan, canManageTeam);
  const canReadTeamDevelopment = can("subaccounts_analytics.read");
  const visibleTeamMemberships = useMemo(
    () => (subscriptionPlan === "clinic" ? sortedMemberships : []),
    [sortedMemberships, subscriptionPlan]
  );
  const teamDevelopmentMap = useMemo(
    () => new Map(teamDevelopmentProfiles.map((row) => [row.user_id, row])),
    [teamDevelopmentProfiles]
  );
  const visibleDevelopmentMemberships = useMemo(
    () =>
      canReadTeamDevelopment
        ? visibleTeamMemberships
        : visibleTeamMemberships.filter((membershipRow) => membershipRow.user_id === user?.id),
    [canReadTeamDevelopment, user?.id, visibleTeamMemberships]
  );

  const developmentRows = useMemo(
    () =>
      visibleDevelopmentMemberships.map((membershipRow) => {
        const profileRow = profileMap.get(membershipRow.user_id);
        const developmentRow = teamDevelopmentMap.get(membershipRow.user_id) ?? null;
        const checklist = buildOnboardingChecklist({
          birthDate: profileRow?.birth_date ?? null,
          email: profileRow?.email ?? null,
          fullName: profileRow?.full_name ?? null,
          hasTemporaryPassword: profileRow?.password_temporary ?? false,
          onboardingFlowRead: developmentRow?.onboarding_flow_read ?? false,
          onboardingInitialTraining: developmentRow?.onboarding_initial_training ?? false,
          phone: profileRow?.phone ?? null,
          professionalLicense: profileRow?.professional_license ?? null,
          socialName: profileRow?.social_name ?? null,
        });
        const recentCreatedSessions = sessions.filter(
          (sessionRow) =>
            sessionRow.user_id === membershipRow.user_id &&
            new Date(sessionRow.session_date).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 30
        ).length;
        const recentFinalizedSessions = sessions.filter(
          (sessionRow) =>
            (sessionRow.provider_id ?? sessionRow.user_id) === membershipRow.user_id &&
            sessionRow.status !== "rascunho" &&
            new Date(sessionRow.session_date).getTime() >= Date.now() - 1000 * 60 * 60 * 24 * 30
        ).length;

        return {
          checklist,
          development: developmentRow,
          membership: membershipRow,
          operationalSignals: {
            recentCreatedSessions,
            recentFinalizedSessions,
          },
          profile: profileRow,
        };
      }),
    [profileMap, sessions, teamDevelopmentMap, visibleDevelopmentMemberships]
  );

  const teamDevelopmentSummary = useMemo(
    () =>
      buildTeamDevelopmentSummary(
        developmentRows.map((row) => ({
          developmentStatus: (row.development?.development_status as DevelopmentStatus | null) ?? "onboarding",
          membershipStatus: row.membership.membership_status,
          operationalRole: row.membership.operational_role,
        }))
      ),
    [developmentRows]
  );

  const subaccountCapacity = useMemo(
    () => getSubaccountCapacity(authClinic?.subaccount_limit ?? 0, memberships),
    [authClinic?.subaccount_limit, memberships]
  );

  const availableSections = useMemo(
    () =>
      [
        {
          description: "Veja os dados básicos da sua conta dentro da clínica.",
          icon: UserRound,
          id: "profile" as const,
          title: "Editar perfil",
        },
        can("clinic_profile.manage") && {
          description: "Edite os dados institucionais e o plano atual da clínica.",
          icon: Building2,
          id: "clinic" as const,
          title: "Perfil da clínica",
        },
        shouldShowTeamSettingsSection(subscriptionPlan) && {
          description: "Visualize subcontas, papéis e status de membership.",
          icon: UsersRound,
          id: "team" as const,
          title: "Colaboradores e acessos",
        },
        can("subscription_billing.manage") && {
          description: "Assinatura, cobrança e limites do plano contratado.",
          icon: CreditCard,
          id: "billing" as const,
          title: "Assinatura e pagamentos",
        },
        can("treasury.manage") && {
          description: "Área reservada para tesouraria e visão financeira da clínica.",
          icon: Wallet,
          id: "treasury" as const,
          title: "Tesouraria",
        },
        {
          description: "Ajustes de acesso e orientações de proteção da conta.",
          icon: Shield,
          id: "security" as const,
          title: "Segurança",
        },
        can("forms.manage") && {
          description: "Criar, editar e analisar fichas de anamnese.",
          icon: ClipboardList,
          id: "forms" as const,
          title: "Gerenciar formulários",
        },
        {
          description: "Encerrar a sessão atual neste dispositivo.",
          icon: LogOut,
          id: "signout" as const,
          title: "Sair da conta",
        },
      ].filter(Boolean) as Array<{
        description: string;
        icon: typeof UserRound;
        id: SettingsSection;
        title: string;
      }>,
    [can, subscriptionPlan]
  );

  useEffect(() => {
    if (!availableSections.some((section) => section.id === activeSection)) {
      setActiveSection(availableSections[0]?.id ?? "profile");
    }
  }, [activeSection, availableSections]);

  const activeSectionMeta = useMemo(
    () => availableSections.find((section) => section.id === activeSection) ?? availableSections[0] ?? null,
    [activeSection, availableSections]
  );

  const clearMobileLongPress = useCallback(() => {
    if (mobileLongPressTimerRef.current !== null) {
      window.clearTimeout(mobileLongPressTimerRef.current);
      mobileLongPressTimerRef.current = null;
    }
  }, []);

  const showMobileDescription = useCallback((sectionId: SettingsSection) => {
    setMobileDescriptionSection(sectionId);

    if (mobileDescriptionTimerRef.current !== null) {
      window.clearTimeout(mobileDescriptionTimerRef.current);
    }

    mobileDescriptionTimerRef.current = window.setTimeout(() => {
      setMobileDescriptionSection((current) => (current === sectionId ? null : current));
      mobileDescriptionTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      clearMobileLongPress();

      if (mobileDescriptionTimerRef.current !== null) {
        window.clearTimeout(mobileDescriptionTimerRef.current);
      }
    };
  }, [clearMobileLongPress]);

  const ownProfileLocks = useMemo(
    () => ({
      address: isSelfServiceProfileAddressLocked(profile?.address),
      birthDate: isSelfServiceProfileDateLocked(profile?.birth_date),
      cpf: isSelfServiceProfileFieldLocked(profile?.cpf),
      fullName: isSelfServiceProfileFieldLocked(profile?.full_name),
      phone: isSelfServiceProfileFieldLocked(profile?.phone),
      professionalLicense: isSelfServiceProfileFieldLocked(profile?.professional_license),
      socialName: isSelfServiceProfileFieldLocked(profile?.social_name),
    }),
    [profile]
  );

  const activeSecuritySessions = useMemo(
    () => securitySessions.filter((securitySession) => !securitySession.ended_at),
    [securitySessions]
  );

  const currentSecuritySession = useMemo(
    () =>
      activeSecuritySessions.find((securitySession) => securitySession.session_key === currentSecuritySessionKey) ??
      activeSecuritySessions[0] ??
      null,
    [activeSecuritySessions, currentSecuritySessionKey]
  );

  const otherSecuritySessions = useMemo(
    () =>
      activeSecuritySessions.filter((securitySession) => securitySession.session_key !== currentSecuritySessionKey),
    [activeSecuritySessions, currentSecuritySessionKey]
  );

  const ownSecurityPosture = useMemo(
    () =>
      getSecurityPostureMeta({
        lastPasswordChangedAt: profile?.last_password_changed_at ?? null,
        lastSeenAt: profile?.last_seen_at ?? null,
        passwordTemporary: profile?.password_temporary ?? false,
      }),
    [profile]
  );

  const localDeviceInfo = useMemo(
    () => parseSecurityUserAgent(typeof navigator === "undefined" ? null : navigator.userAgent),
    []
  );

  const teamSecurityRows = useMemo(
    () =>
      visibleTeamMemberships.map((membershipRow) => {
        const relatedProfile = profileMap.get(membershipRow.user_id);
        return {
          lastSeenAt: relatedProfile?.last_seen_at ?? null,
          membership: membershipRow,
          posture: getSecurityPostureMeta({
            lastPasswordChangedAt: relatedProfile?.last_password_changed_at ?? null,
            lastSeenAt: relatedProfile?.last_seen_at ?? null,
            passwordTemporary: relatedProfile?.password_temporary ?? false,
          }),
          profile: relatedProfile,
        };
      }),
    [profileMap, visibleTeamMemberships]
  );

  const staleTeamSecurityCount = useMemo(
    () =>
      teamSecurityRows.filter(
        (row) => !row.profile?.last_seen_at || row.posture.label === "Acesso desatualizado"
      ).length,
    [teamSecurityRows]
  );

  const temporaryPasswordCount = useMemo(
    () => teamSecurityRows.filter((row) => row.profile?.password_temporary).length,
    [teamSecurityRows]
  );

  const handleSaveClinicProfile = async () => {
    if (!clinicId || !can("clinic_profile.manage")) {
      return;
    }

    setSavingClinic(true);
    const { error } = await supabase
      .from("clinics")
      .update({
        address: buildProfileAddress(clinicAddress),
        business_hours: buildBusinessHours(clinicBusinessHours),
        email: clinicEmail.trim() || null,
        legal_name: clinicLegalName.trim() || null,
        logo_url: clinicLogoUrl.trim() || null,
        name: clinicName.trim(),
        phone: clinicPhone.replace(/\D/g, "") || null,
      })
      .eq("id", clinicId);

    if (error) {
      toast({ title: "Erro ao salvar clínica", description: error.message, variant: "destructive" });
      setSavingClinic(false);
      return;
    }

    toast({ title: "Perfil da clínica atualizado" });
    setSavingClinic(false);
    await refreshAuthState();
    void fetchData();
  };

  const updateClinicAddressField = (key: keyof ProfileAddress, value: string) => {
    setClinicAddress((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const updateOwnProfileField = <K extends keyof EditableOwnProfileState>(key: K, value: EditableOwnProfileState[K]) => {
    setOwnProfileForm((current) => ({ ...current, [key]: value }));
  };

  const updateOwnProfileAddressField = (key: keyof ProfileAddress, value: string) => {
    setOwnProfileForm((current) => ({
      ...current,
      address: {
        ...current.address,
        [key]: value,
      },
    }));
  };

  const updateEditingSubaccountField = <K extends keyof EditableSubaccountState>(key: K, value: EditableSubaccountState[K]) => {
    setEditingSubaccount((current) => (current ? { ...current, [key]: value } : current));
  };

  const updateEditingSubaccountAddressField = (key: keyof ProfileAddress, value: string) => {
    setEditingSubaccount((current) =>
      current
        ? {
            ...current,
            address: {
              ...current.address,
              [key]: value,
            },
          }
        : current
    );
  };

  const getTeamDevelopmentFormState = (userId: string): EditableTeamDevelopmentState => {
    const developmentRow = teamDevelopmentMap.get(userId);

    return (
      teamDevelopmentForms[userId] ?? {
        developmentStatus: (developmentRow?.development_status as DevelopmentStatus | null) ?? "onboarding",
        goals: developmentRow?.goals ?? "",
        internalLevel: (developmentRow?.internal_level as DevelopmentLevel | null) ?? "junior",
        lastReviewAt: developmentRow?.last_review_at ?? "",
        nextReviewAt: developmentRow?.next_review_at ?? "",
        onboardingFlowRead: developmentRow?.onboarding_flow_read ?? false,
        onboardingInitialTraining: developmentRow?.onboarding_initial_training ?? false,
        reviewNotes: developmentRow?.review_notes ?? "",
      }
    );
  };

  const updateTeamDevelopmentField = <K extends keyof EditableTeamDevelopmentState>(
    userId: string,
    key: K,
    value: EditableTeamDevelopmentState[K]
  ) => {
    setTeamDevelopmentForms((current) => ({
      ...current,
      [userId]: {
        ...getTeamDevelopmentFormState(userId),
        [key]: value,
      },
    }));
  };

  const handleSaveOwnProfile = async () => {
    if (!user?.id) {
      return;
    }

    setSavingOwnProfile(true);
    const { error } = await supabase.rpc("update_current_profile", {
      _address: buildProfileAddress(ownProfileForm.address),
      _birth_date: ownProfileForm.birthDate || null,
      _cpf: ownProfileForm.cpf || null,
      _email: ownProfileForm.email,
      _full_name: ownProfileForm.fullName,
      _phone: ownProfileForm.phone || null,
      _professional_license: ownProfileForm.professionalLicense || null,
      _social_name: ownProfileForm.socialName || null,
    });

    if (error) {
      toast({ title: "Erro ao salvar perfil", description: error.message, variant: "destructive" });
      setSavingOwnProfile(false);
      return;
    }

    toast({ title: "Perfil atualizado" });
    setSavingOwnProfile(false);
    await refreshAuthState();
    void fetchData();
  };

  const handleSaveSecurityAlerts = async () => {
    setSavingSecuritySettings(true);
    const { error } = await supabase.rpc("upsert_current_user_security_settings", {
      _alert_access_change: securitySettings.alertAccessChange,
      _alert_new_login: securitySettings.alertNewLogin,
      _alert_other_sessions_ended: securitySettings.alertOtherSessionsEnded,
      _alert_password_changed: securitySettings.alertPasswordChanged,
    });

    if (error) {
      toast({ title: "Erro ao salvar alertas", description: error.message, variant: "destructive" });
      setSavingSecuritySettings(false);
      return;
    }

    toast({ title: "Alertas de seguranca atualizados" });
    setSavingSecuritySettings(false);
    void fetchData();
  };

  const handleChangeSecurityPassword = async () => {
    if (!securityPassword.trim()) {
      toast({ title: "Informe a nova senha", variant: "destructive" });
      return;
    }

    if (securityPassword.trim().length < 6) {
      toast({ title: "A senha precisa ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    if (securityPassword !== securityPasswordConfirm) {
      toast({ title: "As senhas nao conferem", variant: "destructive" });
      return;
    }

    setSavingSecurityPassword(true);
    const { error } = await supabase.rpc("update_current_profile", {
      _new_password: securityPassword.trim(),
    });

    if (error) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
      setSavingSecurityPassword(false);
      return;
    }

    toast({ title: "Senha atualizada" });
    setSecurityPassword("");
    setSecurityPasswordConfirm("");
    setSavingSecurityPassword(false);
    await refreshAuthState();
    void fetchData();
  };

  const handleEndOtherSessions = async () => {
    setEndingOtherSessions(true);
    const authResult = await supabase.auth.signOut({ scope: "others" });
    if (authResult.error) {
      toast({ title: "Erro ao encerrar outras sessoes", description: authResult.error.message, variant: "destructive" });
      setEndingOtherSessions(false);
      return;
    }

    const { error } = await supabase.rpc("end_other_security_sessions", {
      _current_session_key: currentSecuritySessionKey,
    });

    if (error) {
      toast({ title: "As outras sessoes foram encerradas, mas o historico nao foi atualizado", description: error.message, variant: "destructive" });
      setEndingOtherSessions(false);
      return;
    }

    toast({ title: "Outras sessoes encerradas" });
    setEndingOtherSessions(false);
    void fetchData();
  };

  const toggleExpandedSubaccount = (membershipId: string) => {
    setExpandedSubaccountIds((current) =>
      current.includes(membershipId) ? current.filter((id) => id !== membershipId) : [...current, membershipId]
    );
  };

  const startEditingSubaccount = (membershipRow: MembershipRow) => {
    const relatedProfile = profileMap.get(membershipRow.user_id);

    setExpandedSubaccountIds((current) =>
      current.includes(membershipRow.id) ? current : [...current, membershipRow.id]
    );
    setEditingMembershipId(membershipRow.id);
    setEditingSubaccount({
      address: readProfileAddress(relatedProfile?.address),
      birthDate: relatedProfile?.birth_date ?? "",
      cpf: relatedProfile?.cpf ?? "",
      email: relatedProfile?.email ?? "",
      fullName: relatedProfile?.full_name ?? "",
      jobTitle: relatedProfile?.job_title ?? "",
      membershipStatus: membershipRow.membership_status,
      operationalRole: membershipRow.operational_role as SubaccountOperationalRole,
      phone: relatedProfile?.phone ?? "",
      professionalLicense: relatedProfile?.professional_license ?? "",
      socialName: relatedProfile?.social_name ?? "",
      resetPassword: "",
      specialty: relatedProfile?.specialty ?? "",
      workingHours: relatedProfile?.working_hours ?? "",
    });
  };

  const cancelEditingSubaccount = () => {
    setEditingMembershipId(null);
    setEditingSubaccount(null);
  };

  const handleCreateSubaccount = async () => {
    if (!clinicId || !can("subaccounts.manage")) {
      return;
    }

    if (subaccountCapacity.reached) {
      toast({
        title: "Limite de subcontas atingido",
        description: "Inative uma subconta existente ou aumente o plano clinic antes de criar outra.",
        variant: "destructive",
      });
      return;
    }

    setCreatingSubaccount(true);
    const { error } = await supabase.rpc("create_clinic_subaccount", {
      _clinic_id: clinicId,
      _email: newSubaccountEmail,
      _full_name: newSubaccountName,
      _job_title: newSubaccountJobTitle || null,
      _operational_role: newSubaccountRole,
      _password: newSubaccountPassword,
      _specialty: newSubaccountSpecialty || null,
    });

    if (error) {
      toast({ title: "Erro ao criar subconta", description: error.message, variant: "destructive" });
      setCreatingSubaccount(false);
      return;
    }

    toast({ title: "Subconta criada", description: "A nova conta já pode entrar com o e-mail e a senha informados." });
    setNewSubaccountName("");
    setNewSubaccountEmail("");
    setNewSubaccountPassword("123456");
    setNewSubaccountJobTitle("");
    setNewSubaccountSpecialty("");
    setNewSubaccountRole("professional");
    setCreatingSubaccount(false);
    void fetchData();
  };

  const handleSaveSubaccount = async (membershipRow: MembershipRow) => {
    if (!editingSubaccount || !can("subaccounts.manage")) {
      return;
    }

    setSavingMembershipId(membershipRow.id);
    const { error } = await supabase.rpc("update_clinic_subaccount_profile", {
      _address: buildProfileAddress(editingSubaccount.address),
      _birth_date: editingSubaccount.birthDate || null,
      _membership_id: membershipRow.id,
      _cpf: editingSubaccount.cpf || null,
      _email: editingSubaccount.email,
      _full_name: editingSubaccount.fullName,
      _job_title: editingSubaccount.jobTitle || null,
      _membership_status: editingSubaccount.membershipStatus,
      _new_password: editingSubaccount.resetPassword || null,
      _operational_role: editingSubaccount.operationalRole,
      _phone: editingSubaccount.phone || null,
      _professional_license: editingSubaccount.professionalLicense || null,
      _social_name: editingSubaccount.socialName || null,
      _specialty: editingSubaccount.specialty || null,
      _working_hours: editingSubaccount.workingHours || null,
    });

    if (error) {
      toast({ title: "Erro ao salvar subconta", description: error.message, variant: "destructive" });
      setSavingMembershipId(null);
      return;
    }

    toast({ title: "Subconta atualizada" });
    setSavingMembershipId(null);
    cancelEditingSubaccount();
    void fetchData();
  };

  const handleSaveTeamDevelopment = async (userId: string) => {
    if (!canReadTeamDevelopment) {
      return;
    }

    const form = getTeamDevelopmentFormState(userId);
    setSavingTeamDevelopmentUserId(userId);
    const { error } = await supabase.rpc("update_team_development_profile", {
      _development_status: form.developmentStatus,
      _goals: form.goals || null,
      _internal_level: form.internalLevel,
      _last_review_at: form.lastReviewAt || null,
      _next_review_at: form.nextReviewAt || null,
      _onboarding_flow_read: form.onboardingFlowRead,
      _onboarding_initial_training: form.onboardingInitialTraining,
      _review_notes: form.reviewNotes || null,
      _user_id: userId,
    });

    if (error) {
      toast({ title: "Erro ao salvar desenvolvimento", description: error.message, variant: "destructive" });
      setSavingTeamDevelopmentUserId(null);
      return;
    }

    toast({ title: "Desenvolvimento atualizado" });
    setSavingTeamDevelopmentUserId(null);
    void fetchData();
  };

  const handleDeleteTemplate = async (template: TemplateRow) => {
    const { error } = await supabase.from("anamnesis_form_templates").delete().eq("id", template.id);

    if (error) {
      toast({ title: "Erro ao excluir formulário", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Formulário excluído" });
    if (selectedTemplateId === template.id) {
      setSelectedTemplateId(null);
    }
    void fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const renderSettingsMenu = (onSelect?: () => void) => (
    <div className="space-y-3">
      {availableSections.map((item) => (
        <button
          key={item.id}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${
            activeSection === item.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
          }`}
          onClick={() => {
            setActiveSection(item.id);
            onSelect?.();
          }}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-muted p-2">
              <item.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6 pb-28 lg:pb-0">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            aria-label="Voltar para a página inicial"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ajuste preferências da conta e acesse as ferramentas administrativas do projeto.
            </p>
            {activeSectionMeta && (
              <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:hidden">
                {activeSectionMeta.title}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <Card className="hidden lg:block">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Opções
            </CardTitle>
          </CardHeader>
          <CardContent>{renderSettingsMenu()}</CardContent>
        </Card>

        <div className="space-y-6">
          {activeSection === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Editar perfil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">ID</p>
                    <p className="mt-2 font-medium">{getProfilePublicCodeLabel(profile?.public_code ?? null)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Último acesso</p>
                    <p className="mt-2 font-medium">{formatLastSeenAt(profile?.last_seen_at ?? null)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Clínica</p>
                    <p className="mt-2 font-medium">{authClinic?.name || "Não identificada"}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Dados de acesso</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Ajuste o e-mail principal da conta. A troca de senha fica centralizada na subpagina `Seguranca`.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>E-mail de acesso</Label>
                      <Input value={ownProfileForm.email} onChange={(event) => updateOwnProfileField("email", event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Dados pessoais</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Você pode completar seus dados cadastrais uma vez. Depois disso, qualquer ajuste fica restrito à administração da clínica.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Nome completo</Label>
                      <Input
                        value={ownProfileForm.fullName}
                        onChange={(event) => updateOwnProfileField("fullName", event.target.value)}
                        disabled={ownProfileLocks.fullName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome social</Label>
                      <Input
                        value={ownProfileForm.socialName}
                        onChange={(event) => updateOwnProfileField("socialName", event.target.value)}
                        disabled={ownProfileLocks.socialName}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data de nascimento</Label>
                      <Input
                        type="date"
                        value={ownProfileForm.birthDate}
                        onChange={(event) => updateOwnProfileField("birthDate", event.target.value)}
                        disabled={ownProfileLocks.birthDate}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CPF</Label>
                      <Input
                        value={ownProfileForm.cpf}
                        maxLength={14}
                        onChange={(event) => updateOwnProfileField("cpf", formatCpf(event.target.value))}
                        disabled={ownProfileLocks.cpf}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone</Label>
                      <Input
                        value={ownProfileForm.phone}
                        maxLength={15}
                        onChange={(event) => updateOwnProfileField("phone", formatPhone(event.target.value))}
                        disabled={ownProfileLocks.phone}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Conselho regional</Label>
                      <Input
                        value={ownProfileForm.professionalLicense}
                        onChange={(event) => updateOwnProfileField("professionalLicense", event.target.value)}
                        disabled={ownProfileLocks.professionalLicense}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Endereço</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Depois de preenchido, o endereço passa a ser gerenciado pela administração da clínica.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input
                        value={ownProfileForm.address.cep}
                        maxLength={9}
                        onChange={(event) => updateOwnProfileAddressField("cep", formatCep(event.target.value))}
                        disabled={ownProfileLocks.address}
                      />
                    </div>
                    <div className="space-y-2 xl:col-span-2">
                      <Label>Rua</Label>
                      <Input
                        value={ownProfileForm.address.street}
                        onChange={(event) => updateOwnProfileAddressField("street", event.target.value)}
                        disabled={ownProfileLocks.address}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input
                        value={ownProfileForm.address.number}
                        onChange={(event) => updateOwnProfileAddressField("number", event.target.value)}
                        disabled={ownProfileLocks.address}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Complemento</Label>
                      <Input
                        value={ownProfileForm.address.complement}
                        onChange={(event) => updateOwnProfileAddressField("complement", event.target.value)}
                        disabled={ownProfileLocks.address}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input
                        value={ownProfileForm.address.neighborhood}
                        onChange={(event) => updateOwnProfileAddressField("neighborhood", event.target.value)}
                        disabled={ownProfileLocks.address}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input
                        value={ownProfileForm.address.city}
                        onChange={(event) => updateOwnProfileAddressField("city", event.target.value)}
                        disabled={ownProfileLocks.address}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Input
                        value={ownProfileForm.address.state}
                        onChange={(event) => updateOwnProfileAddressField("state", event.target.value)}
                        disabled={ownProfileLocks.address}
                      />
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Campos administrados pela clínica</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cargo, especialidade e horário de trabalho são mantidos pela administração em Colaboradores e acessos.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Cargo</p>
                      <p className="mt-2 text-sm">{profile?.job_title || "Não informado"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Especialidade</p>
                      <p className="mt-2 text-sm">{profile?.specialty || "Não informado"}</p>
                    </div>
                    <div className="rounded-lg bg-muted/30 p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Horário de trabalho</p>
                      <p className="mt-2 text-sm whitespace-pre-wrap">{profile?.working_hours || "Não informado"}</p>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() => void handleSaveOwnProfile()}
                    disabled={savingOwnProfile || !ownProfileForm.fullName.trim() || !ownProfileForm.email.trim()}
                  >
                    {savingOwnProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "clinic" && clinic && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Perfil da clínica</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Marca ativa</p>
                    <p className="mt-2 font-medium">{getClinicBrandName(clinicName)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano</p>
                    <p className="mt-2 font-medium">{clinic.subscription_plan}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Conta compradora</p>
                    <p className="mt-2 font-medium">{accountRole === "account_owner" ? "Você" : "Outro usuário da clínica"}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Dados de acesso e marca</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      O nome e o logo cadastrados aqui passam a representar a clínica no topo da plataforma.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-[120px,1fr] items-start">
                    <div className="rounded-xl border bg-muted/30 p-3 flex items-center justify-center min-h-[96px]">
                      {clinicLogoUrl ? (
                        <img src={clinicLogoUrl} alt={`Logo da ${getClinicBrandName(clinicName)}`} className="max-h-20 max-w-full object-contain" />
                      ) : (
                        <span className="text-sm text-muted-foreground text-center">{getClinicBrandName(clinicName)}</span>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nome da clínica</Label>
                        <Input value={clinicName} onChange={(event) => setClinicName(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>URL do logo</Label>
                        <Input
                          value={clinicLogoUrl}
                          onChange={(event) => setClinicLogoUrl(event.target.value)}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail institucional</Label>
                        <Input value={clinicEmail} onChange={(event) => setClinicEmail(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Telefone institucional</Label>
                        <Input
                          value={clinicPhone}
                          maxLength={15}
                          onChange={(event) => setClinicPhone(formatPhone(event.target.value))}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Dados institucionais</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Informações formais e operacionais da clínica.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Razão social</Label>
                      <Input value={clinicLegalName} onChange={(event) => setClinicLegalName(event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>CNPJ</Label>
                      <Input value={clinic.cnpj} disabled />
                    </div>
                    <div className="space-y-2">
                      <Label>Plano contratado</Label>
                      <Input value={clinic.subscription_plan} disabled />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Horário de funcionamento</Label>
                    <Textarea
                      value={clinicBusinessHours.summary}
                      onChange={(event) => setClinicBusinessHours({ summary: event.target.value })}
                      placeholder="Ex.: seg-sex 08h-18h; sábado 08h-12h"
                    />
                  </div>
                </div>

                <div className="rounded-lg border p-4 space-y-4">
                  <div>
                    <p className="font-medium">Endereço</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Preenchimento estruturado para uso em documentos e identificação da clínica.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input
                        value={clinicAddress.cep}
                        maxLength={9}
                        onChange={(event) => updateClinicAddressField("cep", formatCep(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2 xl:col-span-2">
                      <Label>Rua</Label>
                      <Input value={clinicAddress.street} onChange={(event) => updateClinicAddressField("street", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input value={clinicAddress.number} onChange={(event) => updateClinicAddressField("number", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Complemento</Label>
                      <Input value={clinicAddress.complement} onChange={(event) => updateClinicAddressField("complement", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input value={clinicAddress.neighborhood} onChange={(event) => updateClinicAddressField("neighborhood", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input value={clinicAddress.city} onChange={(event) => updateClinicAddressField("city", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Estado</Label>
                      <Input value={clinicAddress.state} onChange={(event) => updateClinicAddressField("state", event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => void handleSaveClinicProfile()} disabled={savingClinic || !clinicName.trim()}>
                    {savingClinic ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    Salvar perfil da clínica
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "team" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Colaboradores e acessos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!shouldShowTeamSettingsSection(subscriptionPlan) ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    O plano `solo` não permite subcontas. Ao migrar para `clinic`, esta seção passa a permitir equipe e hierarquia simples.
                  </div>
                ) : (
                  <>
                    {canManageTeam && (
                      <>
                        <div className="rounded-lg border p-4 text-sm">
                          <p className="font-medium">Limite atual de subcontas</p>
                          <p className="mt-1 text-muted-foreground">
                            {subaccountCapacity.occupied} de {subaccountCapacity.limit} subconta(s) em uso no plano clinic atual.
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-lg border p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Assentos ocupados</p>
                            <p className="mt-2 text-2xl font-semibold">{subaccountCapacity.occupied}</p>
                          </div>
                          <div className="rounded-lg border p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Disponíveis</p>
                            <p className="mt-2 text-2xl font-semibold">{subaccountCapacity.available}</p>
                          </div>
                          <div className="rounded-lg border p-4">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Conta principal</p>
                            <p className="mt-2 text-sm font-medium">{accountRole === "account_owner" ? "Você" : "Outro usuário da clínica"}</p>
                          </div>
                        </div>
                      </>
                    )}

                    {can("subaccounts.manage") && (
                      <div className="rounded-lg border p-4 space-y-4">
                        <div>
                          <p className="font-medium">Criar nova subconta</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Use esta área para criar acessos adicionais do plano clinic e já definir o papel operacional inicial.
                          </p>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Nome completo</Label>
                            <Input value={newSubaccountName} onChange={(event) => setNewSubaccountName(event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>E-mail</Label>
                            <Input
                              type="email"
                              value={newSubaccountEmail}
                              onChange={(event) => setNewSubaccountEmail(event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Senha inicial</Label>
                            <Input
                              type="text"
                              value={newSubaccountPassword}
                              onChange={(event) => setNewSubaccountPassword(event.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Papel operacional</Label>
                            <Select
                              value={newSubaccountRole}
                              onValueChange={(value) => setNewSubaccountRole(value as SubaccountOperationalRole)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">admin</SelectItem>
                                <SelectItem value="professional">professional</SelectItem>
                                <SelectItem value="assistant">assistant</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Cargo</Label>
                            <Input value={newSubaccountJobTitle} onChange={(event) => setNewSubaccountJobTitle(event.target.value)} />
                          </div>
                          <div className="space-y-2">
                            <Label>Especialidade</Label>
                            <Input value={newSubaccountSpecialty} onChange={(event) => setNewSubaccountSpecialty(event.target.value)} />
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <p className="text-sm text-muted-foreground">
                            A subconta já nasce ativa e ocupando um assento do plano.
                          </p>
                          <Button
                            onClick={() => void handleCreateSubaccount()}
                            disabled={
                              creatingSubaccount ||
                              subaccountCapacity.reached ||
                              !newSubaccountName.trim() ||
                              !newSubaccountEmail.trim() ||
                              newSubaccountPassword.trim().length < 6
                            }
                          >
                            {creatingSubaccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            Criar subconta
                          </Button>
                        </div>
                      </div>
                    )}

                    {visibleTeamMemberships.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Nenhum colaborador encontrado para esta clínica.
                      </div>
                    ) : (
                      visibleTeamMemberships.map((membershipRow) => {
                        const relatedProfile = profileMap.get(membershipRow.user_id);
                        const statusMeta = getMembershipStatusMeta(membershipRow.membership_status);
                        const isExpanded = expandedSubaccountIds.includes(membershipRow.id);
                        const isEditing = editingMembershipId === membershipRow.id && editingSubaccount !== null;
                        const canEditMembershipRow = canManageTeam && membershipRow.account_role !== "account_owner";

                        return (
                          <div key={membershipRow.id} className="rounded-lg border p-4 space-y-4">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div className="space-y-2">
                                <p className="font-medium">{relatedProfile?.full_name || relatedProfile?.email || membershipRow.user_id}</p>
                                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                  <span className="inline-flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${statusMeta.className}`} />
                                    {statusMeta.label}
                                  </span>
                                  <span>{OPERATIONAL_ROLE_LABELS[membershipRow.operational_role]}</span>
                                  <span>{relatedProfile?.specialty || "Sem especialidade"}</span>
                                  <span>Último acesso: {formatLastSeenAt(relatedProfile?.last_seen_at ?? null)}</span>
                                </div>
                              </div>
                              {canManageTeam && (
                                <div className="flex items-center gap-2">
                                  <Button variant="outline" size="sm" onClick={() => toggleExpandedSubaccount(membershipRow.id)}>
                                    {isExpanded ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                                    Ver mais
                                  </Button>
                                  {canEditMembershipRow && (
                                    <Button variant="outline" size="sm" onClick={() => startEditingSubaccount(membershipRow)}>
                                      <Pencil className="h-4 w-4 mr-2" />
                                      Editar campos
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            {canManageTeam && isExpanded && (
                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">ID</p>
                                  <p className="mt-2 text-sm">{getProfilePublicCodeLabel(relatedProfile?.public_code ?? null)}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">E-mail</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.email || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nome social</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.social_name || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Telefone</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.phone || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Nascimento</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.birth_date ? new Date(relatedProfile.birth_date).toLocaleDateString("pt-BR") : "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">CPF</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.cpf || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Conselho regional</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.professional_license || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Cargo</p>
                                  <p className="mt-2 text-sm">{relatedProfile?.job_title || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Horário de trabalho</p>
                                  <p className="mt-2 text-sm whitespace-pre-wrap">{relatedProfile?.working_hours || "Não informado"}</p>
                                </div>
                                <div className="rounded-lg bg-muted/30 p-3 xl:col-span-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Endereço</p>
                                  <p className="mt-2 text-sm whitespace-pre-wrap">
                                    {[
                                      readProfileAddress(relatedProfile?.address).street,
                                      readProfileAddress(relatedProfile?.address).number,
                                      readProfileAddress(relatedProfile?.address).complement,
                                      readProfileAddress(relatedProfile?.address).neighborhood,
                                      readProfileAddress(relatedProfile?.address).city,
                                      readProfileAddress(relatedProfile?.address).state,
                                      readProfileAddress(relatedProfile?.address).cep,
                                    ]
                                      .filter(Boolean)
                                      .join(" • ") || "Não informado"}
                                  </p>
                                </div>
                              </div>
                            )}

                            {canEditMembershipRow && isEditing && editingSubaccount && (
                              <div className="rounded-lg border bg-muted/20 p-4 space-y-4">
                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label>Nome</Label>
                                    <Input
                                      value={editingSubaccount.fullName}
                                      onChange={(event) => updateEditingSubaccountField("fullName", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Nome social</Label>
                                    <Input
                                      value={editingSubaccount.socialName}
                                      onChange={(event) => updateEditingSubaccountField("socialName", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>E-mail</Label>
                                    <Input
                                      type="email"
                                      value={editingSubaccount.email}
                                      onChange={(event) => updateEditingSubaccountField("email", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Data de nascimento</Label>
                                    <Input
                                      type="date"
                                      value={editingSubaccount.birthDate}
                                      onChange={(event) => updateEditingSubaccountField("birthDate", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>CPF</Label>
                                    <Input
                                      value={editingSubaccount.cpf}
                                      maxLength={14}
                                      onChange={(event) => updateEditingSubaccountField("cpf", formatCpf(event.target.value))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Número do conselho regional</Label>
                                    <Input
                                      value={editingSubaccount.professionalLicense}
                                      onChange={(event) => updateEditingSubaccountField("professionalLicense", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Telefone de contato</Label>
                                    <Input
                                      value={editingSubaccount.phone}
                                      maxLength={15}
                                      onChange={(event) => updateEditingSubaccountField("phone", formatPhone(event.target.value))}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Especialidade</Label>
                                    <Input
                                      value={editingSubaccount.specialty}
                                      onChange={(event) => updateEditingSubaccountField("specialty", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Cargo</Label>
                                    <Input
                                      value={editingSubaccount.jobTitle}
                                      onChange={(event) => updateEditingSubaccountField("jobTitle", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Hierarquia na plataforma</Label>
                                    <Select
                                      value={editingSubaccount.operationalRole}
                                      onValueChange={(value) => updateEditingSubaccountField("operationalRole", value as SubaccountOperationalRole)}
                                      disabled={!can("subaccounts_roles.manage")}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="admin">admin</SelectItem>
                                        <SelectItem value="professional">professional</SelectItem>
                                        <SelectItem value="assistant">assistant</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Status de atividade</Label>
                                    <Select
                                      value={editingSubaccount.membershipStatus}
                                      onValueChange={(value) => updateEditingSubaccountField("membershipStatus", value as MembershipRow["membership_status"])}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="active">Ativo</SelectItem>
                                        <SelectItem value="inactive">Inativo</SelectItem>
                                        <SelectItem value="suspended">Suspenso</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Resetar senha</Label>
                                    <Input
                                      type="text"
                                      value={editingSubaccount.resetPassword}
                                      placeholder="Deixe em branco para manter"
                                      onChange={(event) => updateEditingSubaccountField("resetPassword", event.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Horário de trabalho</Label>
                                  <Textarea
                                    value={editingSubaccount.workingHours}
                                    onChange={(event) => updateEditingSubaccountField("workingHours", event.target.value)}
                                    placeholder="Ex.: seg-sex 08h-18h; sábado 08h-12h"
                                  />
                                </div>
                                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                  <div className="space-y-2">
                                    <Label>CEP</Label>
                                    <Input
                                      value={editingSubaccount.address.cep}
                                      maxLength={9}
                                      onChange={(event) => updateEditingSubaccountAddressField("cep", formatCep(event.target.value))}
                                    />
                                  </div>
                                  <div className="space-y-2 xl:col-span-2">
                                    <Label>Rua</Label>
                                    <Input
                                      value={editingSubaccount.address.street}
                                      onChange={(event) => updateEditingSubaccountAddressField("street", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Número</Label>
                                    <Input
                                      value={editingSubaccount.address.number}
                                      onChange={(event) => updateEditingSubaccountAddressField("number", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Complemento</Label>
                                    <Input
                                      value={editingSubaccount.address.complement}
                                      onChange={(event) => updateEditingSubaccountAddressField("complement", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Bairro</Label>
                                    <Input
                                      value={editingSubaccount.address.neighborhood}
                                      onChange={(event) => updateEditingSubaccountAddressField("neighborhood", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Cidade</Label>
                                    <Input
                                      value={editingSubaccount.address.city}
                                      onChange={(event) => updateEditingSubaccountAddressField("city", event.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Estado</Label>
                                    <Input
                                      value={editingSubaccount.address.state}
                                      onChange={(event) => updateEditingSubaccountAddressField("state", event.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="ghost" onClick={cancelEditingSubaccount}>
                                    Cancelar
                                  </Button>
                                  <Button
                                    onClick={() => void handleSaveSubaccount(membershipRow)}
                                    disabled={
                                      savingMembershipId === membershipRow.id ||
                                      !editingSubaccount.fullName.trim() ||
                                      !editingSubaccount.email.trim()
                                    }
                                  >
                                    {savingMembershipId === membershipRow.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Salvar alterações
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === "billing" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Assinatura e pagamentos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Plano atual</p>
                  <p className="mt-2 text-lg font-semibold">{subscriptionPlan || "Não identificado"}</p>
                </div>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Esta área já está reservada para faturamento da assinatura. A capacidade está ligada ao `account_owner`.
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "treasury" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Tesouraria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  A área de tesouraria já está protegida pela nova capacidade `treasury.manage`. O detalhamento financeiro pode entrar na próxima etapa.
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "analytics" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Desenvolvimento da equipe</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Use um painel visual simples para acompanhar onboarding, evolução e sinais operacionais da equipe sem transformar esta área em um formulário longo.
                  </p>
                </CardHeader>
              </Card>

              {canReadTeamDevelopment && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Panorama da equipe</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                      <div className="rounded-xl border bg-background p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Ativos</p>
                        <p className="mt-2 text-2xl font-semibold">{teamDevelopmentSummary.activeTotal}</p>
                      </div>
                      <div className="rounded-xl border bg-background p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding</p>
                        <p className="mt-2 text-2xl font-semibold">{teamDevelopmentSummary.inOnboarding}</p>
                      </div>
                      <div className="rounded-xl border bg-background p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Precisam de atenção</p>
                        <p className="mt-2 text-2xl font-semibold">{teamDevelopmentSummary.needsAttention}</p>
                      </div>
                      <div className="rounded-xl border bg-background p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Em dia</p>
                        <p className="mt-2 text-2xl font-semibold">{teamDevelopmentSummary.onTrack}</p>
                      </div>
                      <div className="rounded-xl border bg-background p-4 shadow-sm">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Distribuição</p>
                        <p className="mt-2 text-sm font-medium">
                          {teamDevelopmentSummary.byRole.admin} admin • {teamDevelopmentSummary.byRole.professional} profissional • {teamDevelopmentSummary.byRole.assistant} assistente
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-medium">Pulso rápido da equipe</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Visão consolidada do estágio atual dos colaboradores ativos.
                          </p>
                        </div>
                        <Badge variant="outline">{teamDevelopmentSummary.activeTotal} colaborador(es)</Badge>
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-lg bg-background p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding</p>
                            <span className="text-sm font-semibold">{teamDevelopmentSummary.inOnboarding}</span>
                          </div>
                          <Progress
                            value={teamDevelopmentSummary.activeTotal > 0 ? (teamDevelopmentSummary.inOnboarding / teamDevelopmentSummary.activeTotal) * 100 : 0}
                            className="mt-3 h-2"
                          />
                        </div>
                        <div className="rounded-lg bg-background p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Precisam de atenção</p>
                            <span className="text-sm font-semibold">{teamDevelopmentSummary.needsAttention}</span>
                          </div>
                          <Progress
                            value={teamDevelopmentSummary.activeTotal > 0 ? (teamDevelopmentSummary.needsAttention / teamDevelopmentSummary.activeTotal) * 100 : 0}
                            className="mt-3 h-2"
                          />
                        </div>
                        <div className="rounded-lg bg-background p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Em dia</p>
                            <span className="text-sm font-semibold">{teamDevelopmentSummary.onTrack}</span>
                          </div>
                          <Progress
                            value={teamDevelopmentSummary.activeTotal > 0 ? (teamDevelopmentSummary.onTrack / teamDevelopmentSummary.activeTotal) * 100 : 0}
                            className="mt-3 h-2"
                          />
                        </div>
                        <div className="rounded-lg bg-background p-3 shadow-sm">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Admins ativos</p>
                            <span className="text-sm font-semibold">{teamDevelopmentSummary.byRole.admin}</span>
                          </div>
                          <Progress
                            value={teamDevelopmentSummary.activeTotal > 0 ? (teamDevelopmentSummary.byRole.admin / teamDevelopmentSummary.activeTotal) * 100 : 0}
                            className="mt-3 h-2"
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{canReadTeamDevelopment ? "Dashboard da equipe" : "Meu dashboard"}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Cada card mostra o estágio geral do colaborador, o andamento do onboarding e sinais operacionais simples dos últimos 30 dias.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {developmentRows.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhum registro de desenvolvimento encontrado para esta clínica.
                    </div>
                  ) : (
                    <div className="grid gap-4 xl:grid-cols-2">
                      {developmentRows.map((row) => {
                        const checklist = row.checklist;
                        const form = getTeamDevelopmentFormState(row.membership.user_id);
                        const statusMeta = getDevelopmentStatusMeta(form.developmentStatus);
                        const levelMeta = getDevelopmentLevelMeta(form.internalLevel);
                        const statusScore = getDevelopmentStatusScore(form.developmentStatus);
                        const dashboardTone = getDevelopmentDashboardTone(form.developmentStatus);
                        const onboardingPercent = Math.round((checklist.completedCount / checklist.totalCount) * 100);

                        return (
                          <div key={`dashboard-${row.membership.user_id}`} className="rounded-2xl border bg-background p-5 shadow-sm space-y-5">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                              <div>
                                <p className="font-semibold">{row.profile?.full_name || row.profile?.email || row.membership.user_id}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {OPERATIONAL_ROLE_LABELS[row.membership.operational_role]} • Último acesso: {formatLastSeenAt(row.profile?.last_seen_at ?? null)}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className={`${statusMeta.className} text-white border-transparent`}>
                                  {statusMeta.label}
                                </Badge>
                                <Badge variant="outline" className={`${levelMeta.className} text-white border-transparent`}>
                                  {levelMeta.label}
                                </Badge>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-xl border bg-muted/20 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding</p>
                                  <span className="text-sm font-semibold">{onboardingPercent}%</span>
                                </div>
                                <Progress value={onboardingPercent} className="mt-3 h-2" />
                                <p className="mt-3 text-sm text-muted-foreground">
                                  {checklist.completedCount} de {checklist.totalCount} checkpoint(s) concluído(s)
                                </p>
                              </div>

                              <div className="rounded-xl border bg-muted/20 p-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Evolução atual</p>
                                  <span className={`text-sm font-semibold ${DEVELOPMENT_DASHBOARD_TONE_CLASSNAMES[dashboardTone]}`}>
                                    {statusScore}%
                                  </span>
                                </div>
                                <Progress value={statusScore} className="mt-3 h-2" />
                                <p className="mt-3 text-sm text-muted-foreground">{statusMeta.label}</p>
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-lg border p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Criadas em 30 dias</p>
                                <p className="mt-2 text-2xl font-semibold">{row.operationalSignals.recentCreatedSessions}</p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Finalizadas em 30 dias</p>
                                <p className="mt-2 text-2xl font-semibold">{row.operationalSignals.recentFinalizedSessions}</p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Última revisão</p>
                                <p className="mt-2 font-medium">
                                  {form.lastReviewAt ? new Date(form.lastReviewAt).toLocaleDateString("pt-BR") : "Não registrada"}
                                </p>
                              </div>
                              <div className="rounded-lg border p-3">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Próxima revisão</p>
                                <p className="mt-2 font-medium">
                                  {form.nextReviewAt ? new Date(form.nextReviewAt).toLocaleDateString("pt-BR") : "Sem agenda"}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-medium">Checkpoints do onboarding</p>
                                <Badge variant="outline">{checklist.completedCount}/{checklist.totalCount}</Badge>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {checklist.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className={`rounded-lg border p-3 text-sm ${
                                      item.completed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border bg-background text-muted-foreground"
                                    }`}
                                  >
                                    <p className="font-medium">{item.label}</p>
                                    <p className="mt-1 text-xs uppercase tracking-wide">
                                      {item.completed ? "Concluído" : "Pendente"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {canReadTeamDevelopment && (
                              <div className="rounded-xl border border-dashed p-4 space-y-4">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div>
                                    <p className="font-medium">Atualização rápida</p>
                                    <p className="mt-1 text-sm text-muted-foreground">
                                      Somente o necessário para manter o dashboard atualizado.
                                    </p>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateTeamDevelopmentField(row.membership.user_id, "lastReviewAt", new Date().toISOString().slice(0, 10))}
                                  >
                                    Registrar revisão hoje
                                  </Button>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                  <div className="space-y-2">
                                    <Label>Status</Label>
                                    <Select
                                      value={form.developmentStatus}
                                      onValueChange={(value) => updateTeamDevelopmentField(row.membership.user_id, "developmentStatus", value as DevelopmentStatus)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {DEVELOPMENT_STATUS_OPTIONS.map((status) => (
                                          <SelectItem key={status} value={status}>
                                            {getDevelopmentStatusMeta(status).label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Nível</Label>
                                    <Select
                                      value={form.internalLevel}
                                      onValueChange={(value) => updateTeamDevelopmentField(row.membership.user_id, "internalLevel", value as DevelopmentLevel)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {DEVELOPMENT_LEVEL_OPTIONS.map((level) => (
                                          <SelectItem key={level} value={level}>
                                            {getDevelopmentLevelMeta(level).label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Próxima revisão</Label>
                                    <Input
                                      type="date"
                                      value={form.nextReviewAt}
                                      onChange={(event) => updateTeamDevelopmentField(row.membership.user_id, "nextReviewAt", event.target.value)}
                                    />
                                  </div>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="flex items-center justify-between gap-4">
                                      <div>
                                        <p className="font-medium">Fluxo interno lido</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Checkpoint rápido de adaptação operacional.</p>
                                      </div>
                                      <Switch
                                        checked={form.onboardingFlowRead}
                                        onCheckedChange={(checked) => updateTeamDevelopmentField(row.membership.user_id, "onboardingFlowRead", checked)}
                                      />
                                    </div>
                                  </div>
                                  <div className="rounded-lg bg-muted/30 p-3">
                                    <div className="flex items-center justify-between gap-4">
                                      <div>
                                        <p className="font-medium">Treinamento inicial</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Marca o onboarding base como concluído.</p>
                                      </div>
                                      <Switch
                                        checked={form.onboardingInitialTraining}
                                        onCheckedChange={(checked) => updateTeamDevelopmentField(row.membership.user_id, "onboardingInitialTraining", checked)}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center justify-end">
                                  <Button
                                    onClick={() => void handleSaveTeamDevelopment(row.membership.user_id)}
                                    disabled={savingTeamDevelopmentUserId === row.membership.user_id}
                                    size="sm"
                                  >
                                    {savingTeamDevelopmentUserId === row.membership.user_id ? (
                                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    ) : (
                                      <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Atualizar dashboard
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {activeSection === "security" && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Segurança</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Proteja sua conta, acompanhe as sessões abertas e revise eventos sensíveis sem misturar isso com dados cadastrais ou gestão de subcontas.
                  </p>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <KeyRound className="h-5 w-5" />
                    Acesso da minha conta
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">E-mail de acesso</p>
                      <p className="mt-2 font-medium break-all">{ownProfileForm.email || user?.email || "Não informado"}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Último acesso</p>
                      <p className="mt-2 font-medium">{formatLastSeenAt(profile?.last_seen_at ?? null)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Última troca de senha</p>
                      <p className="mt-2 font-medium">{formatSecurityEventTimestamp(profile?.last_password_changed_at ?? null)}</p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Status da senha</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={SECURITY_TONE_BADGE_CLASSNAMES[ownSecurityPosture.tone]}>
                          {ownSecurityPosture.label}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{ownSecurityPosture.description}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-4">
                    <div>
                      <p className="font-medium">Alterar senha</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        A troca de senha fica centralizada aqui para manter a parte de segurança separada do cadastro do perfil.
                      </p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Nova senha</Label>
                        <Input
                          type="password"
                          placeholder="Mínimo de 6 caracteres"
                          value={securityPassword}
                          onChange={(event) => setSecurityPassword(event.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Confirmar nova senha</Label>
                        <Input
                          type="password"
                          placeholder="Repita a nova senha"
                          value={securityPasswordConfirm}
                          onChange={(event) => setSecurityPasswordConfirm(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <p className="text-sm text-muted-foreground">
                        Se esta conta estiver com senha provisória, a troca aqui passa a marcar a senha como definitiva.
                      </p>
                      <Button
                        onClick={() => void handleChangeSecurityPassword()}
                        disabled={savingSecurityPassword || !securityPassword.trim() || !securityPasswordConfirm.trim()}
                      >
                        {savingSecurityPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Atualizar senha
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Laptop className="h-5 w-5" />
                    Sessões e dispositivos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-medium">Sessão atual</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {currentSecuritySession?.device_label || `${localDeviceInfo.browser} • ${localDeviceInfo.platform}`}
                        </p>
                      </div>
                      <Badge variant="outline">Ativa neste dispositivo</Badge>
                    </div>
                    <div className="mt-4 grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Navegador</p>
                        <p className="mt-2 font-medium">{currentSecuritySession?.browser || localDeviceInfo.browser}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Plataforma</p>
                        <p className="mt-2 font-medium">{currentSecuritySession?.platform || localDeviceInfo.platform}</p>
                      </div>
                      <div className="rounded-lg bg-muted/30 p-3">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Última atividade</p>
                        <p className="mt-2 font-medium">
                          {formatSecurityEventTimestamp(currentSecuritySession?.last_seen_at ?? profile?.last_seen_at ?? null)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <p className="font-medium">Outras sessões abertas</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Lista resumida das outras sessões registradas para esta conta.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => void handleEndOtherSessions()}
                        disabled={endingOtherSessions || otherSecuritySessions.length === 0}
                      >
                        {endingOtherSessions ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
                        Encerrar outras sessões
                      </Button>
                    </div>

                    {otherSecuritySessions.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        Nenhuma outra sessão ativa registrada no momento.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {otherSecuritySessions.map((securitySession) => (
                          <div key={securitySession.id} className="rounded-lg border p-3">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                              <div>
                                <p className="font-medium">{securitySession.device_label || "Sessão sem identificação"}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {(securitySession.browser || "Navegador")} • {(securitySession.platform || "Dispositivo")}
                                </p>
                              </div>
                              <Badge variant="outline">Outra sessão</Badge>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">
                              Última atividade: {formatSecurityEventTimestamp(securitySession.last_seen_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BellRing className="h-5 w-5" />
                    Alertas e proteções
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    {[
                      {
                        description: "Avise por e-mail quando a senha desta conta for alterada.",
                        key: "alertPasswordChanged" as const,
                        title: "Alerta ao trocar senha",
                      },
                      {
                        description: "Avise quando uma nova sessão relevante for registrada nesta conta.",
                        key: "alertNewLogin" as const,
                        title: "Alerta de novo login",
                      },
                      {
                        description: "Avise quando as outras sessões forem encerradas por esta conta.",
                        key: "alertOtherSessionsEnded" as const,
                        title: "Alerta ao encerrar outras sessões",
                      },
                      {
                        description: "Avise sobre mudanças críticas de acesso no plano clinic, quando aplicável.",
                        key: "alertAccessChange" as const,
                        title: "Alerta de mudança de acesso",
                      },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-4 rounded-lg border p-4">
                        <div>
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                        </div>
                        <Switch
                          checked={securitySettings[item.key]}
                          onCheckedChange={(checked) =>
                            setSecuritySettings((current) => ({
                              ...current,
                              [item.key]: checked,
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-end">
                    <Button onClick={() => void handleSaveSecurityAlerts()} disabled={savingSecuritySettings}>
                      {savingSecuritySettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar alertas
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock3 className="h-5 w-5" />
                    Histórico de eventos sensíveis
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {securityEvents.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhum evento de segurança registrado para esta conta até agora.
                    </div>
                  ) : (
                    securityEvents.map((eventRow) => {
                      const eventMeta = getSecurityEventMeta(eventRow.event_type);
                      return (
                        <div key={eventRow.id} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium">{eventMeta.label}</p>
                                <Badge variant="outline" className={SECURITY_TONE_BADGE_CLASSNAMES[eventMeta.tone]}>
                                  {eventMeta.tone === "admin" ? "Administrativo" : "Conta"}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{eventMeta.description}</p>
                            </div>
                            <p className="text-sm text-muted-foreground">{formatSecurityEventTimestamp(eventRow.created_at)}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {canViewAdminSecurity && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Visão administrativa de segurança
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Equipe monitorada</p>
                        <p className="mt-2 text-2xl font-semibold">{teamSecurityRows.length}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Senhas provisórias</p>
                        <p className="mt-2 text-2xl font-semibold">{temporaryPasswordCount}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Acessos desatualizados</p>
                        <p className="mt-2 text-2xl font-semibold">{staleTeamSecurityCount}</p>
                      </div>
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <div>
                        <p className="font-medium">Sinais de atenção na equipe</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Esta área é apenas de observação. A gestão de subcontas continua em `Colaboradores e acessos`.
                        </p>
                      </div>
                      {teamSecurityRows.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Nenhum colaborador encontrado para esta clínica.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {teamSecurityRows.map((row) => (
                            <div key={row.membership.id} className="rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                  <p className="font-medium">{row.profile?.full_name || row.profile?.email || row.membership.user_id}</p>
                                  <p className="mt-1 text-sm text-muted-foreground">
                                    {OPERATIONAL_ROLE_LABELS[row.membership.operational_role]} • Último acesso: {formatLastSeenAt(row.profile?.last_seen_at ?? null)}
                                  </p>
                                </div>
                                <Badge variant="outline" className={SECURITY_TONE_BADGE_CLASSNAMES[row.posture.tone]}>
                                  {row.posture.label}
                                </Badge>
                              </div>
                              <p className="mt-3 text-sm text-muted-foreground">{row.posture.description}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg border p-4 space-y-3">
                      <div>
                        <p className="font-medium">Eventos administrativos recentes</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Eventos críticos ligados a acessos e contas da equipe.
                        </p>
                      </div>
                      {adminSecurityEvents.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                          Nenhum evento administrativo de segurança registrado até agora.
                        </div>
                      ) : (
                        adminSecurityEvents.map((eventRow) => {
                          const eventMeta = getSecurityEventMeta(eventRow.event_type);
                          const actorProfile = eventRow.actor_user_id ? profileMap.get(eventRow.actor_user_id) : null;
                          const targetProfile = eventRow.target_user_id ? profileMap.get(eventRow.target_user_id) : null;

                          return (
                            <div key={eventRow.id} className="rounded-lg border p-3">
                              <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium">{eventMeta.label}</p>
                                    <Badge variant="outline" className={SECURITY_TONE_BADGE_CLASSNAMES[eventMeta.tone]}>
                                      Administrativo
                                    </Badge>
                                  </div>
                                  <p className="mt-1 text-sm text-muted-foreground">{eventMeta.description}</p>
                                  <p className="mt-2 text-sm text-muted-foreground">
                                    {actorProfile?.full_name || actorProfile?.email || "Conta da clínica"}
                                    {targetProfile ? ` → ${targetProfile.full_name || targetProfile.email || targetProfile.id}` : ""}
                                  </p>
                                </div>
                                <p className="text-sm text-muted-foreground">{formatSecurityEventTimestamp(eventRow.created_at)}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {activeSection === "signout" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">Sair da conta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Encerre a sessão atual neste dispositivo. Você precisará fazer login novamente para acessar a clínica.
                </p>
                <Button variant="destructive" onClick={() => void signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair agora
                </Button>
              </CardContent>
            </Card>
          )}

          {activeSection === "forms" && (
            <>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">Gerenciar formulários</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Edite o bloco-base universal da anamnese e mantenha as fichas extras usadas nos atendimentos.
                  </p>
                </div>
                <Button onClick={() => navigate("/configuracoes/formularios/novo")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova ficha
                </Button>
              </div>

              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="text-base">Bloco padrão universal</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Esta é a primeira parte obrigatória da anamnese, aplicada em todas as fichas da clínica.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes/formularios/base")}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar bloco padrão
                  </Button>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Campos</p>
                    <p className="mt-2 text-2xl font-semibold">{countTemplateQuestionFields(baseSchema)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Seções</p>
                    <p className="mt-2 text-2xl font-semibold">{countTemplateSections(baseSchema)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Uso</p>
                    <p className="mt-2 text-sm font-medium">Sempre incluído antes da ficha extra</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Fichas extras
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {templates.length === 0 && (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Nenhuma ficha criada ainda.
                    </div>
                  )}
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedTemplate?.id === template.id ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                      }`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm">{template.name}</span>
                        <Badge variant="outline">{sessions.filter((session) => session.anamnesis_template_id === template.id).length} usos</Badge>
                      </div>
                      {template.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                      )}
                    </button>
                  ))}
                </CardContent>
              </Card>

              {selectedTemplate ? (
                <>
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                      <div>
                        <CardTitle className="text-xl">{selectedTemplate.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedTemplate.description || "Sem descrição cadastrada."}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/configuracoes/formularios/${selectedTemplate.id}`)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => void handleDeleteTemplate(selectedTemplate)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-4">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Usos</p>
                        <p className="mt-2 text-2xl font-semibold">{selectedStats.totalUses}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Campos</p>
                        <p className="mt-2 text-2xl font-semibold">{selectedStats.fieldCount}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Seções</p>
                        <p className="mt-2 text-2xl font-semibold">{selectedStats.sectionCount}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Último uso</p>
                        <p className="mt-2 text-sm font-medium">
                          {selectedStats.lastUsedAt ? new Date(selectedStats.lastUsedAt).toLocaleDateString("pt-BR") : "Ainda não usada"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Estrutura da ficha
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedSchema.map((field) => (
                        <div key={field.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-sm">{field.label}</p>
                              <p className="text-xs text-muted-foreground">
                                {ANAMNESIS_FIELD_LIBRARY.find((item) => item.type === field.type)?.label || field.type}
                              </p>
                            </div>
                            {field.sectionKey && <Badge variant="secondary">{field.sectionKey}</Badge>}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card className="p-8 text-center text-muted-foreground">
                  Nenhuma ficha disponível ainda. Use o botão acima para criar a primeira ficha.
                </Card>
              )}
            </>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 lg:hidden">
        <div className="mx-auto max-w-screen-sm px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
          {mobileDescriptionSection && (
            <div className="mb-2 rounded-lg border bg-card px-3 py-2 shadow-sm">
              <p className="text-xs font-medium">{availableSections.find((item) => item.id === mobileDescriptionSection)?.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {availableSections.find((item) => item.id === mobileDescriptionSection)?.description}
              </p>
            </div>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {availableSections.map((item) => {
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={`flex min-w-[88px] shrink-0 snap-start flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-colors ${
                    isActive ? "border-primary bg-primary/8 text-primary" : "bg-background text-muted-foreground"
                  }`}
                  onPointerDown={() => {
                    mobileLongPressTriggeredRef.current = false;
                    clearMobileLongPress();
                    mobileLongPressTimerRef.current = window.setTimeout(() => {
                      mobileLongPressTriggeredRef.current = true;
                      showMobileDescription(item.id);
                    }, 450);
                  }}
                  onPointerUp={clearMobileLongPress}
                  onPointerLeave={clearMobileLongPress}
                  onPointerCancel={clearMobileLongPress}
                  onClick={() => {
                    if (mobileLongPressTriggeredRef.current) {
                      mobileLongPressTriggeredRef.current = false;
                      return;
                    }

                    setMobileDescriptionSection(null);
                    setActiveSection(item.id);
                  }}
                >
                  <item.icon className="h-4 w-4" />
                  <span className="mt-1 text-[11px] font-medium leading-tight">{item.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default Configuracoes;
