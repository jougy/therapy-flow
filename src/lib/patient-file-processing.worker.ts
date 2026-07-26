import {
  PATIENT_FILE_IMAGE_MAX_DIMENSION,
  PATIENT_FILE_IMAGE_WEBP_QUALITY,
  normalizePatientUploadContentType,
  shouldUseClinicalRasterPdf,
  shouldUseProcessedPatientFile,
  type PatientFileStorageEncoding,
  type PatientFileUploadContentType,
} from "@/lib/patient-file-uploads";

type ProcessRequest = {
  file: File;
  jobId: string;
};

type ProcessSuccess = {
  blob: Blob;
  checksumSha256: string;
  compressionProfile: string;
  filename: string;
  imageHeight: number | null;
  imageWidth: number | null;
  originalByteSize: number;
  originalContentType: string;
  pageCount: number | null;
  storageEncoding: PatientFileStorageEncoding | null;
  storedByteSize: number;
  storedContentType: PatientFileUploadContentType;
};

type ProcessResponse =
  | { jobId: string; ok: true; result: ProcessSuccess }
  | { error: string; jobId: string; ok: false };

const post = (message: ProcessResponse) => {
  self.postMessage(message);
};

const extensionlessName = (name: string) => name.replace(/\.[^.]+$/, "") || "arquivo";

