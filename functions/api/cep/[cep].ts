interface Env {}

export const onRequestGet = async (context: { params: { cep: string }; env: Env }) => {
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
    } catch {}
  }

  return new Response(JSON.stringify({ error: "CEP not found" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
};
