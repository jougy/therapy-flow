import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Award, ShieldCheck } from "lucide-react";
import { useAuth, type AccessibleClinic } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartConfig } from "@/components/ui/chart";
import { TermsUpdatePromptModal } from "@/components/TermsUpdatePromptModal";
import { PersonalClinicalPortfolioTab } from "@/components/personal/PersonalClinicalPortfolioTab";
import { PersonalWelcomeModal } from "@/components/personal/PersonalWelcomeModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getClinicBrandName } from "@/lib/clinic-settings";
import { logRuntimeError } from "@/lib/runtime-debug";
import { getSignupIntent, clearSignupIntent } from "@/lib/signup-intent";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import {
  type PersonalSection,
  type ReleaseNoteCategory,
  type AttendanceRange,
  type ReleaseNote,
  type ReleaseNoteItem,
  type DashboardSession,
  type DashboardGroup,
  type AttendanceBucket,
  type GroupCount,
  type ClinicInvitation,
  type ClinicSubscriptionSummary,
  sectionItems,
  categoryOrder,
  monthLabels,
  dashboardChartColors,
  isReleaseNoteCategory,
  getInitials,
  toLocalDay,
  getStartOfWeek,
  addDays,
  getDayKey,
  getMonthKey,
  formatShortDay,
  isCompletedAttendance,
  PersonalHeader,
  PersonalDesktopNav,
  PersonalMobileNav,
  PersonalDashboardTab,
  PersonalNewsTab,
  ClinicInvitationsList,
  ClinicSelectionList,
} from "./selecionar-clinica";

