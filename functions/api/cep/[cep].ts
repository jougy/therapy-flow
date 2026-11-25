interface Env {
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
}

const CEP_RL_LUA = `
local c = redis.call('INCR', KEYS[1])
local p = redis.call('PTTL', KEYS[1])
if c == 1 or p < 0 then
  redis.call('PEXPIRE', KEYS[1], 60000)
  p = 60000
end
return {c, p}
`;

async function hashIpShort(ip: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip.trim().toLowerCase()));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 12);
}

async function checkCepRateLimit(request: Request, env: Env): Promise<{ allowed: boolean; retryAfter: number }> {
  const url = env?.UPSTASH_REDIS_REST_URL;
  const token = env?.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { allowed: true, retryAfter: 0 };

  try {
    const ip =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown-ip";
    const ipHash = await hashIpShort(ip);
    const endpoint = url.endsWith("/") ? url : `${url}/`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(["EVAL", CEP_RL_LUA, 1, `rl:cep_proxy_ip:${ipHash}`]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return { allowed: true, retryAfter: 0 };
    const data = (await res.json()) as { result?: [number, number] };
    const count = Number(data?.result?.[0] ?? 1);
    const pttlMs = Math.max(1000, Number(data?.result?.[1] ?? 60_000));
    if (count > 30) {
      return { allowed: false, retryAfter: Math.ceil(pttlMs / 1000) };
    }
    return { allowed: true, retryAfter: 0 };
  } catch {
    return { allowed: true, retryAfter: 0 };
  }
}

export const onRequestGet = async (context: { request?: Request; params: { cep: string }; env: Env }) => {
  if (context.request) {
    const rl = await checkCepRateLimit(context.request, context.env);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas consultas de CEP em curto intervalo.", retryAfter: rl.retryAfter }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
            "Retry-After": String(rl.retryAfter),
            "X-RateLimit-Limit": "30",
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }
  const rawCep = context.params.cep || "";
  const clean = rawCep.replace(/\D/g, "").slice(0, 8);

  if (clean.length !== 8) {
    return new Response(JSON.stringify({ error: "Invalid CEP" }), {
      status: 400,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

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
        source: "cloudflare-edge",
      };

      return new Response(JSON.stringify(normalized), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=86400",
        },
      });
    } catch {
      // Silently continue to next endpoint on error
    }
  }

  return new Response(JSON.stringify({ error: "CEP not found" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
