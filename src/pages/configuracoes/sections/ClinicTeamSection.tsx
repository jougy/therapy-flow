import { useState, useEffect, useMemo } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Clock,
  Coins,
  Copy,
  Edit2,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  Mail,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  RotateCw,
  Save,
  Search,
  Share2,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  UsersRound,
  UserX,
  X,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import { cn } from "@/lib/utils";
import {
  ACCESS_CAPABILITIES,
  hasDefaultCapability,
  type AccessCapability,
} from "@/lib/rbac";
import {
  formatLastSeenAt,
  getConcurrentAccessCapacity,
  shouldShowTeamSettingsSection,
} from "@/lib/subaccounts";
import type { Database } from "@/integrations/supabase/types";

type SubaccountOperationalRole = "admin" | "professional" | "assistant" | "estagiario";
type ClinicOperationalRoleDefinition = Database["public"]["Tables"]["clinic_operational_roles"]["Row"];
type RoleCapabilityRow = Database["public"]["Tables"]["clinic_operational_role_capabilities"]["Row"];

type PendingCollaboratorInvitation = {
  id: string;
  clinic_id: string;
  email: string;
  operational_role: SubaccountOperationalRole;
  job_title: string | null;
  specialty: string | null;
  status: "pending" | "accepted" | "cancelled" | "expired";
  created_at: string;
  expires_at: string;
  account_state: "registered_unconfirmed" | "registered_confirmed_pending_acceptance" | "invite_sent";
  pending_reason: string;
  last_resent_at?: string | null;
};

type ActiveMember = {
  id: string;
  user_id: string;
  operational_role: SubaccountOperationalRole | "owner";
  membership_status: "active" | "suspended" | "inactive" | "invited" | string;
  is_active: boolean;
  created_at: string;
  full_name: string;
  email: string;
  job_title?: string | null;
  specialty?: string | null;
  working_hours?: string | null;
  last_seen_at?: string | null;
};

type ActiveSessionRow = {
  session_key: string;
  user_id: string;
  browser?: string;
  platform?: string;
  device_label?: string;
  last_seen_at?: string | null;
  full_name?: string;
  email?: string;
};

const OPERATIONAL_ROLE_LABELS: Record<string, string> = {
  admin: "Administrador(a)",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário(a)",
  owner: "Proprietário(a)",
};

const OPERATIONAL_ROLE_DESCRIPTIONS: Record<SubaccountOperationalRole, string> = {
  admin: "Acompanha a equipe, ajusta acessos e gerencia configurações operacionais da clínica.",
  assistant: "Apoia a operação com pacientes e agenda, mas não entra nas áreas clínicas mais sensíveis.",
  estagiario: "Acesso mais restrito. Atua apenas no próprio fluxo de atendimentos e só vê/edita atendimentos criados por ele.",
  professional: "Fluxo clínico completo para pacientes e atendimentos, sem poderes administrativos da clínica.",
};

const OPERATIONAL_ROLE_MANAGEMENT_ORDER: Array<SubaccountOperationalRole | "owner"> = [
  "owner",
  "admin",
  "professional",
  "assistant",
  "estagiario",
];

const SYSTEM_OPERATIONAL_ROLE_DEFINITIONS: ClinicOperationalRoleDefinition[] = OPERATIONAL_ROLE_MANAGEMENT_ORDER.map((role, index) => ({
  base_operational_role: role,
  clinic_id: "",
  description: role === "owner" ? "Conta principal da clínica. Gestão irrestrita das diretrizes operacionais." : OPERATIONAL_ROLE_DESCRIPTIONS[role],
  is_system: true,
  label: OPERATIONAL_ROLE_LABELS[role],
  role_key: role,
  sort_order: index * 10,
}));

type RolePermissionCategoryId = "all" | "clinical" | "agenda" | "team" | "admin" | "finance";
type RolePermissionSwitchKind = "view" | "edit" | "delete" | "share" | "finance" | "print" | "manage";

type RolePermissionAction = {
  kind: RolePermissionSwitchKind;
  capability: AccessCapability;
  label?: string;
};

type RolePermissionItem = {
  category: RolePermissionCategoryId;
  description: string;
  details: string;
  key: string;
  title: string;
  actions: RolePermissionAction[];
};

const ROLE_PERMISSION_CATEGORIES: Array<{ id: RolePermissionCategoryId; label: string }> = [
  { id: "all", label: "Todas" },
  { id: "clinical", label: "Clínico" },
  { id: "agenda", label: "Agenda" },
  { id: "team", label: "Equipe" },
  { id: "admin", label: "Administração" },
  { id: "finance", label: "Financeiro" },
];

