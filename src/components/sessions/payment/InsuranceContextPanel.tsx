import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { PaymentPlanFormValues } from "@/lib/payment-plans";

export interface InsuranceContextPanelProps {
  paymentPlanForm: PaymentPlanFormValues;
  onPaymentPlanFormChange: React.Dispatch<React.SetStateAction<PaymentPlanFormValues>>;
  locked?: boolean;
}

export const InsuranceContextPanel = ({
  paymentPlanForm,
  onPaymentPlanFormChange,
  locked,
}: InsuranceContextPanelProps) => {
  if (paymentPlanForm.paymentMethod !== "convenio") {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-primary/10 pb-2">
        <div>
          <span className="text-xs font-semibold text-primary block">
            Modalidade do Atendimento por Convênio
          </span>
          <span className="text-[11px] text-muted-foreground">
            Escolha se o recebimento virá da operadora ou se o paciente solicitará reembolso.
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="sm"
            variant={paymentPlanForm.insuranceMode === "reimbursement" ? "secondary" : "default"}
            className="h-7 text-xs"
            onClick={() =>
              onPaymentPlanFormChange((prev) => ({
                ...prev,
                insuranceMode: "direct_billing",
                paymentStatus: "pendente",
              }))
            }
          >
            Credenciamento Direto
          </Button>
          <Button
            type="button"
            size="sm"
            variant={paymentPlanForm.insuranceMode === "reimbursement" ? "default" : "secondary"}
            className="h-7 text-xs"
            onClick={() =>
              onPaymentPlanFormChange((prev) => ({
                ...prev,
                insuranceMode: "reimbursement",
                paymentStatus: "pago",
              }))
            }
          >
            Reembolso (Livre Escolha)
          </Button>
        </div>
      </div>

      {paymentPlanForm.insuranceMode === "reimbursement" ? (
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            O paciente pagará o valor particular diretamente à clínica e receberá o <strong>Dossiê de Reembolso</strong> para solicitar o ressarcimento no aplicativo do plano de saúde.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="plan-insurance-name" className="text-xs">Nome do Convênio do Paciente</Label>
                <span className="text-[10px] text-muted-foreground">{(paymentPlanForm.insuranceId || "").length}/60</span>
              </div>
              <Input
                id="plan-insurance-name"
                placeholder="Ex: SulAmérica, Bradesco, Amil..."
                maxLength={60}
                value={paymentPlanForm.insuranceId || ""}
                onChange={(e) =>
                  onPaymentPlanFormChange((prev) => ({ ...prev, insuranceId: e.target.value.slice(0, 60) }))
                }
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="plan-insurance-card" className="text-xs">Nº da Carteirinha / Matrícula</Label>
                <span className="text-[10px] text-muted-foreground">{(paymentPlanForm.insuranceCardNumber || "").length}/40</span>
              </div>
              <Input
                id="plan-insurance-card"
                placeholder="Ex: 0012.3456.7890"
                maxLength={40}
                value={paymentPlanForm.insuranceCardNumber || ""}
                onChange={(e) =>
                  onPaymentPlanFormChange((prev) => ({ ...prev, insuranceCardNumber: e.target.value.slice(0, 40) }))
                }
                disabled={locked}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          <p className="text-muted-foreground">
            Atendimento credenciado. A clínica receberá diretamente da operadora de saúde após o envio e fechamento do lote (D+30 / D+60).
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="plan-auth-number" className="text-xs">Nº da Guia / Senha de Autorização</Label>
                <span className="text-[10px] text-muted-foreground">{(paymentPlanForm.insuranceAuthorizationNumber || "").length}/40</span>
              </div>
              <Input
                id="plan-auth-number"
                placeholder="Ex: 987654321"
                maxLength={40}
                value={paymentPlanForm.insuranceAuthorizationNumber || ""}
                onChange={(e) =>
                  onPaymentPlanFormChange((prev) => ({
                    ...prev,
                    insuranceAuthorizationNumber: e.target.value.slice(0, 40),
                  }))
                }
                disabled={locked}
              />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <Label htmlFor="plan-direct-card" className="text-xs">Nº da Carteirinha</Label>
                <span className="text-[10px] text-muted-foreground">{(paymentPlanForm.insuranceCardNumber || "").length}/40</span>
              </div>
              <Input
                id="plan-direct-card"
                placeholder="Ex: 0012.3456.7890"
                maxLength={40}
                value={paymentPlanForm.insuranceCardNumber || ""}
                onChange={(e) =>
                  onPaymentPlanFormChange((prev) => ({ ...prev, insuranceCardNumber: e.target.value.slice(0, 40) }))
                }
                disabled={locked}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
