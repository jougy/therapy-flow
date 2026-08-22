import { CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ClinicBillingSettings } from "@/components/ClinicBillingSettings";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { useAuth } from "@/hooks/useAuth";

export const ClinicBillingSection = () => {
  const { clinicId, subscriptionPlan } = useAuth();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Assinatura e Pagamentos</CardTitle>
              <CardDescription className="text-xs">
                Gerencie o plano da clínica, limites de acessos simultâneos e faturas.
              </CardDescription>
            </div>
          </div>
          <ComponentHelpButton helpId="settings-billing-block" size="sm" />
        </CardHeader>
        <CardContent>
          <ClinicBillingSettings
            clinicId={clinicId}
            currentPlan={subscriptionPlan}
            onPlanChange={() => {}}
          />
        </CardContent>
      </Card>
    </div>
  );
};
