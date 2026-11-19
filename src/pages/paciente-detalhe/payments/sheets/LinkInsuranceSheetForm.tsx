import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ClinicHealthInsuranceItem } from "../types";

export interface LinkInsuranceSheetFormProps {
  clinicInsurances: ClinicHealthInsuranceItem[];
  selectedInsuranceId: string;
  onSelectedInsuranceIdChange: (id: string) => void;
  customInsuranceName: string;
  onCustomInsuranceNameChange: (name: string) => void;
  cardNumber: string;
  onCardNumberChange: (card: string) => void;
  guideNumber: string;
  onGuideNumberChange: (guide: string) => void;
}

export const LinkInsuranceSheetForm: React.FC<LinkInsuranceSheetFormProps> = ({
  clinicInsurances,
  selectedInsuranceId,
  onSelectedInsuranceIdChange,
  customInsuranceName,
  onCustomInsuranceNameChange,
  cardNumber,
  onCardNumberChange,
  guideNumber,
  onGuideNumberChange,
}) => (
  <>
    <div className="space-y-1.5">
      <Label>Operadora / Convênio</Label>
      <Select value={selectedInsuranceId} onValueChange={onSelectedInsuranceIdChange}>
        <SelectTrigger className="min-h-[44px]">
          <SelectValue placeholder="Selecione a operadora" />
        </SelectTrigger>
        <SelectContent>
          {clinicInsurances.map((ins) => (
            <SelectItem key={ins.id} value={ins.id}>
              {ins.name} {ins.ans_code ? `(ANS ${ins.ans_code})` : ""}
            </SelectItem>
          ))}
          <SelectItem value="custom">Outra operadora (digitar nome)</SelectItem>
        </SelectContent>
      </Select>
    </div>

    {selectedInsuranceId === "custom" || clinicInsurances.length === 0 ? (
      <div className="space-y-1.5">
        <Label htmlFor="custom-insurance-name">Nome da operadora</Label>
        <Input
          id="custom-insurance-name"
          placeholder="Ex: Unimed, Bradesco Saúde..."
          value={customInsuranceName}
          onChange={(e) => onCustomInsuranceNameChange(e.target.value)}
          className="min-h-[44px]"
        />
      </div>
    ) : null}

    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="insurance-card-number">Nº da carteirinha</Label>
        <Input
          id="insurance-card-number"
          placeholder="0000 0000 0000"
          value={cardNumber}
          onChange={(e) => onCardNumberChange(e.target.value)}
          className="min-h-[44px]"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="insurance-guide-number">Nº da guia (opcional)</Label>
        <Input
          id="insurance-guide-number"
          placeholder="Ex: GUIA-2026-001"
          value={guideNumber}
          onChange={(e) => onGuideNumberChange(e.target.value)}
          className="min-h-[44px]"
        />
      </div>
    </div>
  </>
);
