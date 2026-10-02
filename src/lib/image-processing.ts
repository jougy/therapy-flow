/**
 * Therapy-Flow Image Processing Utility
 * Otimizado para logotipos e avatares quadrados (1:1), exportando em WebP de alta fidelidade
 */

export interface ProcessSquareImageOptions {
  maxDimension?: number;
  quality?: number;
}

export interface ImageProcessingMetrics {
  originalSize: number;
  compressedSize: number;
  reductionPercent: number;
}

export interface ProcessedSquareImageResult extends ImageProcessingMetrics {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".svg"];

/**
 * Formata bytes em string legível (ex: 1.2 MB, 45 KB)
 */
export function formatByteSize(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

/**
 * Normaliza o nome do arquivo para ter extensão .webp
 */
export function normalizeWebpFilename(originalName: string): string {
  const base = originalName.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanBase = base.slice(0, 80) || "logo";
  return `${cleanBase}.webp`;
}

/**
 * Processa e recorta centralizadamente um arquivo de imagem para proporção 1:1 quadrada,
 * redimensionando para maxDimension (padrão 512x512) e exportando em formato WebP.
 */
export async function processSquareImageToWebp(
  file: File,
  options: ProcessSquareImageOptions = {}
): Promise<ProcessedSquareImageResult> {
  const { maxDimension = 512, quality = 0.85 } = options;

  // 1. Validação de tamanho máximo
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `O arquivo selecionado (${formatByteSize(file.size)}) ultrapassa o limite máximo de 10 MB.`
    );
  }

  // 2. Validação de tipo de arquivo
  const fileExt = `.${file.name.split(".").pop()?.toLowerCase()}`;
  const isExtensionValid = ALLOWED_EXTENSIONS.includes(fileExt);
  const isMimeValid = ALLOWED_MIME_TYPES.has(file.type.toLowerCase());

  if (!isMimeValid && !isExtensionValid) {
    throw new Error(
      "Formato de imagem não suportado. Por favor, envie um arquivo JPG, PNG, WebP ou SVG."
    );
  }

  // 3. Carregar elemento de imagem via Image() ou createImageBitmap
  const img = await loadImageElement(file);

  try {
    const origWidth = img.naturalWidth || img.width;
    const origHeight = img.naturalHeight || img.height;

    if (!origWidth || !origHeight) {
      throw new Error("Não foi possível identificar as dimensões da imagem.");
    }

    // 4. Calcular corte quadrado centralizado (cover)
    const minSide = Math.min(origWidth, origHeight);
    const cropX = (origWidth - minSide) / 2;
    const cropY = (origHeight - minSide) / 2;

    // Resolução de saída: no máximo maxDimension x maxDimension, sem upscaling desnecessário
    const targetSize = Math.min(maxDimension, minSide);

    // 5. Desenhar no Canvas quadrado
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      throw new Error("Falha ao inicializar o contexto gráfico para processamento da imagem.");
    }

    // Suavização de alta qualidade
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    ctx.drawImage(
      img,
      cropX,
      cropY,
      minSide,
      minSide,
      0,
      0,
      targetSize,
      targetSize
    );

    // 6. Exportar para Blob WebP com fallback para PNG se navegador não suportar WebP
    const blob = await canvasToBlob(canvas, "image/webp", quality);

    // Liberar buffer do canvas para evitar retenção de memória em render engines (Garbage Collector imediato)
    canvas.width = 0;
    canvas.height = 0;

    const originalSize = file.size;
    const compressedSize = blob.size;
    const reductionPercent =
      originalSize > 0
        ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
        : 0;

    const filename = normalizeWebpFilename(file.name);

    return {
      blob,
      filename,
      originalSize,
      compressedSize,
      width: targetSize,
      height: targetSize,
      reductionPercent,
    };
  } finally {
    // Revogar Object URL e limpar referências para prevenir vazamentos de memória
    if (img.src && img.src.startsWith("blob:")) {
      URL.revokeObjectURL(img.src);
      img.src = "";
    }
  }
}

/**
 * Sanitiza o conteúdo XML/SVG contra injeção de scripts, handlers de eventos e URLs perigosas.
 * Evita execução de XSS mesmo se o SVG for renderizado de forma embutida ou inline.
 */
export function sanitizeSvgContent(rawSvg: string): string {
  // 1. Remove tags <script>...</script> ou <script ... />
  let sanitized = rawSvg.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  sanitized = sanitized.replace(/<script\b[^>]*\/>/gi, "");

  // 2. Remove handlers de eventos inline (onload, onerror, onclick, onmouseover, etc.)
  sanitized = sanitized.replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // 3. Remove href/xlink:href com javascript:, data: ou vbscript: perigosos
  sanitized = sanitized.replace(/\b(?:href|xlink:href)\s*=\s*["']?\s*(?:javascript|data\s*:\s*text\/html|vbscript):[^"'>\s]*/gi, "");

  // 4. Remove elementos perigosos como <foreignObject>, <applet>, <iframe>, <embed>, <object>
  sanitized = sanitized.replace(/<(?:\/)?(?:foreignobject|applet|iframe|embed|object)\b[^>]*>/gi, "");

  return sanitized;
}

/**
 * Auxiliar para carregar imagem de forma segura tanto para rasters quanto para SVGs
 */
async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

  let objectUrl: string;

  if (isSvg) {
    // Para SVGs, lemos o texto e aplicamos sanitização antes de instanciar a URL de objeto
    const text = await file.text();
    const cleanSvg = sanitizeSvgContent(text);
    const sanitizedBlob = new Blob([cleanSvg], { type: "image/svg+xml" });
    objectUrl = URL.createObjectURL(sanitizedBlob);
  } else {
    objectUrl = URL.createObjectURL(file);
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    // Previne envio de credenciais desnecessárias e reforça sandbox de renderização
    img.crossOrigin = "anonymous";

    img.onload = () => {
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar a imagem. Verifique se o arquivo está corrompido ou formato inválido."));
    };

    img.src = objectUrl;
  });
}

/**
 * Converte canvas para Blob com promessa tipada e suporte a fallback de formato
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        // Fallback para image/png se falhar com webp
        canvas.toBlob(
          (pngBlob) => {
            if (pngBlob) {
              resolve(pngBlob);
            } else {
              reject(new Error("Não foi possível gerar a imagem processada."));
            }
          },
          "image/png"
        );
      },
      type,
      quality
    );
  });
}