const ROLE_PERMISSION_ITEMS: RolePermissionItem[] = [
  // Clínico
  {
    category: "clinical",
    key: "patients",
    title: "Pacientes",
    description: "Cadastro, contato e dados operacionais dos pacientes.",
    details: "Controla visualização da lista e cadastro, edição de informações e exclusão de fichas de pacientes.",
    actions: [
      { kind: "view", capability: "patients.read", label: "Ver" },
      { kind: "edit", capability: "patients.write", label: "Editar" },
      { kind: "delete", capability: "patients.delete", label: "Excluir" },
    ],
  },
  {
    category: "clinical",
    key: "patients-groups",
    title: "Grupos de pacientes",
    description: "Criação, alteração e organização de grupos e categorias de pacientes.",
    details: "Controla o acesso à estrutura de grupos e marcadores para classificar pacientes.",
    actions: [
      { kind: "view", capability: "patients.read", label: "Ver" },
      { kind: "edit", capability: "patients.manage_groups", label: "Editar" },
    ],
  },
  {
    category: "clinical",
    key: "sessions-own",
    title: "Atendimentos próprios",
    description: "Evolução, fichas clínicas e histórico dos próprios atendimentos.",
    details: "Controla o histórico clínico e preenchimento de evoluções dos atendimentos realizados pelo colaborador.",
    actions: [
      { kind: "view", capability: "sessions.read", label: "Ver" },
      { kind: "edit", capability: "sessions.write", label: "Editar" },
      { kind: "delete", capability: "session.delete_draft", label: "Excluir" },
    ],
  },
  {
    category: "clinical",
    key: "sessions-team",
    title: "Atendimentos da equipe",
    description: "Visualização e alteração de atendimentos e evoluções de outros profissionais.",
    details: "Controla leitura de prontuários de outros colegas, edição de registros de terceiros, compartilhamento e exclusão consolidada.",
    actions: [
      { kind: "view", capability: "sessions.read_all", label: "Ver" },
      { kind: "edit", capability: "sessions.write_others", label: "Editar" },
      { kind: "share", capability: "sessions.share", label: "Enviar" },
      { kind: "delete", capability: "sessions.delete", label: "Excluir" },
    ],
  },

  // Agenda
  {
    category: "agenda",
    key: "schedule-own",
    title: "Agenda própria",
    description: "Visualização e agendamento na própria agenda do profissional.",
    details: "Controla a visualização da agenda pessoal e a marcação de compromissos.",
    actions: [
      { kind: "view", capability: "schedule.read", label: "Ver" },
      { kind: "edit", capability: "schedule.write", label: "Agendar" },
    ],
  },
  {
    category: "agenda",
    key: "schedule-team",
    title: "Agenda da equipe",
    description: "Visualização e encaixe de horários na agenda de outros colegas.",
    details: "Permite agendar, mover e cancelar compromissos no calendário de outros membros da clínica.",
    actions: [
      { kind: "view", capability: "schedule.read", label: "Ver" },
      { kind: "edit", capability: "schedule.write_others", label: "Agendar" },
      { kind: "delete", capability: "agenda.delete_events", label: "Excluir" },
    ],
  },

  // Equipe
  {
    category: "team",
    key: "subaccounts",
    title: "Colaboradores da clínica",
    description: "Cadastro, convites, alteração de cargos e revogação de acessos da equipe.",
    details: "Controla a visualização da lista, envio de novos convites, edição de cargos/especialidades/status e exclusão/revogação do vínculo na clínica.",
    actions: [
      { kind: "view", capability: "subaccounts.read", label: "Ver" },
      { kind: "edit", capability: "subaccounts.write", label: "Convidar" },
      { kind: "manage", capability: "subaccounts.manage", label: "Editar" },
      { kind: "delete", capability: "subaccounts.delete", label: "Excluir" },
    ],
  },
  {
    category: "team",
    key: "roles",
    title: "Papéis operacionais & Hierarquias",
    description: "Configuração de poderes e personalização da matriz de permissões.",
    details: "Controla a visualização e edição da matriz de permissões e papéis operacionais da clínica.",
    actions: [
      { kind: "view", capability: "subaccounts_roles.read", label: "Ver" },
      { kind: "manage", capability: "subaccounts_roles.manage", label: "Gerenciar" },
    ],
  },
  {
    category: "team",
    key: "team-analytics",
    title: "Analytics & Metas da equipe",
    description: "Acompanhamento de métricas de produtividade, metas e desenvolvimento.",
    details: "Controla gráficos de desempenho, taxa de ocupação, metas e avaliações internas.",
    actions: [
      { kind: "view", capability: "subaccounts_analytics.read", label: "Métricas" },
      { kind: "edit", capability: "team_development.manage", label: "Metas" },
    ],
  },

  // Financeiro
  {
    category: "finance",
    key: "treasury",
    title: "Caixa & Pagamentos de Pacientes",
    description: "Lançamento de recebimentos, baixa de sessões e controle financeiro de pacientes.",
    details: "Controla o registro de pagamentos, recibos e fluxo de caixa de atendimentos.",
    actions: [
      { kind: "view", capability: "treasury.manage", label: "Extrato" },
      { kind: "finance", capability: "treasury.manage", label: "Receber" },
    ],
  },
  {
    category: "finance",
    key: "billing",
    title: "Assinatura & Plano Therapy-Flow",
    description: "Gestão da assinatura da clínica, faturas e contratação de acessos simultâneos.",
    details: "Controla o plano da clínica junto ao Therapy-Flow, upgrade e histórico de faturamento.",
    actions: [
      { kind: "view", capability: "subscription_billing.manage", label: "Ver" },
      { kind: "manage", capability: "subscription_billing.manage", label: "Gerenciar" },
    ],
  },

  // Administração
  {
    category: "admin",
    key: "clinic-profile",
    title: "Perfil institucional da clínica",
    description: "Razão social, logotipo, CNPJ, endereço e preferências gerais.",
    details: "Controla as informações públicas e institucionais da clínica.",
    actions: [
      { kind: "view", capability: "clinic_profile.manage", label: "Ver" },
      { kind: "manage", capability: "clinic_profile.manage", label: "Editar" },
    ],
  },
  {
    category: "admin",
    key: "forms",
    title: "Modelos de formulários",
    description: "Criação, edição, importação e exportação de modelos de anamnese.",
    details: "Controla a biblioteca de formulários clínicos e fichas da clínica.",
    actions: [
      { kind: "view", capability: "forms.manage", label: "Ver" },
      { kind: "manage", capability: "forms.manage", label: "Gerenciar" },
    ],
  },
  {
    category: "admin",
    key: "system-print",
    title: "Impressão & Documentos físicos",
    description: "Exportação e impressão física de fichas, declarações e prontuários.",
    details: "Controla a autorização para impressão e geração física de documentos clínicos.",
    actions: [
      { kind: "print", capability: "system.print", label: "Imprimir" },
    ],
  },
];

const DEFAULT_SWITCH_KIND_LABELS: Record<RolePermissionSwitchKind, string> = {
  view: "Ver",
  edit: "Editar",
  delete: "Excluir",
  share: "Enviar",
  finance: "Receber",
  print: "Imprimir",
  manage: "Gerenciar",
};

const RolePermissionSwitch = ({
  checked,
  disabled,
  kind,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  kind: RolePermissionSwitchKind;
  label?: string;
  onToggle: (checked: boolean) => void;
}) => {
  const displayLabel = label || DEFAULT_SWITCH_KIND_LABELS[kind] || "Ativar";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={displayLabel}
      disabled={disabled}
      data-kind={kind}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "role-permission-switch",
        checked && "role-permission-switch--checked",
        disabled && "role-permission-switch--disabled"
      )}
      onClick={() => onToggle(!checked)}
    >
      <span className="role-permission-switch__track" aria-hidden="true" />
      <span className="role-permission-switch__label" aria-hidden="true">
        {displayLabel}
      </span>
      <span className="role-permission-switch__thumb" aria-hidden="true">
        {kind === "view" && (
          <>
            <EyeOff className="role-permission-switch__icon role-permission-switch__icon--off" />
            <Eye className="role-permission-switch__icon role-permission-switch__icon--on" />
          </>
        )}
        {kind === "edit" && <Pencil className="role-permission-switch__icon role-permission-switch__icon--edit" />}
        {kind === "delete" && <Trash2 className="role-permission-switch__icon role-permission-switch__icon--delete" />}
        {kind === "share" && <Share2 className="role-permission-switch__icon role-permission-switch__icon--share" />}
        {kind === "finance" && <Coins className="role-permission-switch__icon role-permission-switch__icon--finance" />}
        {kind === "print" && <Printer className="role-permission-switch__icon role-permission-switch__icon--print" />}
        {kind === "manage" && <ShieldCheck className="role-permission-switch__icon role-permission-switch__icon--manage" />}
      </span>
    </button>
  );
};

const PermissionHelpButton = ({ details, title }: { details: string; title: string }) => {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 touch-manipulation"
          aria-label={`Explicar permissão ${title}`}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((prev) => !prev);
          }}
        >
          <CircleHelp className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3 text-xs" side="top" align="start">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-muted-foreground">{details}</p>
      </PopoverContent>
    </Popover>
  );
};

const parseSpecialties = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean);
};

const removeSpecialtyTag = (
  tagToRemove: string,
  currentValue: string,
  setter: (nextVal: string) => void
) => {
  const tags = parseSpecialties(currentValue);
  const updated = tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase());
  setter(updated.join("; "));
};

const SpecialtyTagsPreview = ({
  value,
  onRemove,
}: {
  value: string;
  onRemove?: (tagToRemove: string) => void;
}) => {
  const tags = parseSpecialties(value);
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
      <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
        <Tag className="h-3 w-3 text-primary/70" />
        Tags:
      </span>
      {tags.map((tag, idx) => (
        <Badge
          key={`${tag}-${idx}`}
          variant="secondary"
          className="text-xs gap-1 font-normal py-0 px-2 bg-primary/10 text-primary hover:bg-primary/15 transition-colors border border-primary/20"
        >
          <span>{tag}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="ml-0.5 hover:text-destructive focus:outline-none"
              aria-label={`Remover tag ${tag}`}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
      ))}
    </div>
  );
};

