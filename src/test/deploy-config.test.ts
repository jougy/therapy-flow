import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

describe("deploy config", () => {
  it("uses Workers static assets config for Cloudflare builds", () => {
    const wranglerToml = fs.readFileSync(path.join(repoRoot, "wrangler.toml"), "utf8");

    expect(wranglerToml).toContain("name = \"pronto-health-fisio\"");
    expect(wranglerToml).toContain("[assets]");
    expect(wranglerToml).toContain("directory = \"./dist\"");
    expect(wranglerToml).toContain("not_found_handling = \"single-page-application\"");
    expect(wranglerToml).not.toContain("pages_build_output_dir");
  });

  it("does not ship a catch-all _redirects file when Workers handles SPA fallback", () => {
    expect(fs.existsSync(path.join(repoRoot, "public/_redirects"))).toBe(false);
  });

  it("ships baseline browser security headers for static deploys", () => {
    const headersFile = fs.readFileSync(path.join(repoRoot, "public/_headers"), "utf8");
    const vercelJson = fs.readFileSync(path.join(repoRoot, "vercel.json"), "utf8");

    for (const expectedHeader of [
      "Content-Security-Policy",
      "frame-ancestors 'none'",
      "Referrer-Policy",
      "Permissions-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ]) {
      expect(headersFile).toContain(expectedHeader);
      expect(vercelJson).toContain(expectedHeader);
    }
  });

  it("marks the app shell as not translatable by browser translators", () => {
    const indexHtml = fs.readFileSync(path.join(repoRoot, "index.html"), "utf8");

    expect(indexHtml).toContain('<html lang="pt-BR" translate="no" class="notranslate">');
    expect(indexHtml).toContain('<meta name="google" content="notranslate" />');
    expect(indexHtml).toContain('<div id="root" translate="no" class="notranslate"></div>');
  });
});
