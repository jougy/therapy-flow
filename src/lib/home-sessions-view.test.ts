import { describe, expect, it } from "vitest";
import { filterAndSortHomeSessions } from "@/lib/home-sessions-view";
import type { HomePatientRecord, HomeSessionRecord, HomePatientGroupRecord } from "@/lib/home-patients-view";

describe("filterAndSortHomeSessions", () => {
  const patient1: HomePatientRecord = {
    cpf: "123.456.789-00",
    date_of_birth: "1990-01-01",
    gender: "masculino",
    id: "p-1",
    name: "Carlos Silva",
    phone: "11999999999",
    pronoun: "ele/dele",
    status: "ativo",
    updated_at: "2026-08-01T10:00:00Z",
  };

  const patient2: HomePatientRecord = {
    cpf: "987.654.321-99",
    date_of_birth: "1995-05-15",
    gender: "feminino",
    id: "p-2",
    name: "Ana Souza",
    phone: "11888888888",
    pronoun: "ela/dela",
    status: "pausado",
    updated_at: "2026-08-02T10:00:00Z",
  };

  const session1: HomeSessionRecord = {
    amount_charged_cents: 15000,
    amount_paid_cents: 15000,
    group_id: "g-1",
    id: "s-1",
    patient_id: "p-1",
    payment_method: "pix",
    payment_status: "pago",
    provider_id: "u-1",
    session_date: "2026-08-10T14:00:00Z",
    status: "concluído",
  };

  const session2: HomeSessionRecord = {
    amount_charged_cents: 20000,
    amount_paid_cents: 0,
    group_id: null,
    id: "s-2",
    patient_id: "p-2",
    payment_method: "cartao_credito",
    payment_status: "pendente",
    provider_id: "u-2",
    session_date: "2026-08-15T16:00:00Z",
    status: "rascunho",
  };

  const patientById = new Map<string, HomePatientRecord>([
    ["p-1", patient1],
    ["p-2", patient2],
  ]);

  const group1: HomePatientGroupRecord = {
    color: "#0ea5e9",
    id: "g-1",
    name: "Ortopedia",
    patient_id: "p-1",
    status: "ativo",
  };

  const groupById = new Map<string, HomePatientGroupRecord>([
    ["g-1", group1],
  ]);

  const patientGroupsByPatientId = new Map<string, HomePatientGroupRecord[]>([
    ["p-1", [group1]],
  ]);

  it("filters sessions by patient name search", () => {
    const results = filterAndSortHomeSessions({
      sessions: [session1, session2],
      patientById,
      groupById,
      patientGroupsByPatientId,
      filters: { searchTerm: "Carlos" },
      sortKey: "session_date_desc",
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("s-1");
  });

  it("filters sessions by payment status", () => {
    const results = filterAndSortHomeSessions({
      sessions: [session1, session2],
      patientById,
      groupById,
      patientGroupsByPatientId,
      filters: { selectedPaymentStatuses: ["pending"] },
      sortKey: "session_date_desc",
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("s-2");
  });

  it("sorts sessions by date ascending and descending", () => {
    const resultsAsc = filterAndSortHomeSessions({
      sessions: [session1, session2],
      patientById,
      groupById,
      patientGroupsByPatientId,
      filters: {},
      sortKey: "session_date_asc",
    });
    expect(resultsAsc[0].id).toBe("s-1");
    expect(resultsAsc[1].id).toBe("s-2");

    const resultsDesc = filterAndSortHomeSessions({
      sessions: [session1, session2],
      patientById,
      groupById,
      patientGroupsByPatientId,
      filters: {},
      sortKey: "session_date_desc",
    });
    expect(resultsDesc[0].id).toBe("s-2");
    expect(resultsDesc[1].id).toBe("s-1");
  });
});
