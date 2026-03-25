import { describe, expect, it } from "vitest";
import { filterActivePatientGroups } from "@/lib/patient-groups";

describe("patient group helpers", () => {
  it("keeps only groups marked as em_andamento for the homepage card", () => {
    const result = filterActivePatientGroups([
      { color: "lavender", name: "Lombar", status: "em_andamento" },
      { color: "rose", name: "Pós-operatório", status: "concluido" },
      { color: "sky", name: "Pilates", status: "cancelado" },
    ]);

    expect(result).toEqual([
      { color: "lavender", name: "Lombar", status: "em_andamento" },
    ]);
  });
});
