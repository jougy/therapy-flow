import { describe, it, expect } from "vitest";
import {
  PATIENT_QUERY_KEYS,
  PATIENT_DETAIL_CACHE_KEY,
  PATIENT_SESSIONS_CACHE_KEY,
  PATIENT_SESSIONS_SYNC_KEY,
  PATIENT_GROUPS_CACHE_KEY,
  PATIENT_AGENDA_CACHE_KEY,
  PATIENT_TEMPLATES_CACHE_KEY,
  PATIENT_SUGGESTIONS_CACHE_KEY,
  PATIENT_BASE_SCHEMA_CACHE_KEY,
  type SessionRow,
} from "./usePatientDataQueries";

describe("usePatientDataQueries", () => {
  describe("cache key generators", () => {
    it("generates correct IndexedDB keys for patient detail", () => {
      expect(PATIENT_DETAIL_CACHE_KEY("clinic-1", "pac-123")).toBe("patient_detail_clinic-1_pac-123");
      expect(PATIENT_DETAIL_CACHE_KEY(null, "pac-123")).toBe("patient_detail_global_pac-123");
    });

    it("generates correct IndexedDB keys for patient sessions and sync", () => {
      expect(PATIENT_SESSIONS_CACHE_KEY("p-1")).toBe("patient_sessions_p-1");
      expect(PATIENT_SESSIONS_SYNC_KEY("p-1")).toBe("patient_sessions_sync_p-1");
    });

    it("generates correct keys for groups, agenda, and clinic templates", () => {
      expect(PATIENT_GROUPS_CACHE_KEY("p-1")).toBe("patient_groups_p-1");
      expect(PATIENT_AGENDA_CACHE_KEY("p-1")).toBe("patient_agenda_p-1");
      expect(PATIENT_TEMPLATES_CACHE_KEY("c-1")).toBe("clinic_anamnesis_templates_c-1");
      expect(PATIENT_SUGGESTIONS_CACHE_KEY("c-1")).toBe("clinic_group_suggestions_c-1");
      expect(PATIENT_BASE_SCHEMA_CACHE_KEY("c-1")).toBe("clinic_base_schema_c-1");
    });
  });

  describe("query keys", () => {
    it("builds correct hierarchical query keys", () => {
      expect(PATIENT_QUERY_KEYS.patient("p-1", "c-1")).toEqual(["patient", "p-1", "clinic", "c-1"]);
      expect(PATIENT_QUERY_KEYS.sessions("p-1")).toEqual(["patient-sessions", "p-1"]);
      expect(PATIENT_QUERY_KEYS.groups("p-1")).toEqual(["patient-groups", "p-1"]);
      expect(PATIENT_QUERY_KEYS.agendaEvents("p-1")).toEqual(["patient-agenda", "p-1"]);
      expect(PATIENT_QUERY_KEYS.groupSuggestions("c-1")).toEqual(["patient-group-suggestions", "c-1"]);
      expect(PATIENT_QUERY_KEYS.anamnesisTemplates("c-1")).toEqual(["patient-anamnesis-templates", "c-1"]);
      expect(PATIENT_QUERY_KEYS.clinicBaseSchema("c-1")).toEqual(["patient-clinic-base-schema", "c-1"]);
    });
  });

  describe("delta sync merge logic simulation", () => {
    it("merges delta updates into cached session list correctly", () => {
      const cached: SessionRow[] = [
        {
          id: "s-1",
          patient_id: "p-1",
          clinic_id: "c-1",
          group_id: "g-1",
          session_date: "2026-08-01T10:00:00Z",
          status: "rascunho",
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-08-01T10:00:00Z",
          user_id: "u-1",
          amount_charged_cents: 15000,
          amount_paid_cents: 0,
          payment_status: "pendente",
          payment_method: null,
          provider_id: "u-1",
          notes: null,
          custom_data: null,
          scheduled_start_at: null,
          patient_arrived_at: null,
          payment_adjustment_cents: null,
          payment_adjustment_percent: null,
          payment_adjustment_reason: null,
        },
        {
          id: "s-2",
          patient_id: "p-1",
          clinic_id: "c-1",
          group_id: "g-1",
          session_date: "2026-07-20T10:00:00Z",
          status: "concluído",
          created_at: "2026-07-20T10:00:00Z",
          updated_at: "2026-07-20T10:00:00Z",
          user_id: "u-1",
          amount_charged_cents: 15000,
          amount_paid_cents: 15000,
          payment_status: "pago",
          payment_method: "pix",
          provider_id: "u-1",
          notes: null,
          custom_data: null,
          scheduled_start_at: null,
          patient_arrived_at: null,
          payment_adjustment_cents: null,
          payment_adjustment_percent: null,
          payment_adjustment_reason: null,
        },
      ];

      const delta: SessionRow[] = [
        {
          id: "s-1",
          patient_id: "p-1",
          clinic_id: "c-1",
          group_id: "g-1",
          session_date: "2026-08-01T10:00:00Z",
          status: "concluído",
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-08-10T12:00:00Z",
          user_id: "u-1",
          amount_charged_cents: 15000,
          amount_paid_cents: 15000,
          payment_status: "pago",
          payment_method: "pix",
          provider_id: "u-1",
          notes: "Atualizado",
          custom_data: null,
          scheduled_start_at: null,
          patient_arrived_at: null,
          payment_adjustment_cents: null,
          payment_adjustment_percent: null,
          payment_adjustment_reason: null,
        },
        {
          id: "s-3",
          patient_id: "p-1",
          clinic_id: "c-1",
          group_id: "g-2",
          session_date: "2026-08-15T14:00:00Z",
          status: "rascunho",
          created_at: "2026-08-15T14:00:00Z",
          updated_at: "2026-08-15T14:00:00Z",
          user_id: "u-1",
          amount_charged_cents: 15000,
          amount_paid_cents: 0,
          payment_status: "pendente",
          payment_method: null,
          provider_id: "u-1",
          notes: null,
          custom_data: null,
          scheduled_start_at: null,
          patient_arrived_at: null,
          payment_adjustment_cents: null,
          payment_adjustment_percent: null,
          payment_adjustment_reason: null,
        },
      ];

      // Perform delta merge simulation
      const deltaMap = new Map(delta.map((s) => [s.id, s]));
      const merged = cached.map((s) => deltaMap.get(s.id) ?? s);
      delta.forEach((s) => {
        if (!cached.some((c) => c.id === s.id)) {
          merged.unshift(s);
        }
      });
      merged.sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

      expect(merged).toHaveLength(3);
      expect(merged[0].id).toBe("s-3"); // 2026-08-15 (newest)
      expect(merged[1].id).toBe("s-1"); // 2026-08-01
      expect(merged[1].status).toBe("concluído"); // Updated from delta
      expect(merged[2].id).toBe("s-2"); // 2026-07-20
    });
  });
});
