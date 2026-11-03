import { describe, it, expect } from "vitest";
import {
  escapeXml,
  convertMarkdownToDocxParagraphs,
  buildDocxBlob,
  createZipArchive,
  computeCrc32,
  downloadAllTermsZip,
  downloadSingleTermDoc,
  ExportableTermDoc,
} from "./termsExport";

describe("termsExport utility", () => {
  it("escapes XML special characters correctly", () => {
    const raw = `LGPD & CFM <teste> "aspas" e 'simples'`;
    const escaped = escapeXml(raw);
    expect(escaped).toBe("LGPD &amp; CFM &lt;teste&gt; &quot;aspas&quot; e &apos;simples&apos;");
  });

  it("converts markdown headings and list items to docx XML", () => {
    const md = `
# Título 1
## Subtítulo 2
### Seção 3
- Item de lista com **negrito** e *itálico*
Texto normal com \`código\`.
`;
    const xml = convertMarkdownToDocxParagraphs(md);
    expect(xml).toContain("<w:pStyle w:val=\"Heading1\"/>");
    expect(xml).toContain("Título 1");
    expect(xml).toContain("<w:pStyle w:val=\"Heading2\"/>");
    expect(xml).toContain("Subtítulo 2");
    expect(xml).toContain("<w:b/>");
    expect(xml).toContain("negrito");
    expect(xml).toContain("<w:i/>");
    expect(xml).toContain("itálico");
    expect(xml).toContain("Consolas");
  });

  it("calculates CRC32 correctly", () => {
    const encoder = new TextEncoder();
    const data = encoder.encode("hello world");
    const crc = computeCrc32(data);
    expect(crc.toString(16)).toBe("d4a1185");
  });

  it("generates a valid DOCX blob", () => {
    const md = "# Termo de Consentimento\n\nEste é o texto do termo.";
    const blob = buildDocxBlob(md);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(blob.size).toBeGreaterThan(500);
  });

  it("generates a valid ZIP archive buffer", () => {
    const encoder = new TextEncoder();
    const files = [
      { name: "termo1.md", data: encoder.encode("# Termo 1") },
      { name: "termo2.txt", data: encoder.encode("Texto 2") },
    ];
    const zipBytes = createZipArchive(files);
    expect(zipBytes.length).toBeGreaterThan(0);
    // Assinatura PK\x03\x04
    expect(zipBytes[0]).toBe(0x50);
    expect(zipBytes[1]).toBe(0x4b);
    expect(zipBytes[2]).toBe(0x03);
    expect(zipBytes[3]).toBe(0x04);
  });
});
