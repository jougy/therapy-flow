/**
 * Utilitário de Extração de Texto de PDF e OCR com Tesseract.js
 *
 * Suporta PDFs digitais (via pdfjs-dist) e PDFs escaneados/imagem através
 * de renderização em canvas e OCR local em português com tesseract.js.
 */

import { readFileAsArrayBuffer, readFileAsText } from "./termDocumentScanner";

/**
 * Sanitiza e extrai texto de arquivo PDF utilizando pdfjs-dist e OCR com tesseract.js
 */
export async function parsePdfFile(
  file: File | Blob,
  onProgress?: (status: string) => void
): Promise<{ text: string; hasImages: boolean }> {
  try {
    onProgress?.("Carregando motor do PDF...");
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions?.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.mjs",
        import.meta.url
      ).href;
    }

    const arrayBuffer = await readFileAsArrayBuffer(file);
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      disableFontFace: true,
      stopAtErrors: false,
    });

    const loadedPdf = await loadingTask.promise;
    const pageTexts: string[] = [];
    let hasImages = false;

    for (let pageNum = 1; pageNum <= loadedPdf.numPages; pageNum++) {
      onProgress?.(`Lendo página ${pageNum} de ${loadedPdf.numPages}...`);
      const page = await loadedPdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const lineStrings = textContent.items
        .map((item: unknown) => {
          if (item && typeof item === "object" && "str" in item) {
            return String((item as { str: unknown }).str);
          }
          return "";
        })
        .filter((str: string) => str.trim().length > 0);

      if (lineStrings.length > 0) {
        pageTexts.push(lineStrings.join(" "));
      }

      try {
        const opList = await page.getOperatorList();
        const paintImgOps = [
          pdfjs.OPS?.paintImageXObject,
          pdfjs.OPS?.paintInlineImageXObject,
          pdfjs.OPS?.paintImageMaskXObject,
        ].filter(Boolean);
        if (opList?.fnArray?.some((fn: number) => paintImgOps.includes(fn))) {
          hasImages = true;
        }
      } catch {
        // Ignora verificação de imagem se opList não estiver disponível
      }
    }

    // Se o texto extraído for vazio ou muito curto (< 30 caracteres),
    // trata-se de PDF escaneado/imagem. Executa OCR local com Tesseract.js.
    const totalExtractedLength = pageTexts.reduce((acc, text) => acc + text.trim().length, 0);
    const isScannedPdf =
      (totalExtractedLength < 30 || pageTexts.length === 0) && loadedPdf.numPages > 0;

    if (isScannedPdf) {
      hasImages = true;
      if (typeof document !== "undefined") {
        onProgress?.("PDF escaneado detectado. Inicializando OCR local...");
        let worker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | null = null;
        try {
          const { createWorker } = await import("tesseract.js");
          onProgress?.("Configurando OCR em Português...");
          worker = await createWorker("por", 1, {
            logger: (m: { status?: string; progress?: number }) => {
              if (m.status === "recognizing text" && typeof m.progress === "number") {
                const pct = Math.round(m.progress * 100);
                onProgress?.(`Reconhecendo texto (OCR): ${pct}%`);
              } else if (m.status) {
                onProgress?.(`OCR: ${m.status}`);
              }
            },
          });

          const ocrTexts: string[] = [];
          for (let pageNum = 1; pageNum <= loadedPdf.numPages; pageNum++) {
            onProgress?.(`Executando OCR na página ${pageNum} de ${loadedPdf.numPages}...`);
            const page = await loadedPdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement("canvas");
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            const ctx = canvas.getContext("2d");
            if (ctx) {
              await page.render({
                canvasContext: ctx,
                viewport,
              }).promise;

              const ocrResult = await worker.recognize(canvas);
              const text = ocrResult?.data?.text || "";
              if (text.trim().length > 0) {
                ocrTexts.push(text.trim());
              }
            }
          }

          if (ocrTexts.length > 0) {
            pageTexts.length = 0;
            pageTexts.push(...ocrTexts);
          }
        } catch (ocrErr) {
          console.warn("Falha no OCR via Tesseract:", ocrErr);
        } finally {
          if (worker) {
            try {
              await worker.terminate();
            } catch {
              // Ignora encerramento
            }
          }
        }
      }
    }

    const fullText = pageTexts.join("\n\n");
    return { text: fullText, hasImages };
  } catch (err) {
    console.warn("Falha no parsing detalhado do PDF, usando fallback de texto:", err);
    const fallback = await readFileAsText(file);
    return { text: fallback, hasImages: false };
  }
}
