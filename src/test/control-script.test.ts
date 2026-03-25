import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
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
    expect(output).toContain("supabase-start");
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
});
