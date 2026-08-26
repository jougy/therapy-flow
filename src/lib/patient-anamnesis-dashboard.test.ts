import { describe, expect, it } from "vitest";
import { buildPatientAnamnesisDashboard, type PatientAnamnesisDashboardSession } from "@/lib/patient-anamnesis-dashboard";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

const makeSession = (overrides: Partial<PatientAnamnesisDashboardSession>): PatientAnamnesisDashboardSession => ({
  anamnesis: {},
  anamnesis_form_response: {},
  anamnesis_template_id: "template-1",
  complexity_score: null,
  id: "session-1",
  pain_score: null,
  session_date: "2026-01-01T12:00:00.000Z",
  status: "concluído",
  ...overrides,
});

const baseSchema: AnamnesisTemplateSchema = [
  { id: "base_section", label: "Base", type: "section" },
  { groupKey: "base_section", id: "pain_score", label: "Dor", min: 0, max: 10, systemKey: "pain_score", type: "slider" },
];

const templateSchema: AnamnesisTemplateSchema = [
  { id: "section_main", label: "Avaliação", type: "section" },
  {
    groupKey: "section_main",
    id: "mobility",
    label: "Mobilidade",
    options: [
      { id: "low", label: "Baixa" },
      { id: "high", label: "Alta" },
    ],
    type: "select",
  },
  {
    groupKey: "section_main",
    id: "symptoms",
    label: "Sintomas",
    options: [
      { id: "pain", label: "Dor" },
      { id: "stiffness", label: "Rigidez" },
    ],
    type: "checklist",
  },
  { groupKey: "section_main", id: "strength", label: "Força", type: "number" },
  { groupKey: "section_main", id: "notes", label: "Notas", type: "long_text" },
  { groupKey: "section_main", id: "empty", label: "Campo vazio", type: "short_text" },
];

