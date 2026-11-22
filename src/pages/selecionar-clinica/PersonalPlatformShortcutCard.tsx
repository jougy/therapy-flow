import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PersonalPlatformShortcutCardProps {
  title: string;
  description: string;
  buttonLabel: string;
  onNavigate: () => void;
}

/**
 * Atalho no Espaço Pessoal para retornar ao painel da plataforma (Master ou Marketing).
 */
export function PersonalPlatformShortcutCard({
  title,
  description,
  buttonLabel,
  onNavigate,
}: PersonalPlatformShortcutCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <Button onClick={onNavigate}>
          <ShieldCheck className="mr-2 h-4 w-4" />
          {buttonLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
