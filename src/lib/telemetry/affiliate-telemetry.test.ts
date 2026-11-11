import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fetchAffiliateClicks,
  fetchAffiliateAxiomMetrics,
  getConsolidatedAffiliateTelemetry,
} from "./affiliate-telemetry";
import * as multicloud from "./multicloud-drivers";

describe("affiliate-telemetry", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("fetchAffiliateClicks returns 0 when config is missing", async () => {
    vi.spyOn(multicloud, "getObservabilityMulticloudConfig").mockReturnValue({
      metricsDriver: "upstash_redis",
      errorLogsDriver: "axiom",
      samplingRatePercent: 100,
    });

    const clicks = await fetchAffiliateClicks("dr-silva");
    expect(clicks).toBe(0);
  });

  it("fetchAffiliateClicks parses Upstash pipeline response successfully", async () => {
    vi.spyOn(multicloud, "getObservabilityMulticloudConfig").mockReturnValue({
      metricsDriver: "upstash_redis",
      errorLogsDriver: "axiom",
      samplingRatePercent: 100,
      upstashRestUrl: "https://mock-upstash.com",
      upstashRestToken: "mock-token",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [{ result: "142" }],
    } as Response);

    const clicks = await fetchAffiliateClicks("dr-silva");
    expect(clicks).toBe(142);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://mock-upstash.com/pipeline",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify([["HGET", "affiliate:clicks", "dr-silva"]]),
      })
    );
  });

  it("fetchAffiliateClicks falls back to 0 on fetch error", async () => {
    vi.spyOn(multicloud, "getObservabilityMulticloudConfig").mockReturnValue({
      metricsDriver: "upstash_redis",
      errorLogsDriver: "axiom",
      samplingRatePercent: 100,
      upstashRestUrl: "https://mock-upstash.com",
      upstashRestToken: "mock-token",
    });

    global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout"));

    const clicks = await fetchAffiliateClicks("dr-silva");
    expect(clicks).toBe(0);
  });

  it("fetchAffiliateAxiomMetrics aggregates events from APL tabular response", async () => {
    vi.spyOn(multicloud, "getObservabilityMulticloudConfig").mockReturnValue({
      metricsDriver: "upstash_redis",
      errorLogsDriver: "axiom",
      samplingRatePercent: 100,
      axiomDataset: "pluri-events",
      axiomToken: "axiom-token",
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        tables: [
          {
            fields: [{ name: "event_type" }, { name: "_time" }],
            columns: [
              ["trial_started", "trial_started", "subscription_paid", "churn"],
              ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"],
            ],
          },
        ],
      }),
    } as Response);

    const metrics = await fetchAffiliateAxiomMetrics("dr-silva");
    expect(metrics.trialLeads).toBe(2);
    expect(metrics.activeSubscribers).toBe(1);
    expect(metrics.churn).toBe(1);
  });

  it("getConsolidatedAffiliateTelemetry computes rates and defaults gracefully", async () => {
    vi.spyOn(multicloud, "getObservabilityMulticloudConfig").mockReturnValue({
      metricsDriver: "upstash_redis",
      errorLogsDriver: "axiom",
      samplingRatePercent: 100,
    });

    const data = await getConsolidatedAffiliateTelemetry("carlos30", {
      initialClicks: 100,
      initialTrials: 20,
      initialActives: 10,
      initialChurn: 2,
      lifetimeCommissionCents: 45000,
      availableBalanceCents: 30000,
      retainedBalanceCents: 15000,
    });

    expect(data.slug).toBe("carlos30");
    expect(data.clicksCount).toBe(100);
    expect(data.trialLeadsCount).toBe(20);
    expect(data.activeSubscribersCount).toBe(10);
    expect(data.churnCount).toBe(2);
    expect(data.conversionRatePercent).toBe(10); // 10/100 * 100
    expect(data.churnRatePercent).toBe(16.7); // 2/(10+2) = 16.666% -> 16.7%
    expect(data.lifetimeCommissionCents).toBe(45000);
    expect(data.availableBalanceCents).toBe(30000);
    expect(data.retainedBalanceCents).toBe(15000);
    expect(data.overdueGraceDaysRemaining).toBe(40);
  });
});
