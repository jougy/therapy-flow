const LOCAL_EVO_URL = "http://127.0.0.1:8085";
const STORAGE_KEY = "pluri_local_evo_apikey";

export function isLocalhostRuntime(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
}

function getLocalEvoApiKey(): string | null {
  const envKey = (import.meta.env.VITE_EVOLUTION_API_KEY as string | undefined)?.trim();
  if (envKey) return envKey;

  const stored = window.localStorage.getItem(STORAGE_KEY)?.trim();
  if (stored) return stored;

  const entered = window.prompt(
    "Cole a apikey local da Evolution API (exibida no terminal pelo npm run marketing:conectar-celular):",
  )?.trim();
  if (entered) {
    window.localStorage.setItem(STORAGE_KEY, entered);
    return entered;
  }
  return null;
}

export async function fetchLocalEvolutionQr(instanceKey: string): Promise<string | null> {
  const apikey = getLocalEvoApiKey();
  if (!apikey) return null;

  let res = await fetch(`${LOCAL_EVO_URL}/instance/connect/${encodeURIComponent(instanceKey)}`, {
    headers: { apikey },
  });

  if (res.status === 404) {
    res = await fetch(`${LOCAL_EVO_URL}/instance/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey },
      body: JSON.stringify({
        instanceName: instanceKey,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
      }),
    });
  }

  if (res.status === 401 || res.status === 403) {
    window.localStorage.removeItem(STORAGE_KEY);
    throw new Error("Chave local (apikey) da Evolution API inválida.");
  }

  if (!res.ok) {
    throw new Error(`Evolution API local retornou HTTP ${res.status}`);
  }

  const data = (await res.json()) as { base64?: string; qrcode?: { base64?: string } };
  return data.base64 || data.qrcode?.base64 || null;
}

export async function checkLocalEvolutionStatus(
  instanceKey: string,
): Promise<"connected" | "qr_ready" | "disconnected" | null> {
  const apikey = getLocalEvoApiKey();
  if (!apikey) return null;

  const res = await fetch(`${LOCAL_EVO_URL}/instance/connectionState/${encodeURIComponent(instanceKey)}`, {
    headers: { apikey },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as { instance?: { state?: string }; state?: string };
  const state = data.instance?.state || data.state;
  if (state === "open") return "connected";
  if (state === "connecting") return "qr_ready";
  return "disconnected";
}
