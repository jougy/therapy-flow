import { motion } from "framer-motion";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentRefusalAlertProps {
  message?: string;
  onRetry?: () => void;
}

export function PaymentRefusalAlert({ message, onRetry }: PaymentRefusalAlertProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-5 rounded-2xl bg-destructive/10 border border-destructive/30 text-xs sm:text-sm text-destructive flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg backdrop-blur-sm"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-xl bg-destructive/20 text-destructive shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-destructive text-sm">Transação Não Autorizada ou Recusada</p>
          <p className="text-muted-foreground text-xs leading-relaxed max-w-xl">
            {message || "A instituição financeira informou que o pagamento não foi aprovado. Verifique os dados do cartão, limite disponível ou selecione o pagamento instantâneo via PIX com 5% de desconto."}
          </p>
        </div>
      </div>

      {onRetry && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="border-destructive/40 text-destructive hover:text-destructive-foreground hover:bg-destructive/20 text-xs rounded-xl shrink-0 h-9"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Tentar Novamente
        </Button>
      )}
    </motion.div>
  );
}
