import React, { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Loader2 } from "lucide-react";
import {
  formatMoneyCents,
  parseCurrencyToCents,
  currencyDigitsToInput,
  PAYMENT_METHOD_OPTIONS,
  type SessionPaymentMethod,
} from "@/lib/session-operations";
import {
  calculateSessionUnitAmountCents,
  PAYMENT_PLAN_STATUS_OPTIONS,
  type PatientPaymentPlanRow,
} from "@/lib/payment-plans";
import { toast } from "@/components/ui/use-toast";

interface EditPaymentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PatientPaymentPlanRow;
  onPlanUpdated: (updatedPlan: PatientPaymentPlanRow) => void;
}

export const EditPaymentPlanDialog: React.FC<EditPaymentPlanDialogProps> = ({
  open,
  onOpenChange,
  plan,
  onPlanUpdated,
}) => {
  const [savingPlan, setSavingPlan] = useState(false);
  const [editName, setEditName] = useState(plan.name || "Pacote de Sessões");
  const [editTotalSessions, setEditTotalSessions] = useState(plan.total_sessions || 10);
  const [editTotalAmount, setEditTotalAmount] = useState(
    ((plan.total_amount_cents || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
  const [editPaymentMethod, setEditPaymentMethod] = useState(plan.payment_method || "nao_informado");
  const [editPaymentInstallments, setEditPaymentInstallments] = useState(plan.payment_installments || 1);
  const [editPaymentStatus, setEditPaymentStatus] = useState<"pendente" | "pago" | "parcial" | "cancelado">(
    (plan.payment_status as any) || "pago"
  );

  useEffect(() => {
    if (open) {
      setEditName(plan.name || "Pacote de Sessões");
      setEditTotalSessions(plan.total_sessions || 10);
      setEditTotalAmount(
        ((plan.total_amount_cents || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      );
      setEditPaymentMethod(plan.payment_method || "nao_informado");
      setEditPaymentInstallments(plan.payment_installments || 1);
      setEditPaymentStatus((plan.payment_status as any) || "pago");
    }
  }, [open, plan]);

  const editPreview = useMemo(() => {
    const totalAmountCents = parseCurrencyToCents(editTotalAmount);
    const sessions = Math.max(1, editTotalSessions || 1);
    const unitAmountCents = calculateSessionUnitAmountCents(totalAmountCents, sessions);
    const compensatedCents = Math.min(totalAmountCents, (plan.used_sessions || 0) * unitAmountCents);
    const remainingCreditCents = Math.max(0, totalAmountCents - compensatedCents);

    let pendingDebitCents = 0;
    if (editPaymentStatus === "pago") {
      pendingDebitCents = 0;
    } else if (editPaymentStatus === "parcial") {
      pendingDebitCents = totalAmountCents - Math.round(totalAmountCents / 2);
    } else {
      pendingDebitCents = totalAmountCents;
    }

    return {
      unitAmountCents,
      compensatedCents,
      remainingCreditCents,
      pendingDebitCents,
    };
  }, [editTotalAmount, editTotalSessions, editPaymentStatus, plan.used_sessions]);

  const handleSave = async () => {
    if (editTotalSessions < (plan.used_sessions || 0)) {
      toast({
        title: "Quantidade de sessões inválida",
        description: `O pacote já possui ${plan.used_sessions} sessões realizadas. A quantidade máxima não pode ser menor que as sessões já utilizadas.`,
        variant: "destructive",
      });
      return;
    }

    setSavingPlan(true);
    try {
      const totalAmountCents = parseCurrencyToCents(editTotalAmount);
      const unitAmountCents = calculateSessionUnitAmountCents(totalAmountCents, editTotalSessions);

      const updatedPlan: PatientPaymentPlanRow = {
        ...plan,
        name: editName.trim() || "Pacote de Sessões",
        total_sessions: editTotalSessions,
        total_amount_cents: totalAmountCents,
        session_unit_amount_cents: unitAmountCents,
        payment_method: editPaymentMethod,
        payment_installments: editPaymentInstallments,
        payment_status: editPaymentStatus,
        updated_at: new Date().toISOString(),
      };

      onPlanUpdated(updatedPlan);
      onOpenChange(false);
      toast({
        title: "Plano atualizado com sucesso",
        description: `O pacote foi reajustado para ${editTotalSessions} sessões (${formatMoneyCents(unitAmountCents)}/sessão).`,
      });
    } finally {
      setSavingPlan(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <span>Editar Plano de Sessões</span>
          </DialogTitle>
          <DialogDescription>
            Ajuste as condições gerais do pacote. Os cálculos de valor unitário e compensação serão recalculados automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-plan-name">Nome do Pacote</Label>
            <Input
              id="edit-plan-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Ex: Pacote de 10 Sessões"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-total-sessions">
                Total de Sessões (Mín: {plan.used_sessions || 0})
              </Label>
              <Input
                id="edit-total-sessions"
                type="number"
                min={Math.max(1, plan.used_sessions || 1)}
                max={100}
                value={editTotalSessions}
                onChange={(e) => setEditTotalSessions(parseInt(e.target.value, 10) || 1)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-total-amount">Valor Total (R$)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                  R$
                </span>
                <Input
                  id="edit-total-amount"
                  className="pl-10"
                  inputMode="decimal"
                  value={editTotalAmount}
                  onChange={(e) => setEditTotalAmount(currencyDigitsToInput(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Método de Pagamento</Label>
              <Select
                value={editPaymentMethod}
                onValueChange={(val) => setEditPaymentMethod(val as SessionPaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status do Pagamento</Label>
              <Select
                value={editPaymentStatus}
                onValueChange={(val) => setEditPaymentStatus(val as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_PLAN_STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-xs">
            <span className="font-semibold text-foreground block">
              Simulação dos Novos Cálculos:
            </span>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>
                Novo valor por sessão:{" "}
                <strong className="text-foreground">
                  {formatMoneyCents(editPreview.unitAmountCents)}
                </strong>
              </div>
              <div>
                Compensado ({plan.used_sessions} sessões):{" "}
                <strong className="text-success">
                  {formatMoneyCents(editPreview.compensatedCents)}
                </strong>
              </div>
              <div>
                Crédito restante:{" "}
                <strong className="text-primary">
                  {formatMoneyCents(editPreview.remainingCreditCents)}
                </strong>
              </div>
              <div>
                Débito pendente:{" "}
                <strong className={editPreview.pendingDebitCents > 0 ? "text-warning" : "text-foreground"}>
                  {formatMoneyCents(editPreview.pendingDebitCents)}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={savingPlan}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={savingPlan}
            className="gap-1.5"
          >
            {savingPlan && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Salvar Alterações</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