const blobToSha256 = async (blob: Blob) => {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const canvasToBlob = (canvas: OffscreenCanvas | HTMLCanvasElement, type: string, quality: number) =>
  "convertToBlob" in canvas
    ? (canvas as OffscreenCanvas).convertToBlob({ quality, type })
    : new Promise<Blob>((resolve, reject) => {
        (canvas as HTMLCanvasElement).toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Falha ao compactar imagem."))), type, quality);
      });

const fillCanvasWhite = (context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D, width: number, height: number) => {
  context.save();
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.restore();
};

const processImage = async (file: File): Promise<ProcessSuccess> => {
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, PATIENT_FILE_IMAGE_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  if (typeof OffscreenCanvas === "undefined") {
    throw new Error("Este navegador não suporta processamento de imagem em segundo plano.");
  }

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Não foi possível preparar a imagem.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const optimized = await canvasToBlob(canvas, "image/webp", PATIENT_FILE_IMAGE_WEBP_QUALITY);
  const useOptimized = shouldUseProcessedPatientFile(file.size, optimized.size);
  const blob = useOptimized ? optimized : file;
  const storedContentType = (useOptimized ? "image/webp" : normalizePatientUploadContentType(file.type)) as PatientFileUploadContentType;

  return {
    blob,
    checksumSha256: await blobToSha256(blob),
    compressionProfile: useOptimized ? "image-webp-balanced-v1" : "original-image-smaller-v1",
    filename: useOptimized ? `${extensionlessName(file.name)}.webp` : file.name,
    imageHeight: height,
    imageWidth: width,
    originalByteSize: file.size,
    originalContentType: normalizePatientUploadContentType(file.type),
    pageCount: null,
    storageEncoding: null,
    storedByteSize: blob.size,
    storedContentType,
  };
};

const compressPdfTransport = async (blob: Blob) => {
  if (!("CompressionStream" in self)) {
    return null;
  }

  const stream = blob.stream().pipeThrough(new CompressionStream("gzip"));
  const compressed = await new Response(stream).blob();

  return shouldUseProcessedPatientFile(blob.size, compressed.size) ? compressed : null;
};

type PdfOptimizationResult = {
  blob: Blob;
  pageCount: number | null;
  profile: string;
};

type PdfCandidate = {
  args: string[];
  profile: string;
};

const pdfCandidates: PdfCandidate[] = [
  {
    args: [
      "--object-streams=generate",
      "--stream-data=compress",
      "--compress-streams=y",
      "--recompress-flate",
      "--compression-level=9",
      "--",
      "input.pdf",
      "output.pdf",
    ],
    profile: "pdf-qpdf-lossless-streams-v2",
  },
  {
    args: [
      "--linearize",
      "--object-streams=generate",
      "--stream-data=compress",
      "--compress-streams=y",
      "--recompress-flate",
      "--compression-level=9",
      "--",
      "input.pdf",
      "output.pdf",
    ],
    profile: "pdf-qpdf-lossless-linearized-v2",
  },
  {
    args: [
      "--decode-level=generalized",
      "--object-streams=generate",
      "--stream-data=compress",
      "--compress-streams=y",
      "--recompress-flate",
      "--compression-level=9",
      "--",
      "input.pdf",
      "output.pdf",
    ],
    profile: "pdf-qpdf-lossless-decode-recompress-v2",
  },
  {
    args: ["--linearize", "--", "input.pdf", "output.pdf"],
    profile: "pdf-qpdf-linearized-v1",
  },
];

const processPdfLossless = async (file: File): Promise<PdfOptimizationResult> => {
  let optimizedBlob: Blob = file;
  let compressionProfile = "pdf-original-v1";

  try {
    const { createQpdfRunner: createRunner } = await import("qpdf-run");
    const qpdf = await createRunner({
      qpdfJsUrl: new URL("qpdf-run/qpdf.js", import.meta.url).href,
      timeoutMs: 60_000,
      wasmUrl: new URL("qpdf-run/qpdf.wasm", import.meta.url).href,
      workerUrl: new URL("qpdf-run/worker", import.meta.url).href,
    });

    try {
      const input = new Uint8Array(await file.arrayBuffer());

      for (const candidate of pdfCandidates) {
        try {
          const output = await qpdf.runOne({
            args: candidate.args,
            input,
            inputName: "input.pdf",
            outputName: "output.pdf",
          });
          const qpdfBlob = new Blob([output], { type: "application/pdf" });

          if (
            shouldUseProcessedPatientFile(file.size, qpdfBlob.size) &&
            qpdfBlob.size < optimizedBlob.size
          ) {
            optimizedBlob = qpdfBlob;
            compressionProfile = candidate.profile;
          }
        } catch {
          // Some qpdf builds do not support every optimization flag. Keep trying safer profiles.
        }
      }
    } finally {
      await qpdf.destroy();
    }
  } catch {
    optimizedBlob = file;
  }

  return {
    blob: optimizedBlob,
    pageCount: null,
    profile: compressionProfile,
  };
};

const processPdfClinicalRaster = async (file: File): Promise<PdfOptimizationResult | null> => {
  if (typeof OffscreenCanvas === "undefined") {
    return null;
  }

  try {
    const [{ PDFDocument }, pdfjs] = await Promise.all([
      import("pdf-lib"),
      import("pdfjs-dist/legacy/build/pdf.mjs"),
    ]);
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.mjs", import.meta.url).href;
    const data = new Uint8Array(await file.arrayBuffer());
    const loadingTask = pdfjs.getDocument({
      data,
      disableFontFace: true,
      isImageDecoderSupported: false,
      isOffscreenCanvasSupported: true,
      stopAtErrors: false,
      useSystemFonts: true,
      useWorkerFetch: false,
      useWasm: true,
    });
    const sourcePdf = await loadingTask.promise;
    const outputPdf = await PDFDocument.create();
    const targetScale = 2;
    const maxRasterSide = 2_200;
    const jpegQuality = 0.8;

    try {
      for (let pageNumber = 1; pageNumber <= sourcePdf.numPages; pageNumber += 1) {
        const page = await sourcePdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(targetScale, maxRasterSide / Math.max(baseViewport.width, baseViewport.height));
        const viewport = page.getViewport({ scale: Math.max(1, scale) });
        const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        const context = canvas.getContext("2d");

        if (!context) {
          throw new Error("Não foi possível preparar o canvas do PDF.");
        }

        fillCanvasWhite(context, canvas.width, canvas.height);
        await page.render({
          canvas: canvas as unknown as HTMLCanvasElement,
          canvasContext: context as unknown as CanvasRenderingContext2D,
          viewport,
        }).promise;

        const jpegBlob = await canvasToBlob(canvas, "image/jpeg", jpegQuality);
        const image = await outputPdf.embedJpg(await jpegBlob.arrayBuffer());
        const outputPage = outputPdf.addPage([baseViewport.width, baseViewport.height]);
        outputPage.drawImage(image, {
          height: baseViewport.height,
          width: baseViewport.width,
          x: 0,
          y: 0,
        });
        page.cleanup();
      }

      const bytes = await outputPdf.save({
        addDefaultPage: false,
        objectsPerTick: 25,
        useObjectStreams: true,
      });
      const blob = new Blob([bytes], { type: "application/pdf" });

      return shouldUseClinicalRasterPdf(file.size, blob.size)
        ? {
            blob,
            pageCount: sourcePdf.numPages,
            profile: "pdf-clinical-raster-v1",
          }
        : null;
    } finally {
      if ("destroy" in sourcePdf && typeof sourcePdf.destroy === "function") {
        await sourcePdf.destroy();
      } else if ("destroy" in loadingTask && typeof loadingTask.destroy === "function") {
        await loadingTask.destroy();
      }
    }
  } catch {
    return null;
  }
};

const processPdf = async (file: File): Promise<ProcessSuccess> => {
  let optimized = await processPdfLossless(file);
  const raster = shouldUseProcessedPatientFile(file.size, optimized.blob.size) ? null : await processPdfClinicalRaster(file);

  if (raster && raster.blob.size < optimized.blob.size) {
    optimized = raster;
  }

  const compressed = await compressPdfTransport(optimized.blob);
  const blob = compressed ?? optimized.blob;
  const storageEncoding = compressed ? "gzip" : null;

  return {
    blob,
    checksumSha256: await blobToSha256(blob),
    compressionProfile: compressed ? `${optimized.profile}+gzip` : optimized.profile,
    filename: file.name,
    imageHeight: null,
    imageWidth: null,
    originalByteSize: file.size,
    originalContentType: "application/pdf",
    pageCount: optimized.pageCount,
    storageEncoding,
    storedByteSize: blob.size,
    storedContentType: "application/pdf",
  };
};

self.onmessage = async (event: MessageEvent<ProcessRequest>) => {
  const { file, jobId } = event.data;

  try {
    const contentType = normalizePatientUploadContentType(file.type);
    const result = contentType === "application/pdf" ? await processPdf(file) : await processImage(file);
    post({ jobId, ok: true, result });
  } catch (error) {
    post({
      error: error instanceof Error ? error.message : "Não foi possível processar o arquivo.",
      jobId,
      ok: false,
    });
  }
};
