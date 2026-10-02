import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FileText, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SessionFloatingActionPillsProps {
  visible: boolean;
  canEdit: boolean;
  saving: boolean;
  hasPatient: boolean;
  onOpenSummary: () => void;
  onSave?: (status: "concluído" | "rascunho") => void | Promise<void>;
}

/**
 * Pílulas de ação flutuantes nos cantos inferiores da tela:
 * - Canto Esquerdo: Resumo Clínico reduzido
 * - Canto Direito: Concluir e Salvar Rascunho
 * 
 * Surgem suavemente ao rolar para cima e se ocultam ao rolar para baixo ou próximo do topo.
 */
export const SessionFloatingActionPills: React.FC<SessionFloatingActionPillsProps> = ({
  visible,
  canEdit,
  saving,
  hasPatient,
  onOpenSummary,
  onSave,
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 p-4 sm:p-6 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <div className="mx-auto flex w-full max-w-[min(100vw-1.5rem,1680px)] items-end justify-between gap-3">
            {/* Canto Esquerdo: Resumo Clínico Reduzido */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 28, scale: 0.9, transition: { duration: 0.18, ease: "easeInOut" } }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 24,
                mass: 0.8,
              }}
              className="pointer-events-auto origin-bottom-left"
            >
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onOpenSummary}
                  disabled={!hasPatient}
                  title="Abrir resumo clínico do paciente"
                  className="group flex h-11 items-center gap-2 rounded-full border border-primary/25 bg-background/95 px-3.5 sm:px-4 text-xs font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur-md transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer dark:bg-zinc-900/95"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:scale-110">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="hidden sm:inline font-semibold">Resumo Clínico</span>
                  <span className="sm:hidden font-semibold">Resumo</span>
                </Button>
              </motion.div>
            </motion.div>

            {/* Canto Direito: Botões de Salvar (Apenas em Edição) */}
            {canEdit && onSave && (
              <motion.div
                initial={{ opacity: 0, y: 32, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.9, transition: { duration: 0.18, ease: "easeInOut" } }}
                transition={{
                  type: "spring",
                  stiffness: 380,
                  damping: 24,
                  mass: 0.8,
                }}
                className="pointer-events-auto origin-bottom-right"
              >
                <div className="flex items-center gap-2 rounded-full border border-border/60 bg-background/95 p-1.5 shadow-xl shadow-black/15 backdrop-blur-md dark:bg-zinc-900/95 dark:border-zinc-800">
                  {/* Concluir Atendimento */}
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void onSave("concluído")}
                      disabled={saving}
                      className="h-9 sm:h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 sm:px-4 text-xs gap-1.5 shadow-sm transition-all"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">Concluir</span>
                      <span className="sm:hidden">Concluir</span>
                    </Button>
                  </motion.div>

                  {/* Salvar Rascunho */}
                  <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.94 }}>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => void onSave("rascunho")}
                      disabled={saving}
                      className="h-9 sm:h-10 rounded-full px-2.5 sm:px-3 text-xs gap-1.5 hover:bg-muted font-medium text-muted-foreground hover:text-foreground transition-all"
                      title="Salvar como Rascunho"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span className="hidden sm:inline">Rascunho</span>
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
