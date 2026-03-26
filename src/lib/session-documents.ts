export type SessionDocumentKind = "anamnesis" | "treatment" | "combined";

export interface SessionDocumentData {
  anamnesisSummary: string;
  patientName: string;
  quickNotes: string;
  sessionDate: string;
  treatmentSummary: string;
}

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const renderTextSection = (title: string, content: string) => `${title}\n${content || "Nenhum conteúdo registrado."}`;

const renderHtmlSection = (title: string, content: string) => `
  <section style="margin-top: 24px;">
    <h2 style="font-size: 18px; margin: 0 0 12px;">${escapeHtml(title)}</h2>
    <div style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(content || "Nenhum conteúdo registrado.")}</div>
  </section>
`;

const getDocumentSections = (kind: SessionDocumentKind, data: SessionDocumentData) => {
  const sections: Array<{ title: string; content: string }> = [];

  if (kind === "anamnesis" || kind === "combined") {
    sections.push({ title: "Anamnese", content: data.anamnesisSummary });
  }

  if (kind === "treatment" || kind === "combined") {
    sections.push({ title: "Tratamento", content: data.treatmentSummary });
  }

  if (data.quickNotes.trim()) {
    sections.push({ title: "Observações rápidas", content: data.quickNotes });
  }

  return sections;
};

export const isSessionImmutable = (isNew: boolean, status: string) => !isNew && status !== "rascunho";

export const buildSessionDocument = (kind: SessionDocumentKind, data: SessionDocumentData) => {
  const sections = getDocumentSections(kind, data);
  const title = `Atendimento - ${data.patientName} - ${data.sessionDate}`;
  const text = [
    title,
    "",
    ...sections.flatMap((section, index) => [
      renderTextSection(section.title, section.content),
      ...(index < sections.length - 1 ? [""] : []),
    ]),
  ].join("\n");

  const html = `
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
      </head>
      <body style="font-family: Georgia, serif; color: #111827; margin: 40px;">
        <header style="border-bottom: 1px solid #d1d5db; padding-bottom: 16px;">
          <h1 style="font-size: 24px; margin: 0;">${escapeHtml(data.patientName)}</h1>
          <p style="margin: 8px 0 0; color: #4b5563;">Atendimento em ${escapeHtml(data.sessionDate)}</p>
        </header>
        ${sections.map((section) => renderHtmlSection(section.title, section.content)).join("")}
      </body>
    </html>
  `;

  return {
    html,
    text,
    title,
  };
};
