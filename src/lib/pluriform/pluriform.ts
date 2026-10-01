/**
 * Pluriform (.pluriform) Secure Binary Codec
 *
 * Anti-cópia híbrido e otimização de armazenamento para fichas de anamnese.
 *
 * Especificação do Formato Binário:
 * - Bytes 0..3: Magic Bytes 'PLUR' [0x50, 0x4C, 0x55, 0x52]
 * - Byte 4: Versão (0x01 = Local/Offline, 0x02 = Server-side authenticated)
 * - Bytes 5..16: IV (12 bytes nonce para AES-256-GCM)
 * - Bytes 17..48: Checksum SHA-256 (32 bytes do payload JSON cru descompactado)
 * - Bytes 49..fim: Ciphertext (AES-256-GCM do payload compactado com GZIP)
 */

import { supabase } from "@/integrations/supabase/client";

export const PLURIFORM_MAGIC_BYTES = new Uint8Array([0x50, 0x4c, 0x55, 0x52]); // "PLUR"
export const PLURIFORM_VERSION_OFFLINE = 0x01;
export const PLURIFORM_VERSION_SERVER = 0x02;

export const PLURIFORM_IV_LENGTH = 12;
export const PLURIFORM_CHECKSUM_LENGTH = 32;
export const PLURIFORM_HEADER_LENGTH = 4 + 1 + PLURIFORM_IV_LENGTH + PLURIFORM_CHECKSUM_LENGTH; // 49 bytes

export const PLURIFORM_MAX_DECOMPRESSED_BYTES = 5 * 1024 * 1024; // 5 MB limite estrito anti Zip Bomb

const LOCAL_KEY_SEED = "PLURI-HEALTH-LOCAL-OFFLINE-SEED-V1";

/**
 * Deriva uma chave AES-GCM (256 bits) determinística no client-side para o modo offline (Version 0x01).
 */
export async function getLocalCryptoKey(): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const seedBuffer = encoder.encode(LOCAL_KEY_SEED);
  const hash = await crypto.subtle.digest("SHA-256", seedBuffer);
  return await crypto.subtle.importKey(
    "raw",
    hash,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Compacta dados usando CompressionStream nativo ('gzip') em O(N)
 */
export async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  }).pipeThrough(new CompressionStream("gzip"));

  const response = new Response(stream);
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

/**
 * Descompacta dados usando DecompressionStream nativo ('gzip')
 * com proteção estrita contra Decompression/Zip Bomb (limite máximo de bytes expandidos).
 */
export async function gzipDecompress(
  data: Uint8Array,
  maxDecompressedBytes: number = PLURIFORM_MAX_DECOMPRESSED_BYTES
): Promise<Uint8Array> {
  const decompressedStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  }).pipeThrough(new DecompressionStream("gzip"));

  const reader = decompressedStream.getReader();
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
            // Ignora erro de cancelamento do stream
          }
          throw new Error(
            `Carga descompactada excede o limite seguro permitido (${Math.round(
              maxDecompressedBytes / (1024 * 1024)
            )}MB). Possível ataque de Decompression Bomb.`
          );
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

  // Alocação única O(N) para consolidar os chunks sem realocações iterativas
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    result.set(chunks[i], offset);
    offset += chunks[i].byteLength;
  }
  return result;
}

/**
 * Compara dois buffers de tamanho fixo em tempo constante O(1) com relação aos dados,
 * prevenindo ataques de canal lateral baseados em temporização (Timing Attacks).
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/**
 * Converte Uint8Array para Base64 em O(N) por blocos para evitar estouro de pilha e concatenações O(N^2)
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000; // 32KB
  const strChunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    strChunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return btoa(strChunks.join(""));
}

/**
 * Converte string Base64 para Uint8Array em O(N) com pré-alocação única
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Verifica se um buffer/ArrayBuffer começa com os Magic Bytes 'PLUR'
 */
