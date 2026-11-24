/**
 * Verificação gratuita de senhas vazadas via HaveIBeenPwned (k-anonymity).
 * Envia apenas os 5 primeiros caracteres do hash SHA-1 da senha; nunca envia a senha.
 * Fail-open: se a API externa falhar ou der timeout, não bloqueia o usuário.
 */
export async function checkLeakedPassword(password: string): Promise<{ leaked: boolean; count: number }> {
  if (!password || typeof crypto === "undefined" || !crypto.subtle) {
    return { leaked: false, count: 0 };
  }

  try {
    const encoded = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-1", encoded);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();

    const prefix = hashHex.slice(0, 5);
    const suffix = hashHex.slice(5);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) return { leaked: false, count: 0 };

    const text = await res.text();
    for (const line of text.split("\n")) {
      const [lineSuffix, countStr] = line.trim().split(":");
      if (lineSuffix === suffix) {
        const count = Number.parseInt(countStr || "0", 10);
        if (count > 0) {
          return { leaked: true, count };
        }
      }
    }
    return { leaked: false, count: 0 };
  } catch {
    return { leaked: false, count: 0 };
  }
}
