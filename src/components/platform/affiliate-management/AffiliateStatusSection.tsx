import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle, Lock } from "lucide-react";
import type { AffiliateStatus } from "./types";

export interface AffiliateStatusSectionProps {
  status: AffiliateStatus;
  onStatusChange: (status: AffiliateStatus) => void;
  lockedReason: string;
  onLockedReasonChange: (reason: string) => void;
  validationError?: string | null;
}

export const AffiliateStatusSection: React.FC<AffiliateStatusSectionProps> = ({
  status,
  onStatusChange,
  lockedReason,
  onLockedReasonChange,
  validationError,
}) => {
  return (
    <div className="p-3.5 rounded-lg border space-y-3 bg-card w-full max-w-full min-w-0">
      <div className="flex items-center gap-1.5">
        <Lock className="h-4 w-4 text-destructive shrink-0" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Status & Bloqueio
        </span>
      </div>

      <div className="space-y-1">
        <Label className="text-xs font-medium">Status Operacional</Label>
        <Select value={status} onValueChange={(val) => onStatusChange(val as AffiliateStatus)}>
          <SelectTrigger data-testid="status-select-trigger" className="h-10 text-xs">
            <SelectValue placeholder="Selecione o status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Ativo (Operando normalmente)</SelectItem>
            <SelectItem value="suspended">Suspenso (Repasses retidos)</SelectItem>
            <SelectItem value="banned">Banido (Acesso revogado)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(status === "suspended" || status === "banned") && (
        <div className="space-y-1.5 pt-1">
          <Label
            htmlFor="locked-reason-input"
            className="text-xs font-semibold text-destructive flex items-center gap-1"
          >
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Motivo Obrigatório da Suspensão/Bloqueio *
          </Label>
          <Textarea
            id="locked-reason-input"
            data-testid="locked-reason-input"
            required
            rows={2}
            placeholder="Descreva a inconformidade cadastral, suspeita de fraude ou solicitação judicial..."
            className="text-xs resize-none border-destructive focus-visible:ring-destructive"
            value={lockedReason}
            onChange={(e) => onLockedReasonChange(e.target.value)}
          />
          {validationError && (
            <p className="text-[11px] text-destructive font-medium" data-testid="validation-error">
              {validationError}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
