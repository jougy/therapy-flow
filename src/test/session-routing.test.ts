import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseSessionRef,
  formatSessionDisplayCode,
  getSessionRouteKey,
  getPatientSessionPath,
  getClinicPatientSessionPath,
  resolveSessionReference,
  fetchSessionByRef,
} from "@/lib/patient-routing";
import { supabase } from "@/integrations/supabase/client";

describe("session-routing utilities", () => {
  describe("parseSessionRef", () => {
    it("handles 'novo' keyword variations", () => {
      expect(parseSessionRef("novo")).toEqual({
        raw: "novo",
        isNew: true,
        isUuid: false,
        sessionIndex: null,
        isValid: true,
      });
      expect(parseSessionRef("Novo")).toEqual({
        raw: "Novo",
        isNew: true,
        isUuid: false,
        sessionIndex: null,
        isValid: true,
      });
      expect(parseSessionRef("NOVO ")).toEqual({
        raw: "NOVO",
        isNew: true,
        isUuid: false,
        sessionIndex: null,
        isValid: true,
      });
    });

    it("identifies valid UUIDs", () => {
      const uuid = "8e68b809-4750-4082-ba53-1fb39ddc1e0f";
      expect(parseSessionRef(uuid)).toEqual({
        raw: uuid,
        isNew: false,
        isUuid: true,
        sessionIndex: null,
        isValid: true,
      });
    });

    it("parses friendly sequential codes (ATD-1, ATD-#1, ATD-001, 1, etc.)", () => {
      expect(parseSessionRef("ATD-1")).toEqual({
        raw: "ATD-1",
        isNew: false,
        isUuid: false,
        sessionIndex: 1,
        isValid: true,
      });
      expect(parseSessionRef("atd-2")).toEqual({
        raw: "atd-2",
        isNew: false,
        isUuid: false,
        sessionIndex: 2,
        isValid: true,
      });
      expect(parseSessionRef("ATD-#3")).toEqual({
        raw: "ATD-#3",
        isNew: false,
        isUuid: false,
        sessionIndex: 3,
        isValid: true,
      });
      expect(parseSessionRef("ATD-004")).toEqual({
        raw: "ATD-004",
        isNew: false,
        isUuid: false,
        sessionIndex: 4,
        isValid: true,
      });
      expect(parseSessionRef("ATD5")).toEqual({
        raw: "ATD5",
        isNew: false,
        isUuid: false,
        sessionIndex: 5,
        isValid: true,
      });
      expect(parseSessionRef("ATD_6")).toEqual({
        raw: "ATD_6",
        isNew: false,
        isUuid: false,
        sessionIndex: 6,
        isValid: true,
      });
      expect(parseSessionRef("ATD 7")).toEqual({
        raw: "ATD 7",
        isNew: false,
        isUuid: false,
        sessionIndex: 7,
        isValid: true,
      });
      expect(parseSessionRef("1")).toEqual({
        raw: "1",
        isNew: false,
        isUuid: false,
        sessionIndex: 1,
        isValid: true,
      });
      expect(parseSessionRef("#8")).toEqual({
        raw: "#8",
        isNew: false,
        isUuid: false,
        sessionIndex: 8,
        isValid: true,
      });
      expect(parseSessionRef("042")).toEqual({
        raw: "042",
        isNew: false,
        isUuid: false,
        sessionIndex: 42,
        isValid: true,
      });
    });

    it("invalidates malformed or non-session references", () => {
      expect(parseSessionRef("")).toEqual({
        raw: "",
        isNew: false,
        isUuid: false,
        sessionIndex: null,
        isValid: false,
      });
      expect(parseSessionRef(null)).toEqual({
        raw: "",
        isNew: false,
        isUuid: false,
        sessionIndex: null,
        isValid: false,
      });
      expect(parseSessionRef("invalid-session")).toEqual({
        raw: "invalid-session",
        isNew: false,
        isUuid: false,
        sessionIndex: null,
        isValid: false,
      });
      expect(parseSessionRef("ATD-0")).toEqual({
        raw: "ATD-0",
        isNew: false,
        isUuid: false,
        sessionIndex: null,
        isValid: false,
      });
    });
  });

  describe("formatSessionDisplayCode", () => {
    it("formats numbers and references consistently", () => {
      expect(formatSessionDisplayCode(1)).toBe("ATD-1");
      expect(formatSessionDisplayCode(42)).toBe("ATD-42");
      expect(formatSessionDisplayCode("ATD-001")).toBe("ATD-1");
      expect(formatSessionDisplayCode("ATD-#5")).toBe("ATD-5");
      expect(formatSessionDisplayCode("novo")).toBe("novo");
      expect(formatSessionDisplayCode("custom-label")).toBe("custom-label");
    });
  });

  describe("getSessionRouteKey", () => {
    it("produces clean route keys", () => {
      expect(getSessionRouteKey(1)).toBe("ATD-1");
      expect(getSessionRouteKey("ATD-003")).toBe("ATD-3");
      expect(getSessionRouteKey("novo")).toBe("novo");
      expect(getSessionRouteKey("8e68b809-4750-4082-ba53-1fb39ddc1e0f")).toBe("8e68b809-4750-4082-ba53-1fb39ddc1e0f");
      expect(getSessionRouteKey({ id: "uuid-1", session_index: 2 })).toBe("ATD-2");
      expect(getSessionRouteKey({ id: "uuid-1" })).toBe("uuid-1");
    });
  });

  describe("getPatientSessionPath & getClinicPatientSessionPath", () => {
    it("constructs relative patient session paths", () => {
      expect(getPatientSessionPath("PAC-001", 1)).toBe("/pacientes/PAC-001/sessao/ATD-1");
      expect(getPatientSessionPath("PAC-001", "novo")).toBe("/pacientes/PAC-001/sessao/novo");
      expect(getPatientSessionPath("PAC-001", "ATD-002", "editar")).toBe("/pacientes/PAC-001/sessao/ATD-2/editar");
      expect(getPatientSessionPath({ id: "uuid-p1", patient_code: "PAC-010" }, 3)).toBe("/pacientes/PAC-010/sessao/ATD-3");
    });

    it("constructs clinic-scoped patient session paths", () => {
      expect(getClinicPatientSessionPath("saude-total", "PAC-001", 1)).toBe("/clinica/saude-total/pacientes/PAC-001/sessao/ATD-1");
      expect(getClinicPatientSessionPath("saude-total", "PAC-001", "novo")).toBe("/clinica/saude-total/pacientes/PAC-001/sessao/novo");
      expect(getClinicPatientSessionPath(null, "PAC-001", "ATD-1")).toBe("/pacientes/PAC-001/sessao/ATD-1");
    });
  });

  describe("resolveSessionReference / fetchSessionByRef", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("handles 'novo' mode and returns estimated next sessionIndex", async () => {
      const mockPatient = { id: "p-uuid-1", name: "Paciente Teste", patient_code: "PAC-001", clinic_id: "c-1" };

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
                }),
                single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
              }),
            }),
          } as any;
        }
        if (table === "sessions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 2 }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await resolveSessionReference("novo", "PAC-001", "c-1");
      expect(res.isNew).toBe(true);
      expect(res.patient).toEqual(mockPatient);
      expect(res.sessionIndex).toBe(3); // 2 existing + 1
      expect(res.totalSessions).toBe(2);
      expect(res.error).toBeNull();
    });

    it("resolves sequential code ATD-1 to the first chronological session", async () => {
      const mockPatient = { id: "p-uuid-1", name: "Paciente Teste", patient_code: "PAC-001", clinic_id: "c-1" };
      const mockSessions = [
        { id: "s-1", patient_id: "p-uuid-1", session_date: "2026-01-01", created_at: "2026-01-01T10:00:00Z" },
        { id: "s-2", patient_id: "p-uuid-1", session_date: "2026-01-10", created_at: "2026-01-10T10:00:00Z" },
      ];

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
                }),
                single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
              }),
            }),
          } as any;
        }
        if (table === "sessions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
                  }),
                }),
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const res1 = await fetchSessionByRef("ATD-1", "PAC-001", "c-1");
      expect(res1.data?.id).toBe("s-1");
      expect(res1.sessionIndex).toBe(1);
      expect(res1.totalSessions).toBe(2);
      expect(res1.error).toBeNull();

      const res2 = await fetchSessionByRef("ATD-2", "PAC-001", "c-1");
      expect(res2.data?.id).toBe("s-2");
      expect(res2.sessionIndex).toBe(2);
      expect(res2.totalSessions).toBe(2);
      expect(res2.error).toBeNull();
    });

    it("returns error when sequential index is out of bounds", async () => {
      const mockPatient = { id: "p-uuid-1", name: "Paciente Teste", patient_code: "PAC-001", clinic_id: "c-1" };
      const mockSessions = [
        { id: "s-1", patient_id: "p-uuid-1", session_date: "2026-01-01", created_at: "2026-01-01T10:00:00Z" },
      ];

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
                }),
                single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
              }),
            }),
          } as any;
        }
        if (table === "sessions") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
                  }),
                }),
                order: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: mockSessions, error: null }),
                }),
              }),
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await fetchSessionByRef("ATD-5", "PAC-001", "c-1");
      expect(res.data).toBeNull();
      expect(res.sessionIndex).toBe(5);
      expect(res.error?.message).toContain("não foi encontrado");
    });

    it("resolves direct UUID and calculates its sessionIndex", async () => {
      const sessionUuid = "8e68b809-4750-4082-ba53-1fb39ddc1e0f";
      const mockPatient = { id: "p-uuid-1", name: "Paciente Teste", patient_code: "PAC-001", clinic_id: "c-1" };
      const targetSession = { id: sessionUuid, patient_id: "p-uuid-1", clinic_id: "c-1", session_date: "2026-02-01" };
      const mockSessionsList = [
        { id: "other-session", session_date: "2026-01-01", created_at: "2026-01-01T10:00:00Z" },
        { id: sessionUuid, session_date: "2026-02-01", created_at: "2026-02-01T10:00:00Z" },
      ];

      vi.spyOn(supabase, "from").mockImplementation((table: string) => {
        if (table === "patients") {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
                }),
                single: vi.fn().mockResolvedValue({ data: mockPatient, error: null }),
              }),
            }),
          } as any;
        }
        if (table === "sessions") {
          return {
            select: vi.fn().mockImplementation((cols: string) => {
              if (cols === "*") {
                return {
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                      eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: targetSession, error: null }),
                      }),
                      maybeSingle: vi.fn().mockResolvedValue({ data: targetSession, error: null }),
                    }),
                    maybeSingle: vi.fn().mockResolvedValue({ data: targetSession, error: null }),
                  }),
                };
              }
              return {
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    order: vi.fn().mockReturnValue({
                      order: vi.fn().mockResolvedValue({ data: mockSessionsList, error: null }),
                    }),
                  }),
                  order: vi.fn().mockReturnValue({
                    order: vi.fn().mockResolvedValue({ data: mockSessionsList, error: null }),
                  }),
                }),
              };
            }),
          } as any;
        }
        return {} as any;
      });

      const res = await fetchSessionByRef(sessionUuid, "PAC-001", "c-1");
      expect(res.data?.id).toBe(sessionUuid);
      expect(res.sessionIndex).toBe(2); // Second session in chronological order
      expect(res.totalSessions).toBe(2);
      expect(res.error).toBeNull();
    });
  });
});
