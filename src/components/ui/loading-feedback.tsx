import { useEffect, useState, type ReactNode } from "react";
import { Loader2, WifiOff, Wifi, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LoadingFeedbackProps {
  /** Mensagem inicial ou contexto (ex: "Carregando prontuário do paciente...") */
  message?: string;
  /** Se deve ocupar a tela inteira com layout centralizado */
  fullScreen?: boolean;
  /** Classe CSS customizada para o contêiner */
  className?: string;
  /** Callback opcional para quando o usuário clicar em tentar novamente */
  onRetry?: () => void;
  /** Slot para conteúdo adicional no rodapé do feedback */
  footer?: ReactNode;
}

export function LoadingFeedback({
  message = "Carregando informações...",
  fullScreen = false,
  className,
  onRetry,
  footer,
}: LoadingFeedbackProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true
  );

  // Monitorar conexão de rede do navegador
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Cronômetro para estágios progressivos de feedback
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Determinar mensagem e status com base no tempo e na rede
  const getFeedbackState = () => {
    if (!isOnline) {
      return {
        tone: "offline" as const,
        icon: <WifiOff className="h-6 w-6 text-destructive animate-pulse" />,
        title: "Sem conexão com a internet",
        subtitle: "Aguardando o sinal de rede restabelecer para continuar carregando...",
      };
    }

    if (elapsedSeconds < 3) {
      return {
        tone: "normal" as const,
        icon: <Loader2 className="h-6 w-6 animate-spin text-primary" />,
        title: message,
        subtitle: "Preparando tudo para você...",
      };
    }

    if (elapsedSeconds < 7) {
      return {
        tone: "normal" as const,
        icon: <Loader2 className="h-6 w-6 animate-spin text-primary" />,
        title: "Buscando dados e histórico...",
        subtitle: "Sincronizando as informações mais recentes com segurança.",
      };
    }

    if (elapsedSeconds < 13) {
      return {
        tone: "slow" as const,
        icon: <Wifi className="h-6 w-6 text-amber-500 animate-pulse" />,
        title: "A conexão parece um pouco lenta",
        subtitle: "Estamos finalizando o carregamento. Obrigado pela paciência!",
      };
    }

    return {
      tone: "delayed" as const,
      icon: <Wifi className="h-6 w-6 text-amber-500" />,
      title: "O carregamento está demorando mais do que o esperado",
      subtitle: "Verifique sua conexão de internet se a demora persistir.",
    };
  };

  const { icon, title, subtitle, tone } = getFeedbackState();

  const handleReload = () => {
    if (onRetry) {
      setElapsedSeconds(0);
      onRetry();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-300",
        fullScreen ? "min-h-[65vh] w-full" : "py-12",
        className
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center max-w-sm space-y-3">
        <div
          className={cn(
            "p-3.5 rounded-full transition-colors duration-300",
            tone === "offline"
              ? "bg-destructive/10 border border-destructive/20"
              : tone === "slow" || tone === "delayed"
              ? "bg-amber-500/10 border border-amber-500/20"
              : "bg-primary/10 border border-primary/20"
          )}
        >
          {icon}
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground tracking-tight">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{subtitle}</p>
        </div>

        {(tone === "delayed" || !isOnline) && (
          <div className="pt-2 animate-in fade-in zoom-in-95 duration-200">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReload}
              className="gap-2 text-xs font-normal shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente
            </Button>
          </div>
        )}

        {footer && <div className="pt-2">{footer}</div>}
      </div>
    </div>
  );
}
