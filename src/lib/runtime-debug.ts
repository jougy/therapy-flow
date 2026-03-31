const RUNTIME_DEBUG_PREFIX = "[Pronto runtime]";
const GLOBAL_RUNTIME_DEBUG_FLAG = "__PRONTO_RUNTIME_DEBUG_INSTALLED__";

type RuntimeDebugContext = Record<string, unknown> | undefined;

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
    return error;
  }

  return { message: String(error) };
};

export const logRuntimeError = (scope: string, error: unknown, context?: RuntimeDebugContext) => {
  const errorLike = toErrorLike(error);

  console.groupCollapsed(`${RUNTIME_DEBUG_PREFIX} ${scope}`);
  console.error(errorLike);

  if (context && Object.keys(context).length > 0) {
    console.info("context", context);
  }

  console.groupEnd();
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
