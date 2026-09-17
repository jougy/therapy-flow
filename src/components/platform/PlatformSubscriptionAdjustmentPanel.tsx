import { CalendarPlus, Gift, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export interface SubscriptionPreview {
  dateStr: string;
  daysText: string;
  diffText: string;
  isPositive: boolean;
}

interface PlatformSubscriptionAdjustmentPanelProps {
  isCourtesy: boolean;
  onCourtesyChange: (checked: boolean) => void;
  daysAdjustment: string;
  onDaysAdjustmentChange: (days: string) => void;
  currentExpiresAt?: string | null;
  currentRemainingDays?: number | null;
  preview?: SubscriptionPreview | null;
}

const QUICK_ADD_DAYS = [7, 15, 30, 60, 90, 365] as const;
const QUICK_SUBTRACT_DAYS = [-15, -30] as const;

export const PlatformSubscriptionAdjustmentPanel = ({
  isCourtesy,
  onCourtesyChange,
  daysAdjustment,
  onDaysAdjustmentChange,
  currentExpiresAt,
  currentRemainingDays,
  preview,
}: PlatformSubscriptionAdjustmentPanelProps) => {
  const handleQuickAdd = (days: number) => {
    const current = Number(daysAdjustment) || 0;
    onDaysAdjustmentChange(String(current + days));
  };

  return (
    <div className="space-y-3 rounded-lg border bg-background/80 p-3 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" />
            <Label htmlFor="courtesy-switch" className="text-sm font-semibold cursor-pointer">
              Plano de Cortesia Parceira
            </Label>
            {isCourtesy && (
              <Badge
                variant="secondary"
                className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-medium border-emerald-500/30"
              >
                Vitalício & Gratuito
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Concede isenção permanente para clínicas parceiras/apoiadoras: nunca expira e não gera cobrança até revogação deliberada.
          </p>
        </div>
        <Switch
          id="courtesy-switch"
          checked={isCourtesy}
          onCheckedChange={onCourtesyChange}
        />
      </div>

      {!isCourtesy && (
        <div className="space-y-2 border-t pt-2.5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5">
              <CalendarPlus className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Dar / Tirar dias de assinatura</span>
            </div>
            {currentExpiresAt ? (
              <span className="text-xs text-muted-foreground">
                Vencimento atual: <strong>{new Date(currentExpiresAt).toLocaleDateString("pt-BR")}</strong> ({currentRemainingDays} dias restantes)
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">Sem vencimento ativo registrado</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="w-36">
              <Input
                type="number"
                placeholder="+/- dias (ex: 30)"
                value={daysAdjustment}
                onChange={(event) => onDaysAdjustmentChange(event.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {QUICK_ADD_DAYS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs"
                  onClick={() => handleQuickAdd(d)}
                >
                  +{d}d
                </Button>
              ))}
              {QUICK_SUBTRACT_DAYS.map((d) => (
                <Button
                  key={d}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                  onClick={() => handleQuickAdd(d)}
                >
                  {d}d
                </Button>
              ))}
              {daysAdjustment && daysAdjustment !== "0" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-xs text-muted-foreground"
                  onClick={() => onDaysAdjustmentChange("")}
                >
                  Limpar
                </Button>
              )}
            </div>
          </div>

          {preview && (
            <div className="flex items-center gap-2 rounded-md bg-primary/10 px-3 py-1.5 text-xs text-foreground font-medium">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                Novo vencimento previsto: <strong>{preview.dateStr}</strong> ({preview.daysText}) [{preview.diffText}]
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
