import { Building2, ShieldCheck, HeartHandshake } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { ClinicHealthInsurancesCard } from "./ClinicHealthInsurancesCard";

export const ClinicInsurancesSection = () => {
  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <HeartHandshake className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Planos de Saúde & Convênios</CardTitle>
              <CardDescription className="text-xs">
                Configure as operadoras parceiras aceitas pela clínica, prazos de faturamento e regras de reembolso.
              </CardDescription>
            </div>
          </div>
          <ComponentHelpButton helpId="settings-insurances-guide" size="sm" />
        </CardHeader>
      </Card>

      {/* Dica Informativa Dispensável do Módulo de Convênios */}
      <DismissibleInfoTip
        id="settings-clinic-insurances-guide"
        scope="user"
        className="text-xs leading-relaxed"
      >
        <div className="space-y-3">
          <p className="font-medium text-foreground">
            Configure as operadoras parceiras aceitas pela clínica, prazos de faturamento e regras de reembolso.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <div className="rounded-lg border bg-background/60 p-3 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-primary" />
                Credenciamento Direto
              </span>
              <p className="text-muted-foreground">
                Cadastre aqui os convênios que pagam diretamente à clínica. Ao realizar atendimentos nessas operadoras, o sistema controla guias, autorizações e prazos contratuais de faturamento (D+30 / D+60).
              </p>
            </div>

            <div className="rounded-lg border bg-background/60 p-3 space-y-1">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                Reembolso / Livre Escolha (Universal)
              </span>
              <p className="text-muted-foreground">
                Para planos que a clínica não possui credenciamento direto, o paciente quita o valor particular e você emite o <strong>Dossiê de Reembolso</strong> com 1 clique para ele pedir o ressarcimento à operadora.
              </p>
            </div>
          </div>
        </div>
      </DismissibleInfoTip>

      {/* Gerenciamento das Operadoras Parceiras */}
      <ClinicHealthInsurancesCard />
    </div>
  );
};
