import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../..");
const hardeningMigration = fs.readFileSync(
  path.join(repoRoot, "supabase/migrations/20260528143000_harden_function_execute_privileges.sql"),
  "utf8"
);
const anamnesisSchemaMigration = fs.readFileSync(
  path.join(repoRoot, "supabase/migrations/20260528170000_harden_anamnesis_schema_constraints.sql"),
  "utf8"
);

describe("database security migrations", () => {
  it("revokes default function execution before granting explicit roles", () => {
    expect(hardeningMigration).toContain("revoke execute on all functions in schema public from public;");
    expect(hardeningMigration).toContain("alter default privileges in schema public revoke execute on functions from public;");
  });

  it("keeps anonymous execution limited to public patient registration RPCs", () => {
    const anonGrants = hardeningMigration
      .split("\n")
      .filter((line) => line.includes(" to anon") || line.includes(" to anon,"));

    expect(anonGrants).toEqual([
      "grant execute on function public.get_patient_registration_form(text, text) to anon, authenticated;",
      "grant execute on function public.submit_patient_registration_form(text, text, jsonb) to anon, authenticated;",
    ]);
  });

  it("keeps overdue agenda finalization restricted to the service role", () => {
    expect(hardeningMigration).toContain(
      "grant execute on function public.finalize_overdue_agenda_events(integer, text) to service_role;"
    );
    expect(hardeningMigration).not.toContain(
      "grant execute on function public.finalize_overdue_agenda_events(integer, text) to authenticated;"
    );
  });

  it("caps anamnesis template schemas at the database boundary", () => {
    expect(anamnesisSchemaMigration).toContain("jsonb_typeof(schema) = 'array'");
    expect(anamnesisSchemaMigration).toContain("jsonb_array_length(schema) <= 200");
    expect(anamnesisSchemaMigration).toContain("jsonb_typeof(anamnesis_base_schema) = 'array'");
    expect(anamnesisSchemaMigration).toContain("jsonb_array_length(anamnesis_base_schema) <= 200");
  });
});
