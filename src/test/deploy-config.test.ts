import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");

describe("deploy config", () => {
  it("uses Workers static assets config for Cloudflare builds", () => {
    const wranglerToml = fs.readFileSync(path.join(repoRoot, "wrangler.toml"), "utf8");

    expect(wranglerToml).toContain("name = \"therapy-flow\"");
    expect(wranglerToml).toContain("[assets]");
    expect(wranglerToml).toContain("directory = \"./dist\"");
    expect(wranglerToml).not.toContain("pages_build_output_dir");
  });

  it("ships an SPA fallback redirect for BrowserRouter", () => {
    const redirects = fs.readFileSync(path.join(repoRoot, "public/_redirects"), "utf8");
    expect(redirects).toContain("/* /index.html 200");
  });
});
