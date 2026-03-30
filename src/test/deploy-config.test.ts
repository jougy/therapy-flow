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
    expect(wranglerToml).toContain("not_found_handling = \"single-page-application\"");
    expect(wranglerToml).not.toContain("pages_build_output_dir");
  });

  it("does not ship a catch-all _redirects file when Workers handles SPA fallback", () => {
    expect(fs.existsSync(path.join(repoRoot, "public/_redirects"))).toBe(false);
  });
});
