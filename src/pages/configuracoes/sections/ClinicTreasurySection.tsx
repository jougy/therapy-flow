import { Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";

export const ClinicTreasurySection = () => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Tesouraria e Financeiro</CardTitle>
            <CardDescription className="text-xs">
              Área reservada para tesouraria, contas institucionais e visão financeira da clínica.
            </CardDescription>
          </div>
        </div>
        <ComponentHelpButton helpId="settings-treasury-block" size="sm" />
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Módulo financeiro institucional da clínica ativo e monitorado.
        </div>
      </CardContent>
    </Card>
  );
};
