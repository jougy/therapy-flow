import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalRuntimeDebugHandlers } from "@/lib/runtime-debug";
import { registerServiceWorker } from "@/lib/register-sw";
import { registerChunkReloadHandler } from "@/lib/chunk-reload";

registerChunkReloadHandler();
installGlobalRuntimeDebugHandlers();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
