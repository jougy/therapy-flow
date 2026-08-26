import { ChevronRight, Clock3, MessageCircle, Phone, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import type { SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getPatientStatusMeta } from "@/lib/patient-statuses";
import { getLegacyGroupHex, getReadableTextColor, toRgbaString } from "@/lib/group-colors";
import { PATIENT_RECURRENCE_WEEKDAY_OPTIONS } from "@/lib/patient-recurrence";
import { getPatientPath } from "@/lib/patient-routing";
import { cn } from "@/lib/utils";

export interface PatientCardData {
  id: string;
  patient_code?: string | null;
  name: string;
  gender: string | null;
  pronoun: string | null;
  phone?: string | null;
  recurringWeekdays?: number[];
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

interface PatientCardProps {
  patient: PatientCardData;
  onPrefetch?: (id: string, patientCode?: string | null) => void;
}

const formatCpf = (cpf: string) =>
  cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");

const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return phone;
};

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

const recurrenceWeekdayLetters = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

const stopCardNavigation = (event: SyntheticEvent) => event.stopPropagation();

const PatientCard = ({ patient, onPrefetch }: PatientCardProps) => {
  const navigate = useNavigate();
  const statusMeta = getPatientStatusMeta(patient.status);
  const recurringWeekdaySet = new Set(patient.recurringWeekdays ?? []);
  const hasRecurrence = recurringWeekdaySet.size > 0;

  const phoneDigits = (patient.phone ?? "").replace(/\D/g, "");
  const hasValidPhone = phoneDigits.length >= 10;
  const whatsappUrl = hasValidPhone
    ? `https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`}`
    : null;

  const handleTriggerPrefetch = () => {
    onPrefetch?.(patient.id, patient.patient_code);
  };

  return (
    <Card
      className="p-4 cursor-pointer hover:shadow-md transition-shadow duration-150 group select-none"
      onClick={() => navigate(getPatientPath(patient))}
      onPointerEnter={handleTriggerPrefetch}
      onFocus={handleTriggerPrefetch}
      onTouchStart={handleTriggerPrefetch}
      role="button"
      tabIndex={0}
      aria-label={`Ver detalhes de ${patient.name}`}
      onKeyDown={(e) => e.key === "Enter" && navigate(getPatientPath(patient))}
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
              data-tutorial="patient-card-status-badge"
              variant={patient.status === "ativo" ? "default" : "secondary"}
              className={statusMeta.badgeClassName}
            >
              {statusMeta.label}
            </Badge>
            {patient.paymentSummary && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    data-tutorial="patient-card-payment-icon"
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
                    data-tutorial="patient-card-clock-icon"
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
            {hasRecurrence && (
              <div
                data-tutorial="patient-card-recurrence-pill"
                className="inline-flex h-6 shrink-0 items-center gap-0.5 rounded-full border border-primary/20 bg-primary/5 px-1"
                aria-label={`Recorrência: ${PATIENT_RECURRENCE_WEEKDAY_OPTIONS
                  .filter((weekday) => recurringWeekdaySet.has(weekday.value))
                  .map((weekday) => weekday.label)
                  .join(", ")}`}
                title="Dias recorrentes do paciente"
              >
                {PATIENT_RECURRENCE_WEEKDAY_OPTIONS.map((weekday) => {
                  const isActive = recurringWeekdaySet.has(weekday.value);

                  return (
                    <span
                      key={weekday.value}
                      className={cn(
                        "inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground/45",
                      )}
                      title={weekday.label}
                    >
                      {recurrenceWeekdayLetters[weekday.value]}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div data-tutorial="patient-card-meta-info" className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
            {patient.date_of_birth && (
              <span>Nasc: {format(new Date(patient.date_of_birth + "T12:00:00"), "dd/MM/yyyy")}</span>
            )}
            {patient.cpf && <span>CPF: {formatCpf(patient.cpf)}</span>}
            {patient.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatPhone(patient.phone)}
              </span>
            )}
            {patient.lastSessionDate && (
              <span>Último atend: {format(new Date(patient.lastSessionDate), "dd/MM/yyyy")}</span>
            )}
          </div>

          {patient.groups.length > 0 && (
            <div data-tutorial="patient-card-groups-tags" className="flex gap-1.5 flex-wrap">
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

        <div className="flex items-center gap-1.5 ml-4 shrink-0">
          {whatsappUrl && (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stopCardNavigation}
              onPointerDown={stopCardNavigation}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 transition-colors hover:bg-emerald-500/20 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
              aria-label={`Conversar no WhatsApp com ${patient.name}`}
              title="Abrir WhatsApp"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
      </div>
    </Card>
  );
};

export default PatientCard;
