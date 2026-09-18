import { describe, expect, it } from "vitest";
import {
  buildSessionPayload,
  extractDashboardCareLineItems,
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

  it("sanitizes hostile clinical text and dynamic anamnesis responses", () => {
    const hostileText = ` Café\u0301 😀\u0000\u202E\n${"x".repeat(3_000)}`;
    const payload = buildSessionPayload({
      clinicId: "clinic-1",
      patientId: "patient-1",
      creatorUserId: "creator-123",
      values: {
        amountCharged: "100",
        amountOriginal: "",
        amountPaid: "0",
        anamnesisFormResponse: {
          [`field\u202E${"a".repeat(200)}`]: hostileText,
          checklist: ["ok", `bad\u0000\u202E${"x".repeat(500)}`],
          invalidNumber: Number.POSITIVE_INFINITY,
          table: Array.from({ length: 80 }, (_, index) => ({
            [`column-${index}\u202E`]: hostileText,
          })),
        },
        anamnesisTemplateId: null,
        complexityScore: 4,
        groupId: null,
        notes: hostileText,
        observacoes: hostileText,
        painScore: 7,
        patientArrivedAt: "",
        paymentAdjustmentReason: "",
        paymentInstallments: 1,
        paymentMethod: "pix",
        paymentStatusDate: "",
        paymentStatus: "pendente",
        queixa: hostileText,
        scheduledStartAt: "",
        sintomas: hostileText,
        status: "rascunho",
        treatmentBlocks: [],
        treatmentGeneralGuidance: "",
      },
    });

    expect(payload.notes?.length).toBeLessThanOrEqual(2_000);
    expect(payload.notes).not.toContain("\u0000");
    expect(payload.notes).not.toContain("\u202E");
    expect(Array.from((payload.anamnesis as { queixa: string }).queixa)).toHaveLength(2_000);
    expect(payload.anamnesis_form_response.invalidNumber).toBeNull();
    expect((payload.anamnesis_form_response.checklist as string[])[1]).toHaveLength(120);
    expect(payload.anamnesis_form_response.table as unknown[]).toHaveLength(50);
    expect(Object.keys(payload.anamnesis_form_response).every((key) => !key.includes("\u202E"))).toBe(true);
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

  describe("careLineIds & groupId persistence integrity", () => {
    const baseFormValues = {
      amountCharged: "100",
      amountOriginal: "100",
      amountPaid: "0",
      anamnesisFormResponse: {},
      anamnesisTemplateId: null,
      complexityScore: 1,
      notes: "",
      observacoes: "",
      painScore: 2,
      patientArrivedAt: "",
      paymentAdjustmentReason: "",
      paymentInstallments: 1,
      paymentMethod: "pix" as const,
      paymentStatusDate: "",
      paymentStatus: "pendente" as const,
      queixa: "",
      scheduledStartAt: "",
      sintomas: "",
      status: "rascunho",
      treatmentBlocks: [],
      treatmentGeneralGuidance: "",
    };

    it("persists null group_id and empty array when careLineIds is empty even if groupId has residual value", () => {
      const payload = buildSessionPayload({
        clinicId: "clinic-1",
        patientId: "patient-1",
        creatorUserId: "creator-123",
        values: {
          ...baseFormValues,
          careLineIds: [],
          groupId: "residual-group-id",
        },
      });

      expect(payload.group_id).toBeNull();
      const anamnesis = payload.anamnesis as { care_line_ids: string[] };
      expect(anamnesis.care_line_ids).toEqual([]);
    });

    it("persists first careLineId as group_id and full array in anamnesis when multiple care lines are selected", () => {
      const payload = buildSessionPayload({
        clinicId: "clinic-1",
        patientId: "patient-1",
        creatorUserId: "creator-123",
        values: {
          ...baseFormValues,
          careLineIds: ["group-alpha", "group-beta"],
          groupId: null,
        },
      });

      expect(payload.group_id).toBe("group-alpha");
      const anamnesis = payload.anamnesis as { care_line_ids: string[] };
      expect(anamnesis.care_line_ids).toEqual(["group-alpha", "group-beta"]);
    });

    it("maintains backward compatibility for legacy callers with careLineIds undefined and groupId present", () => {
      const payload = buildSessionPayload({
        clinicId: "clinic-1",
        patientId: "patient-1",
        creatorUserId: "creator-123",
        values: {
          ...baseFormValues,
          groupId: "legacy-group-1",
        },
      });

      expect(payload.group_id).toBe("legacy-group-1");
      const anamnesis = payload.anamnesis as { care_line_ids: string[] };
      expect(anamnesis.care_line_ids).toEqual(["legacy-group-1"]);
    });

    it("persists null group_id and empty array when both careLineIds and groupId are omitted or null", () => {
      const payload = buildSessionPayload({
        clinicId: "clinic-1",
        patientId: "patient-1",
        creatorUserId: "creator-123",
        values: {
          ...baseFormValues,
          groupId: null,
        },
      });

      expect(payload.group_id).toBeNull();
      const anamnesis = payload.anamnesis as { care_line_ids: string[] };
      expect(anamnesis.care_line_ids).toEqual([]);
    });
  });

  describe("extractDashboardCareLineItems", () => {
    it("extracts items from fields with includeInGlobalDashboard or systemKey sintomas", () => {
      const schema = [
        {
          id: "field-1",
          label: "Sintomas Gerais",
          type: "tags" as const,
          includeInGlobalDashboard: false,
          systemKey: "sintomas" as const,
        },
        {
          id: "field-2",
          label: "Diagnósticos Secundários",
          type: "simple_list" as const,
          includeInGlobalDashboard: true,
        },
        {
          id: "field-3",
          label: "Observações Internas",
          type: "long_text" as const,
          includeInGlobalDashboard: false,
        },
      ];

      const formResponse = {
        "field-1": ["Lombalgia Crônica", "Cervicalgia"],
        "field-2": "Tendinite\nFascite Plantar",
        "field-3": "Nota privada que não deve entrar como linha de cuidado",
      };

      const extracted = extractDashboardCareLineItems(schema, formResponse);

      expect(extracted).toEqual([
        "Lombalgia Crônica",
        "Cervicalgia",
        "Tendinite",
        "Fascite Plantar",
      ]);
    });

    it("handles object structures inside array items and trims empty strings", () => {
      const schema = [
        {
          id: "field-complex",
          label: "Linhas Selecionadas",
          type: "checklist" as const,
          includeInGlobalDashboard: true,
        },
      ];

      const formResponse = {
        "field-complex": [
          { label: "Ombro Congelado" },
          { name: "Epicondilite" },
          { value: "Bursite" },
          "  ",
        ],
      };

      const extracted = extractDashboardCareLineItems(schema, formResponse);

      expect(extracted).toEqual(["Ombro Congelado", "Epicondilite", "Bursite"]);
    });

    it("returns empty array when no fields match dashboard criteria or response is empty", () => {
      const schema = [
        {
          id: "field-plain",
          label: "Nota",
          type: "short_text" as const,
          includeInGlobalDashboard: false,
        },
      ];

      expect(extractDashboardCareLineItems(schema, {})).toEqual([]);
    });
  });
});
