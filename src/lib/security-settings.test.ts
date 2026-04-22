import { beforeEach, describe, expect, it } from "vitest";
import { clearSecuritySessionKey, createSecuritySessionKey } from "@/lib/security-settings";

describe("security session key lifecycle", () => {
  beforeEach(() => {
    clearSecuritySessionKey();
  });

  it("reuses the same security session key within the same tab", async () => {
    const firstKey = await createSecuritySessionKey();
    const secondKey = await createSecuritySessionKey();

    expect(secondKey).toBe(firstKey);
  });

  it("generates a new security session key after clearing the tab session", async () => {
    const firstKey = await createSecuritySessionKey();
    clearSecuritySessionKey();
    const secondKey = await createSecuritySessionKey();

    expect(secondKey).not.toBe(firstKey);
  });
});