export function isPluriformBuffer(data: ArrayBuffer | Uint8Array): boolean {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (bytes.length < 4) return false;
  return (
    bytes[0] === PLURIFORM_MAGIC_BYTES[0] &&
    bytes[1] === PLURIFORM_MAGIC_BYTES[1] &&
    bytes[2] === PLURIFORM_MAGIC_BYTES[2] &&
    bytes[3] === PLURIFORM_MAGIC_BYTES[3]
  );
}

/**
 * Compacta e Cifra localmente (Version 0x01)
 */
export async function packPluriformOffline(payload: unknown): Promise<Uint8Array> {
  const jsonStr = JSON.stringify(payload);
  const rawData = new TextEncoder().encode(jsonStr);

  // 1. Checksum SHA-256 do payload cru
  const checksumBuffer = await crypto.subtle.digest("SHA-256", rawData);
  const checksum = new Uint8Array(checksumBuffer);

  // 2. Compressão GZIP
  const compressedData = await gzipCompress(rawData);

  // 3. IV de 12 bytes
  const iv = crypto.getRandomValues(new Uint8Array(PLURIFORM_IV_LENGTH));

  // 4. AES-256-GCM com chave local
  const key = await getLocalCryptoKey();
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    compressedData
  );
  const ciphertext = new Uint8Array(ciphertextBuffer);

  // 5. Montagem do binário em buffer pré-alocado O(N)
  const result = new Uint8Array(PLURIFORM_HEADER_LENGTH + ciphertext.length);
  result.set(PLURIFORM_MAGIC_BYTES, 0);
  result[4] = PLURIFORM_VERSION_OFFLINE;
  result.set(iv, 5);
  result.set(checksum, 5 + PLURIFORM_IV_LENGTH);
  result.set(ciphertext, PLURIFORM_HEADER_LENGTH);

  return result;
}

/**
 * Decifra e descompacta localmente para uma versão específica (Version 0x01 ou chave mestra fallback)
 */
export async function unpackPluriformLocal(
  buffer: Uint8Array,
  cryptoKey?: CryptoKey
): Promise<unknown> {
  if (buffer.length < PLURIFORM_HEADER_LENGTH) {
    throw new Error("Arquivo .pluriform corrompido ou incompleto (tamanho insuficiente).");
  }

  // 1. Valida Magic Bytes
  if (!isPluriformBuffer(buffer)) {
    throw new Error("Assinatura de arquivo inválida (Magic Bytes incorretos). Não é um arquivo .pluriform válido.");
  }

  const version = buffer[4];
  // subarray evita cópias de memória desnecessárias O(N) na leitura de fatias
  const iv = buffer.subarray(5, 5 + PLURIFORM_IV_LENGTH);
  const expectedChecksum = buffer.subarray(5 + PLURIFORM_IV_LENGTH, PLURIFORM_HEADER_LENGTH);
  const ciphertext = buffer.subarray(PLURIFORM_HEADER_LENGTH);

  const key = cryptoKey ?? (await getLocalCryptoKey());

  let compressedData: Uint8Array;
  try {
    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    compressedData = new Uint8Array(decryptedBuffer);
  } catch {
    throw new Error(`Falha na decriptação dos dados (Versão 0x0${version.toString(16)}). Chave inválida ou arquivo corrompido.`);
  }

  // Descompressão com proteção contra Zip Bomb
  const rawData = await gzipDecompress(compressedData);

  // Verificação de integridade SHA-256 com comparação em tempo constante
  const calculatedChecksumBuffer = await crypto.subtle.digest("SHA-256", rawData);
  const calculatedChecksum = new Uint8Array(calculatedChecksumBuffer);

  if (!timingSafeEqual(calculatedChecksum, expectedChecksum)) {
    throw new Error("Falha de integridade: Checksum SHA-256 não confere. O arquivo pode ter sido adulterado.");
  }

  const jsonStr = new TextDecoder().decode(rawData);
  return JSON.parse(jsonStr);
}

