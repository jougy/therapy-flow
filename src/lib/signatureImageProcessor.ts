/**
 * Utilitário de processamento de imagens de assinatura manuscrita/digitalizada.
 * Aceita .jpg, .jpeg, .png, .svg e .webp, renderiza em <canvas>,
 * remove o fundo claro/branco (tornando-o transparente) e exporta para .webp
 * de alta compressão (data URL e Blob).
 */

import { formatByteSize, sanitizeSvgContent } from "./image-processing";

export const SUPPORTED_SIGNATURE_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".webp",
] as const;

export const SUPPORTED_SIGNATURE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/svg+xml",
  "image/webp",
]);

const MAX_SIGNATURE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface BackgroundRemovalOptions {
  /** Luminância (0-255) acima da qual pixels neutros ficam 100% transparentes. Padrão: 232 */
  luminanceThreshold?: number;
  /** Luminância inicial para transição suave (anti-aliasing). Padrão: 185 */
  softThreshold?: number;
  /** Diferença máxima entre canais RGB (chroma) para considerar pixel neutro/cinza-claro. Padrão: 42 */
  chromaTolerance?: number;
}

export interface SignatureProcessOptions {
  /** Largura máxima final em px. Padrão: 640 */
  maxWidth?: number;
  /** Altura máxima final em px. Padrão: 240 */
  maxHeight?: number;
  /** Qualidade WebP (0..1). Padrão: 0.72 (alta compressão mantendo nitidez do traço) */
  quality?: number;
  /** Recorta margens transparentes excedentes ao redor do traço. Padrão: true */
  trimTransparent?: boolean;
  /** Margem preservada no recorte automático em px. Padrão: 8 */
  padding?: number;
  /** Opções de remoção de fundo claro/branco */
  backgroundRemoval?: BackgroundRemovalOptions;
}

export interface ProcessedSignatureResult {
  dataUrl: string;
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
  mimeType: string;
}

/**
 * Valida se o arquivo possui extensão ou MIME type aceito (.jpg, .jpeg, .png, .svg, .webp)
 */
export function isSupportedSignatureFile(file: Pick<File, "name" | "type">): boolean {
  const name = (file.name || "").toLowerCase();
  const mime = (file.type || "").toLowerCase().trim();
  const hasSupportedExt = SUPPORTED_SIGNATURE_EXTENSIONS.some((ext) => name.endsWith(ext));
  const hasSupportedMime = mime !== "" && SUPPORTED_SIGNATURE_MIME_TYPES.has(mime);
  return hasSupportedExt || hasSupportedMime;
}

/**
 * Remove fundo claro/branco de um array RGBA (`ImageData.data`), preservando traços escuros e coloridos
 * (ex: caneta azul ou preta) e aplicando transição suave nas bordas para evitar serrilhado.
 */
export function removeLightBackgroundFromPixels(
  data: Uint8ClampedArray,
  options: BackgroundRemovalOptions = {}
): Uint8ClampedArray {
  const {
    luminanceThreshold = 232,
    softThreshold = 185,
    chromaTolerance = 42,
  } = options;

  const span = Math.max(1, luminanceThreshold - softThreshold);

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const chroma = maxChannel - minChannel;

    if (chroma > chromaTolerance) {
      continue;
    }

    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

    if (luminance >= luminanceThreshold) {
      data[i + 3] = 0;
    } else if (luminance > softThreshold) {
      const opacityFactor = (luminanceThreshold - luminance) / span;
      data[i + 3] = Math.round(a * Math.max(0, Math.min(1, opacityFactor)));
    }
  }

  return data;
}

/**
 * Encontra os limites (bounding box) dos pixels visíveis para recorte automático de bordas vazias.
 */
export function findOpaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaThreshold = 8
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * width * 4;
    for (let x = 0; x < width; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

async function loadSignatureImage(file: File): Promise<HTMLImageElement> {
  const isSvg =
    file.type.toLowerCase() === "image/svg+xml" ||
    file.name.toLowerCase().endsWith(".svg");

  let objectUrl: string;
  if (isSvg) {
    const rawSvg = await file.text();
    const cleanSvg = sanitizeSvgContent(rawSvg);
    const svgBlob = new Blob([cleanSvg], { type: "image/svg+xml" });
    objectUrl = URL.createObjectURL(svgBlob);
  } else {
    objectUrl = URL.createObjectURL(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível decodificar a imagem da assinatura."));
    };
    img.src = objectUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Falha ao gerar Data URL da assinatura."));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao converter assinatura para Data URL."));
    reader.readAsDataURL(blob);
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        // Fallback caso o ambiente não suporte toBlob WebP diretamente
        try {
          const fallbackUrl = canvas.toDataURL("image/webp", quality);
          const base64 = fallbackUrl.split(",")[1] || "";
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const mimeMatch = fallbackUrl.match(/^data:([^;]+);/);
          resolve(new Blob([bytes], { type: mimeMatch?.[1] || "image/webp" }));
        } catch {
          reject(new Error("Não foi possível exportar a assinatura para WebP."));
        }
      },
      "image/webp",
      quality
    );
  });
}

