export type SessionDocumentKind = "anamnesis" | "treatment" | "combined";

export interface SessionDocumentIndicator {
  label: string;
  max: number;
  min: number;
  score: number;
}

export interface SessionDocumentTreatmentBlock {
  duration: string;
  frequency: string;
  id: string;
  instructions: string;
  name: string;
  repetitions: string;
  series: string;
}

export interface SessionDocumentData {
  anamnesisIndicators: SessionDocumentIndicator[];
  anamnesisSummary: string;
  appName: string;
  clinic: {
    address: string;
    businessHours: string;
    cnpj: string | null;
    email: string | null;
    legalName: string | null;
    logoUrl: string | null;
    name: string;
    phone: string | null;
  };
  generatedAt: string;
  patientName: string;
  provider: {
    email: string | null;
    fullName: string;
    jobTitle: string | null;
    phone: string | null;
    professionalLicense: string | null;
    specialty: string | null;
  };
  quickNotes: string;
  sessionDate: string;
  treatmentDetails?: {
    blocks: SessionDocumentTreatmentBlock[];
    generalGuidance: string;
  };
  treatmentSummary: string;
}

export interface SessionDocumentFact {
  label: string;
  value: string;
}

export interface SessionDocumentSection {
  content: string;
  indicators: SessionDocumentIndicator[];
  kind: "anamnesis" | "notes" | "treatment";
  title: string;
  treatmentDetails?: {
    blocks: SessionDocumentTreatmentBlock[];
    generalGuidance: string;
  };
}

export interface SessionDocumentModel {
  brandLogoUrl: string | null;
  brandSubtitle: string;
  brandTitle: string;
  clinicFacts: SessionDocumentFact[];
  filename: string;
  footerItems: SessionDocumentFact[];
  generatedAt: string;
  patientLabel: string;
  providerFacts: SessionDocumentFact[];
  sections: SessionDocumentSection[];
  subtitle: string;
  title: string;
}

const FIGTREE_FONT_HREF = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap";