export const ClinicTeamSection = () => {
  const { accountRole, can, clinic: authClinic, clinicId, operationalRole, subscriptionPlan, user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ActiveMember[]>([]);
  const [pendingInvitations, setPendingInvitations] = useState<PendingCollaboratorInvitation[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionRow[]>([]);

  // RBAC Roles state
  const [roleManagementOpen, setRoleManagementOpen] = useState(false);
  const [selectedOperationalRole, setSelectedOperationalRole] = useState<string>("admin");
  const [rolePermissionCategory, setRolePermissionCategory] = useState<RolePermissionCategoryId>("all");
  const [operationalRoleDefinitions, setOperationalRoleDefinitions] = useState<ClinicOperationalRoleDefinition[]>(SYSTEM_OPERATIONAL_ROLE_DEFINITIONS);
  const [editingRoleLabel, setEditingRoleLabel] = useState("");
  const [savingRoleDefinition, setSavingRoleDefinition] = useState(false);
  const [roleCapabilityOverrides, setRoleCapabilityOverrides] = useState<RoleCapabilityRow[]>([]);

  // Novo Convite Form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<SubaccountOperationalRole>("professional");
  const [inviteJobTitle, setInviteJobTitle] = useState("");
  const [inviteSpecialty, setInviteSpecialty] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [lastGeneratedInviteUrl, setLastGeneratedInviteUrl] = useState("");
  const [lastGeneratedInviteEmail, setLastGeneratedInviteEmail] = useState("");

  // Ações de convite
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);

  // Gestão e Edição de Membros
  const [editingMember, setEditingMember] = useState<ActiveMember | null>(null);
  const [editMemberRole, setEditMemberRole] = useState<string>("professional");
  const [editMemberJobTitle, setEditMemberJobTitle] = useState("");
  const [editMemberSpecialty, setEditMemberSpecialty] = useState("");
  const [editMemberWorkingHours, setEditMemberWorkingHours] = useState("");
  const [editMemberStatus, setEditMemberStatus] = useState<"active" | "suspended" | "inactive">("active");
  const [savingMember, setSavingMember] = useState(false);

  // Revogação de Acesso
  const [revokingMember, setRevokingMember] = useState<ActiveMember | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Toggle rápido de status (pausa / reativação)
  const [togglingMemberId, setTogglingMemberId] = useState<string | null>(null);

  // Filtros de equipe
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "suspended" | "inactive">("all");

  const loadTeamData = async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }
    setLoading(true);

    try {
      const [
        membershipsRes,
        profilesRes,
        { data: pendingData },
        { data: roleDefsData },
        { data: roleCapsData },
        { data: concurrentData },
      ] = await Promise.all([
        supabase
          .from("clinic_memberships")
          .select("id, user_id, operational_role, membership_status, created_at, is_active")
          .eq("clinic_id", clinicId)
          .neq("membership_status", "invited"),
        supabase
          .from("profiles")
          .select("id, full_name, email, job_title, specialty, working_hours, last_seen_at")
          .eq("clinic_id", clinicId),
        supabase.rpc("get_clinic_pending_collaborator_invitations", { _clinic_id: clinicId }),
        supabase.from("clinic_operational_roles").select("*").eq("clinic_id", clinicId),
        supabase.from("clinic_operational_role_capabilities").select("*").eq("clinic_id", clinicId),
        supabase.rpc("get_clinic_concurrent_access_overview", { _clinic_id: clinicId }),
      ]);

      if (membershipsRes.data) {
        const profilesList = (profilesRes.data ?? []) as Array<{
          id: string;
          full_name: string | null;
          email: string | null;
          job_title: string | null;
          specialty: string | null;
          working_hours: string | null;
          last_seen_at: string | null;
        }>;
        const profileMap = new Map(profilesList.map((p) => [p.id, p]));

        const mapped: ActiveMember[] = membershipsRes.data
          .filter((item: any) => item.membership_status !== "invited")
          .map((item: any) => {
            const profile = profileMap.get(item.user_id);
            const status = (item.membership_status as "active" | "suspended" | "inactive") ||
              (item.is_active !== false ? "active" : "inactive");

            return {
              id: item.id,
              user_id: item.user_id,
              operational_role: item.operational_role || "professional",
              membership_status: status,
              is_active: item.is_active !== false,
              created_at: item.created_at,
              full_name: profile?.full_name || "Colaborador",
              email: profile?.email || "",
              job_title: profile?.job_title || null,
              specialty: profile?.specialty || null,
              working_hours: profile?.working_hours || null,
              last_seen_at: profile?.last_seen_at || null,
            };
          });
        setMembers(mapped);
      }

      if (pendingData && Array.isArray(pendingData)) {
        setPendingInvitations(pendingData as PendingCollaboratorInvitation[]);
      }

      if (roleDefsData && Array.isArray(roleDefsData)) {
        setOperationalRoleDefinitions([
          ...SYSTEM_OPERATIONAL_ROLE_DEFINITIONS.map((role) => ({
            ...role,
            clinic_id: clinicId,
            ...((roleDefsData as ClinicOperationalRoleDefinition[]).find((r) => r.role_key === role.role_key) ?? {}),
            is_system: true,
          })),
          ...(roleDefsData as ClinicOperationalRoleDefinition[]).filter(
            (r) => !OPERATIONAL_ROLE_MANAGEMENT_ORDER.includes(r.role_key as SubaccountOperationalRole | "owner")
          ),
        ]);
      }

      if (roleCapsData && Array.isArray(roleCapsData)) {
        setRoleCapabilityOverrides(roleCapsData as RoleCapabilityRow[]);
      }

      if (concurrentData && typeof concurrentData === "object") {
        const cData = concurrentData as { active_sessions?: ActiveSessionRow[] };
        if (Array.isArray(cData.active_sessions)) {
          setActiveSessions(cData.active_sessions);
        }
      }
    } catch (err) {
      console.error("[ClinicTeamSection] loadTeamData error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTeamData();
  }, [clinicId]);

  // Hierarquia ordenada de papéis
  const sortedOperationalRoleDefinitions = useMemo(
    () => [...operationalRoleDefinitions].sort((a, b) => a.sort_order - b.sort_order),
    [operationalRoleDefinitions]
  );

  const selectedRoleDefinition = useMemo(
    () =>
      sortedOperationalRoleDefinitions.find((role) => role.role_key === selectedOperationalRole) ??
      sortedOperationalRoleDefinitions[0] ?? {
        base_operational_role: "professional",
        clinic_id: clinicId || "",
        description: "Papel operacional",
        is_system: true,
        label: "Profissional",
        role_key: "professional",
        sort_order: 10,
      },
    [selectedOperationalRole, sortedOperationalRoleDefinitions, clinicId]
  );

  useEffect(() => {
    setEditingRoleLabel(selectedRoleDefinition.label);
  }, [selectedRoleDefinition]);

  const roleCapabilityMap = useMemo(
    () => new Map(roleCapabilityOverrides.map((row) => [`${row.operational_role}:${row.capability}`, row.enabled])),
    [roleCapabilityOverrides]
  );

  const roleUsageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    members.forEach((m) => {
      counts[m.operational_role] = (counts[m.operational_role] || 0) + 1;
    });
    return counts;
  }, [members]);

  const rolePermissionCategoryCounts = useMemo(() => {
    const counts: Record<RolePermissionCategoryId, number> = {
      all: 0,
      clinical: 0,
      agenda: 0,
      team: 0,
      admin: 0,
      finance: 0,
    };

    ROLE_PERMISSION_ITEMS.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + item.actions.length;
      counts.all += item.actions.length;
    });

    return counts;
  }, []);

  // Regras estritas de autorização e hierarquia vertical:
  const isAccountOwner = accountRole === "account_owner" || operationalRole === "owner";
  const canViewTeam = isAccountOwner || can("subaccounts.read") || can("subaccounts.manage");
  const canInviteCollaborators = isAccountOwner || can("subaccounts.write") || can("subaccounts.manage");
  const canEditCollaborators = isAccountOwner || can("subaccounts.manage");
  const canDeleteCollaborators = isAccountOwner || can("subaccounts.delete") || can("subaccounts.manage");
  const canManageRoles = isAccountOwner || can("subaccounts_roles.manage");
  const canViewRoles = isAccountOwner || can("subaccounts_roles.manage") || can("subaccounts_roles.read");
  const hasRolesManagePermission = canManageRoles;
  const actorRoleKey = isAccountOwner ? "owner" : (operationalRole || "professional");
  const actorRoleIndex = sortedOperationalRoleDefinitions.findIndex((r) => r.role_key === actorRoleKey);
  const selectedRoleIndex = sortedOperationalRoleDefinitions.findIndex((r) => r.role_key === selectedRoleDefinition.role_key);

  // O Owner tem poder total sobre todos os níveis (incluindo o próprio papel Owner).
  // Demais usuários só podem alterar papéis em nível estritamente inferior ao seu próprio (não incluindo o próprio nível nem níveis superiores).
  const canEditSelectedRole = hasRolesManagePermission && (
    isAccountOwner || (actorRoleIndex >= 0 && selectedRoleIndex > actorRoleIndex)
  );

  const canMoveSelectedRole = canEditSelectedRole && selectedRoleDefinition.role_key !== "owner";
  const canDeleteSelectedRole = canEditSelectedRole && !selectedRoleDefinition.is_system && selectedRoleDefinition.role_key !== "owner";

  const selectedRoleCapabilities = useMemo(() => {
    return Object.fromEntries(
      ACCESS_CAPABILITIES.map((capability) => {
        const override = roleCapabilityMap.get(`${selectedRoleDefinition.role_key}:${capability}`);
        if (override !== undefined) return [capability, override];
        const defaultAllowed = hasDefaultCapability(
          {
            accountRole: null,
            isActive: true,
            membershipStatus: "active",
            operationalRole: selectedRoleDefinition.base_operational_role === "owner" ? "owner" : selectedRoleDefinition.base_operational_role,
            subscriptionPlan: subscriptionPlan ?? "clinic",
          },
          capability
        );
        return [capability, defaultAllowed];
      })
    ) as Record<AccessCapability, boolean>;
  }, [selectedRoleDefinition, roleCapabilityMap, subscriptionPlan]);

  const handleToggleRoleCapability = async (capability: AccessCapability, nextChecked: boolean) => {
    if (!clinicId || !canEditSelectedRole) return;

    const relatedItem = ROLE_PERMISSION_ITEMS.find((item) =>
      item.actions.some((a) => a.capability === capability)
    );
    const viewAction = relatedItem?.actions.find((a) => a.kind === "view");

    const updates: Array<{ capability: AccessCapability; enabled: boolean }> = [
      { capability, enabled: nextChecked },
    ];

    // Acoplamento inteligente: ao ativar uma ação como editar/excluir/compartilhar, garante que o 'ver' esteja ativo
    if (nextChecked && viewAction && viewAction.capability !== capability) {
      if (!selectedRoleCapabilities[viewAction.capability]) {
        updates.push({ capability: viewAction.capability, enabled: true });
      }
    } else if (!nextChecked && viewAction && viewAction.capability === capability) {
      // Ao desativar o 'ver', desativa as ações dependentes deste mesmo item
      relatedItem?.actions.forEach((a) => {
        if (a.capability !== capability && selectedRoleCapabilities[a.capability]) {
          updates.push({ capability: a.capability, enabled: false });
        }
      });
    }

    for (const update of updates) {
      const { error } = await supabase.from("clinic_operational_role_capabilities").upsert(
        {
          clinic_id: clinicId,
          operational_role: selectedRoleDefinition.role_key,
          capability: update.capability,
          enabled: update.enabled,
        },
        { onConflict: "clinic_id,operational_role,capability" }
      );

      if (error) {
        toast({ title: "Erro ao salvar permissão", description: error.message, variant: "destructive" });
        return;
      }
    }

    setRoleCapabilityOverrides((curr) => {
      const updateCaps = new Set(updates.map((u) => u.capability));
      const filtered = curr.filter(
        (r) => !(r.operational_role === selectedRoleDefinition.role_key && updateCaps.has(r.capability as AccessCapability))
      );
      const newRows = updates.map((u) => ({
        clinic_id: clinicId,
        operational_role: selectedRoleDefinition.role_key,
        capability: u.capability,
        enabled: u.enabled,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        id: `${clinicId}-${selectedRoleDefinition.role_key}-${u.capability}`,
      }));
      return [...filtered, ...newRows];
    });

    toast({ title: "Permissão atualizada" });
  };

  const handleCreateOperationalRole = async () => {
    if (!clinicId || !hasRolesManagePermission || savingRoleDefinition) return;
    const existingCustomCount = operationalRoleDefinitions.filter((role) => !role.is_system).length;
    const roleKey = `papel_${Date.now().toString(36)}`;
    const nextRole: ClinicOperationalRoleDefinition = {
      base_operational_role: "professional",
      clinic_id: clinicId,
      description: "Papel personalizado da clínica.",
      is_system: false,
      label: `Novo papel ${existingCustomCount + 1}`,
      role_key: roleKey,
      sort_order: Math.max(...operationalRoleDefinitions.map((role) => role.sort_order), 0) + 10,
    };

    setSavingRoleDefinition(true);
    const { data, error } = await supabase
      .from("clinic_operational_roles")
      .upsert(nextRole, { onConflict: "clinic_id,role_key" })
      .select("*")
      .maybeSingle();

    setSavingRoleDefinition(false);
    if (error || !data) {
      toast({ title: "Erro ao criar papel", description: error?.message, variant: "destructive" });
      return;
    }

    setOperationalRoleDefinitions((current) =>
      [...current, data as ClinicOperationalRoleDefinition].sort((a, b) => a.sort_order - b.sort_order)
    );
    setSelectedOperationalRole(data.role_key);
    toast({ title: "Papel criado com sucesso!" });
  };

  const handleMoveSelectedRole = async (direction: "up" | "down") => {
    if (!canMoveSelectedRole || !clinicId) return;
    const index = sortedOperationalRoleDefinitions.findIndex((role) => role.role_key === selectedRoleDefinition.role_key);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const target = sortedOperationalRoleDefinitions[targetIndex];
    if (index < 0 || !target || target.role_key === "owner") return;

    if (!isAccountOwner && targetIndex <= actorRoleIndex) {
      toast({
        title: "Nível não permitido",
        description: "Você não pode mover um papel para o seu mesmo nível hierárquico ou acima.",
        variant: "destructive",
      });
      return;
    }

    const first = { ...selectedRoleDefinition, sort_order: target.sort_order };
    const second = { ...target, sort_order: selectedRoleDefinition.sort_order };
    setSavingRoleDefinition(true);

    await Promise.all([
      supabase.from("clinic_operational_roles").upsert(first, { onConflict: "clinic_id,role_key" }),
      supabase.from("clinic_operational_roles").upsert(second, { onConflict: "clinic_id,role_key" }),
    ]);

    setSavingRoleDefinition(false);
    setOperationalRoleDefinitions((current) =>
      current
        .map((r) => {
          if (r.role_key === first.role_key) return first;
          if (r.role_key === second.role_key) return second;
          return r;
        })
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  const handleDeleteSelectedRole = async () => {
    if (!clinicId || !canDeleteSelectedRole) return;
    const membersCount = roleUsageCounts[selectedRoleDefinition.role_key] ?? 0;
    if (membersCount > 0) {
      toast({
        title: "Papel em uso",
        description: `Remova os ${membersCount} colaborador(es) deste papel antes de excluir.`,
        variant: "destructive",
      });
      return;
    }

    setSavingRoleDefinition(true);
    const { error } = await supabase
      .from("clinic_operational_roles")
      .delete()
      .eq("clinic_id", clinicId)
      .eq("role_key", selectedRoleDefinition.role_key);

    if (!error) {
      await supabase
        .from("clinic_operational_role_capabilities")
        .delete()
        .eq("clinic_id", clinicId)
        .eq("operational_role", selectedRoleDefinition.role_key);
    }

    setSavingRoleDefinition(false);
    if (error) {
      toast({ title: "Erro ao excluir papel", description: error.message, variant: "destructive" });
      return;
    }

    setOperationalRoleDefinitions((current) => current.filter((role) => role.role_key !== selectedRoleDefinition.role_key));
    setRoleCapabilityOverrides((current) => current.filter((row) => row.operational_role !== selectedRoleDefinition.role_key));
    setSelectedOperationalRole("admin");
    toast({ title: "Papel excluído com sucesso!" });
  };

  const handleSaveSelectedRoleLabel = async () => {
    if (!selectedRoleDefinition || !canEditSelectedRole || !clinicId) return;
    if (editingRoleLabel.trim().length < 2) {
      toast({ title: "Nome muito curto", description: "Use pelo menos 2 caracteres.", variant: "destructive" });
      return;
    }

    setSavingRoleDefinition(true);
    const { error } = await supabase
      .from("clinic_operational_roles")
      .upsert(
        {
          clinic_id: clinicId,
          role_key: selectedRoleDefinition.role_key,
          label: editingRoleLabel.trim(),
          base_operational_role: selectedRoleDefinition.base_operational_role,
          description: selectedRoleDefinition.description,
          is_system: selectedRoleDefinition.is_system,
          sort_order: selectedRoleDefinition.sort_order,
        },
        { onConflict: "clinic_id,role_key" }
      );

    setSavingRoleDefinition(false);
    if (error) {
      toast({ title: "Erro ao renomear papel", description: error.message, variant: "destructive" });
      return;
    }

    setOperationalRoleDefinitions((curr) =>
      curr.map((r) => (r.role_key === selectedRoleDefinition.role_key ? { ...r, label: editingRoleLabel.trim() } : r))
    );
    toast({ title: "Papel renomeado com sucesso!" });
  };

  // Envio de novo convite
  const handleSendInvite = async () => {
    if (!clinicId || !inviteEmail.trim()) return;
    setSendingInvite(true);

    const { data, error } = await supabase.rpc("invite_clinic_collaborator", {
      _clinic_id: clinicId,
      _email: inviteEmail.trim(),
      _operational_role: inviteRole,
      _job_title: inviteJobTitle.trim() || undefined,
      _specialty: inviteSpecialty.trim() || undefined,
    });

    if (error) {
      toast({ title: "Erro ao emitir convite", description: error.message, variant: "destructive" });
      setSendingInvite(false);
      return;
    }

    const resData = data as Record<string, unknown> | null;
    const token = resData?.token ? String(resData.token) : "";
    const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);

    setLastGeneratedInviteUrl(inviteUrl);
    setLastGeneratedInviteEmail(inviteEmail.trim());

    const { error: emailError } = await supabase.functions.invoke("send-clinic-invitation", {
      body: { inviteUrl, token },
    });

    if (emailError) {
      toast({
        title: "Convite gerado",
        description: `E-mail não pôde ser enviado automaticamente. Você pode copiar o link ou enviar no WhatsApp.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Convite enviado com sucesso!",
        description: `E-mail oficial enviado para ${inviteEmail}.`,
      });
    }

    setInviteEmail("");
    setInviteJobTitle("");
    setInviteSpecialty("");
    setInviteRole("professional");
    setSendingInvite(false);
    void loadTeamData();
  };

  const handleCopyLink = async (url: string, email: string) => {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: `Link de convite para ${email} copiado.` });
  };

  const handleResendInvite = async (invitation: PendingCollaboratorInvitation) => {
    setResendingId(invitation.id);

    try {
      const { data: fallbackData, error } = await supabase.rpc("invite_clinic_collaborator", {
        _clinic_id: clinicId || undefined,
        _email: invitation.email,
        _operational_role: invitation.operational_role,
        _job_title: invitation.job_title || undefined,
        _specialty: invitation.specialty || undefined,
      });

      if (error) throw new Error(error.message);

      const fData = fallbackData as Record<string, unknown>;
      const token = fData?.token ? String(fData.token) : "";
      const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);

      setLastGeneratedInviteUrl(inviteUrl);
      setLastGeneratedInviteEmail(invitation.email);

      const { error: emailError } = await supabase.functions.invoke("send-clinic-invitation", {
        body: { inviteUrl, token },
      });

      if (emailError) {
        toast({
          title: "Convite atualizado",
          description: `Novo link gerado. Copie o link direto caso o e-mail não chegue.`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Convite reenviado!",
          description: `Novo e-mail enviado para ${invitation.email}.`,
        });
      }

      void loadTeamData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao reenviar convite.";
      toast({ title: "Erro ao reenviar", description: msg, variant: "destructive" });
    } finally {
      setResendingId(null);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    setCancelingId(invitationId);
    const { error } = await supabase.rpc("cancel_clinic_collaborator_invitation", {
      _invitation_id: invitationId,
    });

    if (error) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Convite cancelado com sucesso." });
      void loadTeamData();
    }
    setCancelingId(null);
  };

  const canManageMember = (targetMember: ActiveMember) => {
    if (targetMember.operational_role === "owner") return false;
    if (targetMember.user_id === user?.id) return false;
    if (isAccountOwner) return true;

    if (!canEditCollaborators && !canDeleteCollaborators && !canManageRoles) return false;

    const targetRoleIndex = sortedOperationalRoleDefinitions.findIndex((r) => r.role_key === targetMember.operational_role);
    return actorRoleIndex >= 0 && targetRoleIndex > actorRoleIndex;
  };

  const assignableRoleDefinitions = useMemo(() => {
    return sortedOperationalRoleDefinitions.filter((role) => {
      if (role.role_key === "owner") return false;
      if (isAccountOwner) return true;
      if (!canManageRoles) return false;
      const roleIndex = sortedOperationalRoleDefinitions.findIndex((r) => r.role_key === role.role_key);
      return actorRoleIndex >= 0 && roleIndex > actorRoleIndex;
    });
  }, [sortedOperationalRoleDefinitions, isAccountOwner, canManageRoles, actorRoleIndex]);

  const handleOpenEditMember = (member: ActiveMember) => {
    setEditingMember(member);
    setEditMemberRole(member.operational_role);
    setEditMemberJobTitle(member.job_title || "");
    setEditMemberSpecialty(member.specialty || "");
    setEditMemberWorkingHours(member.working_hours || "");
    setEditMemberStatus((member.membership_status as "active" | "suspended" | "inactive") || "active");
  };

  const handleSaveMember = async () => {
    if (!editingMember || !clinicId) return;
    setSavingMember(true);

    try {
      const { error } = await supabase.rpc("update_clinic_member_operational_fields", {
        _membership_id: editingMember.id,
        _job_title: editMemberJobTitle.trim() || undefined,
        _specialty: editMemberSpecialty.trim() || undefined,
        _working_hours: editMemberWorkingHours.trim() || undefined,
        _operational_role: editMemberRole as any,
        _membership_status: editMemberStatus as any,
      });

      if (error) throw new Error(error.message);

      toast({
        title: "Colaborador atualizado",
        description: `Os dados de ${editingMember.full_name} foram salvos com sucesso.`,
      });

      setEditingMember(null);
      void loadTeamData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao atualizar colaborador.";
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    } finally {
      setSavingMember(false);
    }
  };

  const handleToggleMemberStatus = async (member: ActiveMember, nextStatus: "active" | "suspended") => {
    if (!clinicId) return;
    setTogglingMemberId(member.id);

    try {
      const { error } = await supabase.rpc("update_clinic_member_operational_fields", {
        _membership_id: member.id,
        _membership_status: nextStatus as any,
      });

      if (error) throw new Error(error.message);

      toast({
        title: nextStatus === "active" ? "Acesso reativado" : "Acesso pausado",
        description: nextStatus === "active"
          ? `O acesso de ${member.full_name} foi reativado.`
          : `O acesso de ${member.full_name} foi temporariamente pausado.`,
      });

      void loadTeamData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar status do colaborador.";
      toast({ title: "Erro ao alterar status", description: msg, variant: "destructive" });
    } finally {
      setTogglingMemberId(null);
    }
  };

  const handleConfirmRevokeAccess = async () => {
    if (!revokingMember || !clinicId) return;
    setIsRevoking(true);

    try {
      const { error } = await supabase.rpc("revoke_clinic_member_access", {
        _membership_id: revokingMember.id,
      });

      if (error) throw new Error(error.message);

      toast({
        title: "Acesso revogado",
        description: `O acesso de ${revokingMember.full_name} à clínica foi revogado e as sessões ativas foram encerradas.`,
      });

      setRevokingMember(null);
      void loadTeamData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao revogar acesso do colaborador.";
      toast({ title: "Erro ao revogar acesso", description: msg, variant: "destructive" });
    } finally {
      setIsRevoking(false);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.job_title && m.job_title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (m.specialty && m.specialty.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchRole = roleFilter === "all" || m.operational_role === roleFilter;
      const matchStatus = statusFilter === "all" || m.membership_status === statusFilter;
      return matchSearch && matchRole && matchStatus;
    });
  }, [members, searchTerm, roleFilter, statusFilter]);

  const concurrentAccessCapacity = useMemo(() => {
    const sessionList = (activeSessions ?? []).map((s) => ({
      ended_at: null,
      last_seen_at: s.last_seen_at || new Date().toISOString(),
      session_key: s.session_key,
      user_id: s.user_id,
    }));
    return getConcurrentAccessCapacity(
      authClinic?.concurrent_access_limit ?? 1,
      sessionList,
      new Date()
    );
  }, [authClinic?.concurrent_access_limit, activeSessions]);

  const visibleRolePermissionItems = useMemo(
    () =>
      rolePermissionCategory === "all"
        ? ROLE_PERMISSION_ITEMS
        : ROLE_PERMISSION_ITEMS.filter((item) => item.category === rolePermissionCategory),
    [rolePermissionCategory]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bloco Superior Principal: Colaboradores e Acessos & Gerenciar Papéis Operacionais */}
      <Card data-tutorial="settings-team-main-card">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Colaboradores e acessos</CardTitle>
              <ComponentHelpButton helpId="settings-team-block" size="sm" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie os membros da equipe, convites oficiais e papéis operacionais da clínica.
            </p>
          </div>

          {/* Botão e Modal de Gestão de Papéis Operacionais (RBAC) */}
          <Dialog open={roleManagementOpen} onOpenChange={setRoleManagementOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="gap-2 shrink-0">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Gerenciar papéis operacionais
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] p-0 sm:max-w-5xl flex flex-col overflow-hidden rounded-2xl">
              <DialogHeader className="border-b px-6 py-4 flex-row items-center justify-between shrink-0">
                <div className="flex items-center gap-2 pr-6">
                  <DialogTitle className="text-lg font-bold">Gerenciar papéis operacionais</DialogTitle>
                  <ComponentHelpButton helpId="settings-team-roles-modal-block" size="sm" />
                </div>
                <DialogDescription className="sr-only">
                  Painel para configurar papéis operacionais e permissões da equipe da clínica.
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
                {/* Hierarquias na Lateral do Modal (Fixa à esquerda) */}
                <aside className="w-full md:w-72 border-b md:border-b-0 md:border-r bg-muted/20 p-4 shrink-0 flex flex-col overflow-hidden">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Hierarquias</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 text-xs"
                      onClick={() => void handleCreateOperationalRole()}
                      disabled={savingRoleDefinition}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Novo papel
                    </Button>
                  </div>
                  <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
                    {sortedOperationalRoleDefinitions.map((role) => {
                      const isSelected = selectedOperationalRole === role.role_key;
                      const isOwnerRole = role.role_key === "owner";
                      const count = roleUsageCounts[role.role_key] ?? 0;

                      return (
                        <button
                          key={role.role_key}
                          type="button"
                          className={cn(
                            "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition-all",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                              : "bg-background hover:bg-muted/60 text-foreground"
                          )}
                          onClick={() => setSelectedOperationalRole(role.role_key)}
                        >
                          <span className="min-w-0">
                            <span className="block truncate">{role.label}</span>
                            <span className="mt-0.5 block text-xs text-muted-foreground font-normal">
                              {count} pessoa{count === 1 ? "" : "s"}
                            </span>
                          </span>
                          {isOwnerRole ? (
                            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </aside>

                {/* Conteúdo de Permissões do Papel Selecionado (Scrollável à direita) */}
                <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background p-5">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between shrink-0">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          className="h-9 max-w-xs font-semibold"
                          value={editingRoleLabel}
                          maxLength={40}
                          disabled={!canEditSelectedRole || savingRoleDefinition}
                          onChange={(e) => setEditingRoleLabel(e.target.value)}
                          onBlur={() => void handleSaveSelectedRoleLabel()}
                        />
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            disabled={!canMoveSelectedRole || savingRoleDefinition || selectedRoleIndex <= 1}
                            onClick={() => void handleMoveSelectedRole("up")}
                            aria-label="Subir papel na hierarquia"
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9"
                            disabled={!canMoveSelectedRole || savingRoleDefinition || selectedRoleIndex >= sortedOperationalRoleDefinitions.length - 1}
                            onClick={() => void handleMoveSelectedRole("down")}
                            aria-label="Descer papel na hierarquia"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            disabled={!canDeleteSelectedRole || savingRoleDefinition}
                            onClick={() => void handleDeleteSelectedRole()}
                            aria-label="Excluir papel"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground max-w-2xl">
                        {!canEditSelectedRole
                          ? "Seu nível de acesso atual não permite alterar este papel (somente papéis em hierarquia inferior podem ser editados)."
                          : selectedRoleDefinition.role_key === "owner"
                          ? "Conta principal da clínica. Gestão irrestrita de permissões e diretrizes operacionais."
                          : selectedRoleDefinition.description || "Acompanha a equipe, ajusta acessos e gerencia configurações operacionais da clínica."}
                      </p>
                    </div>
                    {!canEditSelectedRole ? (
                      <Badge variant="outline" className="w-fit shrink-0 text-amber-600 border-amber-300">Somente leitura</Badge>
                    ) : selectedRoleDefinition.role_key === "owner" ? (
                      <Badge variant="secondary" className="w-fit shrink-0">Topo (Owner)</Badge>
                    ) : null}
                  </div>

                  {/* Filtro de Categorias de Permissão com Contadores Dinâmicos */}
                  <div className="mb-3 flex flex-wrap gap-1.5 rounded-xl border bg-muted/30 p-1.5 shrink-0">
                    {ROLE_PERMISSION_CATEGORIES.map((category) => {
                      const isActive = rolePermissionCategory === category.id;
                      const count = rolePermissionCategoryCounts[category.id] ?? 0;

                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setRolePermissionCategory(category.id)}
                          className={cn(
                            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs transition-all",
                            isActive
                              ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                              : "border-transparent bg-transparent text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {category.label}
                          <span className={cn(
                            "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                            isActive ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground"
                          )}>
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Cabeçalho da Tabela */}
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr),auto] gap-3 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 border-b pb-2">
                    <span>Função</span>
                    <span className="text-right pr-2">Ações e Permissões</span>
                  </div>

                  {/* Lista de Permissões com Rolagem Independente */}
                  <div className="space-y-2 overflow-y-auto flex-1 pr-1 pb-4">
                    {visibleRolePermissionItems.map((item) => {
                      return (
                        <div
                          key={item.key}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/30"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-foreground">{item.title}</p>
                              <PermissionHelpButton details={item.details} title={item.title} />
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                          </div>

                          {/* Grid flexível de switches semânticos para as ações desta função */}
                          <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0">
                            {item.actions.map((action) => {
                              const isChecked = selectedRoleCapabilities[action.capability] ?? false;
                              const isDisabled = !canEditSelectedRole;

                              return (
                                <RolePermissionSwitch
                                  key={`${item.key}-${action.kind}-${action.capability}`}
                                  checked={isChecked}
                                  disabled={isDisabled}
                                  kind={action.kind}
                                  label={action.label}
                                  onToggle={(next) => void handleToggleRoleCapability(action.capability, next)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              {/* Rodapé Fixo */}
              <DialogFooter className="px-6 py-3 border-t bg-card shrink-0 flex justify-end">
                <Button onClick={() => setRoleManagementOpen(false)}>Concluir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Banner de Capacidade da Clínica */}
          <div className="rounded-lg border p-4 text-sm bg-muted/10">
            <p className="font-semibold text-foreground">Capacidade Operacional da Clínica</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Equipe Cadastrada: {members.length} colaborador(es) (sem limite de cadastro) | Acessos Simultâneos: {activeSessions.length} de {concurrentAccessCapacity.limit} acesso(s) em uso.
            </p>
          </div>

          {/* 4 Cards de Capacidade */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Colaboradores na Equipe</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{members.length}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Acessos Simultâneos Ativos</p>
              <p className="mt-2 text-2xl font-bold text-foreground">{activeSessions.length} / {concurrentAccessCapacity.limit}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Acessos Disponíveis Agora</p>
              <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{concurrentAccessCapacity.available}</p>
            </div>
            <div className="rounded-xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Conta Principal</p>
              <p className="mt-2 text-sm font-medium text-foreground">{accountRole === "account_owner" ? "Você (Proprietário)" : "Outro usuário"}</p>
            </div>
          </div>

          {/* Acessos Ativos Neste Momento */}
          <div className="rounded-xl border p-4 space-y-3 bg-card shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm text-foreground">Acessos ativos neste momento</p>
                <p className="text-xs text-muted-foreground">
                  No plano Clínica, sua equipe tem cadastro ilimitado e capacidade de até {concurrentAccessCapacity.limit} acesso(s) simultâneo(s) conectados ao mesmo tempo.
                </p>
              </div>
            </div>

            {activeSessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum acesso ativo identificado agora.</p>
            ) : (
              <div className="space-y-2">
                {activeSessions.map((session) => (
                  <div key={session.session_key} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-xs bg-background">
                    <div>
                      <p className="font-semibold text-foreground">{session.full_name || session.email || session.user_id}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {session.device_label || [session.browser, session.platform].filter(Boolean).join(" • ") || "Dispositivo sem identificação"}
                      </p>
                    </div>
                    <span className="text-muted-foreground">Visto por último: {formatLastSeenAt(session.last_seen_at ?? null)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Formulário de Envio de Convite */}
      <Card data-tutorial="settings-team-invite-card">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 dark:bg-sky-950/40 dark:text-sky-400">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">Convidar Colaborador</CardTitle>
                <ComponentHelpButton helpId="settings-team-invite-block" size="sm" />
              </div>
              <CardDescription className="text-xs">
                Convide profissionais para fazerem parte da equipe da clínica com contas independentes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div data-tutorial="settings-invite-email" className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label>E-mail do colaborador</Label>
              <Input
                type="email"
                placeholder="colaborador@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                E-mail para acesso à plataforma.
              </p>
            </div>
            <div data-tutorial="settings-invite-role" className="space-y-1.5">
              <Label>Papel operacional</Label>
              <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as SubaccountOperationalRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador(a)</SelectItem>
                  <SelectItem value="professional">Profissional</SelectItem>
                  <SelectItem value="assistant">Assistente</SelectItem>
                  <SelectItem value="estagiario">Estagiário(a)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Hierarquia e poderes no sistema.
              </p>
            </div>
            <div data-tutorial="settings-invite-job" className="space-y-1.5">
              <Label>Cargo pré-definido</Label>
              <Input
                placeholder="Ex: Fisioterapeuta, Psicólogo(a)..."
                value={inviteJobTitle}
                onChange={(e) => setInviteJobTitle(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Profissão ou função na clínica.
              </p>
            </div>
            <div data-tutorial="settings-invite-specialty" className="space-y-1.5">
              <Label>Especialidade(s)</Label>
              <Input
                placeholder="Ex: Saúde da Mulher; Pediatria; TCC"
                value={inviteSpecialty}
                onChange={(e) => setInviteSpecialty(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                Separe múltiplas especialidades com ponto e vírgula (;).
              </p>
              <SpecialtyTagsPreview
                value={inviteSpecialty}
                onRemove={(tag) =>
                  removeSpecialtyTag(tag, inviteSpecialty, setInviteSpecialty)
                }
              />
            </div>
          </div>

          {lastGeneratedInviteUrl && (
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 dark:bg-sky-950/30 dark:border-sky-800 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-sky-900 dark:text-sky-300">
                  Convite emitido para <strong>{lastGeneratedInviteEmail}</strong>
                </p>
                <Badge className="bg-sky-600 text-white hover:bg-sky-600 text-[10px]">Válido por 14 dias</Badge>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input value={lastGeneratedInviteUrl} readOnly className="font-mono text-xs bg-background" />
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCopyLink(lastGeneratedInviteUrl, lastGeneratedInviteEmail)}
                  >
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copiar
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `Olá! Você foi convidado para participar da equipe de ${authClinic?.name || "nossa clínica"} na Pluri-Health. Acesse seu convite pelo link: ${lastGeneratedInviteUrl}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-700 hover:text-emerald-800"
                    >
                      WhatsApp
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
            {!canInviteCollaborators && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Seu papel atual não possui permissão para convidar novos colaboradores.
              </p>
            )}
            <div className="flex justify-end w-full sm:w-auto ml-auto">
              <Button
                data-tutorial="settings-team-invite-btn"
                onClick={() => void handleSendInvite()}
                disabled={sendingInvite || !inviteEmail.trim() || !canInviteCollaborators}
                className="bg-primary text-primary-foreground gap-2 w-full sm:w-auto"
              >
                {sendingInvite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Enviar convite por e-mail
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Convites Pendentes */}
      {pendingInvitations.length > 0 && (
        <Card data-tutorial="settings-team-pending-box" className="border-amber-200 bg-amber-50/20 dark:border-amber-900/40 dark:bg-amber-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-bold text-amber-950 dark:text-amber-300">
                  Pendências de Cadastro e Confirmação ({pendingInvitations.length})
                </CardTitle>
                <ComponentHelpButton helpId="settings-team-pending-block" size="sm" />
                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900 text-xs dark:bg-amber-950 dark:text-amber-200">
                  Ação necessária
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvitations.map((invitation) => {
              const roleName = OPERATIONAL_ROLE_LABELS[invitation.operational_role] || invitation.operational_role;
              const isResending = resendingId === invitation.id;

              return (
                <div key={invitation.id} className="rounded-xl border border-amber-200 dark:border-amber-900/30 bg-background p-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-foreground text-sm">{invitation.email}</p>
                        <Badge variant="outline" className="text-xs">
                          {roleName}
                        </Badge>
                        {invitation.job_title && (
                          <span className="text-xs font-medium text-foreground">· {invitation.job_title}</span>
                        )}
                        {parseSpecialties(invitation.specialty).map((spec, sIdx) => (
                          <Badge
                            key={`${spec}-${sIdx}`}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-normal bg-primary/10 text-primary border border-primary/20"
                          >
                            {spec}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-amber-800 dark:text-amber-400 mt-1">{invitation.pending_reason}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleResendInvite(invitation)}
                        disabled={isResending || !canInviteCollaborators}
                      >
                        {isResending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCw className="h-3.5 w-3.5 mr-1.5" />}
                        Reenviar convite
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const url = buildPublicAppUrl(`/convite/clinica/${invitation.id}`);
                          void handleCopyLink(url, invitation.email);
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copiar link
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => void handleCancelInvite(invitation.id)}
                        disabled={cancelingId === invitation.id || (!canDeleteCollaborators && !canInviteCollaborators)}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1.5" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Lista de Membros da Equipe */}
      <Card data-tutorial="settings-team-directory-box">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-xl">Equipe da Clínica</CardTitle>
                <ComponentHelpButton helpId="settings-team-directory-block" size="sm" />
              </div>
              <CardDescription className="text-xs">
                Colaboradores vinculados à clínica ({members.length} membros).
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar colaborador..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 text-xs w-48 sm:w-64"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="h-9 text-xs w-36">
                  <SelectValue placeholder="Todos os papéis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os papéis</SelectItem>
                  {sortedOperationalRoleDefinitions.map((role) => (
                    <SelectItem key={role.role_key} value={role.role_key}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="h-9 text-xs w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="active">Ativos</SelectItem>
                  <SelectItem value="suspended">Suspensos</SelectItem>
                  <SelectItem value="inactive">Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredMembers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              Nenhum colaborador encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {filteredMembers.map((member) => {
                const isOwner = member.operational_role === "owner";
                const roleDef = sortedOperationalRoleDefinitions.find((r) => r.role_key === member.operational_role);
                const roleLabel = roleDef?.label || OPERATIONAL_ROLE_LABELS[member.operational_role] || member.operational_role;
                const canManage = canManageMember(member);
                const isToggling = togglingMemberId === member.id;

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-foreground text-sm truncate">{member.full_name}</p>
                          {isOwner ? (
                            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-200 text-[10px] dark:bg-amber-950 dark:text-amber-200">
                              Proprietário
                            </Badge>
                          ) : member.membership_status === "active" ? (
                            <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 text-[10px]">
                              Ativo
                            </Badge>
                          ) : member.membership_status === "suspended" ? (
                            <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 text-[10px]">
                              Suspenso
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-[10px]">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <span>{member.email}</span>
                          {member.job_title && (
                            <span>· {member.job_title}</span>
                          )}
                          {parseSpecialties(member.specialty).map((spec, sIdx) => (
                            <Badge
                              key={`${spec}-${sIdx}`}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 font-normal bg-primary/10 text-primary border border-primary/20"
                            >
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                      <div className="flex flex-col sm:items-end gap-0.5">
                        <Badge variant="outline" className="text-xs font-medium w-fit">
                          {roleLabel}
                        </Badge>
                        {member.last_seen_at && (
                          <span className="text-[11px] text-muted-foreground">
                            Último acesso: {new Date(member.last_seen_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>

                      {/* Menu de Ações do Colaborador */}
                      {isOwner ? (
                        <div className="w-8 flex justify-center">
                          <ShieldCheck className="h-4 w-4 text-primary" title="Conta Proprietária" />
                        </div>
                      ) : canManage ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              aria-label={`Opções para ${member.full_name}`}
                              disabled={isToggling}
                            >
                              {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuLabel className="text-xs font-semibold">
                              Gerenciar Colaborador
                            </DropdownMenuLabel>
                            {canEditCollaborators && (
                              <DropdownMenuItem
                                onClick={() => handleOpenEditMember(member)}
                                className="cursor-pointer"
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar dados e cargo
                              </DropdownMenuItem>
                            )}

                            {canEditCollaborators && (
                              member.membership_status === "active" ? (
                                <DropdownMenuItem
                                  onClick={() => void handleToggleMemberStatus(member, "suspended")}
                                  className="cursor-pointer text-amber-600 focus:text-amber-700"
                                >
                                  <Pause className="h-4 w-4 mr-2" />
                                  Pausar acesso
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => void handleToggleMemberStatus(member, "active")}
                                  className="cursor-pointer text-emerald-600 focus:text-emerald-700"
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Reativar acesso
                                </DropdownMenuItem>
                              )
                            )}

                            {canDeleteCollaborators && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setRevokingMember(member)}
                                  className="cursor-pointer text-destructive focus:text-destructive"
                                >
                                  <UserMinus className="h-4 w-4 mr-2" />
                                  Revogar acesso
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge variant="outline" className="text-[11px] text-muted-foreground">
                          Somente leitura
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Edição de Colaborador */}
      <Dialog open={editingMember !== null} onOpenChange={(open) => !open && setEditingMember(null)}>
        <DialogContent className="max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Editar Colaborador</DialogTitle>
            <DialogDescription>
              Altere o cargo, papel operacional, especialidades e status de acesso à clínica.
            </DialogDescription>
          </DialogHeader>

          {editingMember && (
            <div className="space-y-4 py-2 overflow-y-auto pr-1">
              <div className="rounded-lg bg-muted/40 p-3 border text-xs space-y-1">
                <p className="font-semibold text-foreground text-sm">{editingMember.full_name}</p>
                <p className="text-muted-foreground">{editingMember.email}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-member-role">Papel Operacional</Label>
                <Select value={editMemberRole} onValueChange={setEditMemberRole} disabled={!canManageRoles}>
                  <SelectTrigger id="edit-member-role">
                    <SelectValue placeholder="Selecione o papel" />
                  </SelectTrigger>
                  <SelectContent>
                    {assignableRoleDefinitions.map((role) => (
                      <SelectItem key={role.role_key} value={role.role_key}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {canManageRoles
                    ? "Define o conjunto de poderes e permissões no sistema."
                    : "Seu papel não possui permissão para alterar a hierarquia operacional de colaboradores."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-member-job">Cargo pré-definido</Label>
                <Input
                  id="edit-member-job"
                  placeholder="Ex: Fisioterapeuta, Psicólogo(a)..."
                  value={editMemberJobTitle}
                  onChange={(e) => setEditMemberJobTitle(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Profissão ou função exercida na clínica.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-member-specialty">Especialidade(s)</Label>
                <Input
                  id="edit-member-specialty"
                  placeholder="Ex: Ortopedia; Pediatria; TCC"
                  value={editMemberSpecialty}
                  onChange={(e) => setEditMemberSpecialty(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Separe múltiplas especialidades com ponto e vírgula (;).
                </p>
                <SpecialtyTagsPreview
                  value={editMemberSpecialty}
                  onRemove={(tag) =>
                    removeSpecialtyTag(tag, editMemberSpecialty, setEditMemberSpecialty)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-member-hours">Horário / Carga Horária (Opcional)</Label>
                <Input
                  id="edit-member-hours"
                  placeholder="Ex: Seg a Sex, 08h às 18h"
                  value={editMemberWorkingHours}
                  onChange={(e) => setEditMemberWorkingHours(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-member-status">Status de Acesso à Clínica</Label>
                <Select
                  value={editMemberStatus}
                  onValueChange={(val) => setEditMemberStatus(val as "active" | "suspended" | "inactive")}
                >
                  <SelectTrigger id="edit-member-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo (Acesso normal liberado)</SelectItem>
                    <SelectItem value="suspended">Suspenso (Acesso pausado temporariamente)</SelectItem>
                    <SelectItem value="inactive">Inativo (Acesso desativado)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Colaboradores suspensos ou inativos não conseguem acessar os dados da clínica.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="border-t pt-3 flex flex-row items-center justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setEditingMember(null)} disabled={savingMember}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void handleSaveMember()} disabled={savingMember}>
              {savingMember ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Revogação de Acesso */}
      <Dialog open={revokingMember !== null} onOpenChange={(open) => !open && setRevokingMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle>Revogar Acesso à Clínica</DialogTitle>
            </div>
            <DialogDescription className="pt-2 text-foreground">
              Tem certeza que deseja revogar o acesso de <strong>{revokingMember?.full_name}</strong> ({revokingMember?.email}) à clínica?
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive space-y-1 my-2">
            <p className="font-semibold">Atenção:</p>
            <p>
              O colaborador perderá imediatamente o acesso aos prontuários, atendimentos e agenda da clínica.
              Todas as sessões ativas serão desconectadas na hora.
            </p>
          </div>

          <DialogFooter className="flex flex-row items-center justify-end gap-2 pt-2">
            <Button variant="outline" type="button" onClick={() => setRevokingMember(null)} disabled={isRevoking}>
              Cancelar
            </Button>
            <Button variant="destructive" type="button" onClick={() => void handleConfirmRevokeAccess()} disabled={isRevoking}>
              {isRevoking ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <UserMinus className="h-4 w-4 mr-1.5" />}
              Revogar Acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
