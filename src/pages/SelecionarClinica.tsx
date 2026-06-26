import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Activity, Building2, CalendarDays, CheckCircle2, LayoutDashboard, Loader2, LogOut, Megaphone, PlusCircle, RefreshCw, Settings, ShieldCheck, Tags, Trash2, UserRound, UsersRound, XCircle } from "lucide-react";
import { useAuth, type AccessibleClinic } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import PersonalNotificationsButton from "@/components/PersonalNotificationsButton";
import ProfileAccountButton from "@/components/ProfileAccountButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getClinicBrandName } from "@/lib/clinic-settings";
import { logRuntimeError } from "@/lib/runtime-debug";
import { cn } from "@/lib/utils";

type PersonalSection = "clinics" | "dashboard" | "news" | "settings";
type ReleaseNoteCategory = "fixed" | "added" | "changed" | "removed";
type AttendanceRange = "week" | "month" | "year";

interface ReleaseNoteItem {
  body: string | null;
  category: ReleaseNoteCategory;
  id: string;
  release_id: string;
  sort_order: number;
  title: string;
}

interface ReleaseNote {
  id: string;
  items: ReleaseNoteItem[];
  published_at: string;
  summary: string | null;
  title: string;
  version: string;
  version_order: number;
}

interface DashboardSession {
  clinic_id: string | null;
  group_id: string | null;
  id: string;
  patient_id: string;
  session_date: string;
  status: string;
}

interface DashboardGroup {
  color: string | null;
  id: string;
  name: string;
}

interface AttendanceBucket {
  atendimentos: number;
  label: string;
  key: string;
}

interface GroupCount {
  color: string;
  id: string;
  key: string;
  name: string;
  total: number;
}

interface ClinicInvitation {
  clinic_id: string;
  clinic_logo_url: string | null;
  clinic_name: string;
  clinic_route_key: string;
  created_at: string;
  expires_at: string;
  invitation_id: string;
  invited_by_name: string | null;
  job_title: string | null;
  operational_role: string;
  specialty: string | null;
}

const roleLabel: Record<string, string> = {
  account_owner: "Dono da conta",
  admin: "Admin",
  assistant: "Assistente",
  estagiario: "Estagiário",
  owner: "Owner",
  professional: "Profissional",
};

const sectionItems: Array<{
  icon: typeof Building2;
  label: string;
  value: PersonalSection;
}> = [
  { icon: Building2, label: "Clínicas", value: "clinics" },
  { icon: LayoutDashboard, label: "Minhas Estatísticas", value: "dashboard" },
  { icon: Megaphone, label: "Novidades", value: "news" },
  { icon: Settings, label: "Configurações", value: "settings" },
];

const categoryLabels: Record<ReleaseNoteCategory, string> = {
  added: "Adicionado",
  changed: "Alterado",
  fixed: "Reparado",
  removed: "Removido",
};

const categoryIcons: Record<ReleaseNoteCategory, typeof CheckCircle2> = {
  added: PlusCircle,
  changed: RefreshCw,
  fixed: CheckCircle2,
  removed: Trash2,
};

const categoryOrder: ReleaseNoteCategory[] = ["added", "changed", "fixed", "removed"];

const attendanceRangeLabels: Record<AttendanceRange, string> = {
  week: "Semana",
  month: "Mês",
  year: "Ano",
};

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const dashboardChartColors = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e"];
const attendanceChartConfig = {
  atendimentos: {
    color: "#0ea5e9",
    label: "Atendimentos",
  },
} satisfies ChartConfig;

const isReleaseNoteCategory = (value: unknown): value is ReleaseNoteCategory =>
  value === "fixed" || value === "added" || value === "changed" || value === "removed";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const getAccessLabel = (clinicOption: AccessibleClinic) =>
  clinicOption.membership.account_role === "account_owner"
    ? roleLabel.account_owner
    : roleLabel[clinicOption.membership.operational_role] ?? "Colaborador";

const formatLastSeen = (value: string | null | undefined) => {
  if (!value) {
    return "agora";
  }

  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (minutes <= 1) {
    return "agora";
  }

  return `${minutes} min`;
};

const toLocalDay = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getStartOfWeek = (reference: Date) => {
  const result = toLocalDay(reference);
  const weekday = result.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  result.setDate(result.getDate() + diff);
  return result;
};

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const getDayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const getMonthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const formatShortDay = (date: Date) => `${weekdayLabels[date.getDay()]} ${String(date.getDate()).padStart(2, "0")}`;