/**
 * Pack principal com suporte híbrido:
 * Tenta Version 0x02 via Edge Function `pluriform-codec?action=pack` se houver autenticação e rede;
 * Em caso de falha ou offline, faz fallback transparente para Version 0x01 local.
 */
export async function packPluriform(
  payload: unknown,
  options?: { forceOffline?: boolean }
): Promise<Uint8Array> {
  if (options?.forceOffline) {
    return await packPluriformOffline(payload);
  }

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      // Usuário sem sessão ativa ou offline -> fallback local v1
      return await packPluriformOffline(payload);
    }

    const { data, error } = await supabase.functions.invoke("pluriform-codec", {
      body: payload,
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      // Adiciona o parâmetro de URL
      ...({ queryParams: { action: "pack" } } as any),
    });

    if (error || !data) {
      console.warn("Falha no codec server-side (.pluriform v2). Usando fallback local v1:", error);
      return await packPluriformOffline(payload);
    }

    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (data instanceof Blob) {
      const buf = await data.arrayBuffer();
      return new Uint8Array(buf);
    }
    if (data instanceof Uint8Array) {
      return data;
    }

    // Se o supabase-js retornar texto ou json inesperado, fallback
    return await packPluriformOffline(payload);
  } catch (err) {
    console.warn("Erro ao contactar Edge Function pluriform-codec. Usando fallback offline:", err);
    return await packPluriformOffline(payload);
  }
}

/**
 * Unpack principal com suporte a v1 (local) e v2 (server/edge function):
 * Detecta a versão no cabeçalho binário:
 * - Se version === 0x01: decifra localmente usando AES-256-GCM com chave local.
 * - Se version === 0x02: tenta chamar Edge Function `pluriform-codec?action=unpack`.
 *   Se a chamada falhar (offline), tenta fallback com chave mestre local caso disponível.
 */
export async function unpackPluriform(data: ArrayBuffer | Uint8Array): Promise<unknown> {
  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);

  if (buffer.length < PLURIFORM_HEADER_LENGTH) {
    throw new Error("Arquivo .pluriform corrompido ou incompleto (tamanho insuficiente).");
  }

  if (!isPluriformBuffer(buffer)) {
    throw new Error("Assinatura de arquivo inválida. Não é um arquivo .pluriform.");
  }

  const version = buffer[4];

  if (version === PLURIFORM_VERSION_OFFLINE) {
    return await unpackPluriformLocal(buffer);
  }

  if (version === PLURIFORM_VERSION_SERVER) {
    // Tenta decodificar via Edge Function se possível
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      if (token) {
        // Envia como base64 no JSON para garantir compatibilidade máxima (otimizado O(N) por blocos)
        const base64Data = uint8ArrayToBase64(buffer);

        const { data: respData, error } = await supabase.functions.invoke("pluriform-codec", {
          body: { data: base64Data },
          method: "POST",
          ...({ queryParams: { action: "unpack" } } as any),
        });

        if (!error && respData && respData.success && respData.data) {
          return respData.data;
        }
      }
    } catch (e) {
      console.warn("Falha ao contactar servidor para desempacotar .pluriform v2, tentando decodificador local:", e);
    }

    // Fallback: se estiver offline mas o segredo de fallback for compatível com o do servidor
    const fallbackServerSecret = "PLURI-HEALTH-OFFICIAL-MASTER-SECRET-FALLBACK-V2";
    const encoder = new TextEncoder();
    const hash = await crypto.subtle.digest("SHA-256", encoder.encode(fallbackServerSecret));
    const fallbackKey = await crypto.subtle.importKey(
      "raw",
      hash,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );

    return await unpackPluriformLocal(buffer, fallbackKey);
  }

  throw new Error(`Versão do arquivo .pluriform não reconhecida: ${version}.`);
}