describe("buildPatientAnamnesisDashboard", () => {
  it("aggregates answered fields and ignores empty fields", () => {
    const dashboard = buildPatientAnamnesisDashboard({
      baseSchema,
      sessions: [
        makeSession({
          id: "session-1",
          pain_score: 7,
          session_date: "2026-01-02T12:00:00.000Z",
          anamnesis_form_response: {
            mobility: "low",
            symptoms: ["pain", "stiffness"],
            strength: 3,
            notes: "Primeira avaliação",
          },
        }),
        makeSession({
          id: "session-2",
          pain_score: 4,
          session_date: "2026-01-05T12:00:00.000Z",
          status: "rascunho",
          anamnesis_form_response: {
            mobility: "high",
            symptoms: ["pain"],
            strength: 5,
            notes: "Retorno",
          },
        }),
        makeSession({
          id: "session-3",
          status: "cancelado",
          anamnesis_form_response: {
            mobility: "high",
            strength: 10,
          },
        }),
      ],
      templates: [{ id: "template-1", name: "Ficha ortopédica", schema: templateSchema }],
    });

    expect(dashboard.totalSessions).toBe(2);
    expect(dashboard.groups).toHaveLength(2);

    const baseMetric = dashboard.groups[0].sections[0].metrics[0];
    expect(baseMetric.kind).toBe("number");
    expect(baseMetric.count).toBe(2);
    expect(baseMetric.average).toBe(5.5);
    expect(baseMetric.allowedCharts).toEqual(["line", "bar", "area", "proportion", "pie"]);

    const templateMetrics = dashboard.groups[1].sections[0].metrics;
    expect(templateMetrics.map((metric) => metric.fieldId)).toEqual(["mobility", "symptoms", "strength", "notes"]);
    expect(templateMetrics.find((metric) => metric.fieldId === "empty")).toBeUndefined();

    expect(templateMetrics.find((metric) => metric.fieldId === "strength")?.numberData?.map((point) => point.value)).toEqual([3, 5]);
    expect(templateMetrics.find((metric) => metric.fieldId === "mobility")?.categoryData?.map((point) => [point.label, point.value])).toEqual([
      ["Alta", 1],
      ["Baixa", 1],
    ]);
    expect(templateMetrics.find((metric) => metric.fieldId === "mobility")?.allowedCharts).toEqual(["bar", "proportion", "pie"]);
    expect(templateMetrics.find((metric) => metric.fieldId === "symptoms")?.categoryData?.map((point) => [point.label, point.value])).toEqual([
      ["Dor", 2],
      ["Rigidez", 1],
    ]);
    expect(templateMetrics.find((metric) => metric.fieldId === "notes")?.textEntries?.map((entry) => entry.value)).toEqual(["Retorno", "Primeira avaliação"]);
  });

  it("respects conditional section selectors", () => {
    const schema: AnamnesisTemplateSchema = [
      {
        id: "areas",
        label: "Áreas",
        options: [
          { id: "knee", label: "Joelho" },
          { id: "shoulder", label: "Ombro" },
        ],
        type: "section_selector",
      },
      { id: "knee_section", label: "Joelho", type: "section" },
      { groupKey: "knee_section", id: "knee_pain", label: "Dor no joelho", sectionKey: "knee", type: "number" },
      { id: "shoulder_section", label: "Ombro", type: "section" },
      { groupKey: "shoulder_section", id: "shoulder_pain", label: "Dor no ombro", sectionKey: "shoulder", type: "number" },
    ];

    const dashboard = buildPatientAnamnesisDashboard({
      baseSchema: [],
      sessions: [
        makeSession({
          anamnesis_form_response: {
            areas: ["knee"],
            knee_pain: 8,
            shoulder_pain: 2,
          },
        }),
      ],
      templates: [{ id: "template-1", name: "Ficha condicional", schema }],
    });

    const metrics = dashboard.groups[0].sections.flatMap((section) => section.metrics);

    expect(metrics.map((metric) => metric.fieldId)).toEqual(["knee_pain"]);
    expect(metrics.find((metric) => metric.fieldId === "shoulder_pain")).toBeUndefined();
  });

  it("keeps fields with the same id separated by template", () => {
    const sharedFieldSchema: AnamnesisTemplateSchema = [
      { id: "section", label: "Seção", type: "section" },
      { groupKey: "section", id: "score", label: "Pontuação", type: "number" },
    ];

    const dashboard = buildPatientAnamnesisDashboard({
      baseSchema: [],
      sessions: [
        makeSession({ anamnesis_template_id: "template-1", anamnesis_form_response: { score: 1 } }),
        makeSession({ anamnesis_template_id: "template-2", id: "session-2", anamnesis_form_response: { score: 9 } }),
      ],
      templates: [
        { id: "template-1", name: "Ficha A", schema: sharedFieldSchema },
        { id: "template-2", name: "Ficha B", schema: sharedFieldSchema },
      ],
    });

    expect(dashboard.groups.map((group) => group.title)).toEqual(["Ficha A", "Ficha B"]);
    expect(dashboard.groups.map((group) => group.sections[0].metrics[0].numberData?.[0].value)).toEqual([1, 9]);
  });

  it("aggregates radar_section attributes into a unified multi-series and radar metric", () => {
    const radarTemplateSchema: AnamnesisTemplateSchema = [
      { id: "radar_sec", label: "Status Físico", type: "radar_section" },
      { groupKey: "radar_sec", id: "strength", label: "Força", min: 0, max: 10, type: "slider" },
      { groupKey: "radar_sec", id: "agility", label: "Agilidade", min: 0, max: 10, type: "slider" },
      { groupKey: "radar_sec", id: "endurance", label: "Resistência", min: 0, max: 10, type: "slider" },
    ];

    const dashboard = buildPatientAnamnesisDashboard({
      baseSchema: [],
      sessions: [
        makeSession({
          anamnesis_template_id: "template-radar",
          id: "session-1",
          session_date: "2026-01-01T12:00:00.000Z",
          anamnesis_form_response: {
            strength: 4,
            agility: 6,
            endurance: 5,
          },
        }),
        makeSession({
          anamnesis_template_id: "template-radar",
          id: "session-2",
          session_date: "2026-01-10T12:00:00.000Z",
          anamnesis_form_response: {
            strength: 8,
            agility: 9,
            endurance: 7,
          },
        }),
      ],
      templates: [{ id: "template-radar", name: "Ficha de Status", schema: radarTemplateSchema }],
    });

    expect(dashboard.groups).toHaveLength(1);
    expect(dashboard.groups[0].sections).toHaveLength(1);
    expect(dashboard.groups[0].sections[0].title).toBe("Status Físico");

    const radarMetric = dashboard.groups[0].sections[0].metrics[0];
    expect(radarMetric.isRadarGroup).toBe(true);
    expect(radarMetric.defaultChart).toBe("radar");
    expect(radarMetric.allowedCharts).toEqual(["radar", "line", "bar", "area", "proportion", "pie"]);
    expect(radarMetric.seriesKeys).toHaveLength(3);
    expect(radarMetric.seriesKeys?.map((k) => k.label)).toEqual(["Força", "Agilidade", "Resistência"]);
    expect(radarMetric.multiSeriesData).toHaveLength(2);
    expect(radarMetric.radarItems).toHaveLength(3);
    // latest session values
    expect(radarMetric.radarItems?.map((i) => i.value)).toEqual([8, 9, 7]);
    // comparative series (first vs latest)
    expect(radarMetric.radarSeries).toHaveLength(2);
    expect(radarMetric.radarSeries?.[0].data).toEqual({ Força: 4, Agilidade: 6, Resistência: 5 });
    expect(radarMetric.radarSeries?.[1].data).toEqual({ Força: 8, Agilidade: 9, Resistência: 7 });
  });
});
