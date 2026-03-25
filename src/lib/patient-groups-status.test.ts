import { describe, expect, it } from "vitest";
import { isHomepageVisibleGroupStatus } from "@/lib/patient-groups-status";

describe("patient group status visibility", () => {
  it("shows only em_andamento on the homepage", () => {
    expect(isHomepageVisibleGroupStatus("em_andamento")).toBe(true);
    expect(isHomepageVisibleGroupStatus(null)).toBe(false);
    expect(isHomepageVisibleGroupStatus("pausado")).toBe(false);
    expect(isHomepageVisibleGroupStatus("concluido")).toBe(false);
    expect(isHomepageVisibleGroupStatus("cancelado")).toBe(false);
    expect(isHomepageVisibleGroupStatus("inativo")).toBe(false);
  });
});
