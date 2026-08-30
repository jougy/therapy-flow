import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";

export type FeedbackTriggerSource = "manual" | "session_completed" | "time_connected" | string;

export interface FeedbackTriggerOptions {
  /** Tempo em milissegundos para o primeiro disparo por tempo conectado (padrão: 15 min = 900.000ms) */
  initialTimeThresholdMs?: number;
  /** Intervalo em milissegundos entre disparos periódicos por tempo (padrão: 45 min = 2.700.000ms) */
  recurringIntervalMs?: number;
  /** Cooldown após envio com sucesso em milissegundos (padrão: 4 dias = 345.600.000ms) */
  submittedCooldownMs?: number;
  /** Cooldown após dispensa manual ("Agora não" / fechar) em milissegundos (padrão: 24 horas = 86.400.000ms) */
  dismissedCooldownMs?: number;
}

export const STORAGE_KEYS = {
  LAST_SUBMITTED: "pluri_last_feedback_timestamp",
  LAST_DISMISSED: "pluri_last_feedback_dismissed_timestamp",
  SESSION_START: "pluri_session_start_timestamp",
} as const;

/**
 * Dispara evento global para solicitar abertura do feedback (ex: ao concluir atendimento)
 */
export function notifySessionCompletedFeedback(delayMs = 1500) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("pluri:trigger-feedback", {
      detail: { source: "session_completed", delayMs },
    })
  );
}

/**
 * Dispara evento global customizado para solicitar abertura do feedback
 */
export function triggerFeedbackPrompt(source: FeedbackTriggerSource = "manual", delayMs = 0, force = false) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("pluri:trigger-feedback", {
      detail: { source, delayMs, force },
    })
  );
}

export function useFeedbackTrigger(options: FeedbackTriggerOptions = {}) {
  const {
    initialTimeThresholdMs = 15 * 60 * 1000, // 15 minutos
    recurringIntervalMs = 45 * 60 * 1000,    // 45 minutos
    submittedCooldownMs = 4 * 24 * 60 * 60 * 1000, // 4 dias
    dismissedCooldownMs = 24 * 60 * 60 * 1000,    // 24 horas (1 vez por dia)
  } = options;

  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [triggerSource, setTriggerSource] = useState<FeedbackTriggerSource>("manual");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const delayedTriggerRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializa o timestamp de início da sessão do usuário
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;

    try {
      if (!sessionStorage.getItem(STORAGE_KEYS.SESSION_START)) {
        sessionStorage.setItem(STORAGE_KEYS.SESSION_START, String(Date.now()));
      }
    } catch {
      // ignore storage errors
    }
  }, [user?.id]);

  /**
   * Verifica se o usuário está em período de cooldown para gatilhos automáticos
   */
  const isInCooldown = useCallback(() => {
    if (typeof window === "undefined") return false;

    try {
      const now = Date.now();

      // 1. Cooldown de submissão recente
      const lastSubmitted = localStorage.getItem(STORAGE_KEYS.LAST_SUBMITTED);
      if (lastSubmitted) {
        const diff = now - Number(lastSubmitted);
        if (!isNaN(diff) && diff < submittedCooldownMs) {
          return true;
        }
      }

      // 2. Cooldown de dispensa recente ("Agora não" / fechar)
      const lastDismissed = localStorage.getItem(STORAGE_KEYS.LAST_DISMISSED);
      if (lastDismissed) {
        const diff = now - Number(lastDismissed);
        if (!isNaN(diff) && diff < dismissedCooldownMs) {
          return true;
        }
      }
    } catch {
      // ignore storage errors
    }

    return false;
  }, [submittedCooldownMs, dismissedCooldownMs]);

  /**
   * Abre o modal manualmente (ignora cooldown)
   */
  const openManualFeedback = useCallback(() => {
    setTriggerSource("manual");
    setIsOpen(true);
  }, []);

  /**
   * Registra dispensa ("Agora não" ou fechamento sem envio)
   */
  const dismissFeedback = useCallback(() => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.LAST_DISMISSED, String(Date.now()));
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  /**
   * Tenta abrir o modal por gatilho automático (respeitando cooldown)
   */
  const triggerAutomaticFeedback = useCallback(
    (source: FeedbackTriggerSource, delayMs = 0) => {
      if (!user?.id) return false;
      if (isInCooldown()) return false;

      if (delayedTriggerRef.current) {
        clearTimeout(delayedTriggerRef.current);
      }

      if (delayMs > 0) {
        delayedTriggerRef.current = setTimeout(() => {
          if (!isInCooldown()) {
            setTriggerSource(source);
            setIsOpen(true);
            dismissFeedback();
          }
        }, delayMs);
      } else {
        setTriggerSource(source);
        setIsOpen(true);
        dismissFeedback();
      }

      return true;
    },
    [user?.id, isInCooldown, dismissFeedback]
  );

  /**
   * Manipulador para mudança de estado aberto/fechado
   */
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && isOpen) {
        dismissFeedback();
      }
      setIsOpen(nextOpen);
    },
    [isOpen, dismissFeedback]
  );

  // Escuta evento global customizado 'pluri:trigger-feedback'
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;

    const handleFeedbackEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ source?: FeedbackTriggerSource; delayMs?: number; force?: boolean }>;
      const source = customEvent.detail?.source || "session_completed";
      const delayMs = customEvent.detail?.delayMs ?? 0;
      const force = customEvent.detail?.force ?? false;

      if (force) {
        setTriggerSource(source);
        if (delayMs > 0) {
          setTimeout(() => setIsOpen(true), delayMs);
        } else {
          setIsOpen(true);
        }
      } else {
        triggerAutomaticFeedback(source, delayMs);
      }
    };

    window.addEventListener("pluri:trigger-feedback", handleFeedbackEvent);
    return () => {
      window.removeEventListener("pluri:trigger-feedback", handleFeedbackEvent);
      if (delayedTriggerRef.current) {
        clearTimeout(delayedTriggerRef.current);
      }
    };
  }, [user?.id, triggerAutomaticFeedback]);

  // Timer para disparo por tempo conectado
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id) return;

    const checkTimeConnected = () => {
      try {
        const sessionStartStr = sessionStorage.getItem(STORAGE_KEYS.SESSION_START);
        if (!sessionStartStr) return;

        const sessionStart = Number(sessionStartStr);
        const elapsed = Date.now() - sessionStart;

        if (elapsed >= initialTimeThresholdMs && !isInCooldown() && !isOpen) {
          triggerAutomaticFeedback("time_connected");
        }
      } catch {
        // ignore
      }
    };

    // Primeira checagem após o tempo inicial
    timerRef.current = setInterval(checkTimeConnected, recurringIntervalMs);

    // Timeout inicial para atingir o initialTimeThresholdMs caso esteja na tela
    const initialTimeout = setTimeout(checkTimeConnected, initialTimeThresholdMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearTimeout(initialTimeout);
    };
  }, [user?.id, initialTimeThresholdMs, recurringIntervalMs, isInCooldown, isOpen, triggerAutomaticFeedback]);

  return {
    isOpen,
    setIsOpen: handleOpenChange,
    triggerSource,
    openManualFeedback,
    triggerAutomaticFeedback,
    dismissFeedback,
    isInCooldown,
  };
}