/**
 * Processa um arquivo de assinatura (.jpg, .jpeg, .png, .svg, .webp):
 * - Desenha em <canvas> redimensionando proporcionalmente
 * - Remove fundo claro/branco preservando o traço com transparência
 * - Recorta margens transparentes excedentes (opcional)
 * - Exporta para .webp de alta compressão retornando Data URL e Blob
 */
export async function processSignatureImage(
  file: File,
  options: SignatureProcessOptions = {}
): Promise<ProcessedSignatureResult> {
  const {
    maxWidth = 640,
    maxHeight = 240,
    quality = 0.72,
    trimTransparent = true,
    padding = 8,
    backgroundRemoval,
  } = options;

  if (file.size > MAX_SIGNATURE_FILE_BYTES) {
    throw new Error(
      `O arquivo (${formatByteSize(file.size)}) excede o limite de 10 MB para assinatura.`
    );
  }

  if (!isSupportedSignatureFile(file)) {
    throw new Error(
      "Formato não suportado. Envie uma imagem .jpg, .jpeg, .png, .svg ou .webp."
    );
  }

  const img = await loadSignatureImage(file);
  const workCanvas = document.createElement("canvas");
  let outputCanvas: HTMLCanvasElement | null = null;

  try {
    const rawWidth = img.naturalWidth || img.width || maxWidth;
    const rawHeight = img.naturalHeight || img.height || maxHeight;

    const scale = Math.min(1, maxWidth / rawWidth, maxHeight / rawHeight);
    const drawWidth = Math.max(1, Math.round(rawWidth * scale));
    const drawHeight = Math.max(1, Math.round(rawHeight * scale));

    workCanvas.width = drawWidth;
    workCanvas.height = drawHeight;

    const workCtx = workCanvas.getContext("2d", { willReadFrequently: true });
    if (!workCtx) {
      throw new Error("Não foi possível inicializar o contexto 2D do canvas.");
    }

    workCtx.clearRect(0, 0, drawWidth, drawHeight);
    workCtx.imageSmoothingEnabled = true;
    workCtx.imageSmoothingQuality = "high";
    workCtx.drawImage(img, 0, 0, drawWidth, drawHeight);

    const imageData = workCtx.getImageData(0, 0, drawWidth, drawHeight);
    removeLightBackgroundFromPixels(imageData.data, backgroundRemoval);
    workCtx.putImageData(imageData, 0, 0);

    let finalCanvas = workCanvas;

    if (trimTransparent) {
      const bounds = findOpaqueBounds(imageData.data, drawWidth, drawHeight);
      if (bounds) {
        const sx = Math.max(0, bounds.minX - padding);
        const sy = Math.max(0, bounds.minY - padding);
        const ex = Math.min(drawWidth - 1, bounds.maxX + padding);
        const ey = Math.min(drawHeight - 1, bounds.maxY + padding);
        const cropW = Math.max(1, ex - sx + 1);
        const cropH = Math.max(1, ey - sy + 1);

        outputCanvas = document.createElement("canvas");
        outputCanvas.width = cropW;
        outputCanvas.height = cropH;
        const outCtx = outputCanvas.getContext("2d");
        if (outCtx) {
          outCtx.drawImage(workCanvas, sx, sy, cropW, cropH, 0, 0, cropW, cropH);
          finalCanvas = outputCanvas;
        }
      }
    }

    const blob = await canvasToWebpBlob(finalCanvas, quality);
    const dataUrl = await blobToDataUrl(blob);
    const compressedSize = blob.size;
    const originalSize = file.size;
    const reductionPercent =
      originalSize > 0
        ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
        : 0;

    return {
      dataUrl,
      blob,
      width: finalCanvas.width,
      height: finalCanvas.height,
      originalSize,
      compressedSize,
      reductionPercent,
      mimeType: blob.type || "image/webp",
    };
  } finally {
    if (img.src && img.src.startsWith("blob:")) {
      URL.revokeObjectURL(img.src);
      img.src = "";
    }
    workCanvas.width = 0;
    workCanvas.height = 0;
    if (outputCanvas) {
      outputCanvas.width = 0;
      outputCanvas.height = 0;
    }
  }
}
