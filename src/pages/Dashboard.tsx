import { motion } from "framer-motion";
import { Users, CalendarDays, DollarSign, TrendingUp, Clock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const stats = [
  {
    title: "Pacientes Ativos",
    value: "48",
    change: "+3 este mês",
    icon: Users,
    accent: "text-primary",
    bgAccent: "bg-primary/10",
  },
  {
    title: "Atendimentos Hoje",
    value: "7",
    change: "2 restantes",
    icon: CalendarDays,
    accent: "text-success",
    bgAccent: "bg-success/10",
  },
  {
    title: "Receita Mensal",
    value: "R$ 12.840",
    change: "+12% vs mês anterior",
    icon: DollarSign,
    accent: "text-success",
    bgAccent: "bg-success/10",
  },
  {
    title: "Taxa de Retorno",
    value: "87%",
    change: "+2% vs mês anterior",
    icon: TrendingUp,
    accent: "text-primary",
    bgAccent: "bg-primary/10",
  },
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

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

const Dashboard = () => {
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral da sua clínica</p>
      </div>

      {/* Stats Grid - Bento Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <motion.div key={stat.title} variants={item}>
            <Card className="hover:shadow-md transition-shadow duration-150">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
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

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming Appointments */}
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

        {/* Alerts */}
        <motion.div variants={item}>
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-4">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-base font-semibold">Alertas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentAlerts.map((alert, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/10"
                >
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm">{alert.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
