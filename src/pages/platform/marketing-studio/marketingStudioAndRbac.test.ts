import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { hasCapability } from "@/lib/rbac";
import { PlatformMarketingStudioView } from "./PlatformMarketingStudioView";
import crypto from "node:crypto";

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

const invokeMock = vi.fn().mockResolvedValue({
  data: { success: true, deduplicated: true, job: { worker_tier: "fast_node" } },
  error: null,
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

function signPayloadHmac(rawBody: string, secret: string, timestampSec?: number) {
  const ts = timestampSec ?? Math.floor(Date.now() / 1000);
  const signature = crypto.createHmac("sha256", secret).update(`${ts}.${rawBody}`).digest("hex");
  return { signature, timestamp: String(ts) };
}

function verifyPayloadHmac(
  rawBody: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  secret: string,
  toleranceSec = 300,
): boolean {
  if (!signatureHeader || !timestampHeader) return false;
  const ts = Number(timestampHeader);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${timestampHeader}.${rawBody}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}

describe("Marketing Studio, RBAC and HMAC Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Test 1: hasCapability for admin vs professional across 5 marketing capabilities", () => {
    const adminContext = {
      accountRole: "member" as const,
      isActive: true,
      membershipStatus: "active" as const,
      operationalRole: "admin" as const,
      subscriptionPlan: "clinic" as const,
    };
    const profContext = {
      accountRole: "member" as const,
      isActive: true,
      membershipStatus: "active" as const,
      operationalRole: "professional" as const,
      subscriptionPlan: "clinic" as const,
    };

    const caps = [
      "marketing.zap.view",
      "marketing.zap.manage",
      "marketing.studio.view",
      "marketing.studio.manage",
      "marketing.flows.manage",
    ] as const;

    for (const cap of caps) {
      expect(hasCapability(adminContext, cap)).toBe(true);
      expect(hasCapability(profContext, cap)).toBe(false);
    }
  });

  it("Test 2: HMAC signing and verification handles valid, tampered, and expired payloads", () => {
    const secret = "test-secret-key-123";
    const body = JSON.stringify({ action: "render", title: "Test Reel" });

    const { signature, timestamp } = signPayloadHmac(body, secret);
    expect(verifyPayloadHmac(body, signature, timestamp, secret)).toBe(true);

    // Tampered body
    expect(verifyPayloadHmac(body + "tampered", signature, timestamp, secret)).toBe(false);

    // Expired timestamp (-400s)
    const expiredTs = Math.floor(Date.now() / 1000) - 400;
    const expiredSig = crypto.createHmac("sha256", secret).update(`${expiredTs}.${body}`).digest("hex");
    expect(verifyPayloadHmac(body, expiredSig, String(expiredTs), secret)).toBe(false);
  });

  it("Test 3: renders PlatformMarketingStudioView and triggers enqueue render action", async () => {
    render(React.createElement(PlatformMarketingStudioView));
    const btn = screen.getByTestId("studio-enqueue-render-btn");
    expect(btn).toBeInTheDocument();

    fireEvent.click(btn);

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
        "marketing-studio-api",
        expect.objectContaining({
          body: expect.objectContaining({ action: "enqueue_render_job" }),
        }),
      );
    });
  });
});