const SESSION_DOCUMENT_STYLES = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px;
    color: #0f172a;
    background: linear-gradient(180deg, #f8fafc 0%, #ffffff 16%);
    font-family: "Figtree", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  main {
    max-width: 880px;
    margin: 0 auto;
  }
  header {
    border: 1px solid #dbe4f0;
    border-radius: 24px;
    padding: 24px 28px;
    background: #ffffff;
    box-shadow: 0 18px 45px rgba(15, 23, 42, 0.06);
    text-align: center;
  }
  h1 {
    margin: 0;
    font-size: 30px;
    line-height: 1.15;
    font-weight: 800;
  }
  .subtitle {
    margin-top: 8px;
    color: #475569;
    font-size: 14px;
  }
  .brand-caption {
    margin-top: 6px;
    color: #64748b;
    font-size: 12px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .brand-logo {
    max-height: 64px;
    max-width: 180px;
    margin: 0 auto 14px;
    display: block;
    object-fit: contain;
  }
  .intro-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin-top: 18px;
  }
  .intro-card,
  .patient-card,
  .document-section {
    border: 1px solid #dbe4f0;
    border-radius: 20px;
    background: #ffffff;
  }
  .intro-card {
    padding: 18px 20px;
  }
  .intro-title,
  .patient-label,
  .fact-label,
  .treatment-meta-label {
    margin: 0;
    font-size: 11px;
    color: #64748b;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-weight: 700;
  }
  .fact-item + .fact-item {
    margin-top: 10px;
  }
  .facts-grid {
    display: grid;
    gap: 10px 18px;
  }
  .facts-grid--clinic {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .fact-value {
    margin-top: 4px;
    font-size: 14px;
    line-height: 1.5;
    color: #0f172a;
  }
  .facts-grid--clinic .fact-label {
    font-size: 10px;
  }
  .facts-grid--clinic .fact-value {
    font-size: 12px;
    line-height: 1.4;
  }
  .patient-card {
    margin-top: 18px;
    padding: 18px 20px;
  }
  .patient-name {
    margin-top: 8px;
    font-size: 28px;
    font-weight: 800;
    line-height: 1.15;
  }
  .document-section {
    margin-top: 22px;
    padding: 22px 24px;
  }
  .document-section--treatment {
    break-before: page;
    page-break-before: always;
  }
  .section-title {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 800;
  }
  .section-content {
    white-space: pre-wrap;
    line-height: 1.75;
    font-size: 14px;
  }
  .indicator-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
  }
  .indicator-card {
    border: 1px solid #dbe4f0;
    border-radius: 16px;
    padding: 10px 12px;
    min-width: 170px;
    background: #f8fafc;
  }
  .indicator-label {
    font-size: 12px;
    color: #475569;
    font-weight: 600;
  }
  .indicator-bars {
    display: flex;
    align-items: center;
    gap: 2px;
    margin-top: 8px;
  }
  .indicator-bar {
    width: 8px;
    height: 16px;
    border-radius: 4px;
    background: #e2e8f0;
  }
  .indicator-bar--success { background: #10b981; }
  .indicator-bar--warning { background: #f59e0b; }
  .indicator-bar--destructive { background: #f43f5e; }
  .indicator-score {
    margin-left: 8px;
    font-size: 12px;
    font-weight: 700;
    color: #475569;
  }
  .treatment-blocks {
    display: grid;
    gap: 14px;
  }
  .treatment-card {
    border: 1px solid #dbe4f0;
    border-radius: 18px;
    padding: 16px 18px;
    background: #f8fafc;
  }
  .treatment-title {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
  }
  .treatment-grid {
    display: grid;
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .treatment-meta-value {
    margin-top: 4px;
    font-size: 14px;
    line-height: 1.55;
    color: #0f172a;
  }
  .treatment-guidance {
    margin-top: 14px;
    border-top: 1px solid #dbe4f0;
    padding-top: 14px;
  }
  .footer {
    margin-top: 22px;
    border-top: 1px solid #dbe4f0;
    padding-top: 18px;
    display: grid;
    gap: 10px;
  }
  @media print {
    body {
      padding: 20px;
      background: #ffffff;
    }
    .document-section--treatment {
      break-before: page;
      page-break-before: always;
    }
  }
`;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

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

const isPresent = (value: string | null | undefined): value is string => Boolean(value?.trim());
const normalizeSectionContent = (value: string) => value.trim();

const buildTreatmentCardText = (block: SessionDocumentTreatmentBlock) =>
  [
    `Tratamento: ${block.name.trim() || "Não informado"}`,
    `De quanto em quanto tempo: ${block.frequency.trim() || "Não informado"}`,
    `Por quanto tempo: ${block.duration.trim() || "Não informado"}`,
    `Séries: ${block.series.trim() || "Não informado"}`,
    `Repetições: ${block.repetitions.trim() || "Não informado"}`,
    `Instruções adicionais: ${block.instructions.trim() || "Não informado"}`,
  ].join("\n");

const buildTreatmentSectionText = (
  details: SessionDocumentData["treatmentDetails"],
  fallbackSummary: string
) => {
  if (!details || details.blocks.length === 0) {
    return normalizeSectionContent(fallbackSummary);
  }

  const blocksText = details.blocks
    .map((block, index) => `${index + 1})\n${buildTreatmentCardText(block)}`)
    .join("\n\n");

  return [
    blocksText,
    details.generalGuidance.trim() ? `Orientações gerais e observações: ${details.generalGuidance.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
};

const renderHtmlFacts = (items: SessionDocumentFact[], variant: "default" | "clinic" = "default") =>
  `<div class="facts-grid ${variant === "clinic" ? "facts-grid--clinic" : ""}">
  ${items
    .map((item) => `
      <div class="fact-item">
        <div class="fact-label">${escapeHtml(item.label)}</div>
        <div class="fact-value">${escapeHtml(item.value)}</div>
      </div>
    `)
    .join("")}
  </div>`;

const getIndicatorToneClass = (indicator: SessionDocumentIndicator) => {
  if (indicator.score <= 3) {
    return "indicator-bar--success";
  }

  if (indicator.score <= 6) {
    return "indicator-bar--warning";
  }

  return "indicator-bar--destructive";
};

const renderIndicatorChips = (indicators: SessionDocumentIndicator[]) => {
  if (indicators.length === 0) {
    return "";
  }

  return `
    <div class="indicator-grid">
      ${indicators
        .map((indicator) => {
          const totalBars = Math.max(indicator.max - indicator.min, 1);
          const filledBars = Math.max(Math.min(indicator.score - indicator.min, totalBars), 0);
          const toneClass = getIndicatorToneClass(indicator);

          return `
            <div class="indicator-card">
              <div class="indicator-label">${escapeHtml(indicator.label)}</div>
              <div class="indicator-bars">
                ${Array.from({ length: totalBars })
                  .map(
                    (_, index) =>
                      `<span class="indicator-bar ${index < filledBars ? toneClass : ""}"></span>`
                  )
                  .join("")}
                <span class="indicator-score">${indicator.score}/${indicator.max}</span>
              </div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
};

const renderTreatmentBlocksHtml = (details?: SessionDocumentData["treatmentDetails"]) => {
  if (!details || details.blocks.length === 0) {
    return "";
  }

  return `
    <div class="treatment-blocks">
      ${details.blocks
        .map(
          (block, index) => `
            <article class="treatment-card">
              <h3 class="treatment-title">${index + 1})</h3>
              <div class="treatment-grid">
                <div>
                  <div class="treatment-meta-label">Tratamento</div>
                  <div class="treatment-meta-value">${escapeHtml(block.name.trim() || "Não informado")}</div>
                </div>
                <div>
                  <div class="treatment-meta-label">De quanto em quanto tempo</div>
                  <div class="treatment-meta-value">${escapeHtml(block.frequency.trim() || "Não informado")}</div>
                </div>
                <div>
                  <div class="treatment-meta-label">Por quanto tempo</div>
                  <div class="treatment-meta-value">${escapeHtml(block.duration.trim() || "Não informado")}</div>
                </div>
                <div>
                  <div class="treatment-meta-label">Séries</div>
                  <div class="treatment-meta-value">${escapeHtml(block.series.trim() || "Não informado")}</div>
                </div>
                <div>
                  <div class="treatment-meta-label">Repetições</div>
                  <div class="treatment-meta-value">${escapeHtml(block.repetitions.trim() || "Não informado")}</div>
                </div>
                <div>
                  <div class="treatment-meta-label">Instruções adicionais</div>
                  <div class="treatment-meta-value">${escapeHtml(block.instructions.trim() || "Não informado")}</div>
                </div>
              </div>
            </article>
          `
        )
        .join("")}
      ${
        details.generalGuidance.trim()
          ? `
            <div class="treatment-guidance">
              <div class="treatment-meta-label">Orientações gerais e observações</div>
              <div class="treatment-meta-value">${escapeHtml(details.generalGuidance.trim())}</div>
            </div>
          `
          : ""
      }
    </div>
  `;
};

const renderTextSection = (section: SessionDocumentSection) =>
  [
    section.title,
    ...(section.indicators.length > 0
      ? section.indicators.map((indicator) => `${indicator.label}: ${indicator.score}/${indicator.max}`)
      : []),
    section.content || "Nenhum conteúdo registrado.",
  ].join("\n");

const renderHtmlSection = (section: SessionDocumentSection) => `
  <section class="document-section ${section.kind === "treatment" ? "document-section--treatment" : ""}">
    <h2 class="section-title">${escapeHtml(section.title)}</h2>
    ${section.kind === "anamnesis" ? renderIndicatorChips(section.indicators) : ""}
    ${
      section.kind === "treatment" && section.treatmentDetails
        ? `${renderTreatmentBlocksHtml(section.treatmentDetails)}`
        : `<div class="section-content">${escapeHtml(section.content || "Nenhum conteúdo registrado.")}</div>`
    }
  </section>
`;

const buildClinicFacts = (data: SessionDocumentData) =>
  [
    { label: "Clínica", value: data.clinic.name },
    isPresent(data.clinic.legalName) ? { label: "Razão social", value: data.clinic.legalName } : null,
    isPresent(data.clinic.cnpj) ? { label: "CNPJ", value: data.clinic.cnpj } : null,
    isPresent(data.clinic.phone) ? { label: "Telefone", value: data.clinic.phone } : null,
    isPresent(data.clinic.email) ? { label: "E-mail", value: data.clinic.email } : null,
  ].filter((item): item is SessionDocumentFact => Boolean(item));

const buildProviderFacts = (data: SessionDocumentData) =>
  [
    { label: "Profissional", value: data.provider.fullName },
    isPresent(data.provider.specialty) ? { label: "Especialidade", value: data.provider.specialty } : null,
    isPresent(data.provider.jobTitle) ? { label: "Cargo", value: data.provider.jobTitle } : null,
    isPresent(data.provider.professionalLicense) ? { label: "Conselho / registro", value: data.provider.professionalLicense } : null,
    isPresent(data.provider.phone) ? { label: "Telefone", value: data.provider.phone } : null,
    isPresent(data.provider.email) ? { label: "E-mail", value: data.provider.email } : null,
  ].filter((item): item is SessionDocumentFact => Boolean(item));

const buildFooterItems = (data: SessionDocumentData) =>
  [
    { label: "Emitido em", value: data.generatedAt },
    isPresent(data.clinic.address) ? { label: "Endereço", value: data.clinic.address } : null,
    isPresent(data.clinic.businessHours) ? { label: "Horário de funcionamento", value: data.clinic.businessHours } : null,
  ].filter((item): item is SessionDocumentFact => Boolean(item));

const getDocumentSections = (kind: SessionDocumentKind, data: SessionDocumentData) => {
  const sections: SessionDocumentSection[] = [];

  if (kind === "anamnesis" || kind === "combined") {
    sections.push({
      content: normalizeSectionContent(data.anamnesisSummary),
      indicators: data.anamnesisIndicators,
      kind: "anamnesis",
      title: "Anamnese",
    });
  }

  if (kind === "treatment" || kind === "combined") {
    sections.push({
      content: buildTreatmentSectionText(data.treatmentDetails, data.treatmentSummary),
      indicators: [],
      kind: "treatment",
      title: "Tratamento",
      treatmentDetails: data.treatmentDetails,
    });
  }

  if (data.quickNotes.trim()) {
    sections.push({
      content: normalizeSectionContent(data.quickNotes),
      indicators: [],
      kind: "notes",
      title: "Observações rápidas",
    });
  }

  return sections;
};

export const isSessionImmutable = (isNew: boolean, status: string) => !isNew && status !== "rascunho";

export const buildSessionDocumentFileName = (kind: SessionDocumentKind, data: SessionDocumentData) =>
  `${kindLabels[kind]}-${sanitizeFilenameSegment(data.patientName)}-${sanitizeFilenameSegment(data.sessionDate)}.pdf`;

export const buildSessionDocumentModel = (kind: SessionDocumentKind, data: SessionDocumentData): SessionDocumentModel => ({
  brandLogoUrl: data.clinic.logoUrl,
  brandSubtitle: data.appName,
  brandTitle: data.clinic.name.trim() || data.appName,
  clinicFacts: buildClinicFacts(data),
  filename: buildSessionDocumentFileName(kind, data),
  footerItems: buildFooterItems(data),
  generatedAt: data.generatedAt,
  patientLabel: data.patientName,
  providerFacts: buildProviderFacts(data),
  sections: getDocumentSections(kind, data),
  subtitle: `Atendimento em ${data.sessionDate}`,
  title: `Atendimento - ${data.patientName} - ${data.sessionDate}`,
});

export const renderSessionDocumentText = (model: SessionDocumentModel) =>
  [
    model.brandTitle,
    model.brandSubtitle,
    model.subtitle,
    "",
    `Paciente\n${model.patientLabel}`,
    "",
    "Clínica",
    ...model.clinicFacts.map((item) => `${item.label}: ${item.value}`),
    "",
    "Profissional responsável",
    ...model.providerFacts.map((item) => `${item.label}: ${item.value}`),
    "",
    ...model.sections.flatMap((section, index) => [
      renderTextSection(section),
      ...(index < model.sections.length - 1 ? [""] : []),
    ]),
    "",
    ...model.footerItems.map((item) => `${item.label}: ${item.value}`),
  ].join("\n");

const renderSessionDocumentMarkup = (model: SessionDocumentModel) => `
  <main>
    <header>
      ${model.brandLogoUrl ? `<img class="brand-logo" src="${escapeHtml(model.brandLogoUrl)}" alt="${escapeHtml(model.brandTitle)}" />` : ""}
      <h1>${escapeHtml(model.brandTitle)}</h1>
      <p class="brand-caption">${escapeHtml(model.brandSubtitle)}</p>
      <p class="subtitle">${escapeHtml(model.subtitle)}</p>
    </header>
    <section class="intro-grid">
      <article class="intro-card">
        <p class="intro-title">Clínica</p>
        ${renderHtmlFacts(model.clinicFacts, "clinic")}
      </article>
      <article class="intro-card">
        <p class="intro-title">Profissional responsável</p>
        ${renderHtmlFacts(model.providerFacts)}
      </article>
    </section>
    <section class="patient-card">
      <div class="patient-label">Paciente</div>
      <div class="patient-name">${escapeHtml(model.patientLabel)}</div>
    </section>
    ${model.sections.map((section) => renderHtmlSection(section)).join("")}
    <footer class="footer">
      ${renderHtmlFacts(model.footerItems)}
    </footer>
  </main>
`;

export const renderSessionDocumentHtml = (model: SessionDocumentModel) => `
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(model.title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="${FIGTREE_FONT_HREF}" rel="stylesheet">
    <style>${SESSION_DOCUMENT_STYLES}</style>
  </head>
  <body>
    ${renderSessionDocumentMarkup(model)}
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

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
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

      frameWindow.onafterprint = () => finish(resolve);

      window.setTimeout(() => {
        try {
          frameWindow.focus();
          frameWindow.print();
          window.setTimeout(() => finish(resolve), 1000);
        } catch (error) {
          finish(() => reject(error instanceof Error ? error : new Error("Falha ao abrir a impressão.")));
        }
      }, 180);
    };

    iframe.onerror = () => {
      finish(() => reject(new Error("Não foi possível carregar o documento para impressão.")));
    };

    iframe.src = url;
  });
};
