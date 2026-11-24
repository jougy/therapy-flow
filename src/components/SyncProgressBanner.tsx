import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { CloudDownload, CheckCircle2, RefreshCw, WifiOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export interface SyncStatusSnapshot {
  isOnline?: boolean;
  online?: boolean;
  pendingCount?: number;
  pendingMutations?: number;
  pending?: number;
  queueSize?: number;
  isSyncing?: boolean;
  syncing?: boolean;
  isFlushing?: boolean;
  isInitialSync?: boolean;
  isInitialSyncing?: boolean;
  progress?: number;
}

type SyncStatusHook = () => SyncStatusSnapshot | null | undefined;

const optionalSyncStatusModules = import.meta.glob<{ useSyncStatus?: SyncStatusHook }>(
  "/src/lib/local-first/syncStatusStore.{ts,tsx}",
  { eager: true },
);

const externalUseSyncStatus: SyncStatusHook | undefined = Object.values(optionalSyncStatusModules)[0]
  ?.useSyncStatus;

function useFallbackSyncStatus(): SyncStatusSnapshot {
  const isFetchingCount = useIsFetching();
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" ? navigator.onLine : true,
  );

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

  return {
    isOnline,
    pendingCount: 0,
    isSyncing: false,
    isInitialSync: isFetchingCount > 0,
  };
}

const useResolvedSyncStatus: SyncStatusHook = externalUseSyncStatus ?? useFallbackSyncStatus;

/**
 * Banner discreto e não-intrusivo no topo da aplicação.
 * Exibe modo offline com contagem de pendências, sincronização de pendências
 * ou sincronização inicial em background via `useSyncStatus()` (com fallback seguro).
 */
export function SyncProgressBanner() {
  const { session, loading: authLoading } = useAuth();
  const isFetchingCount = useIsFetching();
  const rawStatus = useResolvedSyncStatus();

  const isOnline =
    typeof rawStatus?.isOnline === "boolean"
      ? rawStatus.isOnline
      : typeof rawStatus?.online === "boolean"
        ? rawStatus.online
        : typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
          ? navigator.onLine
          : true;

  const pendingCount = Math.max(
    0,
    Number(
      rawStatus?.pendingCount ??
        rawStatus?.pendingMutations ??
        rawStatus?.pending ??
        rawStatus?.queueSize ??
        0,
    ) || 0,
  );

  const isSyncingPending = Boolean(rawStatus?.isSyncing ?? rawStatus?.syncing ?? rawStatus?.isFlushing);
  const externalInitialSync =
    typeof rawStatus?.isInitialSync === "boolean"
      ? rawStatus.isInitialSync
      : typeof rawStatus?.isInitialSyncing === "boolean"
        ? rawStatus.isInitialSyncing
        : undefined;
  const externalProgress = typeof rawStatus?.progress === "number" ? rawStatus.progress : undefined;

  const [initialVisible, setInitialVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(false);

  const isInitialFetching = externalInitialSync ?? isFetchingCount > 0;

  useEffect(() => {
    if (!session || authLoading || !isOnline) {
      setInitialVisible(false);
      return;
    }

    if (isInitialFetching && !hasCompletedInitialSync) {
      setInitialVisible(true);
      setProgress((prev) =>
        externalProgress !== undefined ? externalProgress : prev < 90 ? Math.min(prev + 15, 88) : prev,
      );
    } else if (!isInitialFetching && initialVisible) {
      setProgress(100);
      setHasCompletedInitialSync(true);
      const timer = setTimeout(() => {
        setInitialVisible(false);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [
    isInitialFetching,
    session,
    authLoading,
    isOnline,
    hasCompletedInitialSync,
    initialVisible,
    externalProgress,
  ]);

  if (!session || authLoading) {
    return null;
  }

  const showOfflineBanner = !isOnline;
  const showPendingSyncBanner = isOnline && (isSyncingPending || pendingCount > 0);
  const showInitialBanner = isOnline && !showPendingSyncBanner && initialVisible;

  if (!showOfflineBanner && !showPendingSyncBanner && !showInitialBanner) {
    return null;
  }

  const effectiveProgress = externalProgress ?? progress;
  const isDone = showInitialBanner && effectiveProgress >= 100;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] w-full max-w-full min-w-0 overflow-x-clip bg-slate-900/95 dark:bg-slate-950/95 text-white backdrop-blur border-b border-slate-800 text-xs shadow-sm transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-3 py-1.5 flex items-center justify-between gap-2 sm:gap-3 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {showOfflineBanner ? (
            <WifiOff className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          ) : showPendingSyncBanner ? (
            <RefreshCw className="h-3.5 w-3.5 text-sky-400 shrink-0 animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 animate-in zoom-in-75 duration-200" />
          ) : (
            <CloudDownload className="h-3.5 w-3.5 text-sky-400 shrink-0 animate-pulse" />
          )}

          <span className="truncate min-w-0 text-[11px] font-medium text-slate-200">
            {showOfflineBanner
              ? pendingCount > 0
                ? `Modo offline · ${pendingCount} ${pendingCount === 1 ? "pendência" : "pendências"} para sincronizar`
                : "Modo offline · Alterações salvas localmente"
              : showPendingSyncBanner
                ? pendingCount > 0
                  ? `Sincronizando ${pendingCount} ${pendingCount === 1 ? "pendência" : "pendências"}...`
                  : "Sincronizando alterações pendentes..."
                : isDone
                  ? "Dados sincronizados com sucesso no seu dispositivo."
                  : "Sincronizando dados da clínica em segundo plano..."}
          </span>
        </div>

        {showOfflineBanner ? (
          pendingCount > 0 ? (
            <span className="shrink-0 rounded-full bg-amber-500/20 border border-amber-400/30 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200">
              {pendingCount} {pendingCount === 1 ? "pendente" : "pendentes"}
            </span>
          ) : null
        ) : showPendingSyncBanner ? (
          pendingCount > 0 ? (
            <span className="shrink-0 text-[10px] tabular-nums text-sky-300">
              {pendingCount} {pendingCount === 1 ? "restante" : "restantes"}
            </span>
          ) : null
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-16 sm:w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isDone ? "bg-emerald-400" : "bg-sky-400"
                }`}
                style={{ width: `${effectiveProgress}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-slate-400 min-w-[28px] text-right">
              {effectiveProgress}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
