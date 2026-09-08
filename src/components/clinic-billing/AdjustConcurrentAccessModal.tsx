import React from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface AdjustConcurrentAccessModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  extraConcurrentCount: number;
  onExtraConcurrentCountChange: (count: number) => void;
  baseConcurrent: number;
  extraSeatRate: number;
  baseMonthlyEq: number;
  hasActiveRecurringCard?: boolean;
  submitting: boolean;
  onConfirmUpdate: () => void;
  onNavigateToCheckout: () => void;
}

/**
 * Modal para Ajuste de Acessos Simultâneos Extras (Conexões Concorrentes).
 *
 * Racional de Negócio:
 * - Permite expansão elástica de assentos sem precisar mudar de tier de plano.
 * - Fornece prévia instantânea do novo valor mensal recorrente com base na tarifa marginal do plano.
 * - Elimina conflito de botões guiando usuários sem cartão ativo diretamente ao checkout.
 *
 * Complexidade Assintótica: O(1) de tempo e espaço.
 */
export const AdjustConcurrentAccessModal: React.FC<AdjustConcurrentAccessModalProps> = React.memo(({
  isOpen,
  onOpenChange,
  extraConcurrentCount,
  onExtraConcurrentCountChange,
  baseConcurrent,
  extraSeatRate,
  baseMonthlyEq,
  hasActiveRecurringCard = false,
  submitting,
  onConfirmUpdate,
  onNavigateToCheckout,
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border text-popover-foreground sm:max-w-md rounded-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Ajustar Acessos Simultâneos Extras</DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Altere o limite de conexões simultâneas permitidas na clínica (+R$ {extraSeatRate.toFixed(2)}/mês cada).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-foreground">Acessos Extras Adicionais</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={extraConcurrentCount}
              onChange={(e) => onExtraConcurrentCountChange(Math.max(0, parseInt(e.target.value || "0", 10)))}
              className="h-11 text-base rounded-xl min-h-[44px]"
            />
          </div>

          <div className="rounded-xl bg-muted/60 border p-4 space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>Acessos Inclusos no Plano Base:</span>
              <span className="text-foreground font-medium">{baseConcurrent} acessos</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Total de Acessos Permitidos:</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {baseConcurrent + extraConcurrentCount} acessos simultâneos
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-2 border-t border-border text-sm">
              <span className="font-semibold text-foreground">Nova Mensalidade Recorrente:</span>
              <span className="text-xl font-bold text-foreground">
                R$ {(baseMonthlyEq + extraConcurrentCount * extraSeatRate).toFixed(2)}
                <span className="text-xs text-muted-foreground">/mês</span>
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row sm:justify-between">
          {hasActiveRecurringCard ? (
            <>
              <Button
                variant="outline"
                type="button"
                onClick={onNavigateToCheckout}
                disabled={submitting}
                className="border-primary/30 text-primary hover:bg-primary/10 rounded-xl min-h-[44px]"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Pagar via Checkout
              </Button>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  disabled={submitting}
                  className="min-h-[44px]"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={onConfirmUpdate}
                  disabled={submitting}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl min-h-[44px]"
                >
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Atualizar Assinatura
                </Button>
              </div>
            </>
          ) : (
            <div className="w-full flex items-center justify-between gap-2 flex-col sm:flex-row">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="min-h-[44px] text-muted-foreground order-2 sm:order-1"
              >
                Cancelar
              </Button>
              <Button
                onClick={onNavigateToCheckout}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl min-h-[44px] order-1 sm:order-2 w-full sm:w-auto"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Pagar via Checkout
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

AdjustConcurrentAccessModal.displayName = "AdjustConcurrentAccessModal";
