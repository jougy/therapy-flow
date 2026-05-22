import { ChevronRight, Clock3, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getPatientStatusMeta } from "@/lib/patient-statuses";
import { getLegacyGroupHex, getReadableTextColor, toRgbaString } from "@/lib/group-colors";
import { cn } from "@/lib/utils";

export interface PatientCardData {
  id: string;
  name: string;
  gender: string | null;
  pronoun: string | null;
  date_of_birth: string | null;
  cpf: string | null;
  status: string;
  lastSessionDate: string | null;
  groups: { name: string; color: string; status: string | null }[];
  nextAgendaSummary?: {
    description: string;
    scheduledForLabel: string;
    statusLabel: string;
    tone: "confirmed" | "late" | "next" | "unconfirmed";
    title: string;
  } | null;
  paymentSummary?: {
    amountLabel: string | null;
    description: string;
    label: string;
    tone: "credit" | "debt" | "paid" | "pending";
  } | null;
}

const formatCpf = (cpf: string) =>
  cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

const GenderIcon = ({ gender }: { gender: string | null }) => {
  if (gender === "feminino") return <span className="text-sm shrink-0" title="Feminino">♀</span>;
  if (gender === "masculino") return <span className="text-sm shrink-0" title="Masculino">♂</span>;
  return <User className="h-4 w-4 text-muted-foreground shrink-0" />;
};

const paymentToneClassNames: Record<NonNullable<PatientCardData["paymentSummary"]>["tone"], string> = {
  credit: "border-primary/25 bg-primary/10 text-primary hover:bg-primary/15",
  debt: "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
  paid: "border-success/25 bg-success/10 text-success hover:bg-success/15",
  pending: "border-warning/25 bg-warning/15 text-warning hover:bg-warning/20",
};

const agendaToneClassNames: Record<NonNullable<PatientCardData["nextAgendaSummary"]>["tone"], string> = {
  confirmed: "border-success/25 bg-success/10 text-success hover:bg-success/15",
  late: "border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15",
  next: "border-warning/25 bg-warning/15 text-warning hover:bg-warning/20",
  unconfirmed: "border-sky-500/25 bg-sky-500/10 text-sky-700 hover:bg-sky-500/15",
};

const stopCardNavigation = (event: SyntheticEvent) => event.stopPropagation();

const PatientCard = ({ patient }: { patient: PatientCardData }) => {
  const navigate = useNavigate();
  const statusMeta = getPatientStatusMeta(patient.status);

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
              className={statusMeta.badgeClassName}
            >
              {statusMeta.label}
            </Badge>
            {patient.paymentSummary && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      paymentToneClassNames[patient.paymentSummary.tone],
                    )}
                    aria-label={
                      patient.paymentSummary.amountLabel
                        ? `Pagamento: ${patient.paymentSummary.label}, ${patient.paymentSummary.amountLabel}`
                        : `Pagamento: ${patient.paymentSummary.label}`
                    }
                    title="Status financeiro"
                    onClick={stopCardNavigation}
                    onKeyDown={stopCardNavigation}
                    onPointerDown={stopCardNavigation}
                  >
                    $
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-64 space-y-2 text-sm"
                  onClick={stopCardNavigation}
                  onPointerDown={stopCardNavigation}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold",
                        paymentToneClassNames[patient.paymentSummary.tone],
                      )}
                    >
                      $
                    </span>
                    <div>
                      <p className="font-semibold">{patient.paymentSummary.label}</p>
                      {patient.paymentSummary.amountLabel ? (
                        <p className="text-xs text-muted-foreground">{patient.paymentSummary.amountLabel}</p>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{patient.paymentSummary.description}</p>
                </PopoverContent>
              </Popover>
            )}
            {patient.nextAgendaSummary && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      agendaToneClassNames[patient.nextAgendaSummary.tone],
                    )}
                    aria-label={`Agendamento: ${patient.nextAgendaSummary.scheduledForLabel}`}
                    title="Próximo agendamento"
                    onClick={stopCardNavigation}
                    onKeyDown={stopCardNavigation}
                    onPointerDown={stopCardNavigation}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-72 space-y-2 text-sm"
                  onClick={stopCardNavigation}
                  onPointerDown={stopCardNavigation}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 items-center justify-center rounded-full border",
                        agendaToneClassNames[patient.nextAgendaSummary.tone],
                      )}
                    >
                      <Clock3 className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="font-semibold">{patient.nextAgendaSummary.scheduledForLabel}</p>
                      <p className="text-xs text-muted-foreground">{patient.nextAgendaSummary.statusLabel}</p>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-foreground">{patient.nextAgendaSummary.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{patient.nextAgendaSummary.description}</p>
                </PopoverContent>
              </Popover>
            )}
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
                <Badge
                  key={g.name}
                  variant="outline"
                  className="text-xs border-transparent"
                  style={{
                    backgroundColor: toRgbaString(getLegacyGroupHex(g.color), 22),
                    color: getReadableTextColor(getLegacyGroupHex(g.color)),
                  }}
                >
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
