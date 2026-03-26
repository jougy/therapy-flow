import type { Json } from "@/integrations/supabase/types";

export interface ClinicBusinessHours {
  summary: string;
}

export const readBusinessHours = (value: Json | null | undefined): ClinicBusinessHours => {
  const record = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  return {
    summary: typeof record.summary === "string" ? record.summary : "",
  };
};

export const buildBusinessHours = (value: ClinicBusinessHours) => ({
  summary: value.summary.trim(),
});

export const getClinicBrandName = (value: string | null | undefined) => value?.trim() || "TherapyFlow";
