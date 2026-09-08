import React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface CancelSubscriptionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  expiresAt?: string | null;
  submitting: boolean;
  onConfirmCancel: () => void;
}

/**
 * Modal de Confirmação para Cancelamento de Assinatura.
 *
 * Racional de Negócio & Conformidade Ética:
 * - Garante transparência total: esclarece que o cancelamento desativa a renovação automática,
 *   mas mantém o acesso pleno até a data já paga.
 * - Enfatiza que NENHUM dado clínico ou prontuário será excluído (Modo Leitura / LGPD / CFM).
 *
 * Complexidade Assintótica: O(1) de tempo e espaço.
 */
export const CancelSubscriptionModal: React.FC<CancelSubscriptionModalProps> = React.memo(({
  isOpen,
  onOpenChange,
  expiresAt,
  submitting,
  onConfirmCancel,
}) => {
  const formattedExpiry = expiresAt
    ? new Date(expiresAt).toLocaleDateString("pt-BR")
    : "vencimento atual";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-popover border text-popover-foreground sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Cancelar Assinatura
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Tem certeza que deseja cancelar a assinatura do espaço no Asaas?
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Ao cancelar, a renovação automática será desligada imediatamente. Você e sua equipe continuarão com acesso total a todos os recursos até o final do período já pago ({formattedExpiry}). Nenhum dado de paciente ou prontuário será excluído.
        </p>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="min-h-[44px]"
          >
            Manter Assinatura
          </Button>
          <Button
            onClick={onConfirmCancel}
            disabled={submitting}
            variant="destructive"
            className="font-semibold rounded-xl min-h-[44px]"
          >
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar Cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

CancelSubscriptionModal.displayName = "CancelSubscriptionModal";
