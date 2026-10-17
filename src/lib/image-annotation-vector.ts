/**
 * Therapy-Flow Clinical Vector Image Annotation Engine
 * 
 * Engine vetorial ultraleve para anotações em imagens clínicas:
 * - Coordenadas normalizadas em base 0..1000 (viewBox independente de resolução)
 * - Zero duplicação de imagem: armazena apenas a referência baseImageUrl e os vetores
 * - Peso típico de payload: 200 bytes a 2 KB
 * - Suporta: caneta livre (freehand), marca-texto (highlighter), formas (retângulo, círculo, triângulo, cruz 'X'),
 *   linhas (reta, tracejada, pontilhada, seta), texto livre e pins/tags interativos com labels e comentários.
 */

export type ClinicalAnnotationTool =
  | "select"
  | "pen"
  | "highlighter"
  | "arrow"
  | "line"
  | "rect"
  | "circle"
  | "triangle"
  | "cross"
  | "text"
  | "pin";

export type ClinicalLineStyle = "solid" | "dashed" | "dotted";

export interface ClinicalAnnotationShape {
  id: string;
  type:
    | "freehand"
    | "pen"
    | "highlighter"
    | "arrow"
    | "line"
    | "rect"
    | "circle"
    | "triangle"
    | "cross"
    | "text"
    | "pin";
  x: number; // 0..1000
  y: number; // 0..1000
  width?: number; // 0..1000
  height?: number; // 0..1000
  points?: [number, number][]; // Pontos [x, y] normalizados (0..1000)
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number; // Ex: 2, 4, 8
  strokeStyle?: ClinicalLineStyle;
  text?: string;

  // Propriedades específicas de Pins/Tags
  pinNumber?: number;
  label?: string; // Título curto (ex: "Ponto gatilho", "Edema")
  comment?: string; // Descrição clínica aprofundada
  severity?: "low" | "medium" | "high" | "critical"; // Cor semântica opcional
  severityScore?: number; // 0..100 (0 = Verde, ~38 = Amarelo, ~65 = Laranja, ~82 = Vermelho, 100 = Roxo)
}

const PIN_SPECTRUM_STOPS: { stop: number; rgb: [number, number, number] }[] = [
  { stop: 0, rgb: [34, 197, 94] },    // #22C55E (Verde)
  { stop: 35, rgb: [234, 179, 8] },   // #EAB308 (Amarelo)
  { stop: 62, rgb: [249, 115, 22] },  // #F97316 (Laranja)
  { stop: 82, rgb: [239, 68, 68] },   // #EF4444 (Vermelho)
  { stop: 100, rgb: [139, 92, 246] }, // #8B5CF6 (Roxo)
];

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0").toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Interpola suavemente a cor Hex de um Pin com base no slider (0 a 100):
 * Esquerda (0) = Verde -> Amarelo -> Laranja -> Vermelho -> Final da direita (100) = Roxo
 */
export function getPinColorFromSeverityScore(score: number): string {
  const clamped = Math.max(0, Math.min(100, score));
  for (let i = 0; i < PIN_SPECTRUM_STOPS.length - 1; i++) {
    const start = PIN_SPECTRUM_STOPS[i];
    const end = PIN_SPECTRUM_STOPS[i + 1];
    if (clamped >= start.stop && clamped <= end.stop) {
      const ratio = (clamped - start.stop) / (end.stop - start.stop || 1);
      const r = start.rgb[0] + (end.rgb[0] - start.rgb[0]) * ratio;
      const g = start.rgb[1] + (end.rgb[1] - start.rgb[1]) * ratio;
      const b = start.rgb[2] + (end.rgb[2] - start.rgb[2]) * ratio;
      return rgbToHex(r, g, b);
    }
  }
  return "#8B5CF6";
}

