export function registerServiceWorker() {
  if (typeof window !== "undefined" && "serviceWorker" in navigator && import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[SW] Service Worker registrado com sucesso no escopo:", reg.scope);
        })
        .catch((err) => {
          console.warn("[SW] Falha ao registrar Service Worker:", err);
        });
    });
  }
}
