import type { Json } from "@/integrations/supabase/types";
import {
  getVisibleTemplateFields,
  isContainerField,
  type AnamnesisField,
  type AnamnesisFormResponse,
  type AnamnesisFormValue,
  type AnamnesisTableRow,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";

export type PatientAnamnesisChartType = "area" | "bar" | "line" | "pie" | "proportion";
export type PatientAnamnesisMetricKind = "category" | "date" | "number" | "table" | "text";

export interface PatientAnamnesisDashboardSession {
  anamnesis: Json | null;
  anamnesis_form_response: Json | null;
  anamnesis_template_id: string | null;
  complexity_score: number | null;
  id: string;
  pain_score: number | null;
  session_date: string;
  status: string;
}

export interface PatientAnamnesisDashboardTemplate {
  id: string;
  name: string;
  schema: Json;
}

export interface PatientAnamnesisDashboardNumberPoint {
  date: string;
  label: string;
  sessionId: string;
  value: number;
}

export interface PatientAnamnesisDashboardCategoryPoint {
  color: string;
  id: string;
  label: string;
  value: number;
}

export interface PatientAnamnesisDashboardTextEntry {
  date: string;
  label: string;
  sessionId: string;
  value: string;
}

export interface PatientAnamnesisDashboardMetric {
  allowedCharts: PatientAnamnesisChartType[];
  average?: number;
  categoryData?: PatientAnamnesisDashboardCategoryPoint[];
  count: number;
  defaultChart: PatientAnamnesisChartType;
  fieldId: string;
  fieldLabel: string;
  fieldType: AnamnesisField["type"];
  key: string;
  kind: PatientAnamnesisMetricKind;
  max?: number;
  min?: number;
  numberData?: PatientAnamnesisDashboardNumberPoint[];
  tableRowCount?: number;
  textEntries?: PatientAnamnesisDashboardTextEntry[];
}

export interface PatientAnamnesisDashboardSection {
  key: string;
  metrics: PatientAnamnesisDashboardMetric[];
  title: string;
}

export interface PatientAnamnesisDashboardGroup {
  key: string;
  sections: PatientAnamnesisDashboardSection[];
  templateId: string;
  title: string;
}

export interface PatientAnamnesisDashboard {
  groups: PatientAnamnesisDashboardGroup[];
  totalAnsweredFields: number;
  totalSessions: number;
}

const chartColors = ["#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#14b8a6", "#64748b", "#ec4899"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const isFormResponse = (value: Json | null): value is AnamnesisFormResponse =>
  isRecord(value);

const readAnamnesisString = (value: Json | null, key: string) => {
  if (!isRecord(value)) {
    return "";
  }

  const raw = value[key];
  return typeof raw === "string" ? raw.trim() : "";
};

const readResponseValue = (
  field: AnamnesisField,
  session: PatientAnamnesisDashboardSession,
): AnamnesisFormValue | undefined => {
  if (field.systemKey === "pain_score") {
    return typeof session.pain_score === "number" ? session.pain_score : undefined;
  }

  if (field.systemKey === "complexity_score") {
    return typeof session.complexity_score === "number" ? session.complexity_score : undefined;
  }

  if (field.systemKey === "queixa" || field.systemKey === "sintomas" || field.systemKey === "observacoes") {
    return readAnamnesisString(session.anamnesis, field.systemKey);
  }

  const response = isFormResponse(session.anamnesis_form_response) ? session.anamnesis_form_response : {};
  return response[field.id];
};

const hasMeaningfulValue = (value: AnamnesisFormValue | undefined) => {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "boolean") {
    return value;
  }

  return false;
};

const formatDateLabel = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

const getSectionTitle = (fieldsById: Map<string, AnamnesisField>, field: AnamnesisField) => {
  const parent = field.groupKey ? fieldsById.get(field.groupKey) : null;
  return parent && isContainerField(parent) ? parent.label : "Sem seção";
};

const getOptionLabel = (field: AnamnesisField, optionId: string) =>
  field.options?.find((option) => option.id === optionId)?.label ?? optionId;

const buildNumberMetric = (
  groupKey: string,
  field: AnamnesisField,
  sessions: PatientAnamnesisDashboardSession[],
): PatientAnamnesisDashboardMetric | null => {
  const numberData = sessions
    .flatMap((session) => {
      const value = readResponseValue(field, session);
      const numberValue = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;

      if (!Number.isFinite(numberValue)) {
        return [];
      }

      return [{
        date: session.session_date,
        label: formatDateLabel(session.session_date),
        sessionId: session.id,
        value: numberValue,
      }];
    })
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());

  if (numberData.length === 0) {
    return null;
  }

  const values = numberData.map((point) => point.value);

  return {
    allowedCharts: ["line", "bar", "area", "proportion", "pie"],
    average: values.reduce((sum, value) => sum + value, 0) / values.length,
    count: values.length,
    defaultChart: "line",
    fieldId: field.id,
    fieldLabel: field.label,
    fieldType: field.type,
    key: `${groupKey}:${field.id}`,
    kind: "number",
    max: Math.max(...values),
    min: Math.min(...values),
    numberData,
  };
};

