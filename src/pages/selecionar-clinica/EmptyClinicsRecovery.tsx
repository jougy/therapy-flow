import React from "react";
import { Loader2, RefreshCw, WifiOff, Sparkles, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyClinicsRecoveryProps {
  isSearching: boolean;
  searchAttempt: number;
  maxAttempts?: number;
  statusMessage?: string;
  onSearchClinics: () => void | Promise<void>;
}

export const EmptyClinicsRecovery: React.FC<EmptyClinicsRecoveryProps> = React.memo(({
  isSearching,
  searchAttempt,
  maxAttempts = 3,
  statusMessage,
  onSearchClinics,
}) => {
  return (
    <div
      data-testid="empty-clinics-recovery"
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-muted/15 p-6 sm:p-8 text-center space-y-4"
    >
      {/* Ícone de status dinâmico */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs transition-transform duration-300">
        {isSearching ? (
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        ) : searchAttempt >= maxAttempts ? (
          <WifiOff className="h-7 w-7 text-amber-500" />
        ) : (
          <Sparkles className="h-7 w-7 text-primary" />
        )}
      </div>

      {/* Conteúdo textual humanizado */}
      <div className="max-w-md space-y-1.5">
        <h3 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
          {isSearching
            ? "Localizando seus espaços..."
            : searchAttempt >= maxAttempts
            ? "Conexão instável ou lenta"
            : "Nenhum espaço exibido no momento"}
        </h3>

        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {statusMessage ||
            (isSearching
              ? `Tentando reconectar aos seus dados com carinho (tentativa ${searchAttempt} de ${maxAttempts})...`
              : searchAttempt >= maxAttempts
              ? "Não conseguimos carregar suas clínicas agora. Isso costuma acontecer quando o sinal da internet oscila ou ao retornar após alguns dias sem acesso."
              : "Não encontramos clínicas sincronizadas nesta sessão. Clique no botão abaixo para buscar novamente.")}
        </p>
      </div>

      {/* Dicas rápidas amigáveis quando esgotam as tentativas */}
      {!isSearching && searchAttempt >= maxAttempts && (
        <div className="w-full max-w-sm rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-left text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <div className="flex items-center gap-1.5 font-medium">
            <HelpCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Dicas rápidas para reconectar:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] sm:text-xs opacity-90 pl-1">
            <li>Verifique se o seu Wi-Fi ou dados móveis (4G/5G) estão ativos.</li>
            <li>Se estiver no celular, tente alternar o modo avião por alguns segundos.</li>
            <li>Em seguida, clique no botão abaixo para tentar novamente.</li>
          </ul>
        </div>
      )}

      {/* Botão de busca manual */}
      <div className="pt-1 w-full sm:w-auto">
        <Button
          type="button"
          variant={searchAttempt >= maxAttempts ? "default" : "outline"}
          size="default"
          data-testid="search-clinics-btn"
          disabled={isSearching}
          onClick={() => void onSearchClinics()}
          className="w-full sm:w-auto gap-2 text-sm font-medium h-10 px-5 shadow-xs"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Buscando clínicas...</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              <span>Buscar minhas clínicas</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
});

EmptyClinicsRecovery.displayName = "EmptyClinicsRecovery";
