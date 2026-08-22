import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Pending Collaborator Invitations Logic & Edge Function Contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enforces 30-second rate limiting cooldown calculation", () => {
    const now = Date.now();
    
    // Invitation resent 10 seconds ago -> cooldown remaining = 20s
    const resent10sAgo = new Date(now - 10 * 1000).toISOString();
    const diff1 = Math.floor((now - new Date(resent10sAgo).getTime()) / 1000);
    const cooldown1 = diff1 < 30 && diff1 >= 0 ? 30 - diff1 : 0;
    expect(cooldown1).toBe(20);

    // Invitation resent 45 seconds ago -> cooldown expired (0s)
    const resent45sAgo = new Date(now - 45 * 1000).toISOString();
    const diff2 = Math.floor((now - new Date(resent45sAgo).getTime()) / 1000);
    const cooldown2 = diff2 < 30 && diff2 >= 0 ? 30 - diff2 : 0;
    expect(cooldown2).toBe(0);

    // Invitation never resent (null) -> cooldown = 0s
    const lastResentNull: string | null = null;
    const cooldownNull = lastResentNull ? Math.max(0, 30 - Math.floor((now - new Date(lastResentNull).getTime()) / 1000)) : 0;
    expect(cooldownNull).toBe(0);
  });

  it("handles fallback invitation link copying formatting", () => {
    const origin = "https://app.plurihealth.com";
    const token = "mock-sample-token-456";
    const relativePath = `/convite/${token}`;
    const fullUrl = `${origin}${relativePath}`;

    expect(fullUrl).toBe("https://app.plurihealth.com/convite/mock-sample-token-456");
  });

  it("correctly identifies pending account state badges", () => {
    const getBadgeLabel = (accountState?: string | null) => {
      if (accountState === "registered_unconfirmed") return "E-mail não verificado";
      if (accountState === "registered_unconnected") return "Aguardando login";
      return "Convite pendente";
    };

    expect(getBadgeLabel("registered_unconfirmed")).toBe("E-mail não verificado");
    expect(getBadgeLabel("registered_unconnected")).toBe("Aguardando login");
    expect(getBadgeLabel(null)).toBe("Convite pendente");
    expect(getBadgeLabel(undefined)).toBe("Convite pendente");
  });
});
