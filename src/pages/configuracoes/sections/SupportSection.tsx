import { MessageCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";

export const SupportSection = () => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-xl">Suporte e Atendimento</CardTitle>
            <CardDescription className="text-xs">
              Fale com nosso time de atendimento para tirar dúvidas ou relatar problemas.
            </CardDescription>
          </div>
        </div>
        <ComponentHelpButton helpId="settings-support-block" size="sm" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl border p-5 bg-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground">Canal Direto no WhatsApp</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Atendimento em horário comercial de segunda a sexta das 08h às 18h.
            </p>
          </div>
          <Button asChild className="gap-2 shrink-0">
            <a
              href="https://wa.me/5511999999999?text=Ol%C3%A1%2C%20preciso%20de%20ajuda%20com%20o%20Pluri-Health"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="h-4 w-4" />
              Abrir WhatsApp
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
