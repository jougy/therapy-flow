import { describe, it, expect } from "vitest";
import { formatByteSize, normalizeWebpFilename, sanitizeSvgContent } from "./image-processing";

describe("image-processing utils", () => {
  it("formats byte size correctly", () => {
    expect(formatByteSize(0)).toBe("0 B");
    expect(formatByteSize(500)).toBe("500 B");
    expect(formatByteSize(1024)).toBe("1.0 KB");
    expect(formatByteSize(1024 * 50)).toBe("50 KB");
    expect(formatByteSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
  });

  it("normalizes filenames to webp extension", () => {
    expect(normalizeWebpFilename("logo.png")).toBe("logo.webp");
    expect(normalizeWebpFilename("my clinic logo.jpg")).toBe("my_clinic_logo.webp");
    expect(normalizeWebpFilename("foto@clinica!.svg")).toBe("foto_clinica_.webp");
  });

  it("sanitizes malicious SVG elements and scripts", () => {
    const maliciousSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" onload="alert('xss')">
        <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
        <script>alert('pwned');</script>
        <script type="text/javascript">window.location='http://evil.com';</script>
        <a href="javascript:alert(1)"><text>Click</text></a>
        <foreignObject width="100" height="100">
          <body xmlns="http://www.w3.org/1999/xhtml">
            <script>document.cookie</script>
          </body>
        </foreignObject>
      </svg>
    `;

    const cleaned = sanitizeSvgContent(maliciousSvg);

    expect(cleaned).not.toContain("<script");
    expect(cleaned).not.toContain("alert(");
    expect(cleaned).not.toContain("onload=");
    expect(cleaned).not.toContain("javascript:");
    expect(cleaned).not.toContain("<foreignObject");
    expect(cleaned).toContain("<circle cx=\"50\"");
  });
});

