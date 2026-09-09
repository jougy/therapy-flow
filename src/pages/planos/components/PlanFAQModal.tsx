import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, HelpCircle, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "Preciso cadastrar cartão de crédito para iniciar a degustação?",
    answer: "Sim. Para garantir a autenticidade das contas e a segurança antifraude, é necessário cadastrar um cartão de crédito válido, realizando uma cobrança simbólica de confirmação de R$ 0,01 junto ao emissor. Durante os 7 dias de degustação gratuita, nenhuma mensalidade será cobrada e você pode cancelar quando quiser sem custos.",
  },
  {
    question: "O que acontece ao final da degustação ou se eu cancelar minha assinatura?",
    answer: "Seus dados e prontuários continuam 100% seguros e acessíveis em Modo Leitura estrito. Em respeito às resoluções éticas profissionais (CFM/CFP) e à LGPD, nós nunca bloqueamos a visualização ou excluímos registros clínicos de seus pacientes.",
  },
  {
    question: "Existe contrato de fidelidade ou multa rescisória?",
    answer: "Não existe qualquer fidelidade ou multa. Você pode alterar seu ciclo de faturamento ou desativar a renovação automática a qualquer momento com apenas 1 clique.",
  },
  {
    question: "O que são 'Acessos Simultâneos'?",
    answer: "Acessos simultâneos representam a quantidade de pessoas utilizando a plataforma conectadas ao mesmo tempo no seu espaço (por exemplo, 2 secretárias e 2 profissionais atendendo simultaneamente). No plano Clínica Pro você tem 4 inclusos na base e pode expandir dinamicamente conforme sua equipe cresce.",
  },
  {
    question: "Como funciona a segurança e privacidade dos dados de saúde?",
    answer: "Todos os dados são criptografados em trânsito (TLS 1.3) e em repouso (AES-256), com isolamento estrito via Row Level Security (RLS) no PostgreSQL e conformidade integral com a LGPD e resoluções do CFP/CFM.",
  },
];

export interface PlanFAQModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal elegante contendo as Perguntas Frequentes e Garantias Éticas.
 * Evita poluição visual na viewport principal de planos.
 */
export const PlanFAQModal: React.FC<PlanFAQModalProps> = ({ isOpen, onClose }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleItem = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto p-5 sm:p-6 rounded-2xl">
        <DialogHeader className="space-y-1.5 text-left pb-2 border-b border-border/60">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold w-fit">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Transparência e Conformidade Ética</span>
          </div>
          <DialogTitle className="text-xl font-bold text-foreground">
            Perguntas Frequentes & Garantias
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Tire suas dúvidas sobre o funcionamento dos planos, segurança dos prontuários e suporte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5 pt-3">
          {FAQ_ITEMS.map((item, index) => {
            const isItemOpen = openIndex === index;
            return (
              <div
                key={index}
                className="rounded-xl border border-border bg-card/60 dark:bg-neutral-900/40 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleItem(index)}
                  className="w-full p-3.5 text-left flex items-center justify-between gap-3 font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors min-h-[44px]"
                  aria-expanded={isItemOpen}
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary shrink-0 opacity-80" />
                    {item.question}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                      isItemOpen ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isItemOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                    >
                      <div className="px-3.5 pb-3.5 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/40 dark:border-neutral-800/60">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        <div className="pt-3 border-t border-border/60 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs h-9">
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
