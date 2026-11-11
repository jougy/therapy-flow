import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalRuntimeDebugHandlers } from "@/lib/runtime-debug";
import { registerServiceWorker } from "@/lib/register-sw";
import { registerChunkReloadHandler } from "@/lib/chunk-reload";
import { initializeDocumentBrand } from "@/hooks/useActiveBrand";

if (typeof document !== "undefined") {
  document
    .querySelectorAll<HTMLLinkElement>('link[data-async-css="true"], #google-fonts-inter')
    .forEach((link) => {
      if (link.media !== "all") {
        link.media = "all";
      }
    });
}

initializeDocumentBrand();
registerChunkReloadHandler();
installGlobalRuntimeDebugHandlers();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
