import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CalendarDays, Search, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import AgendaWidget from "@/components/AgendaWidget";
import PatientCard, { type PatientCardData } from "@/components/PatientCard";
import { filterActivePatientGroups } from "@/lib/patient-groups";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

const Index = () => {
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, sessions: 0 });
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isSearching = search.trim().length > 0;
  const deletedPatientId =
    typeof (location.state as { deletedPatientId?: unknown } | null)?.deletedPatientId === "string"
      ? (location.state as { deletedPatientId: string }).deletedPatientId
      : null;

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const [patientsRes, groupsRes, sessionsRes] = await Promise.all([
        supabase.from("patients").select("*").order("updated_at", { ascending: false }),
        supabase.from("patient_groups").select("*"),
        supabase.from("sessions").select("id, patient_id, session_date"),
      ]);

      const pats = patientsRes.data ?? [];
      const groups = groupsRes.data ?? [];
      const sessions = sessionsRes.data ?? [];

      // Last session date per patient
      const lastSession: Record<string, string> = {};
      sessions.forEach((s) => {
        if (!lastSession[s.patient_id] || s.session_date > lastSession[s.patient_id]) {
          lastSession[s.patient_id] = s.session_date;
        }
      });

      const mapped: PatientCardData[] = pats.map((p) => ({
        id: p.id,
        name: p.name,
        gender: p.gender,
        pronoun: p.pronoun,
        date_of_birth: p.date_of_birth,
        cpf: p.cpf,
        status: p.status,
        lastSessionDate: lastSession[p.id] || null,
        groups: filterActivePatientGroups(
          groups
            .filter((g) => g.patient_id === p.id)
            .map((g) => ({ name: g.name, color: g.color, status: g.status }))
        ),
      }));

      setPatients(mapped);
      setStats({
        total: pats.length,
        active: pats.filter((p) => p.status === "ativo").length,
        sessions: sessions.length,
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

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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
            placeholder="Buscar paciente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Buscar paciente por nome"
          />
        </div>
        <Button onClick={() => navigate("/pacientes/novo")}>
          <Plus className="h-4 w-4 mr-2" />
          <span>Novo Paciente</span>
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {isSearching ? (
          <motion.div
            key="patients"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-3"
          >
            <p className="text-sm text-muted-foreground">
              {filtered.length} paciente{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>
            {filtered.map((patient) => (
              <motion.div key={patient.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }}>
                <PatientCard patient={patient} />
              </motion.div>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-muted-foreground py-12">Nenhum paciente encontrado.</p>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {dashboardStats.map((stat) => (
                <motion.div key={stat.title} variants={item}>
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
                </motion.div>
              ))}
              <motion.div variants={item}>
                <AgendaWidget />
              </motion.div>
            </div>

            {patients.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">Pacientes recentes</h2>
                <div className="space-y-2">
                  {patients.slice(0, 5).map((patient) => (
                    <PatientCard key={patient.id} patient={patient} />
                  ))}
                </div>
              </div>
            )}

            {patients.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">Nenhum paciente cadastrado ainda.</p>
                <Button className="mt-4" onClick={() => navigate("/pacientes/novo")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar primeiro paciente
                </Button>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Index;
