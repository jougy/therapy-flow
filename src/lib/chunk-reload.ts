/**
 * Utilitário para detecção e auto-recuperação de erros de importação dinâmica (stale chunks pós-deploy).
 * Quando uma nova versão do app é publicada, os hashes dos arquivos .js mudam no servidor.
 * Clientes com abas abertas ou HTML em cache que tentam carregar uma nova rota disparam
 * "error loading dynamically imported module" ou "Failed to fetch dynamically imported module".
 */

const RELOAD_STORAGE_KEY = "pluri_chunk_reload_timestamp";
const RELOAD_COOLDOWN_MS = 15000; // Evita loop infinito se houver um erro de rede real persistente

export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  
  const msg = typeof error === "string" 
    ? error 
    : (error as { message?: string }).message || "";

  return (
    /error loading dynamically imported module/i.test(msg) ||
    /failed to fetch dynamically imported module/i.test(msg) ||
    /importing a module script failed/i.test(msg) ||
    /loading chunk [\d\w_-]+ failed/i.test(msg) ||
    /unable to preload css/i.test(msg)
  );
}

/**
 * Tenta recarregar a página forçadamente para obter o novo index.html e os novos chunks.
 * Retorna true se efetuou o reload ou false se já recarregou recentemente (cooldown).
 */
export function reloadForNewVersion(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const lastReload = sessionStorage.getItem(RELOAD_STORAGE_KEY);
    const now = Date.now();

    if (lastReload) {
      const timeSince = now - parseInt(lastReload, 10);
      if (timeSince < RELOAD_COOLDOWN_MS) {
        // Já recarregamos há menos de 15s. Evita loop de reload.
        return false;
      }
    }

    sessionStorage.setItem(RELOAD_STORAGE_KEY, String(now));
    window.location.reload();
    return true;
  } catch {
    window.location.reload();
    return true;
  }
}

/**
 * Registra o listener global do Vite para falhas de pré-carregamento de módulos.
 */
export function registerChunkReloadHandler(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("vite:preloadError", (event) => {
    // Evita comportamento default se necessário e força atualização transparente
    event.preventDefault();
    reloadForNewVersion();
  });
}
