import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft, Plus, Phone, Calendar, Loader2, ChevronDown, ChevronUp,
  Pencil, Trash2, Palette, FolderPlus, ClipboardEdit, Share2, Copy, CheckCircle2, Search, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { buildPatientRegistrationUrl, getPatientRegistrationPassword } from "@/lib/patient-registration";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import type { PatientGroupStatus } from "@/lib/patient-groups";
import { getSessionPersonLabel } from "@/lib/session-people";
import { getSessionPreviewContent, getSessionPreviewIndicators } from "@/lib/session-preview";
import {
  buildPatientSessionsView,
  canDeleteSelectedSessions,
  filterSessionsForOperationalRole,
  shouldAutoCompleteInternDraft,
  shouldShowSessionCreatorInternBadge,
} from "@/lib/patient-sessions-view";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];
type Session = Database["public"]["Tables"]["sessions"]["Row"];
type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "email" | "full_name" | "id" | "job_title">;
type ShareLinkResponse = {
  completed: boolean;
  password_prefix: string;
  token: string;
};
type PatientStatus = "ativo" | "pausado" | "inativo" | "alta";
type PatientStatusSelectValue = PatientStatus | "delete";

const GROUP_COLORS = [
  { value: "gray", label: "Cinza claro" },
  { value: "lavender", label: "Lavanda" },
  { value: "sage", label: "Verde" },
  { value: "peach", label: "Pêssego" },
  { value: "sky", label: "Azul" },
  { value: "rose", label: "Rosa" },
];

const GROUP_STATUSES: { value: PatientGroupStatus; label: string }[] = [
  { value: "em_andamento", label: "Em andamento" },
  { value: "pausado", label: "Pausado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
  { value: "inativo", label: "Inativo" },
];

const PATIENT_STATUSES: { value: PatientStatus; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "pausado", label: "Pausado" },
  { value: "inativo", label: "Inativo" },
  { value: "alta", label: "Alta" },
];

const DELETE_PATIENT_STATUS_OPTION = { value: "delete" as const, label: "Excluir" };

const groupBorderColors: Record<string, string> = {
  gray: "border-l-group-gray",
  lavender: "border-l-group-lavender",
  sage: "border-l-group-sage",
  peach: "border-l-group-peach",
  sky: "border-l-group-sky",
  rose: "border-l-group-rose",
};

const groupStatusBadgeStyles: Record<PatientGroupStatus, string> = {
  em_andamento: "bg-primary/10 text-primary border-primary/20",
  pausado: "bg-warning/15 text-warning border-warning/20",
  concluido: "bg-success/15 text-success border-success/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  inativo: "bg-muted text-muted-foreground border-border",
};

const statusColors: Record<string, string> = {
  concluído: "bg-success/15 text-success border-success/20",
  rascunho: "bg-warning/15 text-warning border-warning/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
};

const SESSION_STATUSES = [
  { value: "rascunho", label: "Rascunho" },
  { value: "concluído", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
] as const;

const formatSessionMetaDate = (value: string | null) => {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString("pt-BR");
};

const ScaleIndicator = ({ max = 10, min = 0, score }: { max?: number; min?: number; score: number }) => {
  const color = score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  const totalBars = Math.max(max - min, 1);
  const normalizedScore = Math.max(Math.min(score - min, totalBars), 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: totalBars }).map((_, i) => (
          <div key={i} className={`w-2 h-4 rounded-sm ${i < normalizedScore ? color : "bg-muted"}`} />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}/{max}</span>
    </div>
  );
};
const InfoField = ({ label, value, capitalize: cap }: { label: string; value?: string | null; capitalize?: boolean }) => (
  <div>
    <span className="text-xs text-muted-foreground">{label}</span>
    <p className={`text-sm font-medium ${cap ? "capitalize" : ""}`}>{value || "—"}</p>
  </div>
);

