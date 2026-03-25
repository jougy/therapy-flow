import { describe, expect, it, vi } from "vitest";
import { ensureTestLogin, isLocalSupabaseUrl, TEST_LOGIN } from "@/lib/test-login";

const buildClient = () => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  rpc: vi.fn(),
});

describe("ensureTestLogin", () => {
  it("detects whether the configured Supabase URL is local", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://pmnwwdmgxzawsxzpnigw.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl(undefined)).toBe(false);
  });

  it("reuses an existing test account when sign in succeeds", async () => {
    const client = buildClient();

    client.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    client.rpc.mockResolvedValueOnce({ data: true, error: null });

    const result = await ensureTestLogin(client, "http://localhost:8080");

    expect(result).toEqual({ created: false });
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: TEST_LOGIN.email,
      password: TEST_LOGIN.password,
    });
    expect(client.rpc).toHaveBeenCalledWith("validate_user_clinic", {
      _user_id: "user-1",
      _cnpj: TEST_LOGIN.cnpjDigits,
    });
    expect(client.auth.signUp).not.toHaveBeenCalled();
  });

  it("creates the account when the first sign in fails", async () => {
    const client = buildClient();

    client.auth.signInWithPassword
      .mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Invalid login credentials" },
      })
      .mockResolvedValueOnce({
        data: { user: { id: "user-2" } },
        error: null,
      });
    client.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-2" }, session: { access_token: "token" } },
      error: null,
    });
    client.rpc
      .mockResolvedValueOnce({ data: { clinic_id: "clinic-1" }, error: null })
      .mockResolvedValueOnce({ data: true, error: null });

    const result = await ensureTestLogin(client, "http://localhost:8080");

    expect(result).toEqual({ created: true });
    expect(client.auth.signUp).toHaveBeenCalledWith({
      email: TEST_LOGIN.email,
      password: TEST_LOGIN.password,
      options: { emailRedirectTo: "http://localhost:8080" },
    });
    expect(client.rpc).toHaveBeenNthCalledWith(1, "handle_signup", {
      _user_id: "user-2",
      _email: TEST_LOGIN.email,
      _cnpj: TEST_LOGIN.cnpjDigits,
    });
  });

  it("stops after signup when the project requires email confirmation", async () => {
    const client = buildClient();

    client.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Invalid login credentials" },
    });
    client.auth.signUp.mockResolvedValue({
      data: { user: { id: "user-3" }, session: null },
      error: null,
    });
    client.rpc.mockResolvedValueOnce({ data: { clinic_id: "clinic-2" }, error: null });

    const result = await ensureTestLogin(client, "http://localhost:8080");

    expect(result).toEqual({ created: true, requiresEmailConfirmation: true });
    expect(client.auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });
});