const isCompletedAttendance = (session: DashboardSession) => session.status !== "rascunho" && session.status !== "cancelado";

const SelecionarClinica = () => {
  const { accessibleClinics, isPlatformOwner, profile, refreshAuthState, selectClinic, signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesignLabRoute = location.pathname.startsWith("/designlab") || location.pathname.startsWith("/designlabs");
  const isDesignLabExperience = true;
  const [selectingClinicId, setSelectingClinicId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<PersonalSection>("clinics");
  const [releaseNotes, setReleaseNotes] = useState<ReleaseNote[]>([]);
  const [loadingReleaseNotes, setLoadingReleaseNotes] = useState(false);
  const [activeReleaseCategory, setActiveReleaseCategory] = useState<ReleaseNoteCategory>("added");
  const [dashboardSessions, setDashboardSessions] = useState<DashboardSession[]>([]);
  const [dashboardGroups, setDashboardGroups] = useState<DashboardGroup[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [attendanceRange, setAttendanceRange] = useState<AttendanceRange>("week");
  const [clinicInvitations, setClinicInvitations] = useState<ClinicInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [actingInvitationId, setActingInvitationId] = useState<string | null>(null);
  const [leavingClinicId, setLeavingClinicId] = useState<string | null>(null);
  const [mobileDockExpanded, setMobileDockExpanded] = useState(false);
  const [mobileDockPressedSection, setMobileDockPressedSection] = useState<PersonalSection | null>(null);
  const [mobileDockPointerActive, setMobileDockPointerActive] = useState(false);
  const [mobileDockTooltip, setMobileDockTooltip] = useState<{ title: string; x: number } | null>(null);
  const mobileDockScrollResetTimerRef = useRef<number | null>(null);

  const displayName = profile?.full_name || profile?.email || user?.email || "Usuário";
  const initials = getInitials(displayName || "U");

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
      navigate(`${isDesignLabRoute ? "/designlab" : ""}/configuracoes?secao=profile&origem=pessoal`);
    }
  }, [activeSection, isDesignLabRoute, navigate]);

  useEffect(() => {
    if (activeSection !== "news") {
      return;
    }

    let cancelled = false;

    const fetchReleaseNotes = async () => {
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

      if (cancelled) {
        return;
      }

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
    };

    void fetchReleaseNotes();

    return () => {
      cancelled = true;
    };
  }, [activeSection, user?.id]);

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
          color: group.color,
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
    const section = sectionItems.find((item) => item.value === sectionId);

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

  const personalDesktopNav = (
    <nav className="grid w-full min-w-0 max-w-full gap-2">
      {sectionItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.value;

        return (
          <button
            key={item.value}
            type="button"
            className={cn(
              "group flex h-12 w-full min-w-0 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium shadow-sm transition-[border-color,background-color,box-shadow,color,transform] duration-200 ease-out active:translate-y-px",
              isActive
                ? "border-primary/55 bg-card text-primary shadow-[0_0_28px_hsl(198_93%_60%/0.16)]"
                : "border-border/80 bg-card/92 text-muted-foreground hover:border-primary/35 hover:text-foreground hover:shadow-[0_0_22px_hsl(198_93%_60%/0.1)]"
            )}
            onClick={() => setActiveSection(item.value)}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                isActive ? "bg-primary/14 text-primary" : "bg-muted/70 text-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate leading-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  const personalMobileNav = (
    <div
      className="designlab-settings-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/88 lg:hidden"
      data-dock-state={mobileDockExpanded ? "medium" : "compact"}
      data-dock-pressing={mobileDockPointerActive ? "true" : "false"}
    >
      <div className="mx-auto max-w-screen-sm px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        {mobileDockTooltip && (
          <span
            className="designlab-settings-mobile-floating-tooltip"
            style={{ "--mobile-dock-tooltip-x": `${mobileDockTooltip.x}px` } as CSSProperties}
          >
            {mobileDockTooltip.title}
          </span>
        )}
        <div
          className="designlab-settings-mobile-dock flex justify-center gap-1.5 overflow-visible pb-1"
          onPointerMove={(event) => updateMobileDockPressedSectionFromPoint(event.clientX, event.clientY)}
          onTouchMove={(event) => {
            const touch = event.touches[0];
            if (touch) {
              updateMobileDockPressedSectionFromPoint(touch.clientX, touch.clientY);
            }
          }}
          onPointerUp={finishMobileDockInteraction}
          onPointerCancel={finishMobileDockInteraction}
          onTouchEnd={finishMobileDockInteraction}
          onTouchCancel={finishMobileDockInteraction}
          onPointerLeave={() => {
            if (mobileDockPointerActive) {
              finishMobileDockInteraction();
            }
          }}
        >
          {sectionItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.value;
            const isPressed = mobileDockPressedSection === item.value;

            return (
              <button
                key={item.value}
                type="button"
                aria-label={item.label}
                data-personal-mobile-section={item.value}
                className={cn(
                  "designlab-settings-mobile-item group relative flex shrink-0 flex-col items-center justify-center rounded-xl p-[1px] text-center transition-[filter,transform] duration-150 ease-out active:translate-y-0.5",
                  isActive && "is-active",
                  isPressed && "is-pressed"
                )}
                onPointerDown={(event) => {
                  setMobileDockExpanded(true);
                  setMobileDockPointerActive(true);
                  setMobileDockPressedSection(item.value);
                  updateMobileDockTooltipForButton(event.currentTarget, item.label);
                }}
                onTouchStart={(event) => {
                  const touch = event.touches[0];
                  if (!touch) {
                    return;
                  }

                  setMobileDockExpanded(true);
                  setMobileDockPointerActive(true);
                  setMobileDockPressedSection(item.value);
                  updateMobileDockTooltipForButton(event.currentTarget, item.label);
                }}
                onClick={() => setActiveSection(item.value)}
              >
                <span
                  className={cn(
                    "designlab-settings-mobile-surface flex h-full w-full flex-col items-center justify-center rounded-[0.68rem] border px-2 py-2 transition-colors duration-300",
                    isActive ? "border-primary/45 bg-primary/10 text-primary" : "border-border/80 bg-card/92 text-muted-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "designlab-settings-mobile-icon grid h-7 w-7 place-items-center rounded-lg transition-colors duration-300",
                      isActive ? "bg-primary/14 text-primary" : "bg-muted/70 text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UsersRound className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Total de pacientes atendidos</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {loadingDashboard ? "..." : dashboardData.totalAttendedPatients}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <p className="text-sm text-muted-foreground">Total de atendimentos</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              {loadingDashboard ? "..." : dashboardData.totalAttendances}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Quantidade de atendimentos
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">Volume por dia, por mês ou mês a mês no ano.</p>
            </div>
            <div className="flex w-full gap-1 rounded-lg border bg-muted/20 p-1 md:w-auto">
              {(Object.keys(attendanceRangeLabels) as AttendanceRange[]).map((range) => (
                <button
                  key={range}
                  type="button"
                  className={cn(
                    "h-8 flex-1 rounded-md px-3 text-sm font-medium transition md:flex-none",
                    attendanceRange === range ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setAttendanceRange(range)}
                >
                  {attendanceRangeLabels[range]}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingDashboard ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : dashboardData.totalAttendances === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum atendimento concluído encontrado nas suas clínicas.
            </div>
          ) : (
            <ChartContainer config={attendanceChartConfig} className="h-64 w-full">
              <LineChart data={dashboardData.attendanceBuckets} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={attendanceRange === "month" ? 18 : 8} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="atendimentos"
                  stroke="var(--color-atendimentos)"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Tags className="h-4 w-4 text-primary" />
              Top 5 grupos de atendimentos
            </CardTitle>
            <p className="text-sm text-muted-foreground">Grupos mais frequentes nos atendimentos concluídos.</p>
          </CardHeader>
          <CardContent>
            {loadingDashboard ? (
              <div className="flex h-44 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : dashboardData.topGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Nenhum grupo com atendimento encontrado.
              </div>
            ) : (
              <div className="space-y-3">
                {dashboardData.topGroups.map((group, index) => (
                  <div key={group.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{group.name}</p>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            backgroundColor: group.color,
                            width: `${Math.max(8, Math.round((group.total / Math.max(1, dashboardData.topGroups[0].total)) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>
                    <Badge variant="secondary">{group.total}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grupos recorrentes por semana do mês</CardTitle>
            <p className="text-sm text-muted-foreground">Distribuição semanal dos grupos mais recorrentes no mês atual.</p>
          </CardHeader>
          <CardContent>
            {loadingDashboard ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : dashboardData.topGroups.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                Nenhum atendimento no mês atual para comparar por semana.
              </div>
            ) : (
              <ChartContainer config={dashboardData.groupChartConfig} className="h-64 w-full">
                <BarChart data={dashboardData.groupWeeks} margin={{ bottom: 8, left: -18, right: 12, top: 8 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  {dashboardData.topGroups.map((group) => (
                    <Bar key={group.id} dataKey={group.key} fill={`var(--color-${group.key})`} radius={[4, 4, 0, 0]} />
                  ))}
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {isPlatformOwner && (
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          onClick={() => navigate("/platform")}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-foreground">Painel administrativo global</p>
              <p className="truncate text-sm text-muted-foreground">Ferramentas internas da plataforma</p>
            </div>
          </div>
          <Badge variant="secondary">platform_owner</Badge>
        </button>
      )}
    </div>
  );

  const renderNews = () => (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Novidades</CardTitle>
        <p className="text-sm text-muted-foreground">Histórico de notas de atualização publicadas na plataforma.</p>
      </CardHeader>
      <CardContent>
        {loadingReleaseNotes ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : releaseNotes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma nota de atualização publicada ainda.
          </div>
        ) : (
          <div className="min-w-0 space-y-4">
            <nav className="flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {categoryOrder.map((category) => {
                const Icon = categoryIcons[category];
                const count = releaseItemsByCategory[category].length;
                const isActive = activeReleaseCategory === category;

                return (
                  <button
                    key={category}
                    type="button"
                    className={cn(
                      "flex h-10 shrink-0 items-center justify-between gap-2 rounded-md border px-3 text-sm transition sm:min-w-40",
                      isActive ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setActiveReleaseCategory(category)}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {categoryLabels[category]}
                    </span>
                    <Badge variant="secondary">{count}</Badge>
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0 space-y-3">
              {releaseItemsByCategory[activeReleaseCategory].length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Nenhum tópico marcado como {categoryLabels[activeReleaseCategory].toLowerCase()}.
                </div>
              ) : (
                releaseItemsByCategory[activeReleaseCategory].map((item) => (
                  <article key={item.id} className="rounded-lg border bg-background p-4">
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                      <div className="min-w-0 sm:pr-3">
                        <h3 className="font-medium leading-snug">{item.title}</h3>
                        {item.body && <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>}
                      </div>
                      <Badge variant="outline" className="w-fit shrink-0 justify-self-start sm:justify-self-end">{item.release.version}</Badge>
                    </div>
                  </article>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

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
          {(loadingInvitations || clinicInvitations.length > 0) && (
            <Card className="overflow-hidden border-primary/30 bg-primary/5">
              <CardHeader className="px-4 sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Convites pendentes</CardTitle>
                  {clinicInvitations.length > 0 && <Badge variant="secondary" className="w-fit">{clinicInvitations.length}</Badge>}
                </div>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                {loadingInvitations ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-background p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Buscando convites...
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {clinicInvitations.map((invitation) => {
                      const isActing = actingInvitationId === invitation.invitation_id;
                      const clinicName = getClinicBrandName(invitation.clinic_name);

                      return (
                        <div key={invitation.invitation_id} className="grid gap-3 rounded-lg border bg-background p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                              {invitation.clinic_logo_url ? (
                                <img src={invitation.clinic_logo_url} alt="" className="h-9 w-9 rounded object-contain" />
                              ) : (
                                <Building2 className="h-5 w-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{clinicName}</p>
                              <p className="text-sm text-muted-foreground">
                                {roleLabel[invitation.operational_role] ?? invitation.operational_role}
                                {invitation.job_title ? ` · ${invitation.job_title}` : ""}
                                {invitation.specialty ? ` · ${invitation.specialty}` : ""}
                              </p>
                              {invitation.invited_by_name && (
                                <p className="text-xs text-muted-foreground">Convite enviado por {invitation.invited_by_name}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 sm:flex-row md:justify-end">
                            <Button size="sm" onClick={() => void handleAcceptInvitation(invitation.invitation_id)} disabled={!!actingInvitationId}>
                              {isActing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                              Confirmar e entrar
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void handleDeclineInvitation(invitation.invitation_id)} disabled={!!actingInvitationId}>
                              <XCircle className="mr-2 h-4 w-4" />
                              Recusar convite
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card className="overflow-hidden">
            <CardHeader className="px-4 sm:px-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base">Escolha a clínica</CardTitle>
                <Badge variant="secondary" className="w-fit">{accessibleClinics.length} acesso{accessibleClinics.length === 1 ? "" : "s"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              {accessibleClinics.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <UserRound className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                  <p className="font-medium text-foreground">Nenhuma clínica ativa encontrada</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Seu acesso ainda precisa ser liberado pelo administrador da clínica.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {accessibleClinics.map((clinicOption) => {
                    const clinicName = getClinicBrandName(clinicOption.clinic.name);
                    const isSelecting = selectingClinicId === clinicOption.clinic.id;
                    const canLeaveClinic = clinicOption.membership.account_role !== "account_owner" && clinicOption.membership.operational_role !== "owner";
                    const isLeavingClinic = leavingClinicId === clinicOption.clinic.id;

                    return (
                      <div
                        key={clinicOption.clinic.id}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden rounded-lg border bg-card p-2 transition-colors hover:border-primary/50 hover:bg-accent/40 sm:gap-3"
                      >
                      <button
                        type="button"
                        className="flex min-w-0 items-center gap-3 rounded-md p-2 text-left disabled:cursor-wait disabled:opacity-70"
                        onClick={() => handleSelectClinic(clinicOption.clinic.id)}
                        disabled={!!selectingClinicId}
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          {clinicOption.clinic.logo_url ? (
                            <img src={clinicOption.clinic.logo_url} alt="" className="h-8 w-8 rounded object-contain" />
                          ) : (
                            <Building2 className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{clinicName}</p>
                          <p className="truncate text-sm text-muted-foreground">{getAccessLabel(clinicOption)}</p>
                        </div>
                      </button>
                      <div className="flex min-w-0 shrink-0 items-center gap-1 pr-1 sm:gap-2 sm:pr-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="rounded-full border bg-background px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground sm:px-2.5"
                              aria-label={`Ver acessos online da clínica ${clinicName}`}
                            >
                              {clinicOption.activeAccessCount}/{clinicOption.clinic.concurrent_access_limit}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72">
                            <div className="space-y-3">
                              <div>
                                <p className="font-medium text-foreground">Acessos online</p>
                                <p className="text-sm text-muted-foreground">
                                  {clinicOption.activeAccessCount} de {clinicOption.clinic.concurrent_access_limit} em uso.
                                </p>
                              </div>
                              {clinicOption.activeAccessUsers.length > 0 ? (
                                <div className="space-y-2">
                                  {clinicOption.activeAccessUsers.map((activeUser) => (
                                    <div key={`${clinicOption.clinic.id}-${activeUser.user_id}`} className="rounded-md border p-2 text-sm">
                                      <p className="truncate font-medium text-foreground">
                                        {activeUser.full_name || activeUser.email || "Usuário online"}
                                      </p>
                                      <p className="truncate text-xs text-muted-foreground">
                                        {activeUser.device_label || "Dispositivo"} • {formatLastSeen(activeUser.last_seen_at)}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">Nenhum acesso online agora.</p>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        {isSelecting ? (
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                        )}
                        {canLeaveClinic && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                disabled={!!selectingClinicId || !!leavingClinicId}
                                aria-label={`Sair da clínica ${clinicName}`}
                              >
                                {isLeavingClinic ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Sair de {clinicName}?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Você deixará de acessar pacientes, atendimentos, agenda e configurações desta clínica.
                                  Seu espaço pessoal e seus dados próprios continuam existindo. Para voltar, a clínica precisará enviar um novo convite.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => void handleLeaveClinic(clinicOption)}
                                  disabled={!!leavingClinicId}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Sair da clínica
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );

  const renderActiveSection = () => {
    if (activeSection === "dashboard") return renderDashboard();
    if (activeSection === "news") return renderNews();
    return renderClinics();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Pluri-Health</p>
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Espaço pessoal</h1>
          </div>
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <PersonalNotificationsButton />
            <ProfileAccountButton
              displayName={displayName}
              subtitle={profile?.email || user?.email || "Conta pessoal"}
              avatarUrl={profile?.avatar_url}
              initials={initials}
              onClick={() => navigate(`${isDesignLabRoute ? "/designlab" : ""}/configuracoes?secao=profile&origem=pessoal`)}
            />
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="shrink-0">
                  <LogOut className="mr-0 h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sair</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sair da sua conta?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Você será desconectado deste navegador e voltará para a tela inicial de login. Para acessar
                    novamente, será necessário informar seu e-mail e senha.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void signOut()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Sair da conta
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl overflow-hidden px-3 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] pt-4 sm:p-6">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="hidden min-w-0 pt-1 lg:block">
            <div className="mx-auto max-w-screen-sm lg:max-w-none">
              {personalDesktopNav}
            </div>
          </aside>
          <section className="min-w-0">
            {renderActiveSection()}
          </section>
        </div>
      </main>
      {personalMobileNav}
    </div>
  );
};

export default SelecionarClinica;
