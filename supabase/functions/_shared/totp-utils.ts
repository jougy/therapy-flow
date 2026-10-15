// supabase/functions/_shared/totp-utils.ts
/**
 * Implementação segura e autocontida de TOTP (RFC 6238 / RFC 4226)
 * Totalmente compatível com Web Crypto API (Deno / Edge Functions e Node.js).
 * Compatível com Ente Auth, Google Authenticator, Authy, etc.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Converte string Base32 em Uint8Array
 */
export function base32ToUint8Array(base32: string): Uint8Array {
  const clean = base32.toUpperCase().replace(/[\s=-]/g, '');
  let bits = '';
  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return new Uint8Array(bytes);
}

/**
 * Gera código TOTP de 6 dígitos para um determinado segredo e timestamp
 */
export async function generateTotpCode(secret: string, timestampMs = Date.now(), stepSeconds = 30): Promise<string> {
  const keyBytes = base32ToUint8Array(secret);
  if (keyBytes.length === 0) {
    throw new Error('Segredo Base32 inválido para TOTP');
  }

  const epoch = Math.floor(timestampMs / 1000 / stepSeconds);
  const timeBuf = new ArrayBuffer(8);
  const timeView = new DataView(timeBuf);
  timeView.setBigUint64(0, BigInt(epoch), false);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, timeBuf);
  const sigBytes = new Uint8Array(signature);
  const offset = sigBytes[sigBytes.length - 1] & 0x0f;

  const binary =
    ((sigBytes[offset] & 0x7f) << 24) |
    ((sigBytes[offset + 1] & 0xff) << 16) |
    ((sigBytes[offset + 2] & 0xff) << 8) |
    (sigBytes[offset + 3] & 0xff);

  const otp = String(binary % 1_000_000).padStart(6, '0');
  return otp;
}

/**
 * Valida o código TOTP fornecido pelo usuário considerando janela de tolerância de relógio (±1 passo de 30s)
 */
export async function verifyTotpCode(
  secret: string,
  userCode: string,
  timestampMs = Date.now(),
  windowSteps = 1
): Promise<boolean> {
  const sanitizedUserCode = userCode.trim().replace(/\D/g, '');
  if (sanitizedUserCode.length !== 6) {
    return false;
  }

  for (let offset = -windowSteps; offset <= windowSteps; offset++) {
    const checkTime = timestampMs + offset * 30 * 1000;
    try {
      const generated = await generateTotpCode(secret, checkTime);
      if (generated === sanitizedUserCode) {
        return true;
      }
    } catch {
      return false;
    }
  }

  return false;
}
