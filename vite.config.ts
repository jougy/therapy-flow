import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

function cepDevPlugin() {
  return {
    name: "vite-plugin-cep-dev",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = req.url || "";
        const match = url.match(/^\/api\/cep\/(\d{8})/);
        if (!match) return next();

        const clean = match[1];
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

        if (req.method === "OPTIONS") {
          res.statusCode = 204;
          return res.end();
        }

        try {
          const endpoints = [
            `https://brasilapi.com.br/api/cep/v1/${clean}`,
            `https://viacep.com.br/ws/${clean}/json/`,
            `https://opencep.com/v1/${clean}`,
            `https://cep.awesomeapi.com.br/json/${clean}`,
          ];

          for (const ep of endpoints) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 4000);
              const r = await fetch(ep, { signal: controller.signal });
              clearTimeout(timeout);
              if (!r.ok) continue;
              const data = (await r.json()) as any;
              if (data.erro === true || data.erro === "true") continue;

              const city = data.city || data.localidade || "";
              const state = data.state || data.uf || "";
              if (!city || !state) continue;

              const normalized = {
                cep: data.cep || clean,
                street: data.street || data.logradouro || data.address || data.address_name || "",
                neighborhood: data.neighborhood || data.bairro || data.district || "",
                city,
                state: state.toUpperCase(),
                source: "dev-server-proxy",
              };

              res.statusCode = 200;
              return res.end(JSON.stringify(normalized));
            } catch {
              // Silently continue to next endpoint on error
            }
          }

          res.statusCode = 404;
          return res.end(JSON.stringify({ error: "CEP not found" }));
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err?.message || "Internal error" }));
        }
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), cepDevPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/recharts")) {
            return "vendor-charts";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-icons";
          }
          if (id.includes("node_modules/@tanstack/react-query")) {
            return "vendor-query";
          }
          if (id.includes("node_modules/@supabase/supabase-js")) {
            return "vendor-supabase";
          }
        },
      },
    },
  },
}));