export function getPinSeverityInfoFromScore(score: number): {
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  color: string;
} {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  const color = getPinColorFromSeverityScore(clamped);
  if (clamped < 25) {
    return { severity: "low", label: "Baixo / Evolução Positiva", color };
  }
  if (clamped < 55) {
    return { severity: "medium", label: "Médio / Atenção & Palpação", color };
  }
  if (clamped < 85) {
    return { severity: "high", label: "Alto / Dor Aguda ou Alerta", color };
  }
  return { severity: "critical", label: "Crítico / Neuropatia ou Irradiação", color };
}

export function resolveInitialPinSeverityScore(pin?: ClinicalAnnotationShape | null): number {
  if (!pin) return 35;
  if (typeof pin.severityScore === "number" && Number.isFinite(pin.severityScore)) {
    return Math.max(0, Math.min(100, Math.round(pin.severityScore)));
  }
  if (pin.severity === "low") return 0;
  if (pin.severity === "medium") return 35;
  if (pin.severity === "high") return 80;
  if (pin.severity === "critical") return 100;
  const upperColor = (pin.strokeColor || "").toUpperCase();
  if (upperColor === "#22C55E") return 0;
  if (upperColor === "#EAB308") return 35;
  if (upperColor === "#F97316") return 62;
  if (upperColor === "#EF4444") return 82;
  if (upperColor === "#8B5CF6") return 100;
  return 35;
}

export interface ClinicalImageAnnotationValue {
  baseImageId?: string;
  baseImageUrl: string;
  baseImageWidth: number;
  baseImageHeight: number;
  annotations: ClinicalAnnotationShape[];
  updatedAt?: string;
  sourceSessionId?: string;
}

export interface SavedAnnotationBaseImage {
  id: string;
  url: string;
  filename: string;
  width: number;
  height: number;
  createdAt: string;
}

const RECENT_IMAGES_STORAGE_PREFIX = "pluri_recent_annotation_images_";
const MAX_RECENT_BASE_IMAGES = 24;

