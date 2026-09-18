import { describe, expect, it } from "vitest";
import {
  sanitizeMarkdownImages,
  convertDocxXmlToMarkdown,
  compressGzip,
  scanAndCompressTermDocument,
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
  });
});