const SelecionarClinica = () => {
  const { accessibleClinics, isPlatformOwner, loading: authLoading, profile, refreshAuthState, selectClinic, signOut, user } = useAuth();
  const { isFeatureEnabled } = useFeatureFlags();
  const isPortfolioEnabled = isFeatureEnabled("clinical_portfolio_enabled");
  const hasEnterpriseAccess = Boolean(
    isPlatformOwner || accessibleClinics.some((c) => c.clinic.subscription_plan === "enterprise")
  );
  const location = useLocation();
  const navigate = useNavigate();
  const isDesignLabRoute = location.pathname.startsWith("/designlab") || location.pathname.startsWith("/designlabs");
  const [selectingClinicId, setSelectingClinicId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<PersonalSection>("clinics");
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
  const [loadingReleaseNotes, setLoadingReleaseNotes] = useState(false);
  const [isReleaseEditorOpen, setIsReleaseEditorOpen] = useState(false);
  const [activeReleaseCategory, setActiveReleaseCategory] = useState<ReleaseNoteCategory>("added");
  const [dashboardSessions, setDashboardSessions] = useState<DashboardSession[]>([]);
  const [dashboardGroups, setDashboardGroups] = useState<DashboardGroup[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [attendanceRange, setAttendanceRange] = useState<AttendanceRange>("week");
  const [clinicInvitations, setClinicInvitations] = useState<ClinicInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [actingInvitationId, setActingInvitationId] = useState<string | null>(null);
  const [decliningInvitation, setDecliningInvitation] = useState<ClinicInvitation | null>(null);
  const [leavingClinicId, setLeavingClinicId] = useState<string | null>(null);
  const [clinicSubscriptions, setClinicSubscriptions] = useState<Record<string, ClinicSubscriptionSummary>>({});
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false);
  const [mobileDockPressedSection, setMobileDockPressedSection] = useState<PersonalSection | null>(null);
  const [mobileDockPointerActive, setMobileDockPointerActive] = useState(false);
  const [mobileDockTooltip, setMobileDockTooltip] = useState<{ title: string; x: number } | null>(null);
  const mobileDockScrollResetTimerRef = useRef<number | null>(null);
  const hasAttemptedReconciliation = useRef(false);

  const displayName = profile?.full_name || profile?.email || user?.email || "Usuário";
  const initials = getInitials(displayName || "U");

  // Fallback if portfolio feature flag is disabled
  useEffect(() => {
    if (!isPortfolioEnabled && activeSection === "portfolio") {
      setActiveSection("clinics");
    }
  }, [isPortfolioEnabled, activeSection]);

  const visibleSectionItems = useMemo(() => {
    return isPortfolioEnabled
      ? sectionItems
      : sectionItems.filter((item) => item.value !== "portfolio");
  }, [isPortfolioEnabled]);

  useEffect(() => {
    if (!user?.id) {
      setClinicInvitations([]);
      return;
    }

    let cancelled = false;

    const fetchInvitations = async () => {
      if (typeof supabase.rpc !== "function") {
        setClinicInvitations([]);
        return;
      }

      setLoadingInvitations(true);
      const { data, error } = await supabase.rpc("list_current_user_clinic_invitations");

      if (cancelled) {
        return;
      }

      setLoadingInvitations(false);

      if (error) {
        logRuntimeError("personal_space.clinic_invitations", error, { userId: user.id });
        setClinicInvitations([]);
        return;
      }

      setClinicInvitations((data ?? []) as ClinicInvitation[]);
    };

    void fetchInvitations();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const clinicIds = accessibleClinics.map((option) => option.clinic.id).filter(Boolean);
    if (clinicIds.length === 0) {
      setClinicSubscriptions({});
      return;
    }

    let cancelled = false;

    const fetchSubscriptions = async () => {
      try {
        const { data, error } = await supabase
          .from("clinic_subscriptions")
          .select("clinic_id, status, trial_ends_at, is_free_trial, expires_at, current_period_end")
          .in("clinic_id", clinicIds);

        if (cancelled || error || !data) {
          return;
        }

        const map: Record<string, ClinicSubscriptionSummary> = {};
        for (const sub of data) {
          if (sub.clinic_id) {
            map[sub.clinic_id] = {
              status: sub.status ?? "",
              trial_ends_at: sub.trial_ends_at ?? null,
              is_free_trial: sub.is_free_trial ?? null,
              expires_at: sub.expires_at ?? null,
              current_period_end: sub.current_period_end ?? null,
            };
          }
        }
        setClinicSubscriptions(map);
      } catch {
        // Silently continue with clinicOption fallbacks
      }
    };

    void fetchSubscriptions();

    return () => {
      cancelled = true;
    };
  }, [accessibleClinics]);

  // Auto-healing: Tentar auto-aceitar convites pendentes por e-mail (mesmo que o usuário já tenha consultório próprio) e, se não tiver nenhuma clínica, reconciliar consultório solo
  useEffect(() => {
    if (authLoading || !user?.id || isPlatformOwner) return;
    if (hasAttemptedReconciliation.current) return;

    let isSubscribed = true;
    const autoHealingFlow = async () => {
      try {
        hasAttemptedReconciliation.current = true;

        // 1. Sempre tentar auto-aceitar convite pendente emitido para o e-mail deste usuário
        const { data: inviteRows } = await supabase.rpc(
          "auto_accept_pending_clinic_invitation_for_current_user" as never
        ) as { data: Array<{ invitation_id?: string; clinic_id?: string }> | { accepted?: boolean; clinic_id?: string } | null };

        const acceptedInvite = Array.isArray(inviteRows)
          ? inviteRows.length > 0
          : Boolean(inviteRows && "accepted" in inviteRows && inviteRows.accepted);

        if (acceptedInvite && isSubscribed) {
          toast({
            title: "Convite de clínica ativado!",
            description: "Identificamos um convite pendente para sua conta e ativamos seu acesso automaticamente.",
          });
          await refreshAuthState();
          return;
        }

        // 2. Se já possui clínicas acessíveis, não precisa provisionar consultório solo legado
        if (accessibleClinics && accessibleClinics.length > 0) {
          return;
        }

        // 3. Se não houver nenhuma clínica acessível, reconciliar consultório solo gratuito
        const { data, error } = await supabase.rpc("reconcile_legacy_users_solo_clinic");
        if (!error && data && data > 0 && isSubscribed) {
          console.info(`[SoloClinic] Auto-provisioned solo clinic (${data}) for user.`);
          await refreshAuthState();
        }
      } catch {
        // Ignora silenciosamente caso as RPCs ainda não existam no schema remoto
      }
    };

    const timer = setTimeout(() => {
      void autoHealingFlow();
    }, 600);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [accessibleClinics, authLoading, isPlatformOwner, refreshAuthState, user?.id]);

  // Processar intenção de cadastro vinda da Landing Page (plurifisio.com.br) ou login externo
  useEffect(() => {
    if (!accessibleClinics || accessibleClinics.length === 0) return;

    const intent = getSignupIntent();
    if (!intent) return;

    // Buscar a clínica solo / de propriedade do usuário autenticado
    const ownedClinic =
      accessibleClinics.find(
        (opt) =>
          (opt.membership.account_role === "account_owner" || opt.membership.operational_role === "owner") &&
          opt.clinic.account_owner_user_id === user?.id
      ) ||
      accessibleClinics.find(
        (opt) => opt.membership.account_role === "account_owner" || opt.membership.operational_role === "owner"
      ) ||
      accessibleClinics[0];

    if (!ownedClinic?.clinic?.id) return;

    const targetClinicId = ownedClinic.clinic.id;
    const isClinicTeamPlan =
      intent.plan === "clinica_basico" ||
      intent.plan === "clinica_medio" ||
      intent.plan === "clinica_top" ||
      intent.plan === "clinic" ||
      intent.plan === "enterprise";

    // 1. Se intenção for Teste Gratuito de 7 dias
    if (intent.trial) {
      const sub = clinicSubscriptions[targetClinicId];
      const hasUsedTrial = sub?.is_free_trial || sub?.status === "trial_expired" || ownedClinic.clinic.subscription_status === "trial_expired";

      clearSignupIntent();

      if (hasUsedTrial) {
        toast({
          title: "Período de teste já utilizado",
          description: "Sua conta já utilizou o período de teste gratuito de 7 dias. Conheça nossos planos para continuar aproveitando todos os recursos.",
        });
        navigate(`/planos?clinicId=${targetClinicId}`, { replace: true });
        return;
      }

      toast({
        title: "Teste gratuito de 7 dias ativo",
        description: "Bem-vindo ao seu Consultório Pessoal! Aproveite seus 7 dias gratuitos.",
      });
      return;
    }

    // 2. Se intenção for Plano de Clínica com Equipe -> Onboarding de Upgrade
    if (isClinicTeamPlan) {
      clearSignupIntent();
      const params = new URLSearchParams();
      params.set("mode", "upgrade");
      params.set("clinicId", targetClinicId);
      if (intent.plan) params.set("plan", intent.plan);
      if (intent.cycle) params.set("cycle", intent.cycle);
      if (intent.coupon) params.set("coupon", intent.coupon);

      navigate(`/onboarding-clinica?${params.toString()}`, { replace: true });
      return;
    }

    // 3. Se intenção for Plano Profissional Solo -> Direto para Checkout da Clínica Solo
    if (intent.plan) {
      clearSignupIntent();
      const params = new URLSearchParams();
      params.set("plan", intent.plan);
      params.set("cycle", intent.cycle || "annual");
      if (intent.coupon) params.set("coupon", intent.coupon);

      navigate(`/pagamento/${targetClinicId}?${params.toString()}`, { replace: true });
      return;
    }
  }, [accessibleClinics, clinicSubscriptions, navigate, user?.id]);

  const handleAcceptInvitation = async (invitationId: string) => {
    setActingInvitationId(invitationId);
    const { error } = await supabase.rpc("accept_current_user_clinic_invitation", {
      _invitation_id: invitationId,
    });

    if (error) {
      toast({ title: "Erro ao aceitar convite", description: error.message, variant: "destructive" });
      setActingInvitationId(null);
      return;
    }

    toast({ title: "Convite aceito", description: "O acesso da clínica foi liberado no seu espaço pessoal." });
    const acceptedInvitation = clinicInvitations.find((invite) => invite.invitation_id === invitationId);
    setClinicInvitations((current) => current.filter((invite) => invite.invitation_id !== invitationId));
    await refreshAuthState();
    if (acceptedInvitation?.clinic_route_key) {
      await supabase.rpc("set_current_user_active_clinic_by_route_key", {
        _route_key: acceptedInvitation.clinic_route_key,
      });
      navigate(`/clinica/${acceptedInvitation.clinic_route_key}`);
    }
    setActingInvitationId(null);
  };

  const handleDeclineInvitation = async (invitationId: string) => {
    setActingInvitationId(invitationId);
    const { error } = await supabase.rpc("decline_current_user_clinic_invitation", {
      _invitation_id: invitationId,
    });

    if (error) {
      toast({ title: "Erro ao recusar convite", description: error.message, variant: "destructive" });
      setActingInvitationId(null);
      return;
    }

    toast({ title: "Convite recusado", description: "Removemos o convite da sua lista." });
    setClinicInvitations((current) => current.filter((invite) => invite.invitation_id !== invitationId));
    setActingInvitationId(null);
  };

  useEffect(() => {
    if (activeSection === "settings") {
      navigate(`${isDesignLabRoute ? "/designlab" : ""}/configuracoes/pessoal/perfil`);
    }
  }, [activeSection, isDesignLabRoute, navigate]);

  const fetchReleaseNotes = useCallback(async () => {
    setLoadingReleaseNotes(true);

    const [{ data: releasesData, error: releasesError }, { data: itemsData, error: itemsError }] = await Promise.all([
      supabase
        .from("platform_releases")
        .select("id, version, version_order, title, summary, published_at")
        .eq("is_active", true)
        .order("version_order", { ascending: false })
        .limit(12),
      supabase
        .from("platform_release_note_items")
        .select("id, release_id, category, title, body, sort_order")
        .order("sort_order", { ascending: true }),
    ]);

    setLoadingReleaseNotes(false);

    if (releasesError || itemsError) {
      logRuntimeError("personal_space.release_notes", releasesError ?? itemsError, { userId: user?.id });
      return;
    }

    const items = (itemsData ?? []).filter((item): item is ReleaseNoteItem => isReleaseNoteCategory(item.category));
    const nextReleaseNotes = (releasesData ?? []).map((release) => ({
      ...release,
      items: items.filter((item) => item.release_id === release.id),
    }));

    setReleaseNotes(nextReleaseNotes);

    const firstCategoryWithItems =
      categoryOrder.find((category) => nextReleaseNotes.some((release) => release.items.some((item) => item.category === category))) ?? "added";
    setActiveReleaseCategory(firstCategoryWithItems);
  }, [user?.id]);

  useEffect(() => {
    if (activeSection !== "news") {
      return;
    }

    void fetchReleaseNotes();
  }, [activeSection, fetchReleaseNotes]);

  useEffect(() => {
    if (activeSection !== "dashboard") {
      return;
    }

    const clinicIds = accessibleClinics.map((option) => option.clinic.id);

    if (clinicIds.length === 0) {
      setDashboardSessions([]);
      setDashboardGroups([]);
      return;
    }

    let cancelled = false;

    const fetchDashboardData = async () => {
      setLoadingDashboard(true);

      const [{ data: sessionsData, error: sessionsError }, { data: groupsData, error: groupsError }] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, clinic_id, patient_id, group_id, session_date, status")
          .in("clinic_id", clinicIds)
          .order("session_date", { ascending: false })
          .limit(5000),
        supabase
          .from("patient_groups")
          .select("id, name, color")
          .in("clinic_id", clinicIds),
      ]);

      if (cancelled) {
        return;
      }

      setLoadingDashboard(false);

      if (sessionsError || groupsError) {
        logRuntimeError("personal_space.dashboard", sessionsError ?? groupsError, { clinicIds, userId: user?.id });
        setDashboardSessions([]);
        setDashboardGroups([]);
        return;
      }

      setDashboardSessions((sessionsData ?? []) as DashboardSession[]);
      setDashboardGroups((groupsData ?? []) as DashboardGroup[]);
    };

    void fetchDashboardData();

    return () => {
      cancelled = true;
    };
  }, [accessibleClinics, activeSection, user?.id]);

  const releaseItemsByCategory = useMemo(() => {
    const grouped = Object.fromEntries(categoryOrder.map((category) => [category, []])) as Record<
      ReleaseNoteCategory,
      Array<ReleaseNoteItem & { release: ReleaseNote }>
    >;

    for (const release of releaseNotes) {
      for (const item of release.items) {
        grouped[item.category].push({ ...item, release });
      }
    }

    return grouped;
  }, [releaseNotes]);

  const dashboardData = useMemo(() => {
    const completedSessions = dashboardSessions.filter(isCompletedAttendance);
    const groupById = new Map(dashboardGroups.map((group) => [group.id, group]));
    const attendedPatientIds = new Set(completedSessions.map((session) => session.patient_id));
    const now = new Date();

    const buildAttendanceBuckets = (): AttendanceBucket[] => {
      if (attendanceRange === "week") {
        const start = getStartOfWeek(now);
        const buckets = Array.from({ length: 7 }, (_, index) => {
          const date = addDays(start, index);
          return {
            atendimentos: 0,
            key: getDayKey(date),
            label: formatShortDay(date),
          };
        });
        const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

        for (const session of completedSessions) {
          const bucket = bucketByKey.get(getDayKey(toLocalDay(session.session_date)));
          if (bucket) bucket.atendimentos += 1;
        }

        return buckets;
      }

      if (attendanceRange === "month") {
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const buckets = Array.from({ length: daysInMonth }, (_, index) => {
          const date = new Date(now.getFullYear(), now.getMonth(), index + 1);
          return {
            atendimentos: 0,
            key: getDayKey(date),
            label: String(index + 1).padStart(2, "0"),
          };
        });
        const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

        for (const session of completedSessions) {
          const sessionDay = toLocalDay(session.session_date);
          if (sessionDay.getFullYear() !== now.getFullYear() || sessionDay.getMonth() !== now.getMonth()) continue;

          const bucket = bucketByKey.get(getDayKey(sessionDay));
          if (bucket) bucket.atendimentos += 1;
        }

        return buckets;
      }

      const buckets = monthLabels.map((label, monthIndex) => ({
        atendimentos: 0,
        key: `${now.getFullYear()}-${String(monthIndex + 1).padStart(2, "0")}`,
        label,
      }));
      const bucketByKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

      for (const session of completedSessions) {
        const sessionDay = toLocalDay(session.session_date);
        if (sessionDay.getFullYear() !== now.getFullYear()) continue;

        const bucket = bucketByKey.get(getMonthKey(sessionDay));
        if (bucket) bucket.atendimentos += 1;
      }

      return buckets;
    };

    const groupCountsById = new Map<string, GroupCount>();

    for (const session of completedSessions) {
      const group = session.group_id ? groupById.get(session.group_id) : null;
      const id = group?.id ?? "sem-grupo";
      const current = groupCountsById.get(id) ?? {
        color: dashboardChartColors[groupCountsById.size % dashboardChartColors.length],
        id,
        key: `grupo_${groupCountsById.size}`,
        name: group?.name ?? "Sem grupo",
        total: 0,
      };
      current.total += 1;
      groupCountsById.set(id, current);
    }

    const topGroups = [...groupCountsById.values()].sort((left, right) => right.total - left.total).slice(0, 5);
    const topGroupIdSet = new Set(topGroups.map((group) => group.id));
    const currentMonthSessions = completedSessions.filter((session) => {
      const date = toLocalDay(session.session_date);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    });
    const weeksInMonth = Math.ceil(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() / 7);
    const groupWeeks = Array.from({ length: weeksInMonth }, (_, index) => {
      const row: Record<string, number | string> = {
        label: `Semana ${index + 1}`,
      };

      for (const group of topGroups) {
        row[group.key] = 0;
      }

      return row;
    });

    for (const session of currentMonthSessions) {
      const group = session.group_id ? groupById.get(session.group_id) : null;
      const groupId = group?.id ?? "sem-grupo";
      if (!topGroupIdSet.has(groupId)) continue;

      const topGroup = topGroups.find((item) => item.id === groupId);
      if (!topGroup) continue;

      const weekIndex = Math.floor((toLocalDay(session.session_date).getDate() - 1) / 7);
      groupWeeks[weekIndex][topGroup.key] = Number(groupWeeks[weekIndex][topGroup.key] ?? 0) + 1;
    }

    const groupChartConfig = Object.fromEntries(
      topGroups.map((group) => [
        group.key,
        {
          color: group.color ?? undefined,
          label: group.name,
        },
      ]),
    ) satisfies ChartConfig;

    return {
      attendanceBuckets: buildAttendanceBuckets(),
      completedSessions,
      groupChartConfig,
      groupWeeks,
      topGroups,
      totalAttendedPatients: attendedPatientIds.size,
      totalAttendances: completedSessions.length,
    };
  }, [attendanceRange, dashboardGroups, dashboardSessions]);

  // Ordenação inteligente das clínicas:
  // 1. Clínicas pagas / ativas ou convidadas de terceiros com atendimento regular têm maior destaque
  // 2. Clínicas solo de teste gratuito (trial) sem personalização têm menor destaque (ao final da lista)
  const sortedAccessibleClinics = useMemo(() => {
    return [...accessibleClinics].sort((a, b) => {
      const subA = clinicSubscriptions[a.clinic.id];
      const subB = clinicSubscriptions[b.clinic.id];

      const isTrialA = subA?.is_free_trial || a.clinic.subscription_status === "trialing" || a.clinic.subscription_status === "TRIAL";
      const isTrialB = subB?.is_free_trial || b.clinic.subscription_status === "trialing" || b.clinic.subscription_status === "TRIAL";

      const isOwnerA = a.membership.account_role === "account_owner" || a.membership.operational_role === "owner";
      const isOwnerB = b.membership.account_role === "account_owner" || b.membership.operational_role === "owner";

      // Se uma for paga/convite e outra for trial solo, a não-trial vem primeiro
      if (!isTrialA && isTrialB) return -1;
      if (isTrialA && !isTrialB) return 1;

      // Se ambas forem pagas ou ambas forem trial, clínicas onde é colaborador/convidado com equipe têm prioridade de uso
      if (!isOwnerA && isOwnerB) return -1;
      if (isOwnerA && !isOwnerB) return 1;

      return a.clinic.name.localeCompare(b.clinic.name);
    });
  }, [accessibleClinics, clinicSubscriptions]);

  const handleSelectClinic = async (clinicId: string) => {
    setSelectingClinicId(clinicId);

    try {
      await selectClinic(clinicId);
      const selectedClinic = accessibleClinics.find((option) => option.clinic.id === clinicId);
      navigate(`/clinica/${selectedClinic?.clinic.route_key ?? clinicId}`, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Não foi possível entrar nesta clínica.";
      toast({
        title: "Acesso indisponível",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSelectingClinicId(null);
    }
  };

  const handleLeaveClinic = async (clinicOption: AccessibleClinic) => {
    setLeavingClinicId(clinicOption.clinic.id);
    const { error } = await supabase.rpc("leave_current_user_clinic", {
      _clinic_id: clinicOption.clinic.id,
    });

    if (error) {
      toast({ title: "Erro ao sair da clínica", description: error.message, variant: "destructive" });
      setLeavingClinicId(null);
      return;
    }

    toast({
      title: "Acesso removido",
      description: `Você saiu de ${getClinicBrandName(clinicOption.clinic.name)}. Seus dados pessoais continuam no seu espaço pessoal.`,
    });
    setLeavingClinicId(null);
    await refreshAuthState();
  };

  const handleCreateClinicFromEmpty = useCallback(() => {
    navigate("/onboarding-clinica?mode=create");
  }, [navigate]);

  const updateMobileDockTooltipForButton = (button: HTMLButtonElement, title: string) => {
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || rect.right;
    const safeInset = 68;
    const x = Math.min(Math.max(rect.left + rect.width / 2, safeInset), Math.max(safeInset, viewportWidth - safeInset));
    setMobileDockTooltip({ title, x });
  };

  const finishMobileDockInteraction = () => {
    setMobileDockPointerActive(false);
    setMobileDockExpanded(true);
    setMobileDockPressedSection(null);
    setMobileDockTooltip(null);
  };

  const updateMobileDockPressedSectionFromPoint = (clientX: number, clientY: number) => {
    if (!mobileDockPointerActive) {
      return;
    }

    const element = document.elementFromPoint(clientX, clientY);
    const button = element?.closest<HTMLButtonElement>("[data-personal-mobile-section]");
    const sectionId = button?.dataset.personalMobileSection as PersonalSection | undefined;
    const section = visibleSectionItems.find((item) => item.value === sectionId);

    if (!button || !section) {
      return;
    }

    setMobileDockPressedSection(section.value);
    updateMobileDockTooltipForButton(button, section.label);
  };

  useEffect(() => {
    const handleScroll = () => {
      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }

      mobileDockScrollResetTimerRef.current = window.setTimeout(() => {
        setMobileDockExpanded(false);
        setMobileDockPressedSection(null);
        setMobileDockPointerActive(false);
        setMobileDockTooltip(null);
        mobileDockScrollResetTimerRef.current = null;
      }, 80);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (mobileDockScrollResetTimerRef.current !== null) {
        window.clearTimeout(mobileDockScrollResetTimerRef.current);
      }
    };
  }, []);

  const renderClinics = (): ReactNode => (
    <>
      {isPlatformOwner ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Clínicas</CardTitle>
            <p className="text-sm text-muted-foreground">Use o painel administrativo global para acessar clínicas como suporte.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/platform")}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Abrir painel global
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <ClinicInvitationsList
            loadingInvitations={loadingInvitations}
            clinicInvitations={clinicInvitations}
            actingInvitationId={actingInvitationId}
            decliningInvitation={decliningInvitation}
            setDecliningInvitation={setDecliningInvitation}
            onAcceptInvitation={handleAcceptInvitation}
            onDeclineInvitation={handleDeclineInvitation}
          />


          <ClinicSelectionList
            authLoading={authLoading}
            accessibleClinics={accessibleClinics}
            sortedAccessibleClinics={sortedAccessibleClinics}
            clinicSubscriptions={clinicSubscriptions}
            hasEnterpriseAccess={hasEnterpriseAccess}
            userEmail={user?.email || profile?.email}
            selectingClinicId={selectingClinicId}
            leavingClinicId={leavingClinicId}
            onSelectClinic={handleSelectClinic}
            onLeaveClinic={handleLeaveClinic}
            onCreateClinic={handleCreateClinicFromEmpty}
          />
        </div>
      )}
    </>
  );

  const renderPortfolio = () => (
    <div className="w-full">
      <PersonalClinicalPortfolioTab userId={user?.id} />
    </div>
  );

  const renderActiveSection = () => {
    if (activeSection === "dashboard") {
      return (
        <PersonalDashboardTab
          loadingDashboard={loadingDashboard}
          dashboardData={dashboardData}
          attendanceRange={attendanceRange}
          setAttendanceRange={setAttendanceRange}
          isPlatformOwner={isPlatformOwner}
          onNavigateToPlatform={() => navigate("/platform")}
        />
      );
    }
    if (activeSection === "portfolio") return renderPortfolio();
    if (activeSection === "news") {
      return (
        <PersonalNewsTab
          isPlatformOwner={isPlatformOwner}
          loadingReleaseNotes={loadingReleaseNotes}
          releaseNotes={releaseNotes}
          releaseItemsByCategory={releaseItemsByCategory}
          activeReleaseCategory={activeReleaseCategory}
          setActiveReleaseCategory={setActiveReleaseCategory}
          isReleaseEditorOpen={isReleaseEditorOpen}
          setIsReleaseEditorOpen={setIsReleaseEditorOpen}
          onRefreshReleaseNotes={fetchReleaseNotes}
        />
      );
    }
    return renderClinics();
  };

  return (
    <div className="min-h-screen bg-background">
      <PersonalHeader
        isPortfolioEnabled={isPortfolioEnabled}
        displayName={displayName}
        subtitle={profile?.email || user?.email || "Conta pessoal"}
        avatarUrl={profile?.avatar_url}
        initials={initials}
        onOpenPortfolio={() => setActiveSection("portfolio")}
        onOpenProfile={() => navigate(`${isDesignLabRoute ? "/designlab" : ""}/configuracoes/pessoal/perfil`)}
        onSignOut={() => signOut()}
      />

      <main className="mx-auto w-full max-w-5xl overflow-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-4 sm:p-6">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="hidden min-w-0 pt-1 lg:block">
            <div className="mx-auto max-w-screen-sm lg:max-w-none">
              <PersonalDesktopNav
                visibleSectionItems={visibleSectionItems}
                activeSection={activeSection}
                setActiveSection={setActiveSection}
              />
            </div>
          </aside>
          <section className="min-w-0">
            {renderActiveSection()}
          </section>
        </div>
      </main>

      <PersonalMobileNav
        visibleSectionItems={visibleSectionItems}
        activeSection={activeSection}
        setActiveSection={setActiveSection}
        mobileDockExpanded={mobileDockExpanded}
        mobileDockPressedSection={mobileDockPressedSection}
        mobileDockPointerActive={mobileDockPointerActive}
        mobileDockTooltip={mobileDockTooltip}
        onPointerDownButton={(event, item) => {
          setMobileDockExpanded(true);
          setMobileDockPointerActive(true);
          setMobileDockPressedSection(item.value);
          updateMobileDockTooltipForButton(event.currentTarget, item.label);
        }}
        onTouchStartButton={(event, item) => {
          const touch = event.touches[0];
          if (!touch) return;
          setMobileDockExpanded(true);
          setMobileDockPointerActive(true);
          setMobileDockPressedSection(item.value);
          updateMobileDockTooltipForButton(event.currentTarget, item.label);
        }}
        onPointerMove={(event) => updateMobileDockPressedSectionFromPoint(event.clientX, event.clientY)}
        onTouchMove={(event) => {
          const touch = event.touches[0];
          if (touch) updateMobileDockPressedSectionFromPoint(touch.clientX, touch.clientY);
        }}
        onFinishInteraction={finishMobileDockInteraction}
      />

      <PersonalWelcomeModal userId={user?.id} userName={displayName} />
      <TermsUpdatePromptModal />
    </div>
  );
};

export default SelecionarClinica;
