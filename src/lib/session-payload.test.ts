import { describe, expect, it } from "vitest";
import {
  buildSessionPayload,
  formatDateTimeForInput,
  isSessionDateTimeInputValid,
  parseDateTimeInputValue,
  parseOptionalDateInputValue,
  parseOptionalDateTimeInputValue,
} from "@/lib/session-payload";

describe("buildSessionPayload", () => {
  it("uses the creator user id for both author and provider fields", () => {
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      creatorUserId: "creator-123",
      values: {
        amountCharged: "",
        amountOriginal: "",
        amountPaid: "",
        anamnesisFormResponse: {},
        anamnesisTemplateId: null,
        complexityScore: 4,
        groupId: "group-1",
        notes: "Observacao livre",
        observacoes: "Observacao clinica",
        painScore: 7,
        patientArrivedAt: "",
        paymentAdjustmentReason: "",
        paymentInstallments: 1,
        paymentMethod: "nao_informado",
        paymentStatusDate: "",
        paymentStatus: "nao_cobrado",
        queixa: "Dor lombar",
        scheduledStartAt: "",
        sintomas: "Rigidez matinal",
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      },
    });

    expect(payload.user_id).toBe("creator-123");
    expect(payload.provider_id).toBe("creator-123");
  });

  it("persists a custom session date and keeps datetime-local formatting stable", () => {
    const expectedIso = new Date("2026-04-15T10:30").toISOString();
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      creatorUserId: "creator-123",
      sessionDate: "2026-04-15T10:30",
      values: {
        amountCharged: "100",
        amountOriginal: "120,50",
        amountPaid: "60",
        anamnesisFormResponse: {},
        anamnesisTemplateId: null,
        complexityScore: 4,
        groupId: "group-1",
        notes: "Observacao livre",
        observacoes: "Observacao clinica",
        painScore: 7,
        patientArrivedAt: "2026-04-15T10:40",
        paymentAdjustmentReason: "Desconto de teste",
        paymentInstallments: 3,
        paymentMethod: "pix",
        paymentStatusDate: "2026-04-16",
        paymentStatus: "parcial",
        queixa: "Dor lombar",
        scheduledStartAt: "2026-04-15T10:30",
        sintomas: "Rigidez matinal",
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      },
    });

    expect(payload.session_date).toBe(expectedIso);
    expect(payload.scheduled_start_at).toBe(expectedIso);
    expect(payload.patient_arrived_at).toBe(new Date("2026-04-15T10:40").toISOString());
    expect(payload.payment_status).toBe("parcial");
    expect(payload.amount_original_cents).toBe(12050);
    expect(payload.amount_charged_cents).toBe(10000);
    expect(payload.amount_paid_cents).toBe(6000);
    expect(payload.payment_adjustment_reason).toBe("Desconto de teste");
    expect(payload.payment_installments).toBe(3);
    expect(payload.payment_method).toBe("pix");
    expect(payload.payment_status_date).toBe("2026-04-16");
    expect(formatDateTimeForInput(expectedIso)).toBe("2026-04-15T10:30");
    expect(parseDateTimeInputValue("2026-04-15T10:30")).toBe(expectedIso);
  });

  it("rejects invalid or absurd operational dates", () => {
    expect(isSessionDateTimeInputValid("1999-12-31T23:59")).toBe(false);
    expect(isSessionDateTimeInputValid("2101-01-01T00:00")).toBe(false);
    expect(isSessionDateTimeInputValid("abc")).toBe(false);
    expect(parseOptionalDateTimeInputValue("0001-01-01T00:00")).toBeNull();
    expect(parseOptionalDateInputValue("1999-12-31")).toBeNull();
    expect(parseOptionalDateInputValue("2101-01-01")).toBeNull();
    expect(parseOptionalDateInputValue("2026-02-31")).toBeNull();
    expect(parseOptionalDateInputValue("2026-04-16")).toBe("2026-04-16");
  });

  it("sanitizes payment reason and invalid payment dates", () => {
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      creatorUserId: "creator-123",
      values: {
        amountCharged: "1e9",
        amountOriginal: "999999999999",
        amountPaid: "<script>1</script>",
        anamnesisFormResponse: {},
        anamnesisTemplateId: null,
        complexityScore: 0,
        groupId: null,
        notes: "",
        observacoes: "",
        painScore: 0,
        patientArrivedAt: "",
        paymentAdjustmentReason: `  desconto\u0000controlado\n${"x".repeat(300)}`,
        paymentInstallments: 99,
        paymentMethod: "cartao_credito",
        paymentStatusDate: "2101-01-01",
        paymentStatus: "pago",
        queixa: "",
        scheduledStartAt: "",
        sintomas: "",
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      },
    });

    expect(payload.amount_charged_cents).toBe(0);
    expect(payload.amount_original_cents).toBe(10_000_000);
    expect(payload.amount_paid_cents).toBe(0);
    expect(payload.payment_adjustment_reason).not.toContain("\u0000");
    expect(payload.payment_adjustment_reason?.length).toBeLessThanOrEqual(240);
    expect(payload.payment_installments).toBe(1);
    expect(payload.payment_status_date).toBeNull();
  });

  it("normalizes payment status when building payloads", () => {
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      creatorUserId: "creator-123",
      values: {
        amountCharged: "120",
        amountOriginal: "",
        amountPaid: "0",
        anamnesisFormResponse: {},
        anamnesisTemplateId: null,
        complexityScore: 0,
        groupId: null,
        notes: "",
        observacoes: "",
        painScore: 0,
        patientArrivedAt: "",
        paymentAdjustmentReason: "",
        paymentInstallments: 2,
        paymentMethod: "dinheiro",
        paymentStatusDate: "",
        paymentStatus: "credito",
        queixa: "",
        scheduledStartAt: "",
        sintomas: "",
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      },
    });

    expect(payload.payment_status).toBe("pendente");
  });

  it("records courtesy as payment method when courtesy is selected", () => {
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      creatorUserId: "creator-123",
      values: {
        amountCharged: "120",
        amountOriginal: "",
        amountPaid: "0",
        anamnesisFormResponse: {},
        anamnesisTemplateId: null,
        complexityScore: 0,
        groupId: null,
        notes: "",
        observacoes: "",
        painScore: 0,
        patientArrivedAt: "",
        paymentAdjustmentReason: "",
        paymentInstallments: 12,
        paymentMethod: "pix",
        paymentStatusDate: "",
        paymentStatus: "cortesia",
        queixa: "",
        scheduledStartAt: "",
        sintomas: "",
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      },
    });

    expect(payload.payment_status).toBe("cortesia");
    expect(payload.payment_installments).toBe(1);
    expect(payload.payment_method).toBe("cortesia");
  });
});