export function getRecentAnnotationBaseImages(clinicId?: string | null): SavedAnnotationBaseImage[] {
  if (typeof window === "undefined") return [];
  try {
    const key = `${RECENT_IMAGES_STORAGE_PREFIX}${clinicId || "local"}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedAnnotationBaseImage =>
        item &&
        typeof item === "object" &&
        typeof item.url === "string" &&
        item.url.length > 0 &&
        typeof item.width === "number" &&
        typeof item.height === "number"
    );
  } catch {
    return [];
  }
}

export function saveRecentAnnotationBaseImage(
  image: Omit<SavedAnnotationBaseImage, "createdAt"> & { createdAt?: string },
  clinicId?: string | null
): SavedAnnotationBaseImage[] {
  if (typeof window === "undefined" || !image.url) return [];
  try {
    const key = `${RECENT_IMAGES_STORAGE_PREFIX}${clinicId || "local"}`;
    const current = getRecentAnnotationBaseImages(clinicId);
    const entry: SavedAnnotationBaseImage = {
      id: image.id || `img_${Date.now()}`,
      url: image.url,
      filename: image.filename || "Imagem clínica",
      width: image.width || 1200,
      height: image.height || 800,
      createdAt: image.createdAt || new Date().toISOString(),
    };
    const filtered = current.filter((item) => item.url !== entry.url && item.id !== entry.id);
    const next = [entry, ...filtered].slice(0, MAX_RECENT_BASE_IMAGES);
    window.localStorage.setItem(key, JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export const CLINICAL_PALETTE_COLORS = [
  { hex: "#EF4444", label: "Vermelho (Dor aguda / Alerta)" },
  { hex: "#F97316", label: "Laranja (Atenção / Tensão moderada)" },
  { hex: "#EAB308", label: "Amarelo (Inflamação / Palpação sensível)" },
  { hex: "#22C55E", label: "Verde (Evolução positiva / Mobilidade normal)" },
  { hex: "#3B82F6", label: "Azul (Edema / Frio / Referência neutra)" },
  { hex: "#8B5CF6", label: "Roxo (Neuropatia / Parestesia)" },
  { hex: "#FFFFFF", label: "Branco" },
  { hex: "#0F172A", label: "Preto / Escuro" },
];

/**
 * Normaliza um ponto de coordenadas de tela (pixel no canvas) para base 0..1000
 */
export function normalizeCoordinate(pixelVal: number, totalDimension: number): number {
  if (totalDimension <= 0) return 0;
  const clamped = Math.max(0, Math.min(pixelVal, totalDimension));
  return Math.round((clamped / totalDimension) * 1000);
}

/**
 * Converte coordenada normalizada (0..1000) de volta para pixels reais de renderização
 */
export function denormalizeCoordinate(normVal: number, totalDimension: number): number {
  return (normVal / 1000) * totalDimension;
}

/**
 * Calcula a caixa delimitadora (bounding box) normalizada (0..1000) de uma forma
 */
export function getShapeBoundingBox(shape: ClinicalAnnotationShape): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (
    (shape.type === "freehand" || shape.type === "pen" || shape.type === "highlighter") &&
    shape.points &&
    shape.points.length > 0
  ) {
    let minX = shape.points[0][0];
    let minY = shape.points[0][1];
    let maxX = shape.points[0][0];
    let maxY = shape.points[0][1];
    for (const [px, py] of shape.points) {
      if (px < minX) minX = px;
      if (py < minY) minY = py;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    return { minX, minY, maxX, maxY };
  }

  if (shape.type === "pin") {
    return {
      minX: shape.x - 24,
      minY: shape.y - 24,
      maxX: shape.x + 24,
      maxY: shape.y + 24,
    };
  }

  if (shape.type === "text") {
    const textLen = (shape.text || "").length;
    const estWidth = Math.max(60, textLen * 11);
    const estHeight = Math.max(28, shape.strokeWidth * 6);
    return {
      minX: shape.x - 4,
      minY: shape.y - 4,
      maxX: shape.x + estWidth,
      maxY: shape.y + estHeight,
    };
  }

  const w = shape.width ?? 0;
  const h = shape.height ?? 0;
  const x1 = shape.x;
  const y1 = shape.y;
  const x2 = shape.x + w;
  const y2 = shape.y + h;

  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2),
  };
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/**
 * Verifica se o clique/toque nas coordenadas normalizadas (0..1000) atingiu uma forma
 */
export function hitTestAnnotationShape(
  shape: ClinicalAnnotationShape,
  normX: number,
  normY: number,
  tolerance = 24
): boolean {
  if (shape.type === "pin") {
    return Math.hypot(shape.x - normX, shape.y - normY) <= 32;
  }

  if (
    (shape.type === "freehand" || shape.type === "pen" || shape.type === "highlighter") &&
    shape.points &&
    shape.points.length > 0
  ) {
    if (shape.points.length === 1) {
      return Math.hypot(shape.points[0][0] - normX, shape.points[0][1] - normY) <= tolerance;
    }
    const hitRadius = shape.type === "highlighter" ? Math.max(tolerance, 32) : tolerance;
    for (let i = 0; i < shape.points.length - 1; i++) {
      const [x1, y1] = shape.points[i];
      const [x2, y2] = shape.points[i + 1];
      if (distanceToSegment(normX, normY, x1, y1, x2, y2) <= hitRadius) {
        return true;
      }
    }
    return false;
  }

  if (shape.type === "line" || shape.type === "arrow") {
    const x1 = shape.x;
    const y1 = shape.y;
    const x2 = shape.x + (shape.width ?? 0);
    const y2 = shape.y + (shape.height ?? 0);
    return distanceToSegment(normX, normY, x1, y1, x2, y2) <= tolerance;
  }

  const box = getShapeBoundingBox(shape);
  return (
    normX >= box.minX - tolerance / 2 &&
    normX <= box.maxX + tolerance / 2 &&
    normY >= box.minY - tolerance / 2 &&
    normY <= box.maxY + tolerance / 2
  );
}

/**
 * Move uma forma pelo deslocamento normalizado (deltaX, deltaY) mantendo dentro de 0..1000
 */
export function translateAnnotationShape(
  shape: ClinicalAnnotationShape,
  deltaX: number,
  deltaY: number
): ClinicalAnnotationShape {
  const clamp = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));

  if (
    (shape.type === "freehand" || shape.type === "pen" || shape.type === "highlighter") &&
    shape.points
  ) {
    return {
      ...shape,
      x: clamp(shape.x + deltaX),
      y: clamp(shape.y + deltaY),
      points: shape.points.map(([px, py]) => [clamp(px + deltaX), clamp(py + deltaY)]),
    };
  }

  return {
    ...shape,
    x: clamp(shape.x + deltaX),
    y: clamp(shape.y + deltaY),
  };
}

/**
 * Converte um arquivo de imagem (JPG, PNG, HEIC, WEBP) para WebP otimizado via OffscreenCanvas / Canvas
 * Preserva estritamente a proporção de aspecto (aspect ratio original) sem esticar ou cortar.
 */
export async function convertImageFileToWebp(
  file: File,
  maxDimension = 1920,
  quality = 0.85
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number; filename: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo de imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Formato de imagem inválido ou corrompido."));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Contexto 2D não disponível"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falha na conversão para WebP."));
              return;
            }

            const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
            const filename = `${cleanName || "imagem_clinica"}.webp`;
            const dataUrl = canvas.toDataURL("image/webp", quality);

            resolve({
              blob,
              dataUrl,
              width,
              height,
              filename,
            });
          },
          "image/webp",
          quality
        );
      };

      img.src = reader.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Renderiza uma lista de anotações vetoriais sobre um contexto 2D de Canvas
 */
export function renderAnnotationsToCanvasContext(
  ctx: CanvasRenderingContext2D,
  annotations: ClinicalAnnotationShape[],
  canvasWidth: number,
  canvasHeight: number,
  options?: { selectedShapeId?: string | null; hoverShapeId?: string | null }
) {
  for (const shape of annotations) {
    ctx.save();

    const isSelected = options?.selectedShapeId === shape.id;
    const isHover = options?.hoverShapeId === shape.id;

    ctx.strokeStyle = shape.strokeColor;
    ctx.fillStyle = shape.fillColor || shape.strokeColor;
    ctx.lineWidth = Math.max(1, (shape.strokeWidth / 1000) * canvasWidth);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (shape.strokeStyle === "dashed") {
      ctx.setLineDash([ctx.lineWidth * 2.5, ctx.lineWidth * 2]);
    } else if (shape.strokeStyle === "dotted") {
      ctx.setLineDash([ctx.lineWidth, ctx.lineWidth * 1.5]);
    } else {
      ctx.setLineDash([]);
    }

    if (shape.type === "highlighter") {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = Math.max(12, (shape.strokeWidth / 1000) * canvasWidth * 3);
    }

    const x = denormalizeCoordinate(shape.x, canvasWidth);
    const y = denormalizeCoordinate(shape.y, canvasHeight);
    const w = shape.width !== undefined ? denormalizeCoordinate(shape.width, canvasWidth) : 0;
    const h = shape.height !== undefined ? denormalizeCoordinate(shape.height, canvasHeight) : 0;

    switch (shape.type) {
      case "freehand":
      case "pen":
      case "highlighter": {
        if (shape.points && shape.points.length > 0) {
          ctx.beginPath();
          const startX = denormalizeCoordinate(shape.points[0][0], canvasWidth);
          const startY = denormalizeCoordinate(shape.points[0][1], canvasHeight);
          ctx.moveTo(startX, startY);

          for (let i = 1; i < shape.points.length; i++) {
            const px = denormalizeCoordinate(shape.points[i][0], canvasWidth);
            const py = denormalizeCoordinate(shape.points[i][1], canvasHeight);
            ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
        break;
      }

      case "line": {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
        ctx.stroke();
        break;
      }

      case "arrow": {
        const destX = x + w;
        const destY = y + h;
        const angle = Math.atan2(destY - y, destX - x);
        const headLength = Math.max(12, ctx.lineWidth * 3.5);

        // Traço da linha
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(destX, destY);
        ctx.stroke();

        // Cabeça da seta
        ctx.beginPath();
        ctx.fillStyle = shape.strokeColor;
        ctx.moveTo(destX, destY);
        ctx.lineTo(
          destX - headLength * Math.cos(angle - Math.PI / 6),
          destY - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          destX - headLength * Math.cos(angle + Math.PI / 6),
          destY - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        break;
      }

      case "rect": {
        ctx.beginPath();
        ctx.strokeRect(x, y, w, h);
        if (shape.fillColor && shape.fillColor !== "transparent") {
          ctx.fillRect(x, y, w, h);
        }
        break;
      }

      case "circle": {
        ctx.beginPath();
        const radiusX = Math.abs(w / 2);
        const radiusY = Math.abs(h / 2);
        const centerX = x + w / 2;
        const centerY = y + h / 2;
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
        if (shape.fillColor && shape.fillColor !== "transparent") {
          ctx.fill();
        }
        break;
      }

      case "triangle": {
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.stroke();
        if (shape.fillColor && shape.fillColor !== "transparent") {
          ctx.fill();
        }
        break;
      }

      case "cross": {
        const armW = Math.max(8, w);
        const armH = Math.max(8, h);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + armW, y + armH);
        ctx.moveTo(x + armW, y);
        ctx.lineTo(x, y + armH);
        ctx.stroke();
        break;
      }

      case "text": {
        if (shape.text) {
          const fontSize = Math.max(12, (shape.strokeWidth / 1000) * canvasWidth * 3.5);
          ctx.font = `600 ${fontSize}px sans-serif`;
          ctx.textBaseline = "top";

          // Fundo de contraste semi-transparente para legibilidade médica
          const metrics = ctx.measureText(shape.text);
          const bgPadding = 4;
          ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
          ctx.fillRect(
            x - bgPadding,
            y - bgPadding,
            metrics.width + bgPadding * 2,
            fontSize + bgPadding * 2
          );

          ctx.fillStyle = shape.strokeColor;
          ctx.fillText(shape.text, x, y);
        }
        break;
      }

      case "pin": {
        // Pin anatômico interativo: marcador circular com número
        const radius = Math.max(14, (canvasWidth / 1000) * 16);
        
        // Efeito de pulso / sombra
        ctx.shadowColor = "rgba(0,0,0,0.4)";
        ctx.shadowBlur = isSelected || isHover ? 8 : 4;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = shape.strokeColor;
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "#FFFFFF";
        ctx.stroke();

        // Número dentro do pin
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `bold ${Math.round(radius * 1.1)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(shape.pinNumber ?? 1), x, y);

        // Se estiver com hover ou selecionado, desenha tooltip rápido
        if (isSelected || isHover) {
          const title = shape.label || `Ponto ${shape.pinNumber ?? 1}`;
          ctx.font = "bold 12px sans-serif";
          const textMetrics = ctx.measureText(title);
          const tagW = textMetrics.width + 16;
          const tagH = 24;
          const tagX = x - tagW / 2;
          const tagY = y - radius - tagH - 6;

          ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 6);
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(title, x, tagY + tagH / 2);
        }
        break;
      }
    }

    // Desenha contorno tracejado de seleção quando selecionado ou em hover na ferramenta select
    if (isSelected || isHover) {
      const box = getShapeBoundingBox(shape);
      const bx = denormalizeCoordinate(box.minX, canvasWidth) - 6;
      const by = denormalizeCoordinate(box.minY, canvasHeight) - 6;
      const bw = denormalizeCoordinate(box.maxX - box.minX, canvasWidth) + 12;
      const bh = denormalizeCoordinate(box.maxY - box.minY, canvasHeight) + 12;

      ctx.save();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = isSelected ? "#38BDF8" : "rgba(56, 189, 248, 0.65)";
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
    }

    ctx.restore();
  }
}
