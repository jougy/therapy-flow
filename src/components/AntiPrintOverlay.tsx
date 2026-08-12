import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, EyeOff, Lock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AntiPrintOverlayProps {
  isVisible: boolean;
  onDismiss: () => void;
}

export const AntiPrintOverlay: React.FC<AntiPrintOverlayProps> = ({
  isVisible,
  onDismiss,
}) => {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 backdrop-blur-md bg-neutral-950/70 select-none overflow-y-auto"
          style={{ WebkitBackdropFilter: "blur(12px)" }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 350, damping: 25 }}
            className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-neutral-900/95 p-6 sm:p-8 shadow-2xl border border-neutral-200/50 dark:border-neutral-800 backdrop-blur-xl space-y-6 text-center relative overflow-hidden"
          >
            {/* Ambient background glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header Icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 ring-8 ring-amber-500/10 shadow-inner">
              <ShieldAlert className="h-8 w-8" />
            </div>

            {/* Title & Badge */}
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-semibold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5" /> Proteção Anti-Print Ativa
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-neutral-900 dark:text-neutral-50 tracking-tight">
                Captura de Tela Detectada
              </h2>
            </div>

            {/* Refined Institutional Security Message */}
            <p className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed font-normal bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-neutral-100 dark:border-neutral-800 text-left">
              Atenção: Esta tela contém dados protegidos e não permite capturas de tela. Para compartilhar informações com a equipe ou paciente, utilize os recursos oficiais de compartilhamento interno da plataforma ou a opção de impressão autorizada.
            </p>

            {/* Quick Tips */}
            <div className="flex items-center justify-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <EyeOff className="w-3.5 h-3.5 text-amber-500" /> Visão Desfocada
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-primary" /> Registro de Auditoria
              </span>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <Button
                onClick={onDismiss}
                className="w-full h-12 text-base font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-white rounded-xl shadow-lg transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" /> Entendi
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
