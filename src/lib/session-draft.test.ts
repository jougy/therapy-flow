import { describe, it, expect, beforeEach } from "vitest";
import {
  getSessionDraft,
  saveSessionDraft,
  clearSessionDraft,
  getSessionDraftStorageKey,
} from "./session-draft";
import type { SessionFormValues } from "@/components/sessions";

function createStorageMock() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

const localStorageMock = createStorageMock();
Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("session-draft (Local/Client First)", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  const mockValues: SessionFormValues = {
    amountCharged: "150,00",
    amountOriginal: "150,00",
    amountPaid: "150,00",
    anamnesisFormResponse: { symptom: "dor" },
    anamnesisTemplateId: "tmpl-1",
    careLineIds: ["group-1"],
    complexityScore: [3],
    groupId: "group-1",
    notes: "Anotações do rascunho",
    observacoes: "Paciente relatou melhora",
    painScore: [4],
    patientArrivedAt: "2026-08-25T14:00",
    paymentAdjustmentReason: "",
    paymentInstallments: 1,
    paymentMethod: "pix",
    paymentStatus: "pago",
    paymentStatusDate: "2026-08-25",
    queixa: "Dor lombar",
    scheduledStartAt: "2026-08-25T14:00",
    sessionDate: "2026-08-25T14:00",
    sintomas: "Lombalgia aguda",
    status: "rascunho",
    treatmentBlocks: [],
    treatmentGeneralGuidance: "Alongamentos diários",
  };

  it("generates predictable storage keys", () => {
    const key = getSessionDraftStorageKey("cli-1", "pat-1", "sess-1");
    expect(key).toBe("therapy-flow:session-draft:v1:cli-1:pat-1:sess-1");
  });

  it("saves and retrieves a draft correctly", () => {
    saveSessionDraft("cli-1", "pat-1", "sess-1", mockValues);

    const draft = getSessionDraft("cli-1", "pat-1", "sess-1");
    expect(draft).not.toBeNull();
    expect(draft?.clinicId).toBe("cli-1");
    expect(draft?.patientId).toBe("pat-1");
    expect(draft?.sessionId).toBe("sess-1");
    expect(draft?.values.queixa).toBe("Dor lombar");
    expect(draft?.values.sintomas).toBe("Lombalgia aguda");
    expect(draft?.values.painScore).toEqual([4]);
  });

  it("clears a saved draft", () => {
    saveSessionDraft("cli-1", "pat-1", "sess-1", mockValues);
    expect(getSessionDraft("cli-1", "pat-1", "sess-1")).not.toBeNull();

    clearSessionDraft("cli-1", "pat-1", "sess-1");
    expect(getSessionDraft("cli-1", "pat-1", "sess-1")).toBeNull();
  });

  it("returns null when draft does not exist", () => {
    expect(getSessionDraft("cli-1", "pat-1", "non-existent")).toBeNull();
  });
});