const buildCategoryMetric = (
  groupKey: string,
  field: AnamnesisField,
  sessions: PatientAnamnesisDashboardSession[],
): PatientAnamnesisDashboardMetric | null => {
  const counts = new Map<string, number>();

  sessions.forEach((session) => {
    const value = readResponseValue(field, session);
    const values = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : typeof value === "string" && value.trim()
        ? [value]
        : [];

    values.forEach((optionId) => counts.set(optionId, (counts.get(optionId) ?? 0) + 1));
  });

  if (counts.size === 0) {
    return null;
  }

  const categoryData = Array.from(counts.entries())
    .map(([id, value], index) => ({
      color: chartColors[index % chartColors.length],
      id,
      label: getOptionLabel(field, id),
      value,
    }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));

  return {
    allowedCharts: ["bar", "proportion", "pie"],
    categoryData,
    count: categoryData.reduce((sum, item) => sum + item.value, 0),
    defaultChart: "bar",
    fieldId: field.id,
    fieldLabel: field.label,
    fieldType: field.type,
    key: `${groupKey}:${field.id}`,
    kind: "category",
  };
};

const buildTextMetric = (
  groupKey: string,
  field: AnamnesisField,
  sessions: PatientAnamnesisDashboardSession[],
): PatientAnamnesisDashboardMetric | null => {
  const textEntries = sessions
    .flatMap((session) => {
      const value = readResponseValue(field, session);
      const text = typeof value === "string" ? value.trim() : "";

      if (!text) {
        return [];
      }

      return [{
        date: session.session_date,
        label: formatDateLabel(session.session_date),
        sessionId: session.id,
        value: text,
      }];
    })
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  if (textEntries.length === 0) {
    return null;
  }

  return {
    allowedCharts: [],
    count: textEntries.length,
    defaultChart: "bar",
    fieldId: field.id,
    fieldLabel: field.label,
    fieldType: field.type,
    key: `${groupKey}:${field.id}`,
    kind: "text",
    textEntries: textEntries.slice(0, 5),
  };
};

const buildDateMetric = (
  groupKey: string,
  field: AnamnesisField,
  sessions: PatientAnamnesisDashboardSession[],
): PatientAnamnesisDashboardMetric | null => {
  const textEntries = sessions
    .flatMap((session) => {
      const value = readResponseValue(field, session);
      const text = typeof value === "string" ? value.trim() : "";

      if (!text) {
        return [];
      }

      return [{
        date: session.session_date,
        label: formatDateLabel(session.session_date),
        sessionId: session.id,
        value: text,
      }];
    })
    .sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  if (textEntries.length === 0) {
    return null;
  }

  return {
    allowedCharts: [],
    count: textEntries.length,
    defaultChart: "bar",
    fieldId: field.id,
    fieldLabel: field.label,
    fieldType: field.type,
    key: `${groupKey}:${field.id}`,
    kind: "date",
    textEntries: textEntries.slice(0, 5),
  };
};

const buildTableMetric = (
  groupKey: string,
  field: AnamnesisField,
  sessions: PatientAnamnesisDashboardSession[],
): PatientAnamnesisDashboardMetric | null => {
  let count = 0;
  let tableRowCount = 0;

  sessions.forEach((session) => {
    const value = readResponseValue(field, session);
    const rows = Array.isArray(value) && value.every((row) => isRecord(row)) ? (value as AnamnesisTableRow[]) : [];
    const meaningfulRows = rows.filter((row) => Object.values(row).some((cell) => String(cell ?? "").trim().length > 0));

    if (meaningfulRows.length > 0) {
      count += 1;
      tableRowCount += meaningfulRows.length;
    }
  });

  if (count === 0) {
    return null;
  }

  return {
    allowedCharts: [],
    count,
    defaultChart: "bar",
    fieldId: field.id,
    fieldLabel: field.label,
    fieldType: field.type,
    key: `${groupKey}:${field.id}`,
    kind: "table",
    tableRowCount,
  };
};

