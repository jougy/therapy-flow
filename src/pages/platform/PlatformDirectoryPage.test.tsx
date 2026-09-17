import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  consolidateDirectoryItems,
  isStatusActive,
  isStatusPaused,
  getEntityTheme,
} from "@/components/platform/directory-utils";
import { DirectoryCard, DirectoryPill } from "@/components/platform/DirectoryCard";
import type { PlatformDirectoryItem } from "@/components/platform/types";
import { Building2 } from "lucide-react";

describe("PlatformDirectoryPage multi-clinic consolidation", () => {
  it("detects active and paused statuses correctly with helper functions", () => {
    expect(isStatusActive("active")).toBe(true);
    expect(isStatusActive("ACTIVE")).toBe(true);
    expect(isStatusActive("Active")).toBe(true);
    expect(isStatusActive("paused")).toBe(false);
    expect(isStatusActive(null)).toBe(false);
    expect(isStatusActive(undefined)).toBe(false);

    expect(isStatusPaused("paused")).toBe(true);
    expect(isStatusPaused("PAUSED")).toBe(true);
    expect(isStatusPaused("temporarily_paused")).toBe(true);
    expect(isStatusPaused("inactive")).toBe(true);
    expect(isStatusPaused("suspended")).toBe(true);
    expect(isStatusPaused("active")).toBe(false);
    expect(isStatusPaused(null)).toBe(false);
    expect(isStatusPaused(undefined)).toBe(false);
  });

  it("assigns appropriate theme per entity type and state", () => {
    const pendingTheme = getEntityTheme("account", false, true);
    expect(pendingTheme.iconBg).toContain("amber");

    const clinicTheme = getEntityTheme("clinic");
    expect(clinicTheme.iconBg).toContain("sky");

    const ownerTheme = getEntityTheme("account", true);
    expect(ownerTheme.iconBg).toContain("purple");

    const accountTheme = getEntityTheme("account", false);
    expect(accountTheme.iconBg).toContain("indigo");

    const patientTheme = getEntityTheme("patient");
    expect(patientTheme.iconBg).toContain("emerald");
  });

  it("unifies status to 'active' when existing is active and new item is paused", () => {
    const rawList: PlatformDirectoryItem[] = [
      {
        item_id: "user-1",
        item_type: "account",
        title: "Dra. Maria",
        subtitle: "maria@example.com",
        status: "active",
        clinic_id: "clinic-1",
        clinic_name: "Clínica Alfa",
        primary_document: "123.456.789-00",
        secondary_document: "11999999999",
        metadata: { clinics_count: 1 },
        updated_at: "2026-09-01T10:00:00Z",
      },
      {
        item_id: "user-1",
        item_type: "account",
        title: "Dra. Maria",
        subtitle: "maria@example.com",
        status: "paused",
        clinic_id: "clinic-2",
        clinic_name: "Clínica Beta",
        primary_document: "123.456.789-00",
        secondary_document: "11999999999",
        metadata: { clinics_count: 1 },
        updated_at: "2026-09-02T10:00:00Z",
      },
    ];

    const result = consolidateDirectoryItems(rawList);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("active");
    expect(result[0].metadata?.clinics_count).toBe(2);
    expect(result[0].metadata?.paused_clinics_count).toBe(1);
    expect(result[0].metadata?.has_mixed_statuses).toBe(true);
  });

  it("unifies status to 'active' when existing is paused and new item is active", () => {
    const rawList: PlatformDirectoryItem[] = [
      {
        item_id: "user-2",
        item_type: "account",
        title: "Dr. João",
        subtitle: "joao@example.com",
        status: "paused",
        clinic_id: "clinic-1",
        clinic_name: "Clínica Alfa",
        primary_document: "222.333.444-55",
        secondary_document: null,
        metadata: { clinics_count: 1 },
        updated_at: "2026-09-01T10:00:00Z",
      },
      {
        item_id: "user-2",
        item_type: "account",
        title: "Dr. João",
        subtitle: "joao@example.com",
        status: "active",
        clinic_id: "clinic-2",
        clinic_name: "Clínica Beta",
        primary_document: "222.333.444-55",
        secondary_document: null,
        metadata: { clinics_count: 1 },
        updated_at: "2026-09-02T10:00:00Z",
      },
    ];

    const result = consolidateDirectoryItems(rawList);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("active");
    expect(result[0].metadata?.clinics_count).toBe(2);
    expect(result[0].metadata?.paused_clinics_count).toBe(1);
    expect(result[0].metadata?.has_mixed_statuses).toBe(true);
  });

  it("consolidates multiple clinics when data comes with clinics list metadata from backend", () => {
    const rawList: PlatformDirectoryItem[] = [
      {
        item_id: "user-3",
        item_type: "account",
        title: "Dra. Ana",
        subtitle: "ana@example.com",
        status: "active",
        clinic_id: "clinic-1",
        clinic_name: "Clínica Alfa",
        primary_document: "333.444.555-66",
        secondary_document: null,
        metadata: {
          clinics_count: 2,
          clinics: [
            { clinic_id: "clinic-1", clinic_name: "Clínica Alfa", status: "active" },
            { clinic_id: "clinic-2", clinic_name: "Clínica Beta", status: "paused" },
          ],
        },
        updated_at: "2026-09-01T10:00:00Z",
      },
    ];

    const result = consolidateDirectoryItems(rawList);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("active");
    expect(result[0].metadata?.paused_clinics_count).toBe(1);
    expect(result[0].metadata?.has_mixed_statuses).toBe(true);
  });

  it("keeps paused status when all clinics are paused", () => {
    const rawList: PlatformDirectoryItem[] = [
      {
        item_id: "user-4",
        item_type: "account",
        title: "Carlos",
        subtitle: "carlos@example.com",
        status: "paused",
        clinic_id: "clinic-1",
        clinic_name: "Clínica Alfa",
        primary_document: "444.555.666-77",
        secondary_document: null,
        metadata: { clinics_count: 1 },
        updated_at: "2026-09-01T10:00:00Z",
      },
      {
        item_id: "user-4",
        item_type: "account",
        title: "Carlos",
        subtitle: "carlos@example.com",
        status: "paused",
        clinic_id: "clinic-2",
        clinic_name: "Clínica Beta",
        primary_document: "444.555.666-77",
        secondary_document: null,
        metadata: { clinics_count: 1 },
        updated_at: "2026-09-02T10:00:00Z",
      },
    ];

    const result = consolidateDirectoryItems(rawList);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("paused");
    expect(result[0].metadata?.clinics_count).toBe(2);
    expect(result[0].metadata?.paused_clinics_count).toBe(2);
    expect(result[0].metadata?.has_mixed_statuses).toBe(false);
  });

  it("preserves non-account items without interference", () => {
    const rawList: PlatformDirectoryItem[] = [
      {
        item_id: "clinic-10",
        item_type: "clinic",
        title: "Clínica Harmonia",
        subtitle: "harmonia@example.com",
        status: "active",
        clinic_id: "clinic-10",
        clinic_name: "Clínica Harmonia",
        primary_document: "12.345.678/0001-90",
        secondary_document: null,
        metadata: { team_count: 5 },
        updated_at: "2026-09-01T10:00:00Z",
      },
      {
        item_id: "patient-20",
        item_type: "patient",
        title: "Paciente Exemplo",
        subtitle: null,
        status: "active",
        clinic_id: "clinic-10",
        clinic_name: "Clínica Harmonia",
        primary_document: "555.666.777-88",
        secondary_document: null,
        metadata: null,
        updated_at: "2026-09-01T10:00:00Z",
      },
    ];

    const result = consolidateDirectoryItems(rawList);
    expect(result).toHaveLength(2);
    expect(result[0].item_type).toBe("clinic");
    expect(result[1].item_type).toBe("patient");
  });

  it("handles empty list gracefully", () => {
    const result = consolidateDirectoryItems([]);
    expect(result).toEqual([]);
  });
});

