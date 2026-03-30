import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");
const controlScript = path.join(repoRoot, "control.sh");

function runControl(args: string[], env?: NodeJS.ProcessEnv) {
  return spawnSync("sh", [controlScript, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env,
  });
}

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
    const result = runControl(["--run", "missing-action"], process.env);
    const errorMessage = `${result.stderr ?? ""}\n${result.stdout ?? ""}\n${result.error?.message ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(errorMessage).toContain("Acao desconhecida");
  });

  it("fails clearly when online Supabase deploy lacks required credentials", () => {
    const result = runControl(["--run", "supabase-online-deploy"], {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
    });
    const errorMessage = `${result.stderr ?? ""}\n${result.stdout ?? ""}\n${result.error?.message ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(errorMessage).toContain("SUPABASE_ACCESS_TOKEN");
    expect(errorMessage).toContain("senha do banco");
  });

  it("still validates credentials when HOME has no usable profile", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "therapy-flow-home-"));
    let result;

    try {
      result = runControl(["--run", "supabase-online-deploy"], {
        PATH: process.env.PATH ?? "",
        HOME: tempHome,
      });
    } finally {
      fs.rmSync(tempHome, { recursive: true, force: true });
    }
    const errorMessage = `${result?.stderr ?? ""}\n${result?.stdout ?? ""}\n${result?.error?.message ?? ""}`;

    expect(result?.status).not.toBe(0);
    expect(errorMessage).toContain("SUPABASE_ACCESS_TOKEN");
    expect(errorMessage).toContain("senha do banco");
    expect(errorMessage).not.toContain("parameter not set");
    expect(errorMessage).not.toContain(".profile");
  });

  it("fails clearly when Cloudflare Pages deploy lacks required credentials", () => {
    const result = runControl(["--run", "cloudflare-pages-deploy"], {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
    });
    const errorMessage = `${result.stderr ?? ""}\n${result.stdout ?? ""}\n${result.error?.message ?? ""}`;

    expect(result.status).not.toBe(0);
    expect(errorMessage).toContain("CLOUDFLARE_API_TOKEN");
    expect(errorMessage).toContain("CLOUDFLARE_ACCOUNT_ID");
  });
});