const buildMetric = (
  groupKey: string,
  field: AnamnesisField,
  sessions: PatientAnamnesisDashboardSession[],
) => {
  if (field.type === "number" || field.type === "slider") {
    return buildNumberMetric(groupKey, field, sessions);
  }

  if (field.type === "checklist" || field.type === "multiple_choice" || field.type === "select" || field.type === "section_selector") {
    return buildCategoryMetric(groupKey, field, sessions);
  }

  if (field.type === "short_text" || field.type === "long_text") {
    return buildTextMetric(groupKey, field, sessions);
  }

  if (field.type === "date") {
    return buildDateMetric(groupKey, field, sessions);
  }

  if (field.type === "table") {
    return buildTableMetric(groupKey, field, sessions);
  }

  return null;
};

const buildGroup = ({
  groupKey,
  sessions,
  templateId,
  title,
  schema,
}: {
  groupKey: string;
  sessions: PatientAnamnesisDashboardSession[];
  schema: AnamnesisTemplateSchema;
  templateId: string;
  title: string;
}): PatientAnamnesisDashboardGroup | null => {
  const fieldsById = new Map(schema.map((field) => [field.id, field]));
  const sections = new Map<string, PatientAnamnesisDashboardSection>();

  schema
    .filter((field) => !isContainerField(field))
    .forEach((field) => {
      const sessionsWithVisibleField = sessions.filter((session) => {
        const response = isFormResponse(session.anamnesis_form_response) ? session.anamnesis_form_response : {};
        return getVisibleTemplateFields(schema, response).some((visibleField) => visibleField.id === field.id);
      });

      if (!sessionsWithVisibleField.some((session) => hasMeaningfulValue(readResponseValue(field, session)))) {
        return;
      }

      const metric = buildMetric(groupKey, field, sessionsWithVisibleField);
      if (!metric) {
        return;
      }

      const sectionTitle = getSectionTitle(fieldsById, field);
      const sectionKey = `${groupKey}:section:${field.groupKey ?? "none"}`;
      const section = sections.get(sectionKey) ?? {
        key: sectionKey,
        metrics: [],
        title: sectionTitle,
      };

      section.metrics.push(metric);
      sections.set(sectionKey, section);
    });

  const sectionList = Array.from(sections.values()).filter((section) => section.metrics.length > 0);

  if (sectionList.length === 0) {
    return null;
  }

  return {
    key: groupKey,
    sections: sectionList,
    templateId,
    title,
  };
};

export const buildPatientAnamnesisDashboard = ({
  baseSchema,
  sessions,
  templates,
}: {
  baseSchema: AnamnesisTemplateSchema;
  sessions: PatientAnamnesisDashboardSession[];
  templates: PatientAnamnesisDashboardTemplate[];
}): PatientAnamnesisDashboard => {
  const eligibleSessions = sessions.filter((session) => session.status === "concluído" || session.status === "rascunho");
  const groups: PatientAnamnesisDashboardGroup[] = [];
  const baseGroup = buildGroup({
    groupKey: "base",
    schema: baseSchema,
    sessions: eligibleSessions,
    templateId: "base",
    title: "Bloco padrão",
  });

  if (baseGroup) {
    groups.push(baseGroup);
  }

  templates.forEach((template) => {
    if (!Array.isArray(template.schema)) {
      return;
    }

    const templateSessions = eligibleSessions.filter((session) => session.anamnesis_template_id === template.id);
    const group = buildGroup({
      groupKey: `template:${template.id}`,
      schema: template.schema as AnamnesisTemplateSchema,
      sessions: templateSessions,
      templateId: template.id,
      title: template.name,
    });

    if (group) {
      groups.push(group);
    }
  });

  return {
    groups,
    totalAnsweredFields: groups.reduce((sum, group) => sum + group.sections.reduce((sectionSum, section) => sectionSum + section.metrics.length, 0), 0),
    totalSessions: eligibleSessions.length,
  };
};
