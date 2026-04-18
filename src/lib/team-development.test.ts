import { describe, expect, it } from "vitest";
import {
  buildOnboardingChecklist,
  buildTeamDevelopmentSummary,
  getDevelopmentDashboardTone,
  getDevelopmentLevelMeta,
  getDevelopmentStatusScore,
  getDevelopmentStatusMeta,
  shouldShowTeamDevelopmentSection,
  type TeamDevelopmentChecklistInput,
  type TeamDevelopmentMemberSummaryInput,
} from "@/lib/team-development";

const checklistInput = (overrides: Partial<TeamDevelopmentChecklistInput> = {}): TeamDevelopmentChecklistInput => ({
  birthDate: null,
  email: "alice@clinic.test",
  fullName: "Alice",
  hasTemporaryPassword: false,
  onboardingFlowRead: true,
  onboardingInitialTraining: false,
  phone: null,
  professionalLicense: null,
  socialName: null,
  ...overrides,
});

const memberSummary = (overrides: Partial<TeamDevelopmentMemberSummaryInput> = {}): TeamDevelopmentMemberSummaryInput => ({
  developmentStatus: "em_evolucao",
  membershipStatus: "active",
  operationalRole: "professional",
  ...overrides,
});

describe("team development helpers", () => {
  it("shows the team development section only for clinic admins or professionals", () => {
    expect(shouldShowTeamDevelopmentSection("clinic", true, "admin")).toBe(true);
    expect(shouldShowTeamDevelopmentSection("clinic", false, "professional")).toBe(true);
    expect(shouldShowTeamDevelopmentSection("clinic", false, "assistant")).toBe(false);
    expect(shouldShowTeamDevelopmentSection("solo", true, "admin")).toBe(false);
  });

  it("builds onboarding checklist progress from derived and manual fields", () => {
    expect(
      buildOnboardingChecklist(
        checklistInput({
          birthDate: "1990-01-01",
          onboardingInitialTraining: true,
          phone: "11999999999",
          professionalLicense: "CREFITO 123",
        })
      )
    ).toMatchObject({
      completedCount: 5,
      totalCount: 5,
    });

    expect(
      buildOnboardingChecklist(
        checklistInput({
          hasTemporaryPassword: true,
          onboardingFlowRead: false,
          onboardingInitialTraining: false,
          phone: "",
          professionalLicense: "",
        })
      )
    ).toMatchObject({
      completedCount: 2,
      totalCount: 5,
    });
  });

  it("summarizes the team overview by status and active memberships", () => {
    expect(
      buildTeamDevelopmentSummary([
        memberSummary({ developmentStatus: "onboarding", operationalRole: "admin" }),
        memberSummary({ developmentStatus: "em_evolucao" }),
        memberSummary({ developmentStatus: "precisa_supervisao" }),
        memberSummary({ developmentStatus: "consolidado" }),
        memberSummary({ membershipStatus: "inactive" }),
      ])
    ).toEqual({
      activeTotal: 4,
      byRole: {
        admin: 1,
        assistant: 0,
        owner: 0,
        professional: 3,
      },
      inOnboarding: 1,
      needsAttention: 1,
      onTrack: 2,
    });
  });

  it("returns readable labels for development status and level", () => {
    expect(getDevelopmentStatusMeta("precisa_supervisao")).toEqual({
      className: "bg-amber-500",
      label: "Precisa de supervisao",
    });

    expect(getDevelopmentLevelMeta("referencia")).toEqual({
      className: "bg-sky-500",
      label: "Referencia interna",
    });
  });

  it("returns safe fallbacks for unexpected development status and level values", () => {
    expect(getDevelopmentStatusMeta("legado")).toEqual({
      className: "bg-slate-400",
      label: "Status desconhecido",
    });

    expect(getDevelopmentLevelMeta("especialista")).toEqual({
      className: "bg-slate-400",
      label: "Nivel desconhecido",
    });
  });

  it("provides compact dashboard scores and tones", () => {
    expect(getDevelopmentStatusScore("onboarding")).toBe(30);
    expect(getDevelopmentStatusScore("consolidado")).toBe(100);
    expect(getDevelopmentDashboardTone("precisa_supervisao")).toBe("warning");
    expect(getDevelopmentDashboardTone("consolidado")).toBe("healthy");
  });
});
