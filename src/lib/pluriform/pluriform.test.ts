import { describe, expect, it } from "vitest";
import {
  isPluriformBuffer,
  packPluriformOffline,
  unpackPluriformLocal,
  packPluriform,
  unpackPluriform,
  PLURIFORM_MAGIC_BYTES,
  PLURIFORM_VERSION_OFFLINE,
  PLURIFORM_VERSION_SERVER,
  PLURIFORM_HEADER_LENGTH,
} from "./pluriform";
import {
  buildAnamnesisTemplateExchangePayload,
  parseAnamnesisTemplateExchangePayload,
  createDefaultTemplateSchema,
} from "@/lib/anamnesis-forms";

describe(".pluriform Secure Codec (AES-256-GCM + GZIP + SHA-256)", () => {
  const samplePayload = {
    test: true,
    formName: "Ficha Fisioterapia Traumato-Ortopédica",
    description: "Modelo clínico de teste",
    schema: [
      { id: "f1", label: "Queixa Principal", type: "long_text", required: true },
      { id: "f2", label: "EVA Dor", type: "slider", min: 0, max: 10 },
    ],
  };

  it("identifies .pluriform magic bytes correctly", async () => {
    const valid = new Uint8Array([0x50, 0x4c, 0x55, 0x52, 0x01, 0x00]);
    expect(isPluriformBuffer(valid)).toBe(true);

    const invalid = new Uint8Array([0x00, 0x11, 0x22, 0x33]);
    expect(isPluriformBuffer(invalid)).toBe(false);

    const shortBuf = new Uint8Array([0x50, 0x4c]);
    expect(isPluriformBuffer(shortBuf)).toBe(false);
  });

  it("packs and unpacks payloads locally using Version 0x01 (AES-256-GCM + GZIP + Checksum)", async () => {
    const packed = await packPluriformOffline(samplePayload);
    expect(packed.length).toBeGreaterThan(PLURIFORM_HEADER_LENGTH);

    // Magic Bytes 'PLUR'
    expect(packed[0]).toBe(PLURIFORM_MAGIC_BYTES[0]);
    expect(packed[1]).toBe(PLURIFORM_MAGIC_BYTES[1]);
    expect(packed[2]).toBe(PLURIFORM_MAGIC_BYTES[2]);
    expect(packed[3]).toBe(PLURIFORM_MAGIC_BYTES[3]);

    // Version
    expect(packed[4]).toBe(PLURIFORM_VERSION_OFFLINE);

    // Unpack local
    const unpacked = await unpackPluriformLocal(packed);
    expect(unpacked).toEqual(samplePayload);
  });

  it("detects tampering and rejects payload when SHA-256 checksum or ciphertext is modified", async () => {
    const packed = await packPluriformOffline(samplePayload);
    const tampered = new Uint8Array(packed);

    // Corrompe um byte do ciphertext
    tampered[tampered.length - 1] ^= 0xff;

    await expect(unpackPluriformLocal(tampered)).rejects.toThrow();
  });

  it("fails gracefully if file is shorter than minimum header length", async () => {
    const shortBuffer = new Uint8Array([0x50, 0x4c, 0x55, 0x52, 0x01]);
    await expect(unpackPluriformLocal(shortBuffer)).rejects.toThrow(
      "Arquivo .pluriform corrompido ou incompleto"
    );
  });

  it("performs transparent offline fallback when packPluriform is invoked offline", async () => {
    const packed = await packPluriform(samplePayload, { forceOffline: true });
    expect(isPluriformBuffer(packed)).toBe(true);
    expect(packed[4]).toBe(PLURIFORM_VERSION_OFFLINE);

    const unpacked = await unpackPluriform(packed);
    expect(unpacked).toEqual(samplePayload);
  });

  it("integrates with parseAnamnesisTemplateExchangePayload to read both .pluriform and legacy .json", async () => {
    const exchangePayload = buildAnamnesisTemplateExchangePayload({
      description: "Modelo Integrado",
      kind: "template",
      name: "Ficha Integrada",
      schema: createDefaultTemplateSchema(),
    });

    // 1. Binário .pluriform
    const packedBytes = await packPluriformOffline(exchangePayload);
    const parsedFromPluriform = await parseAnamnesisTemplateExchangePayload(packedBytes);
    expect(parsedFromPluriform.template.name).toBe("Ficha Integrada");
    expect(parsedFromPluriform.template.schema.length).toBeGreaterThan(0);

    // 2. Legado .json (string)
    const jsonStr = JSON.stringify(exchangePayload);
    const parsedFromJson = await parseAnamnesisTemplateExchangePayload(jsonStr);
    expect(parsedFromJson.template.name).toBe("Ficha Integrada");

    // 3. Legado .json como ArrayBuffer (ex: vindo de file.arrayBuffer())
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const parsedFromJsonBuffer = await parseAnamnesisTemplateExchangePayload(jsonBytes);
    expect(parsedFromJsonBuffer.template.name).toBe("Ficha Integrada");
  });

  it("protects against Decompression Bomb (Zip Bomb) by enforcing maximum unpacked byte limits", async () => {
    // Cria um payload com repetição alta que comprime muito pequeno mas expande grande
    const hugeString = "A".repeat(2 * 1024 * 1024); // 2 MB
    const packed = await packPluriformOffline({ data: hugeString });

    // Se tentarmos descompactar com limite de 100 KB, deve rejeitar com erro de segurança
    const { gzipDecompress } = await import("./pluriform");
    // O unpack com maxDecompressedBytes customizado
    const compressedSlice = packed.subarray(PLURIFORM_HEADER_LENGTH);
    const key = await (await import("./pluriform")).getLocalCryptoKey();
    const iv = packed.subarray(5, 5 + 12);
    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, compressedSlice);

    await expect(gzipDecompress(new Uint8Array(decrypted), 50 * 1024)).rejects.toThrow(
      "Possível ataque de Decompression Bomb"
    );
  });

  it("timingSafeEqual correctly compares byte arrays in constant time", async () => {
    const { timingSafeEqual } = await import("./pluriform");
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    const c = new Uint8Array([1, 2, 3, 4, 6]);
    const d = new Uint8Array([1, 2, 3, 4]);

    expect(timingSafeEqual(a, b)).toBe(true);
    expect(timingSafeEqual(a, c)).toBe(false);
    expect(timingSafeEqual(a, d)).toBe(false);
  });

  it("uint8ArrayToBase64 and base64ToUint8Array operate symmetrically in O(N)", async () => {
    const { uint8ArrayToBase64, base64ToUint8Array } = await import("./pluriform");
    const original = new Uint8Array([0, 1, 2, 253, 254, 255, 65, 66, 67]);
    const b64 = uint8ArrayToBase64(original);
    const roundtrip = base64ToUint8Array(b64);
    expect(roundtrip).toEqual(original);
  });
});

