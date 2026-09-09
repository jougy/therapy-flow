import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, HelpCircle, ChevronDown } from "lucide-react";

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
];

/**
 * Seção de Perguntas Frequentes (FAQ) e Garantias de Segurança.
 *
 * Racional de Negócio:
 * - Aumenta a taxa de conversão esclarecendo dúvidas cruciais (sem fidelidade, conformidade LGPD/CFM).
 * - Reforça o valor do Modo Leitura estrito como garantia ética.
 *
 * Complexidade Assintótica: O(1) de tempo e espaço (tamanho de FAQ fixo).
 */
export const PlanFAQ: React.FC = React.memo(() => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleItem = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx));
  };

  return (
    <div className="z-10 w-full max-w-5xl mt-12 mb-8 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary dark:text-blue-400 text-xs font-semibold">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Transparência e Conformidade Ética</span>
        </div>
        <h3 className="text-xl sm:text-2xl font-bold text-foreground">
          Perguntas Frequentes & Garantias
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-xl mx-auto">
          Tire suas dúvidas sobre o funcionamento dos planos, segurança dos prontuários e suporte.
        </p>
      </div>

      <div className="grid gap-3 max-w-3xl mx-auto">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div
              key={index}
              className="rounded-2xl border border-border bg-card/60 dark:bg-neutral-900/40 backdrop-blur-md overflow-hidden transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleItem(index)}
                className="w-full p-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-foreground hover:text-primary transition-colors min-h-[48px]"
                aria-expanded={isOpen}
              >
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-primary shrink-0 opacity-70" />
                  {item.question}
                </span>
                <ChevronDown
                  className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-primary" : ""
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                  >
                    <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/40 dark:border-neutral-800/60">
                      {item.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
});

PlanFAQ.displayName = "PlanFAQ";
