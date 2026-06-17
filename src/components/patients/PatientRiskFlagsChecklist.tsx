import { Checkbox } from "@/components/ui/checkbox";
import { PATIENT_RISK_FLAG_OPTIONS, type PatientRiskFlagValue } from "@/lib/patient-clinical-profile";

interface PatientRiskFlagsChecklistProps {
  value: PatientRiskFlagValue[];
  onChange: (value: PatientRiskFlagValue[]) => void;
}

export const PatientRiskFlagsChecklist = ({ value, onChange }: PatientRiskFlagsChecklistProps) => {
  const selected = new Set(value);

  const toggleFlag = (flag: PatientRiskFlagValue, checked: boolean) => {
    const next = new Set(value);

    if (checked) {
      next.add(flag);
    } else {
      next.delete(flag);
    }

    onChange(PATIENT_RISK_FLAG_OPTIONS.map((option) => option.value).filter((option) => next.has(option)));
  };

  return (
    <section className="space-y-4 rounded-xl border border-warning/25 bg-warning/5 p-4">
      <div>
        <h3 className="text-sm font-semibold">Riscos</h3>
        <p className="text-xs text-muted-foreground">Marque os riscos que devem aparecer como alerta na ficha do paciente.</p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {PATIENT_RISK_FLAG_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex min-h-11 items-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm transition hover:bg-muted/30"
          >
            <Checkbox
              checked={selected.has(option.value)}
              onCheckedChange={(checked) => toggleFlag(option.value, checked === true)}
              aria-label={option.label}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </section>
  );
};
