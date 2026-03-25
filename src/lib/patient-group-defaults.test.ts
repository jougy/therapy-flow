import { describe, expect, it } from "vitest";
import { getPreferredPatientGroupId } from "@/lib/patient-group-defaults";

describe("patient group defaults", () => {
  it("prefers the last used group when it still exists", () => {
    const groupId = getPreferredPatientGroupId(
      [
        { id: "default-group", is_default: true },
        { id: "rehab-group", is_default: false },
      ],
      "rehab-group"
    );

    expect(groupId).toBe("rehab-group");
  });

  it("falls back to the default group when there is no last used group", () => {
    const groupId = getPreferredPatientGroupId(
      [
        { id: "default-group", is_default: true },
        { id: "rehab-group", is_default: false },
      ],
      null
    );

    expect(groupId).toBe("default-group");
  });
});
