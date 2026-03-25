import { isHomepageVisibleGroupStatus } from "@/lib/patient-groups-status";

export type PatientGroupStatus = "em_andamento" | "pausado" | "concluido" | "cancelado" | "inativo";

export interface PatientGroupSummary {
  color: string;
  name: string;
  status: string | null;
}

export const filterActivePatientGroups = <T extends PatientGroupSummary>(groups: T[]) =>
  groups.filter((group) => isHomepageVisibleGroupStatus(group.status));
