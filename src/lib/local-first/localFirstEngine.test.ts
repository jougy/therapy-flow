import { describe, it, expect, vi, beforeEach } from "vitest";
import { coalesceInFlight, clearInFlightCoalescer } from "./inFlightCoalescer";
import { deltaMergeById } from "./deltaMerge";
import { getSyncStatusSnapshot, setSyncStatus } from "./syncStatusStore";
import {
  clearLocalCache,
  deleteLocalCacheItem,
  getSyncMemoryCacheItem,
  setLocalCacheItem,
} from "@/lib/indexed-db-persister";
import { resolveSessionReference, type PatientRow, type SessionRow } from "@/lib/patient-routing";
import { supabase } from "@/integrations/supabase/client";

describe("local-first engine (Etapa 1A)", () => {
  beforeEach(async () => {
    clearInFlightCoalescer();
    await clearLocalCache();
    vi.restoreAllMocks();
  });

  describe("coalesceInFlight", () => {
    it("deduplicates concurrent calls with the same key", async () => {
      let executions = 0;
      const factory = () =>
        new Promise<string>((resolve) => {
          executions++;
          setTimeout(() => resolve("ok"), 15);
        });

      const [a, b, c] = await Promise.all([
        coalesceInFlight("same-key", factory),
        coalesceInFlight("same-key", factory),
        coalesceInFlight("same-key", factory),
      ]);

      expect(executions).toBe(1);
      expect(a).toBe("ok");
      expect(b).toBe("ok");
      expect(c).toBe("ok");

      const next = await coalesceInFlight("same-key", factory);
      expect(next).toBe("ok");
      expect(executions).toBe(2);
    });
  });

  describe("deltaMergeById", () => {
    it("merges records in O(N+M), prefers newer updated_at, and removes soft-deleted records", () => {
      const existing = [
        { id: "1", updated_at: "2026-01-02T00:00:00Z", deleted_at: null, label: "v2" },
        { id: "2", updated_at: "2026-01-01T00:00:00Z", deleted_at: null, label: "keep" },
        { id: "3", updated_at: "2026-01-01T00:00:00Z", deleted_at: null, label: "to-delete" },
      ];
      const delta = [
        { id: "1", updated_at: "2026-01-01T00:00:00Z", deleted_at: null, label: "stale-v1" },
        { id: "3", updated_at: "2026-01-03T00:00:00Z", deleted_at: "2026-01-03T00:00:00Z", label: "deleted" },
        { id: "4", updated_at: "2026-01-04T00:00:00Z", deleted_at: null, label: "new" },
      ];

      const merged = deltaMergeById(existing, delta, (a, b) => a.id.localeCompare(b.id));
      expect(merged).toHaveLength(3);
      expect(merged.map((m) => m.id)).toEqual(["1", "2", "4"]);
      expect(merged[0].label).toBe("v2");
    });
  });

  describe("indexed-db-persister L1 LRU memory mirror", () => {
    it("serves synchronous L1 cache hits and enforces 250-entry LRU cap", async () => {
      for (let i = 0; i < 255; i++) {
        await setLocalCacheItem(`k-${i}`, { val: i });
      }

      // Oldest 5 entries should have been evicted
      expect(getSyncMemoryCacheItem("k-0")).toBeNull();
      expect(getSyncMemoryCacheItem("k-4")).toBeNull();
      expect(getSyncMemoryCacheItem<{ val: number }>("k-254")).toEqual({ val: 254 });

      await deleteLocalCacheItem("k-254");
      expect(getSyncMemoryCacheItem("k-254")).toBeNull();
    });
  });

  describe("syncStatusStore", () => {
    it("updates snapshot fields cleanly", () => {
      setSyncStatus({ pendingCount: 3, isSyncing: true });
      const snap = getSyncStatusSnapshot();
      expect(snap.pendingCount).toBe(3);
      expect(snap.isSyncing).toBe(true);
      setSyncStatus({ pendingCount: 0, isSyncing: false });
    });
  });

  describe("resolveSessionReference with known cache options", () => {
    it("resolves ATD-1 and UUID from knownPatient + knownSessions without querying Supabase", async () => {
      const fromSpy = vi.spyOn(supabase, "from");

      const knownPatient = {
        id: "11111111-1111-4111-8111-111111111111",
        clinic_id: "22222222-2222-4222-8222-222222222222",
        patient_code: "PAC-001",
      } as unknown as PatientRow;

      const knownSessions = [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          patient_id: knownPatient.id,
          session_date: "2026-01-01T10:00:00Z",
          created_at: "2026-01-01T10:00:00Z",
          deleted_at: null,
        },
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          patient_id: knownPatient.id,
          session_date: "2026-01-05T10:00:00Z",
          created_at: "2026-01-05T10:00:00Z",
          deleted_at: null,
        },
      ] as unknown as SessionRow[];

      const byIndex = await resolveSessionReference("ATD-2", "PAC-001", knownPatient.clinic_id, null, {
        knownPatient,
        knownSessions,
      });
      expect(byIndex.data?.id).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
      expect(byIndex.sessionIndex).toBe(2);
      expect(byIndex.totalSessions).toBe(2);

      const byUuid = await resolveSessionReference(
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "PAC-001",
        knownPatient.clinic_id,
        null,
        { knownPatient, knownSessions }
      );
      expect(byUuid.data?.id).toBe("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
      expect(byUuid.sessionIndex).toBe(1);

      const byNew = await resolveSessionReference("novo", "PAC-001", knownPatient.clinic_id, null, {
        knownPatient,
        knownSessions,
      });
      expect(byNew.isNew).toBe(true);
      expect(byNew.sessionIndex).toBe(3);

      expect(fromSpy).not.toHaveBeenCalled();
    });
  });
});
