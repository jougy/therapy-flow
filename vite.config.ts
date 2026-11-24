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

function autoLeadsDevProxyPlugin() {
  return {
    name: "vite-plugin-auto-leads-dev-proxy",
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const url = (req.url || "").split("?")[0];
        if (url !== "/__dev/auto-leads-proxy") return next();

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        const prodUrl = (process.env.PROD_SUPABASE_URL || "https://ggytwbnintrftgzvjczs.supabase.co").replace(/\/+$/, "");
        const serviceKey = (process.env.PROD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

        if (!serviceKey) {
          res.statusCode = 503;
          return res.end(JSON.stringify({ error: "missing_service_role_key" }));
        }

        const headers = {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        };

        try {
          if (req.method === "GET") {
            const r = await fetch(
              `${prodUrl}/rest/v1/platform_auto_leads?deleted_at=is.null&order=created_at.desc`,
              { headers },
            );
            const data = await r.json();
            res.statusCode = r.status;
            return res.end(JSON.stringify(data));
          }

          if (req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");

            if (body.action === "update" && body.id) {
              const r = await fetch(
                `${prodUrl}/rest/v1/platform_auto_leads?id=eq.${encodeURIComponent(body.id)}`,
                { method: "PATCH", headers, body: JSON.stringify(body.patch || {}) },
              );
              const data = await r.json();
              res.statusCode = r.status;
              return res.end(JSON.stringify(data));
            }

            if (body.action === "insert") {
              const r = await fetch(`${prodUrl}/rest/v1/platform_auto_leads`, {
                method: "POST",
                headers,
                body: JSON.stringify(body.payload || {}),
              });
              const data = await r.json();
              res.statusCode = r.status;
              return res.end(JSON.stringify(data));
            }

            if (body.action === "upsert_batch") {
              const r = await fetch(`${prodUrl}/rest/v1/rpc/upsert_platform_auto_leads_batch`, {
                method: "POST",
                headers,
                body: JSON.stringify({ _leads: body.leads || [] }),
              });
              const data = await r.json();
              res.statusCode = r.status;
              return res.end(JSON.stringify(data));
            }
          }

          res.statusCode = 400;
          return res.end(JSON.stringify({ error: "unsupported_action" }));
        } catch (err: any) {
          res.statusCode = 500;
          return res.end(JSON.stringify({ error: err?.message || "proxy_error" }));
        }
      });
    },
  };
}

function nonBlockingCssPlugin() {
  return {
    name: "vite-plugin-non-blocking-css",
    enforce: "post" as const,
    transformIndexHtml(html: string) {
      return html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        '<link rel="preload" as="style" crossorigin href="$1">' +
          '<link rel="stylesheet" crossorigin href="$1" media="print" data-async-css="true">' +
          '<noscript><link rel="stylesheet" crossorigin href="$1"></noscript>'
      );
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
  plugins: [react(), cepDevPlugin(), autoLeadsDevProxyPlugin(), nonBlockingCssPlugin()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Rolldown handles automated chunk splitting naturally
    chunkSizeWarningLimit: 1000,
  },
}));
