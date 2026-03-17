import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CalendarDays, DollarSign, TrendingUp, Clock, AlertCircle, Search, Plus, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const stats = [
  { title: "Pacientes Ativos", value: "48", change: "+3 este mês", icon: Users, accent: "text-primary", bgAccent: "bg-primary/10" },
  { title: "Atendimentos Hoje", value: "7", change: "2 restantes", icon: CalendarDays, accent: "text-success", bgAccent: "bg-success/10" },
  { title: "Receita Mensal", value: "R$ 12.840", change: "+12% vs mês anterior", icon: DollarSign, accent: "text-success", bgAccent: "bg-success/10" },
  { title: "Taxa de Retorno", value: "87%", change: "+2% vs mês anterior", icon: TrendingUp, accent: "text-primary", bgAccent: "bg-primary/10" },
];

const upcomingAppointments = [
  { patient: "Ana Silva", time: "14:00", type: "Fisioterapia", group: "lavender" },
  { patient: "Carlos Mendes", time: "15:00", type: "Acupuntura", group: "sage" },
  { patient: "Mariana Costa", time: "16:30", type: "Fisioterapia", group: "peach" },
];

const recentAlerts = [
  { message: "Ficha de João Ribeiro incompleta", type: "warning" },
  { message: "Pagamento pendente - Lúcia Ferreira", type: "alert" },
];

const groupColorMap: Record<string, string> = {
  lavender: "border-l-group-lavender",
  sage: "border-l-group-sage",
  peach: "border-l-group-peach",
  sky: "border-l-group-sky",
  rose: "border-l-group-rose",
};

interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  lastSession: string;
  totalSessions: number;
  status: "ativo" | "inativo";
  groups: { name: string; color: string }[];
}

const mockPatients: Patient[] = [
  { id: "1", name: "Ana Silva", age: 34, phone: "(11) 99123-4567", lastSession: "12/03/2026", totalSessions: 18, status: "ativo", groups: [{ name: "Cervicalgia", color: "lavender" }, { name: "Lombalgia", color: "sage" }] },
  { id: "2", name: "Carlos Mendes", age: 52, phone: "(11) 98765-4321", lastSession: "10/03/2026", totalSessions: 6, status: "ativo", groups: [{ name: "Pós-operatório Joelho", color: "peach" }] },
  { id: "3", name: "Mariana Costa", age: 28, phone: "(21) 97654-3210", lastSession: "08/03/2026", totalSessions: 12, status: "ativo", groups: [{ name: "Fibromialgia", color: "rose" }] },
  { id: "4", name: "João Ribeiro", age: 45, phone: "(11) 91234-5678", lastSession: "01/02/2026", totalSessions: 3, status: "inativo", groups: [{ name: "Tendinite", color: "sky" }] },
];

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
  const navigate = useNavigate();
  const isSearching = search.trim().length > 0;

  const filtered = mockPatients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Search bar + New Patient */}
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
              <motion.div
                key={patient.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
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
                        <span>{patient.age} anos</span>
                        <span>{patient.phone}</span>
                        <span>Último: {patient.lastSession}</span>
                        <span>{patient.totalSessions} sessões</span>
                      </div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {patient.groups.map((g) => (
                          <Badge key={g.name} variant="outline" className={`text-xs ${groupBadgeColors[g.color]}`}>
                            {g.name}
                          </Badge>
                        ))}
                      </div>
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
              {stats.map((stat) => (
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
                      <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <motion.div variants={item} className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 pb-4">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base font-semibold">Próximos Atendimentos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {upcomingAppointments.map((apt) => (
                      <div
                        key={apt.patient + apt.time}
                        className={`flex items-center justify-between p-3 rounded-lg border-l-4 bg-muted/30 ${groupColorMap[apt.group]}`}
                      >
                        <div>
                          <p className="font-medium text-sm">{apt.patient}</p>
                          <p className="text-xs text-muted-foreground">{apt.type}</p>
                        </div>
                        <span className="text-sm font-medium text-muted-foreground">{apt.time}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={item}>
                <Card>
                  <CardHeader className="flex flex-row items-center gap-2 pb-4">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <CardTitle className="text-base font-semibold">Alertas</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {recentAlerts.map((alert, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <p className="text-sm">{alert.message}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Index;
