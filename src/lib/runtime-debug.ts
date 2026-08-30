import { useEffect, useState } from "react";

const RUNTIME_DEBUG_PREFIX = "[Pluri-Health runtime]";
const GLOBAL_RUNTIME_DEBUG_FLAG = "__PRONTO_RUNTIME_DEBUG_INSTALLED__";

export type RuntimeDebugContext = Record<string, unknown> | undefined;

export type DebugEventType = "error" | "warn" | "info" | "query" | "rpc";

export interface RuntimeDebugEvent {
  id: string;
  timestamp: number;
  timeString: string;
  type: DebugEventType;
  scope: string;
  message: string;
  context?: RuntimeDebugContext;
  errorDetails?: {
    name?: string;
    message: string;
    stack?: string;
  };
}

const MAX_DEBUG_EVENTS = 120;
let debugEvents: RuntimeDebugEvent[] = [];
const listeners = new Set<(events: RuntimeDebugEvent[]) => void>();

const notifyListeners = () => {
  const current = [...debugEvents];
  listeners.forEach((listener) => {
    try {
      listener(current);
    } catch {
      // Ignora erro no listener para resiliência
    }
  });
};

export const addDebugEvent = (
  type: DebugEventType,
  scope: string,
  message: string,
  context?: RuntimeDebugContext,
  errorDetails?: { name?: string; message: string; stack?: string }
): RuntimeDebugEvent => {
  const now = new Date();
  const timeString = `${now.getHours().toString().padStart(2, "0")}:${now
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now
    .getMilliseconds()
    .toString()
    .padStart(3, "0")}`;

  const event: RuntimeDebugEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now.getTime(),
    timeString,
    type,
    scope,
    message,
    context,
    errorDetails,
  };

  debugEvents = [event, ...debugEvents.slice(0, MAX_DEBUG_EVENTS - 1)];
  notifyListeners();
  return event;
};

export const getDebugEvents = (): RuntimeDebugEvent[] => [...debugEvents];

export const clearDebugEvents = () => {
  debugEvents = [];
  notifyListeners();
};

export const subscribeDebugEvents = (listener: (events: RuntimeDebugEvent[]) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useRuntimeDebugEvents = () => {
  const [events, setEvents] = useState<RuntimeDebugEvent[]>(getDebugEvents);

  useEffect(() => {
    setEvents(getDebugEvents());
    const unsubscribe = subscribeDebugEvents(setEvents);
    return unsubscribe;
  }, []);

  return events;
};

const toErrorLike = (error: unknown) => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  if (error && typeof error === "object") {
    return {
      message: (error as { message?: string }).message || JSON.stringify(error),
      ...(error as Record<string, unknown>),
    };
  }

  return { message: String(error) };
};

export const logRuntimeError = (scope: string, error: unknown, context?: RuntimeDebugContext) => {
  const errorLike = toErrorLike(error);

  addDebugEvent("error", scope, errorLike.message, context, {
    message: errorLike.message,
    name: "name" in errorLike && typeof errorLike.name === "string" ? errorLike.name : undefined,
    stack: "stack" in errorLike && typeof errorLike.stack === "string" ? errorLike.stack : undefined,
  });

  console.groupCollapsed(`${RUNTIME_DEBUG_PREFIX} ${scope}`);
  console.error(errorLike);

  if (context && Object.keys(context).length > 0) {
    console.info("context", context);
  }

  console.groupEnd();
};

export const logRuntimeInfo = (scope: string, message: string, context?: RuntimeDebugContext) => {
  addDebugEvent("info", scope, message, context);
};

export const logRuntimeRpc = (
  rpcName: string,
  params: Record<string, unknown>,
  status: "success" | "error",
  durationMs: number,
  response?: unknown,
  error?: unknown
) => {
  const isErr = status === "error";
  addDebugEvent(
    isErr ? "error" : "rpc",
    `rpc.${rpcName}`,
    isErr ? `RPC ${rpcName} falhou (${durationMs}ms)` : `RPC ${rpcName} executada (${durationMs}ms)`,
    {
      params,
      durationMs,
      status,
      response,
      error: error ? toErrorLike(error) : undefined,
    }
  );
};

export const installGlobalRuntimeDebugHandlers = () => {
  if (typeof window === "undefined") {
    return;
  }

  const runtimeWindow = window as typeof window & {
    [GLOBAL_RUNTIME_DEBUG_FLAG]?: boolean;
  };

  if (runtimeWindow[GLOBAL_RUNTIME_DEBUG_FLAG]) {
    return;
  }

  window.addEventListener("error", (event) => {
    logRuntimeError("window.error", event.error ?? event.message, {
      column: event.colno,
      filename: event.filename,
      line: event.lineno,
      type: "error",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    logRuntimeError("window.unhandledrejection", event.reason, {
      type: "unhandledrejection",
    });
  });

  runtimeWindow[GLOBAL_RUNTIME_DEBUG_FLAG] = true;
};
