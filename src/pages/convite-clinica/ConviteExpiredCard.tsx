import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface ConviteExpiredCardProps {
  isAccepted?: boolean;
  clinicName?: string | null;
  clinicRouteKey?: string | null;
}

export const ConviteExpiredCard = ({
  isAccepted = false,
  clinicName,
  clinicRouteKey,
}: ConviteExpiredCardProps = {}) => {
  if (isAccepted) {
    const destination = clinicRouteKey ? `/clinica/${clinicRouteKey}` : "/espacopessoal";
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-emerald-200 bg-card shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <CardTitle className="mt-2 text-xl font-bold">Convite já ativado!</CardTitle>
            <CardDescription className="mt-1 text-sm">
              Este convite para a clínica {clinicName || "indicada"} já foi aceito. Você já pode acessar a clínica normalmente.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" asChild>
              <Link to={destination}>Acessar Clínica Agora</Link>
            </Button>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/espacopessoal">Ir para meu espaço pessoal</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-amber-200 bg-card shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
            <AlertCircle className="h-7 w-7" />
          </div>
          <CardTitle className="mt-2 text-xl font-bold">Convite indisponível</CardTitle>
          <CardDescription className="mt-1 text-sm">
            Este convite já foi aceito, cancelado, expirou ou não existe mais no sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button className="w-full" asChild>
            <Link to="/auth">Ir para o login</Link>
          </Button>
          <Button variant="outline" className="w-full" asChild>
            <Link to="/auth/cadastro">Criar uma nova conta</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
