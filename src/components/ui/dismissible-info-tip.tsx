import React, { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

export interface DismissibleInfoTipProps {
  /** Identificador único do aviso (ex: "agenda-new-event-helper") */
  id: string;
  /** Conteúdo textual ou elementos React */
  children: React.ReactNode;
  /**
   * Escopo da dispensa:
   * - "user": vinculado ao usuário logado (cada usuário tem sua própria flag)
   * - "global": vinculado ao navegador/dispositivo
   * @default "user"
   */
  scope?: "user" | "global";
  /** Estilo visual */
  variant?: "default" | "muted" | "subtle";
  /** Classes CSS adicionais */
  className?: string;
  /** Ícone customizado opcional */
  icon?: React.ReactNode;
  /** Callback opcional quando o usuário fecha o aviso */
  onDismiss?: () => void;
}

const STORAGE_PREFIX = "pluri_dismissed_infotip_";

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
    // Modo anônimo restrito ou quota excedida
  }
};

/**
 * Componente reutilizável para mensagens informativas e dicas contextuais de primeiros acessos.
 * Possui ícone informativo [i] e botão fechar [x].
 * Quando fechado, salva no localStorage e nunca mais reaparece, mesmo após relogar.
 */
export function DismissibleInfoTip({
  id,
  children,
  scope = "user",
  variant = "default",
  className,
  icon,
  onDismiss,
}: DismissibleInfoTipProps) {
  const { user } = useAuth();

  const storageKey =
    scope === "user" && user?.id
      ? `${STORAGE_PREFIX}${id}_${user.id}`
      : `${STORAGE_PREFIX}${id}_global`;

  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return safeGetItem(storageKey) === "true";
  });

  // Sincroniza se a chave mudar (ex: login/troca de usuário)
  useEffect(() => {
    setIsDismissed(safeGetItem(storageKey) === "true");
  }, [storageKey]);

  if (isDismissed) {
    return null;
  }

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    safeSetItem(storageKey, "true");
    setIsDismissed(true);
    onDismiss?.();
  };

  const variantStyles = {
    default: "border-primary/20 bg-primary/5 text-muted-foreground",
    muted: "border-border bg-muted/30 text-muted-foreground",
    subtle: "border-sky-500/20 bg-sky-50/50 dark:bg-sky-950/20 text-muted-foreground",
  };

  return (
    <div
      role="note"
      data-infotip-id={id}
      className={cn(
        "group relative flex items-start gap-2.5 rounded-lg border p-2.5 text-xs leading-relaxed transition-all duration-200",
        variantStyles[variant],
        className
      )}
    >
      <div className="mt-0.5 shrink-0 text-primary">
        {icon || <Info className="h-3.5 w-3.5" aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1 pr-6">{children}</div>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        title="Dispensar aviso permanentemente"
        aria-label="Dispensar aviso permanentemente"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default DismissibleInfoTip;
