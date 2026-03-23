import { ChevronRight, User, Venus, Mars } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

const groupBadgeColors: Record<string, string> = {
  lavender: "bg-group-lavender/40 text-foreground border-group-lavender",
  sage: "bg-group-sage/40 text-foreground border-group-sage",
  peach: "bg-group-peach/40 text-foreground border-group-peach",
  sky: "bg-group-sky/40 text-foreground border-group-sky",
  rose: "bg-group-rose/40 text-foreground border-group-rose",
};

const statusMap: Record<string, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-success/15 text-success border-success/20 hover:bg-success/20" },
  inativo: { label: "Inativo", className: "" },
  pagamento_pendente: { label: "Pagamento pendente", className: "bg-warning/15 text-warning border-warning/20 hover:bg-warning/20" },
};

export interface PatientCardData {
  id: string;
  name: string;
  gender: string | null;
  pronoun: string | null;
  date_of_birth: string | null;
  cpf: string | null;
  status: string;
  lastSessionDate: string | null;
  groups: { name: string; color: string }[];
}

const formatCpf = (cpf: string) =>
  cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

const GenderIcon = ({ gender }: { gender: string | null }) => {
  if (gender === "feminino") return <Venus className="h-4 w-4 text-pink-400 shrink-0" />;
  if (gender === "masculino") return <Mars className="h-4 w-4 text-blue-400 shrink-0" />;
  return <User className="h-4 w-4 text-muted-foreground shrink-0" />;
};

const PatientCard = ({ patient }: { patient: PatientCardData }) => {
  const navigate = useNavigate();
  const st = statusMap[patient.status] || statusMap.inativo;

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-shadow duration-150 group"
      onClick={() => navigate(`/pacientes/${patient.id}`)}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalhes de ${patient.name}`}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/pacientes/${patient.id}`)}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <GenderIcon gender={patient.gender} />
            <h3 className="font-semibold text-sm">{patient.name}</h3>
            {patient.pronoun && (
              <span className="text-xs text-muted-foreground">({patient.pronoun})</span>
            )}
            <Badge
              variant={patient.status === "ativo" ? "default" : "secondary"}
              className={st.className}
            >
              {st.label}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {patient.date_of_birth && (
              <span>Nasc: {format(new Date(patient.date_of_birth + "T12:00:00"), "dd/MM/yyyy")}</span>
            )}
            {patient.cpf && <span>CPF: {formatCpf(patient.cpf)}</span>}
            {patient.lastSessionDate && (
              <span>Último atend: {format(new Date(patient.lastSessionDate), "dd/MM/yyyy")}</span>
            )}
          </div>

          {patient.groups.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
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
  );
};

export default PatientCard;
