import React from "react";
import { Building2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface EmptyClinicsCalloutProps {
  userEmail?: string;
  onCreateClinic?: () => void;
}

export const EmptyClinicsCallout: React.FC<EmptyClinicsCalloutProps> = React.memo(({
  onCreateClinic,
}) => {
  const navigate = useNavigate();

  const handleCreate = React.useCallback(() => {
    if (onCreateClinic) {
      onCreateClinic();
    } else {
      navigate("/onboarding-clinica?mode=create");
    }
  }, [onCreateClinic, navigate]);

  return (
    <div
      data-testid="empty-clinics-callout"
      className="rounded-2xl border border-dashed border-border/80 bg-muted/15 p-5 sm:p-7 text-left space-y-5"
    >
      <div className="text-center max-w-lg mx-auto space-y-1.5">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Espaço Enterprise</span>
        </div>
        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
          Nenhuma clínica vinculada
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Você tem permissão para provisionar um novo espaço clínico institucional na Pluri Health.
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <Card className="relative overflow-hidden border-primary/25 bg-card/95 hover:border-primary/50 transition-all duration-200 shadow-xs flex flex-col justify-between">
          <div className="absolute top-0 right-0 h-24 w-24 bg-primary/5 rounded-bl-full pointer-events-none" />
          <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-base tracking-tight flex items-center gap-1.5">
                  Criar novo espaço
                </h4>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Monte a estrutura da nova unidade ou clínica, gerencie acessos, prontuários e equipes multidisciplinares.
                </p>
              </div>
            </div>

            <Button
              onClick={handleCreate}
              className="w-full min-h-[44px] gap-2 font-medium shadow-xs"
              data-testid="empty-clinics-create-btn"
            >
              <Plus className="h-4 w-4" />
              <span>Criar espaço agora</span>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

EmptyClinicsCallout.displayName = "EmptyClinicsCallout";
