import { useEffect, useState } from "react";
import { useIsFetching } from "@tanstack/react-query";
import { CloudDownload, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

/**
 * Banner discreto e não-intrusivo no topo da aplicação.
 * Exibe status de sincronização inicial e carregamento de dados em segundo plano,
 * garantindo ao usuário total transparência de que o sistema está preparando
 * seu banco local de dados (IndexedDB/Local-First) sem que ele pense que travou.
 */
export function SyncProgressBanner() {
  const { session, loading: authLoading } = useAuth();
  const isFetchingCount = useIsFetching();

  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasCompletedInitialSync, setHasCompletedInitialSync] = useState(false);

  // Monitora quando há requisições em background acontecendo
  useEffect(() => {
    if (!session || authLoading) {
      setVisible(false);
      return;
    }

    if (isFetchingCount > 0 && !hasCompletedInitialSync) {
      setVisible(true);
      // Simula incremento orgânico de progresso enquanto os dados são baixados
      setProgress((prev) => (prev < 90 ? Math.min(prev + 15, 88) : prev));
    } else if (isFetchingCount === 0 && visible) {
      // Finalização com confirmação suave
      setProgress(100);
      setHasCompletedInitialSync(true);
      const timer = setTimeout(() => {
        setVisible(false);
      }, 1400);
      return () => clearTimeout(timer);
    }
  }, [isFetchingCount, session, authLoading, hasCompletedInitialSync, visible]);

  if (!visible && !hasCompletedInitialSync) {
    return null;
  }

  if (!visible) {
    return null;
  }

  const isDone = progress >= 100;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] w-full bg-slate-900/95 dark:bg-slate-950/95 text-white backdrop-blur border-b border-slate-800 text-xs shadow-sm transition-all duration-300"
    >
      <div className="max-w-7xl mx-auto px-3 py-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {isDone ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 animate-in zoom-in-75 duration-200" />
          ) : (
            <CloudDownload className="h-3.5 w-3.5 text-sky-400 shrink-0 animate-pulse" />
          )}
          <span className="truncate text-[11px] font-medium text-slate-200">
            {isDone
              ? "Dados sincronizados com sucesso no seu dispositivo."
              : "Sincronizando dados da clínica para acesso rápido no computador..."}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 sm:w-36 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isDone ? "bg-emerald-400" : "bg-sky-400"
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-slate-400 min-w-[28px] text-right">
            {progress}%
          </span>
        </div>
      </div>
    </div>
  );
}
