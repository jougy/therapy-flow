import type { FC } from "react";
import { CalendarClock } from "lucide-react";
import AgendaWidget from "@/components/AgendaWidget";
import { Button } from "@/components/ui/button";
import { usePatientWorkspace } from "../context/PatientWorkspaceContext";

export const PatientAgendaPage: FC = () => {
  const ws = usePatientWorkspace();
  const { patient } = ws;

  if (!patient) return null;

  return (
    <div data-tutorial="patient-internal-agenda" className="w-full max-w-full min-w-0 space-y-4">
      <AgendaWidget
        fixedPatient={{ id: patient.id, name: patient.name }}
        onStartAttendance={() => void ws.handleStartAttendanceNow()}
        startAttendanceLabel="Iniciar atendimento agora"
        headerAccessory={
          <Button
            data-tutorial="patient-btn-recurrence"
            type="button"
            variant={patient.is_recurring ? "default" : "outline"}
            size="sm"
            className="h-8 min-h-[36px] rounded-xl text-xs gap-1.5 px-2.5 font-medium border-border/80 shadow-2xs hover:bg-accent transition-all active:scale-95"
            onClick={() => ws.setRecurrenceDialogOpen(true)}
            title={patient.is_recurring ? `Recorrente: ${ws.patientRecurrenceLabel}` : "Configurar recorrência"}
          >
            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{ws.patientRecurrenceLabel}</span>
          </Button>
        }
      />
    </div>
  );
};

export default PatientAgendaPage;
