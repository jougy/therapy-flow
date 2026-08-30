import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentSuccessViewProps {
  clinicName: string;
  planTitle: string;
  onEnter: () => void;
}

export function PaymentSuccessView({ clinicName, planTitle, onEnter }: PaymentSuccessViewProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-8 sm:p-10 rounded-3xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-6 shadow-xl backdrop-blur-xl"
    >
      <div className="w-20 h-20 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/40 shadow-lg shadow-emerald-500/20">
        <CheckCircle2 className="w-11 h-11" />
      </div>

      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Pagamento Liquidado e Confirmado</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
          Assinatura Ativa com Sucesso!
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          O pagamento do <strong className="text-foreground">{planTitle}</strong> para <strong className="text-foreground">{clinicName}</strong> foi confirmado pela instituição financeira Asaas. Seu espaço está 100% liberado para uso.
        </p>
      </div>

      <Button
        onClick={onEnter}
        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 px-8 rounded-xl text-base shadow-xl shadow-emerald-600/30 transition-all inline-flex items-center gap-2"
      >
        <span>Acessar Meu Espaço Agora</span>
        <ArrowRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}
