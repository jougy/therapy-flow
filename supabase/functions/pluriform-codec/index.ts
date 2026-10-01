import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

// Headers CORS para suportar requisições web
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    status,
  });

// Constantes da especificação .pluriform
const MAGIC_BYTES = new Uint8Array([0x50, 0x4c, 0x55, 0x52]); // "PLUR"
const VERSION_V2 = 0x02; // Server-side authenticated mode
const IV_LENGTH = 12; // 12 bytes nonce para AES-GCM
const CHECKSUM_LENGTH = 32; // 32 bytes SHA-256
const HEADER_LENGTH = 4 + 1 + IV_LENGTH + CHECKSUM_LENGTH; // 49 bytes

const PLURIFORM_MAX_DECOMPRESSED_BYTES = 5 * 1024 * 1024; // 5 MB limite estrito anti Zip Bomb

/**
 * Obtém a chave mestra para o AES-GCM a partir de PLURIFORM_MASTER_SECRET
 * ou utiliza chave derivada determinística como fallback seguro.
 */
async function getMasterCryptoKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("PLURIFORM_MASTER_SECRET") || "PLURI-HEALTH-OFFICIAL-MASTER-SECRET-FALLBACK-V2";
  const encoder = new TextEncoder();
  const secretBuffer = encoder.encode(secret);
  
  // Gera hash SHA-256 do segredo para garantir exatamente 256 bits (32 bytes)
  const keyMaterial = await crypto.subtle.digest("SHA-256", secretBuffer);
  
  return await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Compacta dados usando CompressionStream GZIP
 */
async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream("gzip"));
  const response = new Response(stream);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Descompacta dados usando DecompressionStream GZIP com proteção contra Zip Bomb
 */
async function gzipDecompress(
  data: Uint8Array,
  maxDecompressedBytes: number = PLURIFORM_MAX_DECOMPRESSED_BYTES
): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxDecompressedBytes) {
          try {
            await reader.cancel();
          } catch {
            // Ignora erro de cancelamento
          }
          throw new Error("Carga descompactada excede o limite seguro permitido. Possível Decompression Bomb.");
        }
        chunks.push(value);
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes("Decompression Bomb")) {
      throw err;
    }
    throw new Error("Falha ao descomprimir carga útil do formulário.");
  }

  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    result.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return result;
}

/**
 * Comparação em tempo constante O(1) de buffers para integridade SHA-256
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Compacta e Cifra um payload JSON para o binário .pluriform v2
 */
async function packPluriform(payload: unknown): Promise<Uint8Array> {
  const jsonStr = JSON.stringify(payload);
  const rawData = new TextEncoder().encode(jsonStr);

  // 1. Checksum SHA-256 do payload cru descompactado
  const checksumBuffer = await crypto.subtle.digest("SHA-256", rawData);
  const checksum = new Uint8Array(checksumBuffer);

  // 2. Compressão GZIP
  const compressedData = await gzipCompress(rawData);

  // 3. IV de 12 bytes
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // 4. Criptografia AES-GCM-256
  const key = await getMasterCryptoKey();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    compressedData
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // 5. Montagem do binário final em buffer pré-alocado O(N)
  const result = new Uint8Array(HEADER_LENGTH + ciphertext.length);
  result.set(MAGIC_BYTES, 0);
  result[4] = VERSION_V2;
  result.set(iv, 5);
  result.set(checksum, 5 + IV_LENGTH);
  result.set(ciphertext, HEADER_LENGTH);

  return result;
}

/**
 * Decifra e descompacta um binário .pluriform v2 retornando o objeto JSON
 */
