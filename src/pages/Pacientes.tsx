import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

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
  {
    id: "1",
    name: "Ana Silva",
    age: 34,
    phone: "(11) 99123-4567",
    lastSession: "12/03/2026",
    totalSessions: 18,
    status: "ativo",
    groups: [{ name: "Cervicalgia", color: "lavender" }, { name: "Lombalgia", color: "sage" }],
  },
  {
    id: "2",
    name: "Carlos Mendes",
    age: 52,
    phone: "(11) 98765-4321",
    lastSession: "10/03/2026",
    totalSessions: 6,
    status: "ativo",
    groups: [{ name: "Pós-operatório Joelho", color: "peach" }],
  },
  {
    id: "3",
    name: "Mariana Costa",
    age: 28,
    phone: "(21) 97654-3210",
    lastSession: "08/03/2026",
    totalSessions: 12,
    status: "ativo",
    groups: [{ name: "Fibromialgia", color: "rose" }],
  },
  {
    id: "4",
    name: "João Ribeiro",
    age: 45,
    phone: "(11) 91234-5678",
    lastSession: "01/02/2026",
    totalSessions: 3,
    status: "inativo",
    groups: [{ name: "Tendinite", color: "sky" }],
  },
];

const groupBadgeColors: Record<string, string> = {
  lavender: "bg-group-lavender/40 text-foreground border-group-lavender",
  sage: "bg-group-sage/40 text-foreground border-group-sage",
  peach: "bg-group-peach/40 text-foreground border-group-peach",
  sky: "bg-group-sky/40 text-foreground border-group-sky",
  rose: "bg-group-rose/40 text-foreground border-group-rose",
};

const Pacientes = () => {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = mockPatients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground text-sm mt-1">{mockPatients.length} pacientes cadastrados</p>
        </div>
        <Button onClick={() => navigate("/pacientes/novo")}>
          <Plus className="h-4 w-4 mr-2" />
          <span>Novo Paciente</span>
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar paciente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          aria-label="Buscar paciente por nome"
        />
      </div>

      <div className="space-y-3">
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
                      <Badge
                        key={g.name}
                        variant="outline"
                        className={`text-xs ${groupBadgeColors[g.color]}`}
                      >
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
          <p className="text-center text-muted-foreground py-12">
            Nenhum paciente encontrado.
          </p>
        )}
      </div>
    </motion.div>
  );
};

export default Pacientes;