describe("DirectoryCard status badges rendering", () => {
  const mockOnClick = vi.fn();

  it("renders 'Ativo' badge and complementary '1 clínica pausada' when user has mixed status", () => {
    const item: PlatformDirectoryItem = {
      item_id: "user-1",
      item_type: "account",
      title: "Dra. Maria",
      subtitle: "maria@example.com",
      status: "active",
      clinic_id: "clinic-1",
      clinic_name: "Clínica Alfa",
      primary_document: "123.456.789-00",
      secondary_document: null,
      metadata: {
        clinics_count: 2,
        paused_clinics_count: 1,
        has_mixed_statuses: true,
      },
      updated_at: "2026-09-01T10:00:00Z",
    };

    render(<DirectoryCard item={item} onClick={mockOnClick} />);

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("1 clínica pausada")).toBeInTheDocument();
    expect(screen.getByText("2 clínicas associadas")).toBeInTheDocument();
  });

  it("renders 'Ativo' and plural '2 clínicas pausadas' when 2 clinics are paused", () => {
    const item: PlatformDirectoryItem = {
      item_id: "user-2",
      item_type: "account",
      title: "Dr. Roberto",
      subtitle: "roberto@example.com",
      status: "active",
      clinic_id: "clinic-1",
      clinic_name: "Clínica Central",
      primary_document: "123.456.789-00",
      secondary_document: null,
      metadata: {
        clinics_count: 3,
        paused_clinics_count: 2,
        has_mixed_statuses: true,
      },
      updated_at: "2026-09-01T10:00:00Z",
    };

    render(<DirectoryCard item={item} onClick={mockOnClick} />);

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.getByText("2 clínicas pausadas")).toBeInTheDocument();
    expect(screen.getByText("3 clínicas associadas")).toBeInTheDocument();
  });

  it("renders only 'Ativo' when all clinics are active without paused ones", () => {
    const item: PlatformDirectoryItem = {
      item_id: "user-3",
      item_type: "account",
      title: "Dra. Lucia",
      subtitle: "lucia@example.com",
      status: "active",
      clinic_id: "clinic-1",
      clinic_name: "Clínica Alfa",
      primary_document: "123.456.789-00",
      secondary_document: null,
      metadata: {
        clinics_count: 2,
        paused_clinics_count: 0,
        has_mixed_statuses: false,
      },
      updated_at: "2026-09-01T10:00:00Z",
    };

    render(<DirectoryCard item={item} onClick={mockOnClick} />);

    expect(screen.getByText("Ativo")).toBeInTheDocument();
    expect(screen.queryByText(/pausada/i)).not.toBeInTheDocument();
  });

  it("renders 'Pausado' badge when user status is paused", () => {
    const item: PlatformDirectoryItem = {
      item_id: "user-4",
      item_type: "account",
      title: "Dr. Pedro",
      subtitle: "pedro@example.com",
      status: "paused",
      clinic_id: "clinic-1",
      clinic_name: "Clínica Beta",
      primary_document: "123.456.789-00",
      secondary_document: null,
      metadata: {
        clinics_count: 1,
      },
      updated_at: "2026-09-01T10:00:00Z",
    };

    render(<DirectoryCard item={item} onClick={mockOnClick} />);

    expect(screen.getByText("Pausado")).toBeInTheDocument();
  });

  it("renders DirectoryPill component correctly", () => {
    render(<DirectoryPill icon={Building2} label="Total de Clínicas" value={42} />);
    expect(screen.getByText("Total de Clínicas")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});

describe("PlatformDirectoryPage Big-O & Efficiency benchmarks", () => {
  it("executes consolidateDirectoryItems in O(N) linear time for large datasets (5,000 items)", () => {
    const itemCount = 5000;
    const mockList: PlatformDirectoryItem[] = [];

    for (let i = 0; i < itemCount; i++) {
      const isAccount = i % 2 === 0;
      const userId = `user-${i % 500}`; // Simulates 500 distinct users with multiple entries
      mockList.push({
        item_id: isAccount ? userId : `clinic-${i}`,
        item_type: isAccount ? "account" : "clinic",
        title: `Item ${i}`,
        subtitle: `item${i}@example.com`,
        status: i % 3 === 0 ? "active" : "paused",
        clinic_id: `clinic-${i % 20}`,
        clinic_name: `Clínica ${i % 20}`,
        primary_document: "123.456.789-00",
        secondary_document: null,
        metadata: isAccount
          ? {
              clinics_count: 1,
              clinics: [
                {
                  clinic_id: `clinic-${i % 20}`,
                  clinic_name: `Clínica ${i % 20}`,
                  status: i % 3 === 0 ? "active" : "paused",
                },
              ],
            }
          : { team_count: 10 },
        updated_at: "2026-09-01T10:00:00Z",
      });
    }

    const start = performance.now();
    const consolidated = consolidateDirectoryItems(mockList);
    const durationMs = performance.now() - start;

    expect(consolidated.length).toBeLessThan(itemCount);
    // 5,000 items must be consolidated in strictly under 80ms
    expect(durationMs).toBeLessThan(80);
  });

  it("merges clinics lists safely without losing entries when consolidating duplicates", () => {
    const rawList: PlatformDirectoryItem[] = [
      {
        item_id: "user-merge-1",
        item_type: "account",
        title: "Dra. Paula",
        subtitle: "paula@example.com",
        status: "paused",
        clinic_id: "clinic-a",
        clinic_name: "Clínica A",
        primary_document: "111.222.333-44",
        secondary_document: null,
        metadata: {
          clinics_count: 1,
          clinics: [{ clinic_id: "clinic-a", clinic_name: "Clínica A", status: "paused" }],
        },
        updated_at: "2026-09-01T10:00:00Z",
      },
      {
        item_id: "user-merge-1",
        item_type: "account",
        title: "Dra. Paula",
        subtitle: "paula@example.com",
        status: "active",
        clinic_id: "clinic-b",
        clinic_name: "Clínica B",
        primary_document: "111.222.333-44",
        secondary_document: null,
        metadata: {
          clinics_count: 1,
          clinics: [{ clinic_id: "clinic-b", clinic_name: "Clínica B", status: "active" }],
        },
        updated_at: "2026-09-02T10:00:00Z",
      },
    ];

    const result = consolidateDirectoryItems(rawList);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("active");
    expect(result[0].metadata?.clinics_count).toBe(2);
    expect(result[0].metadata?.paused_clinics_count).toBe(1);
    expect(result[0].metadata?.has_mixed_statuses).toBe(true);

    const mergedClinics = result[0].metadata?.clinics as Array<{ clinic_id: string }>;
    expect(mergedClinics).toBeDefined();
    expect(mergedClinics).toHaveLength(2);
  });
});

