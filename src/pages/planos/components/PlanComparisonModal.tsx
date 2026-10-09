import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface PlanComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlanComparisonModal: React.FC<PlanComparisonModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 rounded-2xl bg-card text-card-foreground">
        <DialogHeader className="text-center pb-2">
          <div className="mx-auto mb-1.5 px-3 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider border border-blue-500/20 w-fit">
            Matriz Oficial de Planos
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-extrabold text-foreground">
            Tabela Comparativa de Planos — Pluri Fisio
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Visão dissertativa e técnica completa das funcionalidades por perfil de uso
          </DialogDescription>
        </DialogHeader>

        {/* Container responsivo com scroll horizontal para telas menores */}
        <div className="w-full overflow-x-auto my-3 border rounded-xl shadow-xs">
          <table className="w-full border-collapse text-left text-xs min-w-[760px]">
            <thead>
              <tr className="bg-muted/60 dark:bg-muted/30 border-b">
                <th className="p-3 font-bold text-muted-foreground uppercase text-[11px] w-[20%]">Parâmetro</th>
                <th className="p-3 text-center border-l">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase">
                    Profissional
                  </span>
                  <div className="font-bold text-sm text-foreground mt-1">Básico</div>
                  <div className="text-primary font-extrabold text-xs">R$ 57,00/mês</div>
                </th>
                <th className="p-3 text-center border-l">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase">
                    Profissional
                  </span>
                  <div className="font-bold text-sm text-foreground mt-1">Médio</div>
                  <div className="text-primary font-extrabold text-xs">R$ 87,00/mês</div>
                </th>
                <th className="p-3 text-center border-l">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[10px] font-bold uppercase">
                    Profissional
                  </span>
                  <div className="font-bold text-sm text-foreground mt-1">Top</div>
                  <div className="text-primary font-extrabold text-xs">R$ 127,00/mês</div>
                </th>
                <th className="p-3 text-center border-l">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase">
                    Clínica
                  </span>
                  <div className="font-bold text-sm text-foreground mt-1">Básico</div>
                  <div className="text-primary font-extrabold text-xs">R$ 147,00/mês</div>
                </th>
                <th className="p-3 text-center border-l">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase">
                    Clínica
                  </span>
                  <div className="font-bold text-sm text-foreground mt-1">Médio</div>
                  <div className="text-primary font-extrabold text-xs">R$ 267,00/mês</div>
                </th>
                <th className="p-3 text-center border-l">
                  <span className="inline-block px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-bold uppercase">
                    Clínica
                  </span>
                  <div className="font-bold text-sm text-foreground mt-1">Top</div>
                  <div className="text-primary font-extrabold text-xs">R$ 447,00/mês</div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y text-center">
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">Acessos Simultâneos</td>
                <td className="p-3 border-l"><strong>1 acesso</strong> individual</td>
                <td className="p-3 border-l"><strong>1 acesso</strong> individual</td>
                <td className="p-3 border-l text-blue-600 dark:text-blue-400 font-bold">2 acessos (Você + Apoio)</td>
                <td className="p-3 border-l text-blue-600 dark:text-blue-400 font-bold">2 acessos simultâneos</td>
                <td className="p-3 border-l text-blue-600 dark:text-blue-400 font-bold">4 acessos simultâneos</td>
                <td className="p-3 border-l text-blue-600 dark:text-blue-400 font-bold">8 acessos simultâneos</td>
              </tr>
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">Limite de Colaboradores</td>
                <td className="p-3 border-l">1 profissional titular</td>
                <td className="p-3 border-l">1 profissional titular</td>
                <td className="p-3 border-l">2 (Titular + Apoio)</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitado</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitado</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitado</td>
              </tr>
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">Pacientes e Atendimentos</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Ilimitados</td>
              </tr>
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">Duplicação Rápida (30s)</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">✓ Incluso</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">✓ Incluso</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">✓ Incluso</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">✓ Incluso</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">✓ Incluso</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">✓ Incluso</td>
              </tr>
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">Formulários e Fichas</td>
                <td className="p-3 border-l">1 universal + 1 complementar</td>
                <td className="p-3 border-l text-purple-600 dark:text-purple-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-purple-600 dark:text-purple-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-purple-600 dark:text-purple-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-purple-600 dark:text-purple-400 font-bold">Ilimitados</td>
                <td className="p-3 border-l text-purple-600 dark:text-purple-400 font-bold">Ilimitados</td>
              </tr>
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">Modelo de Permissões</td>
                <td className="p-3 border-l">Individual autônomo</td>
                <td className="p-3 border-l">Individual autônomo</td>
                <td className="p-3 border-l font-medium">Titular + Apoio</td>
                <td className="p-3 border-l font-semibold">Padrão Fixo</td>
                <td className="p-3 border-l text-blue-600 dark:text-blue-400 font-bold">Permissões Editáveis</td>
                <td className="p-3 border-l text-purple-600 dark:text-purple-400 font-bold">Controle Total & Auditoria</td>
              </tr>
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">Módulo Financeiro</td>
                <td className="p-3 border-l">Básico</td>
                <td className="p-3 border-l">Completo</td>
                <td className="p-3 border-l font-medium">Completo + Recibos</td>
                <td className="p-3 border-l">Básico</td>
                <td className="p-3 border-l font-medium">Completo + Repasses</td>
                <td className="p-3 border-l font-medium">Completo + Repasses</td>
              </tr>
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">WhatsApp & Comunicação</td>
                <td className="p-3 border-l">Atalho de 1 toque</td>
                <td className="p-3 border-l">Atalho de 1 toque</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Lembretes automáticos</td>
                <td className="p-3 border-l">Atalho de 1 toque</td>
                <td className="p-3 border-l">Atalho de 1 toque</td>
                <td className="p-3 border-l text-emerald-600 dark:text-emerald-400 font-bold">Lembretes automáticos</td>
              </tr>
              <tr className="hover:bg-muted/40 transition-colors">
                <td className="p-3 text-left font-semibold text-foreground bg-muted/20">Posse dos Prontuários</td>
                <td className="p-3 border-l">Pertence ao profissional</td>
                <td className="p-3 border-l">Pertence ao profissional</td>
                <td className="p-3 border-l">Pertence ao profissional</td>
                <td className="p-3 border-l">Centralizado na clínica</td>
                <td className="p-3 border-l">Centralizado na clínica</td>
                <td className="p-3 border-l">Centralizado na clínica</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-muted-foreground text-center pt-1">
          * Todos os planos contam com prontuário eletrônico completo, segurança LGPD e descontos exclusivos nos ciclos Trimestral (-15%) e Anual (Até 35% OFF).
        </p>

        <div className="pt-3 border-t flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs h-9">
            Fechar Tabela
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
