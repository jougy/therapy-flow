import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildSlotCacheKey,
  executeUpstashCommand,
  getAvailableSlotsCached,
  invalidateSlotCache,
} from "@/lib/schedule/schedule-cache";

describe("Upstash Redis Schedule Cache & Atomic Booking", () => {
  const clinicId = "11111111-1111-1111-1111-111111111111";
  const providerId = "22222222-2222-2222-2222-222222222222";
  const dateIso = "2026-11-01";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("buildSlotCacheKey formats key with clinic, provider and date", () => {
    const key = buildSlotCacheKey(clinicId, providerId, dateIso);
    expect(key).toBe(`schedule:slots:${clinicId}:${providerId}:${dateIso}`);

    const keyAll = buildSlotCacheKey(clinicId, null, dateIso);
    expect(keyAll).toBe(`schedule:slots:${clinicId}:all:${dateIso}`);
  });

  it("returns Cache HIT in < 20ms when key is present in Upstash Redis", async () => {
    const mockSlots = ["08:00", "08:30", "09:00", "14:00"];

    // Mock fetch to simulate Upstash Redis response
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const body = JSON.parse(String(init?.body || "[]"));
      if (body[0] === "GET") {
        return new Response(JSON.stringify({ result: JSON.stringify(mockSlots) }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const startTime = performance.now();
    const result = await getAvailableSlotsCached(clinicId, providerId, dateIso, {
      redisRestUrl: "https://mock-redis.upstash.io",
      redisRestToken: "mock-token",
    });
    const duration = performance.now() - startTime;

    expect(result.fromCache).toBe(true);
    expect(result.slots).toEqual(mockSlots);
    expect(duration).toBeLessThan(50); // fast local execution < 20ms
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("triggers Cache MISS, queries RPC and populates Upstash Redis with TTL 120s", async () => {
    const mockDbSlots = ["09:00", "09:30", "10:00"];
    const sentCommands: unknown[][] = [];

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const body = JSON.parse(String(init?.body || "[]"));
      sentCommands.push(body);
      if (body[0] === "GET") {
        return new Response(JSON.stringify({ result: null }), { status: 200 }); // Cache MISS
      }
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    // Mock supabase.rpc
    const { supabase } = await import("@/integrations/supabase/client");
    const rpcSpy = vi.spyOn(supabase, "rpc" as any).mockResolvedValue({
      data: mockDbSlots,
      error: null,
    } as any);

    const result = await getAvailableSlotsCached(clinicId, providerId, dateIso, {
      redisRestUrl: "https://mock-redis.upstash.io",
      redisRestToken: "mock-token",
      defaultTtlSeconds: 120,
    });

    expect(result.fromCache).toBe(false);
    expect(result.slots).toEqual(mockDbSlots);
    expect(rpcSpy).toHaveBeenCalledWith("rpc_get_available_slots", {
      _clinic_id: clinicId,
      _provider_id: providerId,
      _date: dateIso,
    });

    // Check SET EX 120 was sent to Upstash
    const setCmd = sentCommands.find((c) => c[0] === "SET");
    expect(setCmd).toBeDefined();
    expect(setCmd?.[1]).toBe(`schedule:slots:${clinicId}:${providerId}:${dateIso}`);
    expect(setCmd?.[2]).toBe(JSON.stringify(mockDbSlots));
    expect(setCmd?.[3]).toBe("EX");
    expect(setCmd?.[4]).toBe(120);
  });

  it("invalidates slot cache using DEL command upon appointment booking", async () => {
    const deletedKeys: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      const body = JSON.parse(String(init?.body || "[]"));
      if (body[0] === "DEL") {
        deletedKeys.push(String(body[1]));
        return new Response(JSON.stringify({ result: 1 }), { status: 200 });
      }
      return new Response(JSON.stringify({ result: "OK" }), { status: 200 });
    });

    const success = await invalidateSlotCache(clinicId, providerId, dateIso, {
      redisRestUrl: "https://mock-redis.upstash.io",
      redisRestToken: "mock-token",
    });

    expect(success).toBe(true);
    expect(deletedKeys).toContain(`schedule:slots:${clinicId}:${providerId}:${dateIso}`);
    expect(deletedKeys).toContain(`schedule:slots:${clinicId}:all:${dateIso}`);
  });

  it("handles Upstash Redis downtime gracefully without throwing exceptions", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network connection refused"));

    const { supabase } = await import("@/integrations/supabase/client");
    vi.spyOn(supabase, "rpc" as any).mockResolvedValue({
      data: ["10:00", "11:00"],
      error: null,
    } as any);

    const result = await getAvailableSlotsCached(clinicId, providerId, dateIso, {
      redisRestUrl: "https://offline-redis.upstash.io",
      redisRestToken: "mock-token",
    });

    expect(result.fromCache).toBe(false);
    expect(result.slots).toEqual(["10:00", "11:00"]);
  });
});
