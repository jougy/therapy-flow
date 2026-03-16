import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Phone, Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const groupBorderColors: Record<string, string> = {
  lavender: "border-l-group-lavender",
  sage: "border-l-group-sage",
  peach: "border-l-group-peach",
  sky: "border-l-group-sky",
  rose: "border-l-group-rose",
};

const groupBadgeColors: Record<string, string> = {
  lavender: "bg-group-lavender/40 text-foreground border-group-lavender",
  sage: "bg-group-sage/40 text-foreground border-group-sage",
  peach: "bg-group-peach/40 text-foreground border-group-peach",
  sky: "bg-group-sky/40 text-foreground border-group-sky",
  rose: "bg-group-rose/40 text-foreground border-group-rose",
};

// Mock data
const patient = {
  id: "1",
  name: "Ana Silva",
  age: 34,
  phone: "(11) 99123-4567",
  email: "ana.silva@email.com",
  birthDate: "15/05/1991",
  cpf: "123.456.789-00",
  groups: [
    {
      id: "g1",
      name: "Cervicalgia",
      color: "lavender",
      description: "Dor cervical crônica com irradiação para membros superiores",
      symptoms: ["Dor cervical", "Rigidez", "Cefaleia tensional"],
      firstSession: "10/01/2026",
      lastSession: "12/03/2026",
      sessions: [
        {
          id: "s1",
          date: "12/03/2026",
          time: "14:00 - 15:00",
          status: "concluído",
          painScore: 4,
          complexityScore: 6,
          mainComplaint: "Dor cervical após longa jornada de trabalho",
          symptoms: ["Dor cervical", "Rigidez matinal"],
        },
        {
          id: "s2",
          date: "05/03/2026",
          time: "14:00 - 15:00",
          status: "concluído",
          painScore: 6,
          complexityScore: 6,
          mainComplaint: "Piora da dor após episódio de estresse",
          symptoms: ["Dor cervical", "Cefaleia", "Tensão muscular"],
        },
      ],
    },
    {
      id: "g2",
      name: "Lombalgia",
      color: "sage",
      description: "Dor lombar recorrente",
      symptoms: ["Dor lombar", "Limitação de movimento"],
      firstSession: "20/02/2026",
      lastSession: "08/03/2026",
      sessions: [
        {
          id: "s3",
          date: "08/03/2026",
          time: "15:30 - 16:30",
          status: "concluído",
          painScore: 3,
          complexityScore: 4,
          mainComplaint: "Melhora significativa da dor lombar",
          symptoms: ["Dor lombar leve"],
        },
      ],
    },
  ],
};

const statusColors: Record<string, string> = {
  concluído: "bg-success/15 text-success border-success/20",
  cancelado: "bg-destructive/15 text-destructive border-destructive/20",
  pendente: "bg-warning/15 text-warning border-warning/20",
};

const PainIndicator = ({ score }: { score: number }) => {
  const color =
    score <= 3 ? "bg-success" : score <= 6 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-4 rounded-sm ${i < score ? color : "bg-muted"}`}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-muted-foreground">{score}/10</span>
    </div>
  );
};

const PacienteDetalhe = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/pacientes")}
          aria-label="Voltar para lista de pacientes"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{patient.name}</h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" /> {patient.age} anos
            </span>
            <span className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> {patient.phone}
            </span>
            <span className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> {patient.email}
            </span>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          <span>Novo Atendimento</span>
        </Button>
      </div>

      {/* Session Groups */}
      <div className="space-y-6">
        {patient.groups.map((group) => (
          <Card key={group.id}>
            <CardHeader className={`border-l-4 rounded-tl-lg ${groupBorderColors[group.color]}`}>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="text-lg">{group.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{group.description}</p>
                </div>
                <div className="text-xs text-muted-foreground text-right">
                  <div>{group.firstSession} — {group.lastSession}</div>
                  <div>{group.sessions.length} atendimento{group.sessions.length !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <div className="flex gap-1.5 flex-wrap mt-2">
                {group.symptoms.map((s) => (
                  <Badge
                    key={s}
                    variant="outline"
                    className={`text-xs ${groupBadgeColors[group.color]}`}
                  >
                    {s}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {group.sessions.map((session) => (
                <Card
                  key={session.id}
                  className={`border-l-4 cursor-pointer hover:shadow-md transition-shadow duration-150 ${groupBorderColors[group.color]}`}
                  onClick={() => navigate(`/pacientes/${id}/sessao/${session.id}`)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Ver sessão de ${session.date}`}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`/pacientes/${id}/sessao/${session.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between flex-wrap gap-3">
                      <div className="space-y-2 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{session.date}</span>
                          <span className="text-xs text-muted-foreground">{session.time}</span>
                          <Badge
                            variant="outline"
                            className={`text-xs ${statusColors[session.status]}`}
                          >
                            {session.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{session.mainComplaint}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          {session.symptoms.map((s) => (
                            <Badge key={s} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5 shrink-0">
                        <div>
                          <span className="text-xs text-muted-foreground block">Dor</span>
                          <PainIndicator score={session.painScore} />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Complexidade</span>
                          <PainIndicator score={session.complexityScore} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
};

export default PacienteDetalhe;
