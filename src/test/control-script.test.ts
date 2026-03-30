import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");
const controlScript = path.join(repoRoot, "control.sh");

describe("control.sh", () => {
  it("lists available actions", () => {
    const output = execFileSync("sh", [controlScript, "--list"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("docker-start");
    expect(output).toContain("cloudflare-pages-deploy");
    expect(output).toContain("supabase-start");
    expect(output).toContain("supabase-online-deploy");
    expect(output).toContain("account-create");
    expect(output).toContain("start-all");
  });

  it("runs env-summary non-interactively", () => {
    const output = execFileSync("sh", [controlScript, "--run", "env-summary"], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("therapy-flow");
    expect(output).toContain(".env.local");
  });

  it("fails with a clear error for an unknown action", () => {
    let errorMessage = "";

    try {
      execFileSync("sh", [controlScript, "--run", "missing-action"], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      errorMessage = String((error as { stderr?: string }).stderr ?? error);
    }

    expect(errorMessage).toContain("Acao desconhecida");
  });

  it("fails clearly when online Supabase deploy lacks required credentials", () => {
    let errorMessage = "";

    try {
      execFileSync("sh", [controlScript, "--run", "supabase-online-deploy"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          HOME: process.env.HOME ?? "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      errorMessage = String((error as { stderr?: string }).stderr ?? error);
    }

    expect(errorMessage).toContain("SUPABASE_ACCESS_TOKEN");
    expect(errorMessage).toContain("senha do banco");
  });

  it("still validates credentials when HOME has no usable profile", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "therapy-flow-home-"));
    let errorMessage = "";

    try {
      execFileSync("sh", [controlScript, "--run", "supabase-online-deploy"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          HOME: tempHome,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      errorMessage = String((error as { stderr?: string }).stderr ?? error);
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }

    expect(errorMessage).toContain("SUPABASE_ACCESS_TOKEN");
    expect(errorMessage).toContain("senha do banco");
    expect(errorMessage).not.toContain("parameter not set");
    expect(errorMessage).not.toContain(".profile");
  });

  it("fails clearly when Cloudflare Pages deploy lacks required credentials", () => {
    let errorMessage = "";

    try {
      execFileSync("sh", [controlScript, "--run", "cloudflare-pages-deploy"], {
        cwd: repoRoot,
        encoding: "utf8",
        env: {
          PATH: process.env.PATH ?? "",
          HOME: process.env.HOME ?? "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      errorMessage = String((error as { stderr?: string }).stderr ?? error);
    }

    expect(errorMessage).toContain("CLOUDFLARE_API_TOKEN");
    expect(errorMessage).toContain("CLOUDFLARE_ACCOUNT_ID");
  });
});
