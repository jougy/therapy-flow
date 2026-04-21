import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpDown, ListFilter, Loader2, Plus, Search, Users, CalendarDays, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
  type HomePatientFilters,
  type HomePatientGroupRecord,
  type HomePatientRecord,
  type HomePatientSortKey,
  type HomeSessionRecord,
} from "@/lib/home-patients-view";
import { PATIENT_STATUS_OPTIONS } from "@/lib/patient-statuses";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const Index = () => {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<HomePatientRecord[]>([]);
  const [patientGroups, setPatientGroups] = useState<HomePatientGroupRecord[]>([]);
  const [sessions, setSessions] = useState<HomeSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, sessions: 0 });
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([]);
  const [sessionDateFrom, setSessionDateFrom] = useState("");
  const [sessionDateTo, setSessionDateTo] = useState("");
  const [sortKey, setSortKey] = useState<HomePatientSortKey>(DEFAULT_HOME_PATIENT_SORT_KEY);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const deletedPatientId =
    typeof (location.state as { deletedPatientId?: unknown } | null)?.deletedPatientId === "string"
      ? (location.state as { deletedPatientId: string }).deletedPatientId
      : null;

  const filters: HomePatientFilters = {
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
  const recentPatients = buildHomePatientViews({
    filters: {
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

  const toggleWeekday = (weekday: number, checked: boolean | "indeterminate") => {
    setSelectedWeekdays((current) => {
      if (checked === true) {
        return current.includes(weekday) ? current : [...current, weekday];
      }

      return current.filter((value) => value !== weekday);
    });
  };

  const clearFilters = () => {
    setSelectedStatuses([]);
    setSelectedWeekdays([]);
    setSessionDateFrom("");
    setSessionDateTo("");
  };

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const [patientsRes, groupsRes, sessionsRes] = await Promise.all([
        supabase.from("patients").select("*").order("updated_at", { ascending: false }),
        supabase.from("patient_groups").select("*"),
        supabase.from("sessions").select("id, patient_id, session_date, status"),
      ]);

      const pats = patientsRes.data ?? [];
      const groups = groupsRes.data ?? [];
      const fetchedSessions = sessionsRes.data ?? [];

      setPatients(pats);
      setPatientGroups(groups);
      setSessions(fetchedSessions);
      setStats({
        total: pats.length,
        active: pats.filter((p) => p.status === "ativo").length,
        sessions: fetchedSessions.length,
      });
      setLoading(false);
    };
    fetchData();
  }, [location.key, user]);

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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" aria-label={activeFilterCount > 0 ? `Filtro, ${activeFilterCount} ativos` : "Filtro"}>
              <ListFilter className="h-4 w-4" />
              <span>Filtro</span>
              {activeFilterCount > 0 && <Badge variant="secondary">{activeFilterCount}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold">Filtros</h3>
                <p className="text-xs text-muted-foreground">Refine a lista por status, período e dias da semana.</p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                Sem filtros
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Status de atividade</p>
              <div className="space-y-2">
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
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Período dos atendimentos</p>
              <div className="grid gap-2 sm:grid-cols-2">
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
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Dias da semana</p>
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
            </div>
          </PopoverContent>
        </Popover>
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
