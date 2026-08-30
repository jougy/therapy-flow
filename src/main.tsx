import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installGlobalRuntimeDebugHandlers } from "@/lib/runtime-debug";
import { registerServiceWorker } from "@/lib/register-sw";

installGlobalRuntimeDebugHandlers();
registerServiceWorker();

createRoot(document.getElementById("root")!).render(<App />);
