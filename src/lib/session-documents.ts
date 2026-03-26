export type SessionDocumentKind = "anamnesis" | "treatment" | "combined";

export interface SessionDocumentData {
  anamnesisSummary: string;
  patientName: string;
  quickNotes: string;
  sessionDate: string;
  treatmentSummary: string;
}

export interface SessionDocumentSection {
  title: string;
  content: string;
}

export interface SessionDocumentModel {
  filename: string;
  sections: SessionDocumentSection[];
  subtitle: string;
  title: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const renderTextSection = (title: string, content: string) => `${title}\n${content || "Nenhum conteúdo registrado."}`;

const renderHtmlSection = (title: string, content: string) => `
  <section style="margin-top: 28px;">
    <h2 style="font-size: 18px; font-weight: 700; margin: 0 0 12px;">${escapeHtml(title)}</h2>
    <div style="white-space: pre-wrap; line-height: 1.7; font-size: 14px;">${escapeHtml(content || "Nenhum conteúdo registrado.")}</div>
  </section>
`;

const kindLabels: Record<SessionDocumentKind, string> = {
  anamnesis: "anamnese",
  combined: "atendimento",
  treatment: "tratamento",
};

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

const sanitizeFilenameSegment = (value: string) => {
  const slug = slugify(value);
  return slug || "sem-identificacao";
};

const normalizeSectionContent = (value: string) => value.trim();

const getDocumentSections = (kind: SessionDocumentKind, data: SessionDocumentData) => {
  const sections: SessionDocumentSection[] = [];

  if (kind === "anamnesis" || kind === "combined") {
    sections.push({ title: "Anamnese", content: normalizeSectionContent(data.anamnesisSummary) });
  }

  if (kind === "treatment" || kind === "combined") {
    sections.push({ title: "Tratamento", content: normalizeSectionContent(data.treatmentSummary) });
  }

  if (data.quickNotes.trim()) {
    sections.push({ title: "Observações rápidas", content: normalizeSectionContent(data.quickNotes) });
  }

  return sections;
};

export const isSessionImmutable = (isNew: boolean, status: string) => !isNew && status !== "rascunho";

export const buildSessionDocumentFileName = (kind: SessionDocumentKind, data: SessionDocumentData) =>
  `${kindLabels[kind]}-${sanitizeFilenameSegment(data.patientName)}-${sanitizeFilenameSegment(data.sessionDate)}.pdf`;

export const buildSessionDocumentModel = (kind: SessionDocumentKind, data: SessionDocumentData): SessionDocumentModel => ({
  filename: buildSessionDocumentFileName(kind, data),
  sections: getDocumentSections(kind, data),
  subtitle: `Atendimento em ${data.sessionDate}`,
  title: `Atendimento - ${data.patientName} - ${data.sessionDate}`,
});

export const renderSessionDocumentText = (model: SessionDocumentModel) =>
  [
    model.title,
    "",
    ...model.sections.flatMap((section, index) => [
      renderTextSection(section.title, section.content),
      ...(index < model.sections.length - 1 ? [""] : []),
    ]),
  ].join("\n");

export const renderSessionDocumentHtml = (model: SessionDocumentModel) => `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(model.title)}</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 40px;
        color: #111827;
        background: #ffffff;
        font-family: Georgia, "Times New Roman", serif;
      }
      main {
        max-width: 760px;
        margin: 0 auto;
      }
      header {
        border-bottom: 1px solid #d1d5db;
        padding-bottom: 18px;
      }
      h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1.2;
      }
      .subtitle {
        margin-top: 8px;
        color: #4b5563;
        font-size: 14px;
      }
      @media print {
        body {
          padding: 24px;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${escapeHtml(model.title)}</h1>
        <p class="subtitle">${escapeHtml(model.subtitle)}</p>
      </header>
      ${model.sections.map((section) => renderHtmlSection(section.title, section.content)).join("")}
    </main>
  </body>
</html>
`;

export const buildSessionDocument = (kind: SessionDocumentKind, data: SessionDocumentData) => {
  const model = buildSessionDocumentModel(kind, data);

  return {
    filename: model.filename,
    html: renderSessionDocumentHtml(model),
    model,
    text: renderSessionDocumentText(model),
    title: model.title,
  };
};

const ensureBrowserEnvironment = () => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("Esta ação só pode ser executada no navegador.");
  }
};

export const printSessionDocument = async (kind: SessionDocumentKind, data: SessionDocumentData) => {
  ensureBrowserEnvironment();

  const { html } = buildSessionDocument(kind, data);
  const iframe = document.createElement("iframe");

  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";

  document.body.appendChild(iframe);

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);

  await new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      iframe.remove();
    };

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
      window.setTimeout(cleanup, 500);
    };

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow;

      if (!frameWindow) {
        finish(() => reject(new Error("Não foi possível preparar o documento para impressão.")));
        return;
      }

      const handleAfterPrint = () => finish(resolve);
      frameWindow.onafterprint = handleAfterPrint;

      window.setTimeout(() => {
        try {
          frameWindow.focus();
          frameWindow.print();
          window.setTimeout(() => finish(resolve), 1000);
        } catch (error) {
          finish(() => reject(error instanceof Error ? error : new Error("Falha ao abrir a impressão.")));
        }
      }, 150);
    };

    iframe.onerror = () => {
      finish(() => reject(new Error("Não foi possível carregar o documento para impressão.")));
    };

    iframe.src = url;
  });
};

export const downloadSessionDocumentPdf = async (kind: SessionDocumentKind, data: SessionDocumentData) => {
  const { jsPDF } = await import("jspdf");
  const model = buildSessionDocumentModel(kind, data);
  const pdf = new jsPDF({
    compress: true,
    format: "a4",
    unit: "pt",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 48;
  const usableWidth = pageWidth - margin * 2;
  const lineHeight = 20;
  let cursorY = margin;

  const ensureSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= pageHeight - margin) {
      return;
    }

    pdf.addPage();
    cursorY = margin;
  };

  const writeWrappedBlock = (text: string, fontSize: number, extraGap = 0) => {
    pdf.setFontSize(fontSize);
    const lines = pdf.splitTextToSize(text || "Nenhum conteúdo registrado.", usableWidth) as string[];
    ensureSpace(lines.length * lineHeight + extraGap);
    pdf.text(lines, margin, cursorY);
    cursorY += lines.length * lineHeight + extraGap;
  };

  pdf.setFont("times", "bold");
  writeWrappedBlock(model.title, 18, 8);
  pdf.setFont("times", "normal");
  pdf.setTextColor(75, 85, 99);
  writeWrappedBlock(model.subtitle, 11, 10);
  pdf.setTextColor(17, 24, 39);

  model.sections.forEach((section) => {
    ensureSpace(48);
    pdf.setFont("times", "bold");
    writeWrappedBlock(section.title, 14, 4);
    pdf.setFont("times", "normal");
    writeWrappedBlock(section.content || "Nenhum conteúdo registrado.", 11, 14);
  });

  pdf.save(model.filename);
  return model.filename;
};
