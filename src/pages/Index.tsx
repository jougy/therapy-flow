import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CalendarDays, DollarSign, TrendingUp, Clock, AlertCircle, Search, Plus, ChevronRight, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface PatientWithGroups {
  id: string;
  name: string;
  age: number | null;
  phone: string | null;
  status: string;
  updated_at: string;
  groups: { name: string; color: string }[];
  sessionCount: number;
}

const groupBadgeColors: Record<string, string> = {
  lavender: "bg-group-lavender/40 text-foreground border-group-lavender",
  sage: "bg-group-sage/40 text-foreground border-group-sage",
  peach: "bg-group-peach/40 text-foreground border-group-peach",
  sky: "bg-group-sky/40 text-foreground border-group-sky",
  rose: "bg-group-rose/40 text-foreground border-group-rose",
};

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
  const [patients, setPatients] = useState<PatientWithGroups[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, sessions: 0 });
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSearching = search.trim().length > 0;

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setLoading(true);
      const [patientsRes, groupsRes, sessionsRes] = await Promise.all([
        supabase.from("patients").select("*").order("updated_at", { ascending: false }),
        supabase.from("patient_groups").select("*"),
        supabase.from("sessions").select("id, patient_id"),
      ]);

      const pats = patientsRes.data ?? [];
      const groups = groupsRes.data ?? [];
      const sessions = sessionsRes.data ?? [];

      const sessionCounts: Record<string, number> = {};
      sessions.forEach((s) => {
        sessionCounts[s.patient_id] = (sessionCounts[s.patient_id] || 0) + 1;
      });

      const mapped: PatientWithGroups[] = pats.map((p) => ({
        id: p.id,
        name: p.name,
        age: p.age,
        phone: p.phone,
        status: p.status,
        updated_at: p.updated_at,
        groups: groups.filter((g) => g.patient_id === p.id).map((g) => ({ name: g.name, color: g.color })),
        sessionCount: sessionCounts[p.id] || 0,
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
  }, [user]);

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const dashboardStats = [
    { title: "Pacientes Ativos", value: String(stats.active), icon: Users, accent: "text-primary", bgAccent: "bg-primary/10" },
    { title: "Total de Pacientes", value: String(stats.total), icon: Users, accent: "text-primary", bgAccent: "bg-primary/10" },
    { title: "Total de Sessões", value: String(stats.sessions), icon: CalendarDays, accent: "text-success", bgAccent: "bg-success/10" },
    { title: "Taxa de Retorno", value: stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : "—", icon: TrendingUp, accent: "text-primary", bgAccent: "bg-primary/10" },
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
                <Card
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow duration-150 group"
                  onClick={() => navigate(`/pacientes/${patient.id}`)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver detalhes de ${patient.name}`}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/pacientes/${patient.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-semibold text-sm">{patient.name}</h3>
                        <Badge
                          variant={patient.status === "ativo" ? "default" : "secondary"}
                          className={patient.status === "ativo" ? "bg-success/15 text-success border-success/20 hover:bg-success/20" : ""}
                        >
                          {patient.status === "ativo" ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                        {patient.age && <span>{patient.age} anos</span>}
                        {patient.phone && <span>{patient.phone}</span>}
                        <span>{patient.sessionCount} sessões</span>
                      </div>
                      {patient.groups.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {patient.groups.map((g) => (
                            <Badge key={g.name} variant="outline" className={`text-xs ${groupBadgeColors[g.color] || ""}`}>
                              {g.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 ml-4" />
                  </div>
                </Card>
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
            </div>

            {patients.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground mb-3">Pacientes recentes</h2>
                <div className="space-y-2">
                  {patients.slice(0, 5).map((patient) => (
                    <Card
                      key={patient.id}
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow duration-150 group"
                      onClick={() => navigate(`/pacientes/${patient.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && navigate(`/pacientes/${patient.id}`)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-sm">{patient.name}</span>
                          {patient.groups.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {patient.groups.map((g) => (
                                <Badge key={g.name} variant="outline" className={`text-xs ${groupBadgeColors[g.color] || ""}`}>
                                  {g.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </div>
                    </Card>
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