const SessionTabsPreview = ({ baseSchema, session }: { baseSchema: AnamnesisTemplateSchema; session: Session }) => {
  const preview = getSessionPreviewContent(session, baseSchema);

  return (
    <Tabs
      defaultValue="queixa"
      className="mt-3"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="queixa" className="text-xs sm:text-sm">Queixa principal</TabsTrigger>
        <TabsTrigger value="tratamento" className="text-xs sm:text-sm">Tratamento</TabsTrigger>
      </TabsList>
      <TabsContent value="queixa" className="rounded-md border bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {preview.complaint || "Nenhuma queixa principal registrada."}
        </p>
      </TabsContent>
      <TabsContent value="tratamento" className="rounded-md border bg-muted/20 p-3">
        <p className="text-sm text-muted-foreground whitespace-pre-line">
          {preview.treatment || "Nenhum tratamento registrado."}
        </p>
      </TabsContent>
    </Tabs>
  );
};

const SessionCard = ({
  baseSchema,
  borderClassName,
  creatorName,
  creatorIsIntern,
  isSelected,
  navigateTo,
  onPressCancel,
  onPressStart,
  onToggleSelect,
  selectionMode,
  session,
}: {
  baseSchema: AnamnesisTemplateSchema;
  borderClassName?: string;
  creatorName: string;
  creatorIsIntern: boolean;
  isSelected: boolean;
  navigateTo: () => void;
  onPressCancel: () => void;
  onPressStart: () => void;
  onToggleSelect: () => void;
  selectionMode: boolean;
  session: Session;
}) => {
  const indicators = getSessionPreviewIndicators(session, baseSchema);

  return (
    <Card
      className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow ${borderClassName || ""} ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}`}
      onClick={selectionMode ? onToggleSelect : navigateTo}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();

        if (selectionMode) {
          onToggleSelect();
          return;
        }

        navigateTo();
      }}
      onPointerDown={selectionMode ? undefined : onPressStart}
      onPointerUp={selectionMode ? undefined : onPressCancel}
      onPointerLeave={selectionMode ? undefined : onPressCancel}
      onPointerCancel={selectionMode ? undefined : onPressCancel}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{new Date(session.session_date).toLocaleDateString("pt-BR")}</span>
              <Badge variant="outline" className={`text-xs ${statusColors[session.status] || ""}`}>{session.status}</Badge>
              <Badge variant="secondary" className="text-xs">
                {creatorName}
              </Badge>
              {creatorIsIntern && (
                <Badge variant="outline" className="text-xs">
                  Estagiario
                </Badge>
              )}
              {selectionMode && (
                <Badge variant={isSelected ? "default" : "outline"} className="text-xs">
                  {isSelected ? "Selecionado" : "Toque para selecionar"}
                </Badge>
              )}
            </div>
            <SessionTabsPreview baseSchema={baseSchema} session={session} />
          </div>
          {indicators.length > 0 && (
            <div className="space-y-1.5 shrink-0">
              {indicators.map((indicator) => (
                <div key={indicator.id}>
                  <span className="text-xs text-muted-foreground block">{indicator.label}</span>
                  <ScaleIndicator score={indicator.score} min={indicator.min} max={indicator.max} />
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const isShareLinkResponse = (value: Json): value is ShareLinkResponse => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const data = value as Record<string, Json | undefined>;
  return (
    typeof data.completed === "boolean" &&
    typeof data.password_prefix === "string" &&
    typeof data.token === "string"
  );
};

const PacienteDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { can, clinicId, operationalRole, user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [groups, setGroups] = useState<PatientGroup[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [profiles, setProfiles] = useState<ProfileSummary[]>([]);
  const [baseSchema, setBaseSchema] = useState<AnamnesisTemplateSchema>([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);

  // Group dialog state
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PatientGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState("lavender");
  const [groupStatus, setGroupStatus] = useState<PatientGroupStatus>("em_andamento");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [generatingShareLink, setGeneratingShareLink] = useState(false);
  const [shareLink, setShareLink] = useState("");
  const [sharePassword, setSharePassword] = useState("");
  const [shareCompleted, setShareCompleted] = useState(false);
  const [updatingPatientStatus, setUpdatingPatientStatus] = useState(false);
  const [deletePatientDialogOpen, setDeletePatientDialogOpen] = useState(false);
  const [deletingPatient, setDeletingPatient] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [groupStatusFilter, setGroupStatusFilter] = useState("all");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const isIntern = operationalRole === "estagiario";
  const canDeletePatient = can("clinic_profile.manage");

  const fetchData = useCallback(async () => {
    if (!id) return;

    const [pRes, gRes, sRes, clinicRes, profilesRes] = await Promise.all([
      supabase.from("patients").select("*").eq("id", id).single(),
      supabase.from("patient_groups").select("*").eq("patient_id", id),
      supabase.from("sessions").select("*").eq("patient_id", id).order("session_date", { ascending: false }),
      clinicId ? supabase.from("clinics").select("anamnesis_base_schema").eq("id", clinicId).single() : Promise.resolve({ data: null }),
      clinicId ? supabase.from("profiles").select("id, full_name, email, job_title").eq("clinic_id", clinicId) : Promise.resolve({ data: [] }),
    ]);

    const allSessions = (sRes.data ?? []) as Session[];
    const staleInternDraftIds = allSessions
      .filter((session) =>
        shouldAutoCompleteInternDraft({
          createdAt: session.created_at,
          currentUserId: user?.id,
          operationalRole,
          sessionStatus: session.status,
          userId: session.user_id,
        })
      )
      .map((session) => session.id);

    if (staleInternDraftIds.length > 0) {
      const { error: autoCompleteError } = await supabase
        .from("sessions")
        .update({ status: "concluído" })
        .in("id", staleInternDraftIds);

      if (!autoCompleteError) {
        allSessions.forEach((session) => {
          if (staleInternDraftIds.includes(session.id)) {
            session.status = "concluído";
          }
        });
      }
    }

    setPatient(pRes.data);
    setGroups(gRes.data ?? []);
    setSessions(
      filterSessionsForOperationalRole({
        currentUserId: user?.id,
        operationalRole,
        sessions: allSessions,
      })
    );
    setProfiles((profilesRes.data ?? []) as ProfileSummary[]);
    setBaseSchema(Array.isArray(clinicRes.data?.anamnesis_base_schema) ? (clinicRes.data.anamnesis_base_schema as AnamnesisTemplateSchema) : []);
    setLoading(false);
  }, [clinicId, id, operationalRole, user?.id]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    setCollapsedGroups((current) => {
      const next = { ...current };

      groups.forEach((group) => {
        if (!(group.id in next)) {
          next[group.id] = false;
        }
      });

      return next;
    });
  }, [groups]);

  const handleOpenShareDialog = useCallback(async () => {
    if (!id || !patient) return;
    setGeneratingShareLink(true);

    const { data, error } = await supabase.rpc("create_patient_registration_link", {
      _patient_id: id,
    });

    if (error || !data || !isShareLinkResponse(data)) {
      toast({
        title: "Não foi possível gerar o link",
        description: error?.message ?? "Tente novamente em alguns instantes.",
        variant: "destructive",
      });
      setGeneratingShareLink(false);
      return;
    }

    setShareLink(buildPatientRegistrationUrl(window.location.origin, data.token));
    setSharePassword(data.password_prefix);
    setShareCompleted(data.completed);
    setShareDialogOpen(true);
    setGeneratingShareLink(false);
  }, [id, patient]);

  useEffect(() => {
    const shouldOpenShareDialog = (location.state as { openShareDialog?: boolean } | null)?.openShareDialog;

    if (!shouldOpenShareDialog || !patient) return;

    void handleOpenShareDialog();
    navigate(location.pathname, { replace: true, state: null });
  }, [handleOpenShareDialog, location.pathname, location.state, navigate, patient]);

  const openNewGroup = () => {
    setEditingGroup(null);
    setGroupName("");
    setGroupColor("lavender");
    setGroupStatus("em_andamento");
    setGroupDialogOpen(true);
  };

  const openEditGroup = (g: PatientGroup) => {
    if (g.is_default) {
      toast({ title: "O grupo padrão não pode ser editado dessa forma", variant: "destructive" });
      return;
    }

    setEditingGroup(g);
    setGroupName(g.name);
    setGroupColor(g.color);
    setGroupStatus((g.status as PatientGroupStatus) || "em_andamento");
    setGroupDialogOpen(true);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim() || !id || !user) return;
    setSavingGroup(true);

    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });

    if (editingGroup) {
      const { error } = await supabase
        .from("patient_groups")
        .update({ name: groupName.trim(), color: groupColor, status: groupStatus })
        .eq("id", editingGroup.id);
      if (error) { toast({ title: "Erro ao atualizar grupo", variant: "destructive" }); }
      else { toast({ title: "Grupo atualizado" }); }
    } else {
      const { error } = await supabase.from("patient_groups").insert({
        name: groupName.trim(),
        color: groupColor,
        status: groupStatus,
        is_default: false,
        patient_id: id,
        user_id: user.id,
        clinic_id: clinicRes.data,
      });
      if (error) { toast({ title: "Erro ao criar grupo", variant: "destructive" }); }
      else { toast({ title: "Grupo criado" }); }
    }

    setSavingGroup(false);
    setGroupDialogOpen(false);
    void fetchData();
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (group?.is_default) {
      toast({ title: "O grupo padrão não pode ser excluído", variant: "destructive" });
      setDeleteConfirmId(null);
      return;
    }

    // Unlink sessions first
    await supabase.from("sessions").update({ group_id: null }).eq("group_id", groupId);
    const { error } = await supabase.from("patient_groups").delete().eq("id", groupId);
    if (error) { toast({ title: "Erro ao excluir grupo", variant: "destructive" }); }
    else { toast({ title: "Grupo excluído" }); }
    setDeleteConfirmId(null);
    void fetchData();
  };

  const handlePatientStatusChange = async (nextStatus: PatientStatusSelectValue) => {
    if (nextStatus === "delete") {
      if (!canDeletePatient) {
        return;
      }

      setDeletePatientDialogOpen(true);
      return;
    }

    if (!patient || patient.status === nextStatus) {
      return;
    }

    setUpdatingPatientStatus(true);
    const { error } = await supabase
      .from("patients")
      .update({ status: nextStatus })
      .eq("id", patient.id);

    if (error) {
      toast({ title: "Erro ao atualizar status do paciente", description: error.message, variant: "destructive" });
      setUpdatingPatientStatus(false);
      return;
    }

    setPatient((current) => (current ? { ...current, status: nextStatus } : current));
    toast({ title: "Status do paciente atualizado" });
    setUpdatingPatientStatus(false);
  };

  const handleDeletePatient = async () => {
    if (!patient || !canDeletePatient) {
      return;
    }

    setDeletingPatient(true);
    const { error } = await supabase
      .from("patients")
      .delete()
      .eq("id", patient.id);

    if (error) {
      toast({ title: "Erro ao excluir paciente", description: error.message, variant: "destructive" });
      setDeletingPatient(false);
      return;
    }

    toast({ title: "Paciente excluído" });
    setDeletePatientDialogOpen(false);
    setDeletingPatient(false);
    navigate("/");
  };

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleSessionPressStart = (sessionId: string) => {
    if (selectionMode) {
      return;
    }

    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (!isIntern) {
        setSelectionMode(true);
        setSelectedSessionIds([sessionId]);
      }
    }, 420);
  };

  const handleSessionPressCancel = () => {
    clearLongPress();
  };

  const toggleSessionSelection = (sessionId: string) => {
    setSelectedSessionIds((current) =>
      current.includes(sessionId) ? current.filter((id) => id !== sessionId) : [...current, sessionId]
    );
  };

  const handleSessionNavigate = (sessionId: string) => {
    if (selectionMode) {
      toggleSessionSelection(sessionId);
      return;
    }

    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    navigate(`/pacientes/${id}/sessao/${sessionId}`);
  };

  const handleExitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedSessionIds([]);
    longPressTriggeredRef.current = false;
    clearLongPress();
  };

  const profileMap = useMemo(
    () => new Map(profiles.map((item) => [item.id, item])),
    [profiles]
  );

  const getSessionSearchText = useCallback(
    (session: Session) => {
      const preview = getSessionPreviewContent(session, baseSchema);
      return [
        preview.complaint,
        preview.treatment,
        getSessionPersonLabel(profileMap.get(session.user_id)),
      ]
        .filter(Boolean)
        .join(" ");
    },
    [baseSchema, profileMap]
  );

  const sessionView = useMemo(
    () =>
      buildPatientSessionsView({
        groups,
        sessions,
        filters: {
          searchTerm,
          sessionStatus: sessionStatusFilter,
          groupStatus: groupStatusFilter,
        },
        getSessionText: getSessionSearchText,
      }),
    [getSessionSearchText, groupStatusFilter, groups, searchTerm, sessionStatusFilter, sessions]
  );

  const selectedSessions = useMemo(
    () => sessions.filter((session) => selectedSessionIds.includes(session.id)),
    [selectedSessionIds, sessions]
  );

  const canDeleteSelection = canDeleteSelectedSessions(selectedSessions);

  const handleBulkMove = async (nextGroupId: string) => {
    if (selectedSessionIds.length === 0) {
      return;
    }

    setBulkUpdating(true);
    const { error } = await supabase
      .from("sessions")
      .update({ group_id: nextGroupId === "none" ? null : nextGroupId })
      .in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao mover atendimentos", description: error.message, variant: "destructive" });
      setBulkUpdating(false);
      return;
    }

    toast({ title: "Atendimentos movidos" });
    handleExitSelectionMode();
    setBulkUpdating(false);
    void fetchData();
  };

  const handleBulkStatusUpdate = async (nextStatus: string) => {
    if (selectedSessionIds.length === 0) {
      return;
    }

    setBulkUpdating(true);
    const { error } = await supabase
      .from("sessions")
      .update({ status: nextStatus })
      .in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      setBulkUpdating(false);
      return;
    }

    toast({ title: "Status dos atendimentos atualizado" });
    handleExitSelectionMode();
    setBulkUpdating(false);
    void fetchData();
  };

  const handleBulkDelete = async () => {
    if (!canDeleteSelection) {
      toast({
        title: "Só é possível excluir rascunhos",
        description: "Remova da seleção os atendimentos concluídos ou cancelados para excluir em lote.",
        variant: "destructive",
      });
      return;
    }

    setBulkUpdating(true);
    const { error } = await supabase.from("sessions").delete().in("id", selectedSessionIds);

    if (error) {
      toast({ title: "Erro ao excluir atendimentos", description: error.message, variant: "destructive" });
      setBulkUpdating(false);
      return;
    }

    toast({ title: "Atendimentos excluídos" });
    handleExitSelectionMode();
    setBulkUpdating(false);
    void fetchData();
  };

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedGroups((current) => ({
      ...current,
      [groupId]: !current[groupId],
    }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!patient) {
    return <div className="text-center py-24 text-muted-foreground">Paciente não encontrado.</div>;
  }

  const sharePasswordAvailable = !!getPatientRegistrationPassword(patient.cpf);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} aria-label="Voltar">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{patient.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            {patient.age && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {patient.age} anos</span>}
            {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {patient.phone}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={patient.status}
            onValueChange={(value) => void handlePatientStatusChange(value as PatientStatusSelectValue)}
            disabled={updatingPatientStatus || deletingPatient}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PATIENT_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
              ))}
              {canDeletePatient ? (
                <SelectItem value={DELETE_PATIENT_STATUS_OPTION.value} className="text-destructive focus:text-destructive">
                  {DELETE_PATIENT_STATUS_OPTION.label}
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => navigate(`/pacientes/${id}/cadastro`)}>
            <ClipboardEdit className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Cadastro Completo</span>
          </Button>
          <Button onClick={() => navigate(`/pacientes/${id}/sessao/novo`)}>
            <Plus className="h-4 w-4 mr-2" />
            <span>Novo Atendimento</span>
          </Button>
        </div>
      </div>

      {/* Expandable patient info */}
      <Card>
        <button
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors rounded-lg"
          onClick={() => setShowInfo(!showInfo)}
        >
          <span className="font-medium text-sm">Mais informações</span>
          {showInfo ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <CardContent className="pt-0 pb-4 space-y-5">
                {/* Dados básicos */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dados Básicos</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <InfoField label="Nome completo" value={patient.name} />
                    <InfoField
                      label="Data de nascimento"
                      value={patient.date_of_birth ? new Date(`${patient.date_of_birth}T12:00:00`).toLocaleDateString("pt-BR") : null}
                    />
                    <InfoField label="Idade" value={patient.age ? `${patient.age} anos` : null} />
                    <InfoField label="CPF" value={patient.cpf} />
                    <InfoField label="Telefone" value={patient.phone} />
                    <InfoField label="E-mail" value={patient.email} />
                    <InfoField label="Status" value={patient.status} capitalize />
                    <InfoField label="Cadastrado em" value={new Date(patient.created_at).toLocaleDateString("pt-BR")} />
                  </div>
                </div>

                {/* Dados pessoais */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dados Pessoais</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <InfoField label="Gênero" value={patient.gender} capitalize />
                    <InfoField label="Pronome" value={patient.pronoun} />
                    <InfoField label="RG" value={patient.rg} />
                    <InfoField label="Tipo sanguíneo" value={patient.blood_type} />
                    <InfoField label="Profissão" value={patient.profession} />
                  </div>
                </div>

                {/* Endereço */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Endereço</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <InfoField label="CEP" value={patient.cep} />
                    <InfoField label="Rua" value={patient.street} />
                    <InfoField label="Número" value={patient.address_number} />
                    <InfoField label="Complemento" value={patient.address_complement} />
                    <InfoField label="Bairro" value={patient.neighborhood} />
                    <InfoField label="Cidade" value={patient.city} />
                    <InfoField label="Estado" value={patient.state} />
                    <InfoField label="País" value={patient.country} />
                  </div>
                </div>

                {/* Histórico clínico */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Histórico Clínico</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <InfoField label="Problemas crônicos" value={patient.chronic_conditions} />
                    <InfoField label="Cirurgias" value={patient.surgeries} />
                    <InfoField label="Medicamentos contínuos" value={patient.continuous_medications} />
                    <InfoField label="Alergias" value={patient.allergies} />
                    <InfoField label="Observações clínicas" value={patient.clinical_notes} />
                  </div>
                </div>

                <div className="pt-2 flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate(`/pacientes/${id}/cadastro`)}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />
                    Editar dados cadastrais
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleOpenShareDialog()}
                    disabled={generatingShareLink || !sharePasswordAvailable || patient.registration_complete}
                  >
                    {generatingShareLink ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Share2 className="h-3.5 w-3.5 mr-2" />}
                    Compartilhar com o paciente
                  </Button>
                  {patient.registration_complete && (
                    <Badge variant="outline" className="text-success border-success/30 bg-success/10">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Cadastro concluído
                    </Badge>
                  )}
                </div>
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      {/* Group management toolbar */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold">Grupos & Atendimentos</h2>
          {!isIntern && (
            <Button variant="outline" size="sm" onClick={openNewGroup}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Novo Grupo
            </Button>
          )}
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr),180px,180px]">
            <div className="space-y-2">
              <Label htmlFor="sessions-search">Buscar por grupo ou atendimento</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="sessions-search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Ex: lombar, rascunho, 18/03/2026"
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status do atendimento</Label>
              <Select value={sessionStatusFilter} onValueChange={setSessionStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {SESSION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status do grupo</Label>
              <Select value={groupStatusFilter} onValueChange={setGroupStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {GROUP_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {!isIntern && selectionMode && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-wrap items-center gap-3 p-4">
              <Badge variant="secondary">{selectedSessionIds.length} atendimento(s) selecionado(s)</Badge>
              <Select onValueChange={(value) => void handleBulkMove(value)} disabled={bulkUpdating || selectedSessionIds.length === 0}>
                <SelectTrigger className="w-[220px] bg-background">
                  <SelectValue placeholder="Mover para grupo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem grupo</SelectItem>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={(value) => void handleBulkStatusUpdate(value)} disabled={bulkUpdating || selectedSessionIds.length === 0}>
                <SelectTrigger className="w-[220px] bg-background">
                  <SelectValue placeholder="Alterar status" />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void handleBulkDelete()}
                disabled={bulkUpdating || !canDeleteSelection}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir rascunhos
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExitSelectionMode} disabled={bulkUpdating}>
                <X className="h-4 w-4 mr-2" />
                Cancelar seleção
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Groups with sessions */}
      {sessionView.groups.map((groupView) => (
        <Card key={groupView.group.id}>
          <CardHeader className={`border-l-4 rounded-tl-lg ${groupBorderColors[groupView.group.color] || ""}`}>
            <div className="flex items-start justify-between gap-3">
              <button
                type="button"
                className="flex flex-1 items-start justify-between text-left"
                onClick={() => toggleGroupCollapsed(groupView.group.id)}
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-lg">{groupView.group.name}</CardTitle>
                    {!groupView.group.is_default && groupView.group.status && (
                      <Badge variant="outline" className={groupStatusBadgeStyles[groupView.group.status as PatientGroupStatus]}>
                        {GROUP_STATUSES.find((status) => status.value === groupView.group.status)?.label || "Em andamento"}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span>{groupView.sessionCount} atendimento{groupView.sessionCount !== 1 ? "s" : ""}</span>
                    <span>Primeiro: {formatSessionMetaDate(groupView.firstSessionDate)}</span>
                    <span>Mais recente: {formatSessionMetaDate(groupView.latestSessionDate)}</span>
                  </div>
                </div>
                {collapsedGroups[groupView.group.id] ? <ChevronDown className="mt-1 h-4 w-4 text-muted-foreground" /> : <ChevronUp className="mt-1 h-4 w-4 text-muted-foreground" />}
              </button>
              <div className="flex items-center gap-1">
                {!isIntern && !groupView.group.is_default && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditGroup(groupView.group)} aria-label="Editar grupo">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {!isIntern && !groupView.group.is_default && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirmId(groupView.group.id)} aria-label="Excluir grupo">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <AnimatePresence initial={false}>
            {!collapsedGroups[groupView.group.id] && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-4 space-y-3">
                  {groupView.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      baseSchema={baseSchema}
                      creatorName={getSessionPersonLabel(profileMap.get(session.user_id))}
                      creatorIsIntern={shouldShowSessionCreatorInternBadge(profileMap.get(session.user_id)?.job_title)}
                      session={session}
                      isSelected={selectedSessionIds.includes(session.id)}
                      selectionMode={!isIntern && selectionMode}
                      borderClassName={groupBorderColors[groupView.group.color] || ""}
                      onPressStart={() => handleSessionPressStart(session.id)}
                      onPressCancel={handleSessionPressCancel}
                      onToggleSelect={() => toggleSessionSelection(session.id)}
                      navigateTo={() => handleSessionNavigate(session.id)}
                    />
                  ))}
                  {groupView.sessions.length === 0 && <p className="text-sm text-muted-foreground py-2">Nenhum atendimento neste grupo.</p>}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ))}

      {/* Ungrouped sessions */}
      {sessionView.ungrouped.length > 0 && (
        <Card>
          <CardHeader>
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => toggleGroupCollapsed("ungrouped")}
            >
              <div>
                <CardTitle className="text-lg">Atendimentos sem grupo</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">{sessionView.ungrouped.length} atendimento{sessionView.ungrouped.length !== 1 ? "s" : ""}</p>
              </div>
              {collapsedGroups.ungrouped ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CardHeader>
          <AnimatePresence initial={false}>
            {!collapsedGroups.ungrouped && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-4 space-y-3">
                  {sessionView.ungrouped.map((session) => (
                    <SessionCard
                      key={session.id}
                      baseSchema={baseSchema}
                      creatorName={getSessionPersonLabel(profileMap.get(session.user_id))}
                      creatorIsIntern={shouldShowSessionCreatorInternBadge(profileMap.get(session.user_id)?.job_title)}
                      session={session}
                      isSelected={selectedSessionIds.includes(session.id)}
                      selectionMode={!isIntern && selectionMode}
                      onPressStart={() => handleSessionPressStart(session.id)}
                      onPressCancel={handleSessionPressCancel}
                      onToggleSelect={() => toggleSessionSelection(session.id)}
                      navigateTo={() => handleSessionNavigate(session.id)}
                    />
                  ))}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      )}

      {sessionView.groups.length === 0 && sessionView.ungrouped.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum resultado encontrado para a busca ou filtros atuais.</p>
        </Card>
      )}

      {sessions.length === 0 && groups.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Nenhum atendimento registrado.</p>
        </Card>
      )}

      {/* Group create/edit dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingGroup ? "Editar Grupo" : "Novo Grupo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do grupo</Label>
              <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Ex: Lombalgia crônica" />
            </div>
            <div className="space-y-2">
              <Label>Status do grupo</Label>
              <Select value={groupStatus} onValueChange={(value) => setGroupStatus(value as PatientGroupStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <Select value={groupColor} onValueChange={setGroupColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GROUP_COLORS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full bg-group-${c.value}`} />
                        {c.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveGroup} disabled={!groupName.trim() || savingGroup}>
              {savingGroup ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingGroup ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir grupo?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Os atendimentos deste grupo serão mantidos, mas ficarão sem grupo.</p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => deleteConfirmId && handleDeleteGroup(deleteConfirmId)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deletePatientDialogOpen} onOpenChange={setDeletePatientDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir paciente?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Essa ação apaga o paciente definitivamente, junto com grupos e atendimentos vinculados. Não dá para desfazer.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={deletingPatient}>Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => void handleDeletePatient()} disabled={deletingPatient}>
              {deletingPatient ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartilhar com o paciente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {shareCompleted ? (
              <div className="rounded-lg border border-success/30 bg-success/10 px-4 py-3 text-sm text-success">
                Cadastro concluído! Caso precise atualizar alguma informação, informe o profissional que está te atendendo.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Link do cadastro</Label>
                  <div className="flex gap-2">
                    <Input value={shareLink} readOnly />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await navigator.clipboard.writeText(shareLink);
                        toast({ title: "Link copiado" });
                      }}
                    >
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </Button>
                  </div>
                </div>
                <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                  <p className="font-medium">Senha de acesso</p>
                  <p className="text-muted-foreground mt-1">
                    Oriente o paciente a usar os 6 primeiros dígitos do CPF para abrir o formulário.
                  </p>
                  <p className="mt-2 font-mono text-base">{sharePassword}</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default PacienteDetalhe;
