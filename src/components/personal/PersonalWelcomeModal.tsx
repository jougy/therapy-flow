import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, HeartHandshake } from "lucide-react";

interface PersonalWelcomeModalProps {
  userId?: string;
  userName?: string;
}

const safeGetItem = (key: string): string | null => {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key: string, value: string): void => {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // Graceful fallback for Safari private mode or quota limits
  }
};

const sanitizeGreetingName = (name?: string): string => {
  if (!name) return "";
  const cleaned = name
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return !(code <= 31 || (code >= 127 && code <= 159));
    })
    .join("")
    .trim();
  const first = cleaned.split(/\s+/)[0] || "";
  return first.slice(0, 50);
};

export const PersonalWelcomeModal: React.FC<PersonalWelcomeModalProps> = React.memo(({
  userId,
  userName,
}) => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const storageKey = `pluri_welcome_seen_${userId}`;
    const alreadySeen = safeGetItem(storageKey);
    if (!alreadySeen) {
      setOpen(true);
    }
  }, [userId]);

  const handleClose = React.useCallback(() => {
    if (userId) {
      const storageKey = `pluri_welcome_seen_${userId}`;
      safeSetItem(storageKey, new Date().toISOString());
    }
    setOpen(false);
  }, [userId]);

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      handleClose();
    } else {
      setOpen(true);
    }
  }, [handleClose]);

  const firstName = React.useMemo(() => sanitizeGreetingName(userName), [userName]);
  const greetingName = firstName ? `, ${firstName}` : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        data-testid="personal-welcome-modal"
        className="sm:max-w-md p-0 overflow-hidden border-border/80 shadow-2xl rounded-2xl bg-card"
      >
        {/* Banner com gradiente e logo elegante Pluri Health */}
        <div className="relative overflow-hidden bg-gradient-to-br from-cyan-500/15 via-blue-600/10 to-indigo-600/15 px-6 pt-8 pb-6 text-center border-b border-border/50">
          <div className="absolute -top-12 -right-12 h-36 w-36 rounded-full bg-cyan-400/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-blue-600/20 blur-2xl pointer-events-none" />

          {/* Logotipo / Ícone */}
          <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-background/90 p-2 shadow-md ring-1 ring-border/60">
            <img
              src="/branding/logo/pluri_health_icon_gradient.svg"
              alt="Pluri Health"
              className="h-10 w-10 object-contain drop-shadow-xs"
            />
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Seu novo centro de prática clínica</span>
          </div>

          <DialogHeader className="space-y-1.5 text-center">
            <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              {greetingName
                ? `Bem-vindo(a) à Pluri Health, ${firstName}!`
                : "Bem-vindo(a) à Pluri Health!"}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Estamos muito felizes em ter você aqui. Seu Espaço Pessoal é o ponto de partida para organizar sua rotina, gerenciar consultórios e impulsionar seus atendimentos.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Corpo acolhedor com destaques rápidos */}
        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-muted/80 bg-muted/30 p-3.5 flex items-start gap-3">
            <div className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary shrink-0">
              <HeartHandshake className="h-4 w-4" />
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground font-semibold block mb-0.5">
                Feito para o profissional de saúde moderno
              </strong>
              Acesse suas clínicas ativas, crie seu próprio consultório ou acompanhe suas métricas clínicas com total segurança e conformidade ética.
            </div>
          </div>

          <Button
            onClick={handleClose}
            className="w-full h-11 min-h-[44px] text-sm font-semibold shadow-md gap-2 rounded-xl"
            data-testid="welcome-start-button"
          >
            <span>Explorar meu espaço</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
});

PersonalWelcomeModal.displayName = "PersonalWelcomeModal";
