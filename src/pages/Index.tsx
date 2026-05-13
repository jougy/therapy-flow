import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUpDown, CalendarDays, Check, ChevronDown, ChevronUp, ListFilter, Loader2, Plus, Search, Users, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import AgendaWidget from "@/components/AgendaWidget";
import PatientCard from "@/components/PatientCard";
import {
  DEFAULT_HOME_PATIENT_SORT_KEY,
  HOME_PATIENT_SORT_OPTIONS,
  HOME_PATIENT_WEEKDAY_OPTIONS,
  buildHomePatientViews,
  getActiveHomePatientFilterCount,
  hasActiveHomePatientFilters,
  type HomeCollaboratorFilterRecord,
  type HomePatientFilters,
  type HomePatientGroupRecord,
  type HomePatientRecord,
  type HomePatientSortKey,
  type HomeSessionRecord,
} from "@/lib/home-patients-view";
import { PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";

type ClinicMembershipRow = Database["public"]["Tables"]["clinic_memberships"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const normalize = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  professional: "Profissional",
  assistant: "Assistente",
  estagiario: "Estagiário",
};

const FILTER_SECTIONS = {
  collaborator: "collaborator",
  dates: "dates",
  groups: "groups",
  statuses: "statuses",
  weekdays: "weekdays",
} as const;

type FilterSectionKey = (typeof FILTER_SECTIONS)[keyof typeof FILTER_SECTIONS];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const Index = () => {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<HomePatientRecord[]>([]);
  const [patientGroups, setPatientGroups] = useState<HomePatientGroupRecord[]>([]);
  const [collaborators, setCollaborators] = useState<HomeCollaboratorFilterRecord[]>([]);
  const [sessions, setSessions] = useState<HomeSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, sessions: 0 });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedGroupNames, setSelectedGroupNames] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedCollaboratorIds, setSelectedCollaboratorIds] = useState<string[]>([]);
  const [collaboratorQuery, setCollaboratorQuery] = useState("");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Record<FilterSectionKey, boolean>>({
    collaborator: true,
    dates: false,
    groups: true,
    statuses: true,
    weekdays: false,
  });
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [sessionDateFrom, setSessionDateFrom] = useState("");
  const [sessionDateTo, setSessionDateTo] = useState("");
  const [sortKey, setSortKey] = useState<HomePatientSortKey>(DEFAULT_HOME_PATIENT_SORT_KEY);
  const navigate = useNavigate();
  const location = useLocation();
  const { clinicId, user } = useAuth();
  const deletedPatientId =
    typeof (location.state as { deletedPatientId?: unknown } | null)?.deletedPatientId === "string"
      ? (location.state as { deletedPatientId: string }).deletedPatientId
      : null;

  const filters: HomePatientFilters = {
    collaboratorIds: selectedCollaboratorIds,
    colors: selectedColors,
    groupNames: selectedGroupNames,
    searchTerm: search,
    sessionDateFrom,
    sessionDateTo,
    statuses: selectedStatuses,
    weekdays: selectedWeekdays,
  };
  const activeFilterCount = getActiveHomePatientFilterCount(filters);
  const filtersAreActive = hasActiveHomePatientFilters(filters);
  const isShowingPatientList =
    search.trim().length > 0 || filtersAreActive || sortKey !== DEFAULT_HOME_PATIENT_SORT_KEY;
  const visiblePatients = buildHomePatientViews({
    filters,
    patientGroups,
    patients,
    sessions,
    sortKey,
  });
  const availableGroups = useMemo(
    () => Array.from(new Set(patientGroups.map((group) => group.name))).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [patientGroups],
  );
  const availableColors = useMemo(
    () => Array.from(new Set(patientGroups.map((group) => group.color))).sort((left, right) => left.localeCompare(right, "pt-BR")),
    [patientGroups],
  );
  const visibleGroups = useMemo(
    () =>
      availableGroups.filter((groupName) => {
        if (selectedColors.length === 0) {
          return true;
        }

        return patientGroups.some((group) => group.name === groupName && selectedColors.includes(group.color));
      }),
    [availableGroups, patientGroups, selectedColors],
  );
  const groupListHeightClass = visibleGroups.length <= 2 ? "max-h-[112px]" : "max-h-[240px]";
  const visibleCollaborators = useMemo(() => {
    const normalizedQuery = normalize(collaboratorQuery);

    return collaborators.filter((collaborator) => {
      if (!normalizedQuery) {
        return true;
      }

      return normalize(
        [
          collaborator.full_name,
          collaborator.email,
          collaborator.job_title,
          collaborator.operational_role,
        ].filter(Boolean).join(" "),
      ).includes(normalizedQuery);
    });
  }, [collaboratorQuery, collaborators]);
  const collaboratorListHeightClass = visibleCollaborators.length <= 2 ? "max-h-[128px]" : "max-h-[240px]";
  const recentPatients = buildHomePatientViews({
    filters: {
      collaboratorIds: [],
      colors: [],
      groupNames: [],
      searchTerm: "",
      sessionDateFrom: "",
      sessionDateTo: "",
      statuses: [],
      weekdays: [],
    },
    patientGroups,
    patients,
    sessions,
    sortKey: DEFAULT_HOME_PATIENT_SORT_KEY,
  });

  const toggleStatus = (status: string, checked: boolean | "indeterminate") => {
    setSelectedStatuses((current) => {
      if (checked === true) {
        return current.includes(status) ? current : [...current, status];
      }

      return current.filter((value) => value !== status);
    });
  };

  const toggleStringFilter = (
    value: string,
    checked: boolean | "indeterminate",
    setValues: (updater: (current: string[]) => string[]) => void,
  ) => {
    setValues((current) => {
      if (checked === true) {
        return current.includes(value) ? current : [...current, value];
      }

      return current.filter((item) => item !== value);
    });
  };

  const toggleWeekday = (weekday: number, checked: boolean | "indeterminate") => {
    setSelectedWeekdays((current) => {
      if (checked === true) {
        return current.includes(weekday) ? current : [...current, weekday];
      }

      return current.filter((value) => value !== weekday);
    });
  };

  const toggleSection = (section: FilterSectionKey) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedGroupNames([]);
    setSelectedColors([]);
    setSelectedCollaboratorIds([]);
    setCollaboratorQuery("");
    setSelectedWeekdays([]);
    setSessionDateFrom("");
    setSessionDateTo("");
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const [patientsRes, groupsRes, sessionsRes, membershipsRes, profilesRes] = await Promise.all([
        supabase.from("patients").select("*").order("updated_at", { ascending: false }),
        supabase.from("patient_groups").select("*"),
        supabase.from("sessions").select("id, patient_id, provider_id, session_date, status, user_id"),
        clinicId
          ? supabase
              .from("clinic_memberships")
              .select("user_id, operational_role, is_active, membership_status")
              .eq("clinic_id", clinicId)
          : Promise.resolve({ data: [] }),
        clinicId
          ? supabase.from("profiles").select("id, full_name, email, job_title").eq("clinic_id", clinicId)
          : Promise.resolve({ data: [] }),
      ]);

      const pats = patientsRes.data ?? [];
      const groups = groupsRes.data ?? [];
      const fetchedSessions = sessionsRes.data ?? [];
      const memberships = ((membershipsRes.data ?? []) as ClinicMembershipRow[]).filter(
        (membership) => membership.is_active && membership.membership_status === "active",
      );
      const profiles = (profilesRes.data ?? []) as Pick<ProfileRow, "email" | "full_name" | "id" | "job_title">[];
      const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
      const collaboratorRows = memberships.map<HomeCollaboratorFilterRecord>((membership) => {
        const profile = profileMap.get(membership.user_id);

        return {
          email: profile?.email ?? null,
          full_name: profile?.full_name ?? null,
          id: membership.user_id,
          job_title: profile?.job_title ?? null,
          operational_role: membership.operational_role,
        };
      });

      setPatients(pats);
      setPatientGroups(groups);
      setSessions(fetchedSessions);
      setCollaborators(collaboratorRows);
      setStats({
        total: pats.length,
        active: pats.filter((p) => p.status === "ativo").length,
        sessions: fetchedSessions.length,
      });
      setLoading(false);
    };
    fetchData();
  }, [clinicId, location.key, user]);

  useEffect(() => {
    if (!deletedPatientId) {
      return;
    }

    setPatients((current) => {
      const deletedPatient = current.find((patient) => patient.id === deletedPatientId);

      if (!deletedPatient) {
        return current;
      }

      setStats((stats) => ({
        ...stats,
        active: deletedPatient.status === "ativo" ? Math.max(0, stats.active - 1) : stats.active,
        total: Math.max(0, stats.total - 1),
      }));

      return current.filter((patient) => patient.id !== deletedPatientId);
    });
  }, [deletedPatientId]);

  const dashboardStats = [
    { title: "Pacientes Ativos", value: String(stats.active), icon: Users, accent: "text-primary", bgAccent: "bg-primary/10" },
    { title: "Total de Pacientes", value: String(stats.total), icon: Users, accent: "text-primary", bgAccent: "bg-primary/10" },
    { title: "Total de Sessões", value: String(stats.sessions), icon: CalendarDays, accent: "text-success", bgAccent: "bg-success/10" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar paciente, CPF ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar paciente por nome, CPF ou telefone"
          />
        </div>
        <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" aria-label={activeFilterCount > 0 ? `Filtro, ${activeFilterCount} ativos` : "Filtro"}>
              <ListFilter className="h-4 w-4" />
              <span>Filtro</span>
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle>Filtros</DialogTitle>
                  <DialogDescription>
                    Refine a lista por status, grupos, cores, colaborador, período e dias da semana.
                  </DialogDescription>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                  Sem filtros
                </Button>
              </div>
            </DialogHeader>
            <ScrollArea className="max-h-[70vh] pr-4">
              <div className="space-y-4">
                <Collapsible open={openSections.statuses} onOpenChange={() => toggleSection("statuses")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Status de atividade</span>
                    {openSections.statuses ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-2 pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                    {PATIENT_STATUS_OPTIONS.map((statusOption) => (
                      <label key={statusOption.value} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedStatuses.includes(statusOption.value)}
                          onCheckedChange={(checked) => toggleStatus(statusOption.value, checked)}
                          aria-label={statusOption.label}
                        />
                        <span>{statusOption.label}</span>
                      </label>
                    ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.groups} onOpenChange={() => toggleSection("groups")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Grupos</span>
                    {openSections.groups ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <ScrollArea className="w-full whitespace-nowrap">
                      <div className="flex gap-2 pb-2">
                        {availableColors.map((color) => {
                          const selected = selectedColors.includes(color);

                          return (
                            <button
                              key={color}
                              type="button"
                              className={`relative h-5 w-5 shrink-0 rounded-full transition hover:scale-105 ${selected ? "ring-2 ring-primary ring-offset-2" : ""}`}
                              onClick={() =>
                                setSelectedColors((current) =>
                                  current.includes(color) ? current.filter((item) => item !== color) : [...current, color],
                                )
                              }
                              aria-pressed={selected}
                              aria-label={`Cor ${color}`}
                              title={color}
                              style={{ backgroundColor: color }}
                            >
                              <span className="sr-only">{color}</span>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>

                    <ScrollArea className={`${groupListHeightClass} rounded-lg border`}>
                      <div className="divide-y">
                        {visibleGroups.map((groupName) => {
                          const selected = selectedGroupNames.includes(groupName);
                          const groupColor = patientGroups.find((group) => group.name === groupName)?.color ?? "#CBD5E1";

                          return (
                            <button
                              key={groupName}
                              type="button"
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                              style={{ boxShadow: `inset 4px 0 0 ${groupColor}` }}
                              onClick={() =>
                                setSelectedGroupNames((current) =>
                                  current.includes(groupName)
                                    ? current.filter((item) => item !== groupName)
                                    : [...current, groupName],
                                )
                              }
                            >
                              <Checkbox checked={selected} aria-label={groupName} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{groupName}</p>
                              </div>
                              {selected ? (
                                <Badge variant="secondary" className="gap-1">
                                  <Check className="h-3 w-3" />
                                  Selecionado
                                </Badge>
                              ) : null}
                            </button>
                          );
                        })}
                        {visibleGroups.length === 0 ? (
                          <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                            Nenhum grupo encontrado para as cores selecionadas.
                          </div>
                        ) : null}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.collaborator} onOpenChange={() => toggleSection("collaborator")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Colaborador</span>
                    {openSections.collaborator ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={collaboratorQuery}
                        onChange={(event) => setCollaboratorQuery(event.target.value)}
                        placeholder="Buscar por nome, email, função ou cargo"
                        className="pl-9"
                      />
                    </div>
                    <ScrollArea className={`${collaboratorListHeightClass} rounded-lg border`}>
                      <div className="divide-y">
                        {visibleCollaborators.map((collaborator) => {
                          const selected = selectedCollaboratorIds.includes(collaborator.id);
                          const label = collaborator.full_name ?? collaborator.email ?? collaborator.id;
                          return (
                            <button
                              key={collaborator.id}
                              type="button"
                              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                              onClick={() =>
                                setSelectedCollaboratorIds((current) =>
                                  current.includes(collaborator.id)
                                    ? current.filter((id) => id !== collaborator.id)
                                    : [...current, collaborator.id],
                                )
                              }
                            >
                              <Checkbox checked={selected} aria-label={`Selecionar ${label}`} />
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                {label.slice(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{label}</p>
                                <p className="truncate text-xs text-muted-foreground">{collaborator.email || "Sem email"}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                {collaborator.operational_role ? (
                                  <Badge variant="outline" className="hidden sm:inline-flex">
                                    {roleLabels[collaborator.operational_role] ?? collaborator.operational_role}
                                  </Badge>
                                ) : null}
                                {selected ? (
                                  <Badge variant="secondary" className="gap-1">
                                    <Check className="h-3 w-3" />
                                    Selecionado
                                  </Badge>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                        {visibleCollaborators.length === 0 ? (
                          <div className="flex items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
                            Nenhum colaborador encontrado.
                          </div>
                        ) : null}
                      </div>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.dates} onOpenChange={() => toggleSection("dates")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Período dos atendimentos</span>
                    {openSections.dates ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground" htmlFor="home-session-date-from">Data inicial</label>
                        <Input
                          id="home-session-date-from"
                          type="date"
                          value={sessionDateFrom}
                          onChange={(event) => setSessionDateFrom(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground" htmlFor="home-session-date-to">Data final</label>
                        <Input
                          id="home-session-date-to"
                          type="date"
                          value={sessionDateTo}
                          onChange={(event) => setSessionDateTo(event.target.value)}
                        />
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Collapsible open={openSections.weekdays} onOpenChange={() => toggleSection("weekdays")}>
                  <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left">
                    <span className="font-medium">Dias da semana</span>
                    {openSections.weekdays ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {HOME_PATIENT_WEEKDAY_OPTIONS.map((weekday) => (
                        <label key={weekday.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedWeekdays.includes(weekday.value)}
                            onCheckedChange={(checked) => toggleWeekday(weekday.value, checked)}
                            aria-label={weekday.label}
                          />
                          <span>{weekday.label}</span>
                        </label>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={clearFilters}>Limpar</Button>
              <Button onClick={() => setFilterDialogOpen(false)}>
                <ArrowDown className="mr-2 h-4 w-4" />
                Aplicar filtros
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Select value={sortKey} onValueChange={(value) => setSortKey(value as HomePatientSortKey)}>
          <SelectTrigger className="w-[220px]" aria-label="Ordenar pacientes">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <SelectValue />
            </div>
          </SelectTrigger>
          <SelectContent>
            {HOME_PATIENT_SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => navigate("/pacientes/novo")}>
          <Plus className="h-4 w-4 mr-2" />
          <span>Novo Paciente</span>
        </Button>
      </div>

      {filtersAreActive && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedGroupNames.length > 0 && (
            <Badge variant="secondary">Grupos: {selectedGroupNames.join(", ")}</Badge>
          )}
          {selectedColors.length > 0 && (
            <Badge variant="secondary">Cores: {selectedColors.join(", ")}</Badge>
          )}
          {selectedCollaboratorIds.length > 0 && (
            <Badge variant="secondary">
              Colaborador: {selectedCollaboratorIds
                .map((id) => collaborators.find((collaborator) => collaborator.id === id)?.full_name ?? collaborators.find((collaborator) => collaborator.id === id)?.email ?? id)
                .join(", ")}
            </Badge>
          )}
          {selectedStatuses.length > 0 && (
            <Badge variant="secondary">Status: {selectedStatuses.map((status) => PATIENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status).join(", ")}</Badge>
          )}
          {(sessionDateFrom || sessionDateTo) && (
            <Badge variant="secondary">
              Período: {sessionDateFrom || "início"} até {sessionDateTo || "hoje"}
            </Badge>
          )}
          {selectedWeekdays.length > 0 && (
            <Badge variant="secondary">
              Dias: {HOME_PATIENT_WEEKDAY_OPTIONS.filter((weekday) => selectedWeekdays.includes(weekday.value)).map((weekday) => weekday.label).join(", ")}
            </Badge>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        </div>
      )}

      {isShowingPatientList ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {visiblePatients.length} paciente{visiblePatients.length !== 1 ? "s" : ""} encontrado{visiblePatients.length !== 1 ? "s" : ""}
          </p>
          {visiblePatients.map((patient) => (
            <motion.div key={patient.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
              <PatientCard patient={patient} />
            </motion.div>
          ))}
          {visiblePatients.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum paciente encontrado.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboardStats.map((stat) => (
              <div key={stat.title}>
                <Card className="hover:shadow-md transition-shadow duration-150">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                    <div className={`p-2 rounded-lg ${stat.bgAccent}`}>
                      <stat.icon className={`h-4 w-4 ${stat.accent}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                  </CardContent>
                </Card>
              </div>
            ))}
            <div>
              <AgendaWidget />
            </div>
          </div>

          {recentPatients.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">Pacientes recentes</h2>
              <div className="space-y-2">
                {recentPatients.slice(0, 5).map((patient) => (
                  <PatientCard key={patient.id} patient={patient} />
                ))}
              </div>
            </div>
          )}

          {recentPatients.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Nenhum paciente cadastrado ainda.</p>
              <Button className="mt-4" onClick={() => navigate("/pacientes/novo")}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar primeiro paciente
              </Button>
            </Card>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default Index;
