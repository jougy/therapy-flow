import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AFFILIATE_TIERS,
  type AffiliateTier,
  getAffiliateTierDefinition,
} from "@/lib/affiliate-tiers";
import { Award } from "lucide-react";

export interface AffiliateTierSectionProps {
  tier: AffiliateTier;
  onTierChange: (tier: AffiliateTier) => void;
  minimumTierFloor: AffiliateTier;
  onMinimumTierFloorChange: (floor: AffiliateTier) => void;
  isTierManualOverride: boolean;
  onIsTierManualOverrideChange: (val: boolean) => void;
  firstMonthPercent: number;
  onFirstMonthPercentChange: (val: number) => void;
  recurringPercent: number;
  onRecurringPercentChange: (val: number) => void;
  isSubscriptionWaived: boolean;
  onIsSubscriptionWaivedChange: (val: boolean) => void;
  isWaiverManualOverride: boolean;
  onIsWaiverManualOverrideChange: (val: boolean) => void;
  manualTierNotes: string;
  onManualTierNotesChange: (val: string) => void;
}

export const AffiliateTierSection: React.FC<AffiliateTierSectionProps> = ({
  tier,
  onTierChange,
  minimumTierFloor,
  onMinimumTierFloorChange,
  isTierManualOverride,
  onIsTierManualOverrideChange,
  firstMonthPercent,
  onFirstMonthPercentChange,
  recurringPercent,
  onRecurringPercentChange,
  isSubscriptionWaived,
  onIsSubscriptionWaivedChange,
  isWaiverManualOverride,
  onIsWaiverManualOverrideChange,
  manualTierNotes,
  onManualTierNotesChange,
}) => {
  const handleSelectTier = (newTier: AffiliateTier) => {
    onTierChange(newTier);
    if (!isTierManualOverride) {
      const def = getAffiliateTierDefinition(newTier);
      onFirstMonthPercentChange(def.firstMonthCommissionPercent);
      onRecurringPercentChange(def.recurringCommissionPercent);
    }
  };

  return (
    <div className="space-y-3.5 w-full max-w-full min-w-0">
      {/* Bloco Tier & Alíquotas */}
      <div className="p-3.5 rounded-lg border space-y-3 bg-card w-full">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Award className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tier & Alíquotas
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="tier-override-switch" className="text-xs cursor-pointer font-medium">
              Override Manual
            </Label>
            <Switch
              id="tier-override-switch"
              data-testid="tier-override-switch"
              checked={isTierManualOverride}
              onCheckedChange={onIsTierManualOverrideChange}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Degrau / Tier Ativo</Label>
            <Select value={tier} onValueChange={(val) => handleSelectTier(val as AffiliateTier)}>
              <SelectTrigger data-testid="tier-select-trigger" className="h-10 text-xs">
                <SelectValue placeholder="Selecione o tier" />
              </SelectTrigger>
              <SelectContent>
                {AFFILIATE_TIERS.map((t) => (
                  <SelectItem key={t.tier} value={t.tier}>
                    {t.label} {t.tier === "legendary" ? "⭐ (Legendary Master)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Piso Contratual Garantido</Label>
            <Select
              value={minimumTierFloor}
              onValueChange={(val) => onMinimumTierFloorChange(val as AffiliateTier)}
            >
              <SelectTrigger data-testid="floor-select-trigger" className="h-10 text-xs">
                <SelectValue placeholder="Piso mínimo" />
              </SelectTrigger>
              <SelectContent>
                {AFFILIATE_TIERS.map((t) => (
                  <SelectItem key={t.tier} value={t.tier}>
                    {t.label} (Piso)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="first-month-input" className="text-xs font-medium">
              % 1º Mês (Fechamento)
            </Label>
            <Input
              id="first-month-input"
              data-testid="first-month-input"
              type="number"
              min={0}
              max={100}
              step={0.5}
              className="h-10 text-xs"
              value={firstMonthPercent}
              onChange={(e) => onFirstMonthPercentChange(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="recurring-input" className="text-xs font-medium">
              % Recorrente (Mensal)
            </Label>
            <Input
              id="recurring-input"
              data-testid="recurring-input"
              type="number"
              min={0}
              max={100}
              step={0.5}
              className="h-10 text-xs"
              value={recurringPercent}
              onChange={(e) => onRecurringPercentChange(parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
      </div>

      {/* Bloco Isenção de Assinatura */}
      <div className="p-3.5 rounded-lg border space-y-3 bg-card w-full">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block">
          Isenção de Assinatura da Clínica (Waiver)
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/20">
            <Label htmlFor="subscription-waived-switch" className="text-xs cursor-pointer font-medium">
              Isenção Ativa (100% OFF)
            </Label>
            <Switch
              id="subscription-waived-switch"
              data-testid="subscription-waived-switch"
              checked={isSubscriptionWaived}
              onCheckedChange={onIsSubscriptionWaivedChange}
            />
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-md border bg-muted/20">
            <Label htmlFor="waiver-override-switch" className="text-xs cursor-pointer font-medium">
              Override Manual de Isenção
            </Label>
            <Switch
              id="waiver-override-switch"
              data-testid="waiver-override-switch"
              checked={isWaiverManualOverride}
              onCheckedChange={onIsWaiverManualOverrideChange}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="manual-notes-input" className="text-xs font-medium">
            Notas do Admin / Justificativa
          </Label>
          <Textarea
            id="manual-notes-input"
            data-testid="manual-notes-input"
            placeholder="Justificativa do benefício, acordo comercial ou histórico de alíquota..."
            rows={2}
            className="text-xs resize-none"
            value={manualTierNotes}
            onChange={(e) => onManualTierNotesChange(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
