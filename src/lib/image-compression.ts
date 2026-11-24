export interface CompressImageOptions {
  /** Maior dimensão (largura ou altura) em pixels. Padrão: 256px. */
  maxSize?: number;
  /** Qualidade WebP inicial (0 a 1). Padrão: 0.62 (super compactado). */
  quality?: number;
  /** Limite alvo em bytes da data URL para tentar uma segunda passada mais leve. */
  targetMaxBytes?: number;
}

/**
 * Converte um arquivo de imagem para WebP redimensionado e super compactado,
 * retornando uma Data URL `data:image/webp;base64,...`.
 */
export async function compressImageToWebp(
  file: File,
  options: CompressImageOptions = {},
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Selecione um arquivo de imagem válido.");
  }

  const maxSize = options.maxSize ?? 256;
  const initialQuality = options.quality ?? 0.62;
  const targetMaxBytes = options.targetMaxBytes ?? 28_000;

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Não foi possível carregar a imagem selecionada."));
      image.src = objectUrl;
    });

    const sourceWidth = img.naturalWidth || img.width;
    const sourceHeight = img.naturalHeight || img.height;
    if (!sourceWidth || !sourceHeight) {
      throw new Error("Dimensões da imagem inválidas.");
    }

    const scale = Math.min(1, maxSize / Math.max(sourceWidth, sourceHeight));
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Contexto gráfico indisponível para compactação.");
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    let dataUrl = canvas.toDataURL("image/webp", initialQuality);

    if (dataUrl.length > targetMaxBytes) {
      dataUrl = canvas.toDataURL("image/webp", 0.42);
    }

    if (!dataUrl.startsWith("data:image/webp")) {
      throw new Error("Seu navegador não suporta exportação em WebP.");
    }

    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
