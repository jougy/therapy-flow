import React from "react";
import { Building2, Mail, Plus, Sparkles, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface EmptyClinicsCalloutProps {
  userEmail?: string;
  onCreateClinic?: () => void;
}

const sanitizeDisplayEmail = (email?: string): string => {
  if (!email) return "";
  return email.replace(/[\u0000-\u001F\u007F-\u009F]/g, "").trim().slice(0, 100);
};

export const EmptyClinicsCallout: React.FC<EmptyClinicsCalloutProps> = React.memo(({
  userEmail,
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

  const sanitizedEmail = React.useMemo(() => sanitizeDisplayEmail(userEmail), [userEmail]);

  return (
    <div
      data-testid="empty-clinics-callout"
      className="rounded-2xl border border-dashed border-border/80 bg-muted/15 p-5 sm:p-7 text-left space-y-6"
    >
      <div className="text-center max-w-lg mx-auto space-y-1.5">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-1">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Comece por aqui</span>
        </div>
        <h3 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
          Nenhuma clínica ativa no momento
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Você ainda não possui vínculos com clínicas ativas. Escolha abaixo como deseja começar sua experiência na Pluri Health:
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Caminho 1: Criar o próprio espaço */}
        <Card className="relative overflow-hidden border-primary/25 bg-card/95 hover:border-primary/50 transition-all duration-200 shadow-xs flex flex-col justify-between">
          <div className="absolute top-0 right-0 h-24 w-24 bg-primary/5 rounded-bl-full pointer-events-none" />
          <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-xs">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-base tracking-tight flex items-center gap-1.5">
                  Criar meu próprio espaço
                </h4>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Monte a estrutura do seu consultório ou clínica, cadastre pacientes, personalize prontuários e gerencie sua agenda.
                </p>
              </div>
            </div>

            <Button
              onClick={handleCreate}
              className="w-full min-h-[44px] gap-2 font-medium shadow-xs"
              data-testid="empty-clinics-create-btn"
            >
              <Plus className="h-4 w-4" />
              <span>Criar meu espaço agora</span>
            </Button>
          </CardContent>
        </Card>

        {/* Caminho 2: Aguardar convite de clínica */}
        <Card className="relative overflow-hidden border-border/80 bg-card/80 hover:border-border transition-all duration-200 shadow-xs flex flex-col justify-between">
          <div className="absolute top-0 right-0 h-24 w-24 bg-muted/40 rounded-bl-full pointer-events-none" />
          <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground/80 shadow-xs">
                <Mail className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-foreground text-base tracking-tight flex items-center gap-1.5">
                  Aguardando convite de uma clínica?
                </h4>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Se você foi convidado por uma clínica parceira, peça para o administrador enviar o convite para o seu e-mail cadastrado
                  {sanitizedEmail ? (
                    <strong className="text-foreground font-semibold"> ({sanitizedEmail})</strong>
                  ) : null}
                  . Assim que enviado, o convite surgirá automaticamente aqui no topo para você aceitar com 1 clique.
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-muted/40 border border-muted/80 p-2.5 flex items-center gap-2 text-xs text-muted-foreground">
              <UserCheck className="h-4 w-4 text-primary shrink-0" />
              <span>Convites pendentes aparecem instantaneamente na sua tela.</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

EmptyClinicsCallout.displayName = "EmptyClinicsCallout";
