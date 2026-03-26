import { describe, expect, it } from "vitest";
import { isLocalSupabaseUrl, LOCAL_TEST_LOGINS } from "@/lib/test-login";

describe("local test logins", () => {
  it("detects whether the configured Supabase URL is local", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://pmnwwdmgxzawsxzpnigw.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl(undefined)).toBe(false);
  });

  it("exposes both solo and clinic credentials for local development", () => {
    expect(LOCAL_TEST_LOGINS.solo.email).toBe("solo@therapyflow.local");
    expect(LOCAL_TEST_LOGINS.clinic.email).toBe("clinic.owner@therapyflow.local");
    expect(LOCAL_TEST_LOGINS.solo.password).toBe("123456");
    expect(LOCAL_TEST_LOGINS.clinic.password).toBe("123456");
  });
});
