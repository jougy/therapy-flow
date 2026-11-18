import { describe, expect, it, vi } from "vitest";
import {
  sanitizeMarkdownImages,
  convertDocxXmlToMarkdown,
  compressGzip,
  scanAndCompressTermDocument,
  structureTextToMarkdown,
  suggestTitleFromFilename,
} from "./termDocumentScanner";

describe("termDocumentScanner", () => {
  describe("sanitizeMarkdownImages", () => {
    it("removes markdown image syntax ![]() and keeps pure text", () => {
      const input = `# Termo de Consentimento
![Logo da Clínica](https://clinica.com/logo.png)
Este é o texto do termo de consentimento livre e esclarecido.
![Assinatura](data:image/png;base64,iVBORw0KGgoAAA)
Fim do documento.`;

      const result = sanitizeMarkdownImages(input);
      expect(result.removedImages).toBe(true);
      expect(result.cleanText).not.toContain("https://clinica.com/logo.png");
      expect(result.cleanText).not.toContain("Logo da Clínica");
      expect(result.cleanText).not.toContain("![Assinatura]");
      expect(result.cleanText).toContain("# Termo de Consentimento");
      expect(result.cleanText).toContain("Este é o texto do termo de consentimento livre e esclarecido.");
      expect(result.cleanText).toContain("Fim do documento.");
    });

    it("removes html <img> tags", () => {
      const input = `# Termo com HTML
<img src="banner.jpg" alt="Banner" width="200" />
<img src="/assets/icon.png">
Texto do parágrafo normal.`;

      const result = sanitizeMarkdownImages(input);
      expect(result.removedImages).toBe(true);
      expect(result.cleanText).not.toContain("<img");
      expect(result.cleanText).toContain("# Termo com HTML");
      expect(result.cleanText).toContain("Texto do parágrafo normal.");
    });

    it("leaves clean text without images untouched", () => {
      const input = `# Termo Sem Imagens
Texto explicativo com [link](https://exemplo.com) e formatação **negrito**.`;

      const result = sanitizeMarkdownImages(input);
      expect(result.removedImages).toBe(false);
      expect(result.cleanText).toBe(input);
    });
  });

  describe("convertDocxXmlToMarkdown", () => {
    it("extracts paragraphs, headings and strips <w:drawing> and <w:pict>", () => {
      const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>Termo de Consentimento Adulto</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Parágrafo de introdução do paciente.</w:t></w:r>
      <w:drawing><w:graphic><w:graphicData>DADOS_DE_IMAGEM_PESADA</w:graphicData></w:graphic></w:drawing>
    </w:p>
    <w:p>
      <w:r><w:pict><v:shape><v:imagedata src="image1.png"/></v:shape></w:pict></w:r>
      <w:r><w:t>Conformidade estrita com a LGPD e CFM.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;

      const markdown = convertDocxXmlToMarkdown(sampleXml);
      expect(markdown).toContain("# Termo de Consentimento Adulto");
      expect(markdown).toContain("Parágrafo de introdução do paciente.");
      expect(markdown).toContain("Conformidade estrita com a LGPD e CFM.");
      expect(markdown).not.toContain("DADOS_DE_IMAGEM_PESADA");
      expect(markdown).not.toContain("image1.png");
      expect(markdown).not.toContain("<w:drawing");
      expect(markdown).not.toContain("<w:pict");
    });
  });

  describe("compressGzip and scanAndCompressTermDocument", () => {
    it("compresses string and returns a valid blob", async () => {
      const text = "Este é um texto para teste de compressão em gzip nativo.".repeat(20);
      const blob = await compressGzip(text);
      expect(blob).toBeDefined();
      expect(blob.size).toBeGreaterThan(0);
    });

    it("scans and compresses a text or markdown file", async () => {
      const content = `# TCLE Teste
![Imagem](https://site.com/foto.jpg)
Normas da clínica e retenção por 20 anos.`;

      const file = new File([content], "termo-teste.md", { type: "text/markdown" });
      const scanned = await scanAndCompressTermDocument(file);

      expect(scanned.hasRemovedImages).toBe(true);
      expect(scanned.markdownText).not.toContain("foto.jpg");
      expect(scanned.markdownText).toContain("# TCLE Teste");
      expect(scanned.markdownText).toContain("Normas da clínica e retenção por 20 anos.");
      expect(scanned.originalSize).toBe(file.size);
      expect(scanned.compressedBlob).toBeDefined();
    });

    it("detects variables in scanned markdown document", async () => {
      const content = `# TCLE da Clínica <nome_clinica>
Eu, <nome_paciente>, portador do CPF <cpf_paciente>, aceito os termos em <data_atual>.`;

      const file = new File([content], "termo-variaveis.md", { type: "text/markdown" });
      const scanned = await scanAndCompressTermDocument(file);

      expect(scanned.detectedVariables).toEqual([
        "<nome_clinica>",
        "<nome_paciente>",
        "<cpf_paciente>",
        "<data_atual>",
      ]);
    });

    it("scans and extracts text from a PDF file", async () => {
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([500, 500]);
      page.drawText("Termo em PDF com variavel <nome_paciente>");
      const bytes = await pdfDoc.save();

      const file = new File([bytes], "documento.pdf", { type: "application/pdf" });
      const progressUpdates: string[] = [];
      const scanned = await scanAndCompressTermDocument(file, (msg) => {
        progressUpdates.push(msg);
      });

      expect(scanned.markdownText).toContain("Termo em PDF com variavel <nome_paciente>");
      expect(scanned.detectedVariables).toContain("<nome_paciente>");
      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates).toContain("Concluído!");
    });
  });

  describe("structureTextToMarkdown", () => {
    it("formats titles, clauses, lists and heals paragraph wraps", () => {
      const raw = `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO

CLÁUSULA PRIMEIRA - DO OBJETO
Este é o texto inicial que foi
quebrado no meio da frase para demonstrar
a junção automática de parágrafos.

1. Condições Gerais
As obrigações do paciente incluem:
• Pontualidade nas sessões agendadas
▪ Cancelamento prévio com 24 horas
* Trazer documento com foto
- Respeitar normas da clínica
a) Notificar via WhatsApp
i) Manter cadastro atualizado

Art. 14. O consentimento do menor será fornecido pelos pais.

Parágrafo Único: Em caso de urgência, o atendimento será mantido.

CLÁUSULA SEGUNDA - DA CONFIDENCIALIDADE
O psicólogo responsável, Dr(a). <nome_profissional>, guardará sigilo absoluto.`;

      const markdown = structureTextToMarkdown(raw);

      expect(markdown).toContain("# TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO");
      expect(markdown).toContain("## CLÁUSULA PRIMEIRA - DO OBJETO");
      expect(markdown).toContain(
        "Este é o texto inicial que foi quebrado no meio da frase para demonstrar a junção automática de parágrafos."
      );
      expect(markdown).toContain("## 1. Condições Gerais");
      expect(markdown).toContain("- Pontualidade nas sessões agendadas");
      expect(markdown).toContain("- Cancelamento prévio com 24 horas");
      expect(markdown).toContain("- Trazer documento com foto");
      expect(markdown).toContain("- Respeitar normas da clínica");
      expect(markdown).toContain("- a) Notificar via WhatsApp");
      expect(markdown).toContain("- i) Manter cadastro atualizado");
      expect(markdown).toContain("## Art. 14. O consentimento do menor será fornecido pelos pais.");
      expect(markdown).toContain("### Parágrafo Único: Em caso de urgência, o atendimento será mantido.");
      expect(markdown).toContain("## CLÁUSULA SEGUNDA - DA CONFIDENCIALIDADE");
      expect(markdown).toContain("<nome_profissional>");
    });

    it("handles de-hyphenation across line breaks", () => {
      const raw = `TERMO DE ATENDIMENTO
O paciente declara estar ciente de sua responsa-
bilidade no cumpri-
mento do plano.`;

      const markdown = structureTextToMarkdown(raw);
      expect(markdown).toContain("responsabilidade no cumprimento do plano.");
    });

    it("preserves already formatted markdown headings", () => {
      const raw = `# Título Existente
## Subtítulo Existente
- Item 1
- Item 2`;

      const markdown = structureTextToMarkdown(raw);
      expect(markdown).toContain("# Título Existente");
      expect(markdown).toContain("## Subtítulo Existente");
      expect(markdown).toContain("- Item 1");
      expect(markdown).toContain("- Item 2");
    });
  });

  describe("suggestTitleFromFilename", () => {
    it("suggests clean capitalized title from various filename conventions", () => {
      expect(suggestTitleFromFilename("termo-de-teleatendimento.pdf")).toBe(
        "Termo de Teleatendimento"
      );
      expect(suggestTitleFromFilename("contrato_de_honorarios_terapeuticos.docx")).toBe(
        "Contrato de Honorarios Terapeuticos"
      );
      expect(suggestTitleFromFilename("tcle-psicoterapia-adulto.pdf")).toBe(
        "TCLE Psicoterapia Adulto"
      );
      expect(suggestTitleFromFilename("termo.md")).toBe("Termo");
    });
  });
});