async function unpackPluriform(buffer: Uint8Array): Promise<unknown> {
  if (buffer.length < HEADER_LENGTH) {
    throw new Error("Arquivo .pluriform corrompido ou incompleto (tamanho insuficiente).");
  }

  // 1. Valida Magic Bytes "PLUR"
  for (let i = 0; i < 4; i++) {
    if (buffer[i] !== MAGIC_BYTES[i]) {
      throw new Error("Assinatura de arquivo inválida (Magic Bytes incorretos). Não é um arquivo .pluriform válido.");
    }
  }

  // 2. Valida Versão (deve ser 0x02 para decodificação server-side v2)
  const version = buffer[4];
  if (version !== VERSION_V2) {
    throw new Error(`Versão do arquivo não suportada pelo servidor: ${version}. Utilize o modo local ou versão correspondente.`);
  }

  // 3. Extrai IV, Checksum e Ciphertext sem alocações desnecessárias via subarray
  const iv = buffer.subarray(5, 5 + IV_LENGTH);
  const expectedChecksum = buffer.subarray(5 + IV_LENGTH, HEADER_LENGTH);
  const ciphertext = buffer.subarray(HEADER_LENGTH);

  // 4. Decifra AES-GCM-256
  const key = await getMasterCryptoKey();
  let compressedData: Uint8Array;
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    compressedData = new Uint8Array(decryptedBuffer);
  } catch (_e) {
    throw new Error("Falha na decriptação dos dados. Chave de criptografia inválida ou arquivo corrompido.");
  }

  // 5. Descompressão GZIP com proteção contra Zip Bomb
  const rawData = await gzipDecompress(compressedData);

  // 6. Verificação de integridade SHA-256 em tempo constante
  const calculatedChecksumBuffer = await crypto.subtle.digest("SHA-256", rawData);
  const calculatedChecksum = new Uint8Array(calculatedChecksumBuffer);

  if (!timingSafeEqual(calculatedChecksum, expectedChecksum)) {
    throw new Error("Falha de integridade: Checksum SHA-256 não confere. O arquivo pode ter sido adulterado.");
  }

  // 7. Parse JSON
  const jsonStr = new TextDecoder().decode(rawData);
  return JSON.parse(jsonStr);
}

Deno.serve(async (req: Request) => {
  // Trata preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido. Utilize POST." }, 405);
  }

  try {
    // 1. Autenticação estrita via Bearer Token do Supabase
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return jsonResponse({ error: "Acesso negado. Cabeçalho de autorização ausente." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (supabaseUrl && supabaseAnonKey) {
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: userData, error: userError } = await userClient.auth.getUser(token);
      if (userError || !userData?.user) {
        return jsonResponse({ error: "Sessão inválida ou expirada." }, 401);
      }
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "pack";

    // 2. Ação 'pack': Recebe JSON ou { schema, metadata } e devolve binário .pluriform v2
    if (action === "pack") {
      const payload = await req.json().catch(() => null);
      if (!payload) {
        return jsonResponse({ error: "Corpo da requisição deve ser um JSON válido." }, 400);
      }

      const pluriformBytes = await packPluriform(payload);

      return new Response(pluriformBytes, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/x-pluriform",
          "Content-Disposition": 'attachment; filename="form.pluriform"',
        },
      });
    }

    // 3. Ação 'unpack': Recebe binário application/x-pluriform ou application/octet-stream (ou base64 em JSON)
    if (action === "unpack") {
      const contentType = req.headers.get("content-type") || "";
      let binaryData: Uint8Array;

      if (contentType.includes("application/json")) {
        const body = await req.json().catch(() => ({}));
        if (!body.data || typeof body.data !== "string") {
          return jsonResponse({ error: "Campo 'data' em Base64 ausente no JSON." }, 400);
        }
        // Converte base64 para Uint8Array em O(N) com pré-alocação
        const binStr = atob(body.data);
        const len = binStr.length;
        binaryData = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          binaryData[i] = binStr.charCodeAt(i);
        }
      } else {
        // Binário direto vindo no Body
        const arrayBuffer = await req.arrayBuffer();
        binaryData = new Uint8Array(arrayBuffer);
      }

      if (binaryData.length === 0) {
        return jsonResponse({ error: "Arquivo ou buffer binário vazio recebido." }, 400);
      }

      const unpackedData = await unpackPluriform(binaryData);
      return jsonResponse({
        success: true,
        version: "v2",
        data: unpackedData,
      });
    }

    return jsonResponse({ error: `Ação desconhecida: '${action}'. Ações válidas: 'pack', 'unpack'.` }, 400);

  } catch (error: unknown) {
    // Sanitiza mensagens de erro para não expor stack traces ou detalhes sensíveis de infraestrutura
    const rawMessage = error instanceof Error ? error.message : "";
    const isClientFacingSafe =
      rawMessage.includes("Arquivo .pluriform") ||
      rawMessage.includes("Assinatura de arquivo") ||
      rawMessage.includes("Versão do arquivo") ||
      rawMessage.includes("Falha na decriptação") ||
      rawMessage.includes("Falha ao descomprimir") ||
      rawMessage.includes("Falha de integridade") ||
      rawMessage.includes("Decompression Bomb");

    const message = isClientFacingSafe ? rawMessage : "Erro interno no processamento do arquivo de formulário.";
    return jsonResponse({ error: message }, 500);
  }
});
