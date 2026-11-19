import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planOptionGroups, subproductOptions } from "./platform-api";

export interface PlanAndVerticalSelectorProps {
  planValue: string;
  onPlanChange: (value: string) => void;
  subproductValue: string;
  onSubproductChange: (value: string) => void;
  planLabel?: string;
  subproductLabel?: string;
  triggerClassName?: string;
}

/**
 * Seletor reutilizável de Plano de Assinatura + Frente/Vertical (Pluri Fisio, Pluri Psy, Pluri Health, etc.) para o Backoffice.
 */
export function PlanAndVerticalSelector({
  planValue,
  onPlanChange,
  subproductValue,
  onSubproductChange,
  planLabel = "Tipo de plano",
  subproductLabel = "Frente / Vertical (Produto)",
  triggerClassName,
}: PlanAndVerticalSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>{planLabel}</Label>
        <Select value={planValue} onValueChange={onPlanChange}>
          <SelectTrigger className={triggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {planOptionGroups.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </SelectLabel>
                {group.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label>{subproductLabel}</Label>
        <Select value={subproductValue} onValueChange={onSubproductChange}>
          <SelectTrigger className={triggerClassName}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {subproductOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
