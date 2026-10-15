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
  severity?: "low" | "medium" | "high"; // Cor semântica opcional
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

    ctx.restore();
  }
}
