import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Check, AlertCircle, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Resultado da validação do cupom retornado pela RPC Supabase.
 */
export interface CouponValidationResult {
  valid: boolean;
  coupon_id?: string;
  code?: string;
  description?: string;
  discount_type?: "PERCENTAGE" | "FIXED_AMOUNT" | "TRIAL_DAYS";
  discount_value?: number;
  message?: string;
}

export interface PlanCouponInputProps {
  /** Valor digitado no campo de cupom. */
  couponInput: string;
  /** Manipulador de alteração no texto do cupom. */
  onCouponInputChange: (value: string) => void;
  /** Estado de validação assíncrona em andamento. */
  validatingCoupon: boolean;
  /** Dispara a validação RPC do cupom digitado. */
  onValidateCoupon: () => void;
  /** Objeto de cupom validado e aplicado com sucesso. */
  appliedCoupon: CouponValidationResult | null;
  /** Mensagem de erro caso a validação falhe. */
  couponError: string | null;
  /** Remove o cupom aplicado atualmente. */
  onRemoveCoupon: () => void;
}

/**
 * Componente de entrada e feedback de Cupom Promocional.
 *
 * Características:
 * - Sanitização automática para uppercase.
 * - Animações suaves de entrada/saída com Framer Motion.
 * - Feedback contextual de erro ou sucesso com badge dinâmico (PERCENTAGE, FIXED_AMOUNT, TRIAL_DAYS).
 *
 * Complexidade Assintótica: O(1) de tempo e espaço.
 */
export const PlanCouponInput: React.FC<PlanCouponInputProps> = React.memo(({
  couponInput,
  onCouponInputChange,
  validatingCoupon,
  onValidateCoupon,
  appliedCoupon,
  couponError,
  onRemoveCoupon,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !validatingCoupon && couponInput.trim()) {
      e.preventDefault();
      onValidateCoupon();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="z-10 w-full max-w-xl mb-8 p-4 rounded-2xl bg-card border border-border shadow-md dark:bg-neutral-900/80 dark:border-neutral-800 backdrop-blur-xl space-y-3"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary dark:text-blue-400">
        <Tag className="w-4 h-4" />
        <span>Possui um Cupom Promocional?</span>
      </div>

      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="EX: PRIMEIROMES100, BETA50"
          value={couponInput}
          onChange={(e) => onCouponInputChange(e.target.value.toUpperCase())}
          onKeyDown={handleKeyDown}
          className="bg-background border-border text-foreground placeholder:text-muted-foreground rounded-xl h-11 text-sm font-mono tracking-wider uppercase focus:border-primary"
          aria-label="Código do cupom promocional"
        />
        <Button
          type="button"
          onClick={onValidateCoupon}
          disabled={validatingCoupon || !couponInput.trim()}
          className="font-semibold rounded-xl h-11 px-5 text-sm shrink-0 min-h-[44px]"
        >
          {validatingCoupon ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              Validando...
            </>
          ) : (
            "Aplicar"
          )}
        </Button>
      </div>

      {/* Feedback visual do cupom */}
      <AnimatePresence>
        {appliedCoupon && appliedCoupon.valid && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="font-medium">
                Cupom <strong>{appliedCoupon.code}</strong> aplicado: {appliedCoupon.description}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant="outline"
                className="border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/20 text-[10px]"
              >
                {appliedCoupon.discount_type === "PERCENTAGE" && `${appliedCoupon.discount_value}% OFF`}
                {appliedCoupon.discount_type === "FIXED_AMOUNT" && `R$ ${appliedCoupon.discount_value} OFF`}
                {appliedCoupon.discount_type === "TRIAL_DAYS" && `${appliedCoupon.discount_value} Dias Grátis`}
              </Badge>
              <button
                type="button"
                onClick={onRemoveCoupon}
                className="p-1 rounded-md text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-200 transition-colors"
                title="Remover cupom"
                aria-label="Remover cupom"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}

        {couponError && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{couponError}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

PlanCouponInput.displayName = "PlanCouponInput";
