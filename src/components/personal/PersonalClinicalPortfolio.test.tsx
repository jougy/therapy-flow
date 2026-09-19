import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { PersonalClinicalPortfolioTab } from "@/components/personal/PersonalClinicalPortfolioTab";
import { PersonalClinicalPortfolioModal } from "@/components/personal/PersonalClinicalPortfolioModal";
import { PortfolioCompactSessionCard } from "@/components/personal/PortfolioCompactSessionCard";
import { ClinicalRecordEvolutionModal } from "@/components/personal/ClinicalRecordEvolutionModal";
import { formatPatientPseudonym, formatDemographics, sanitizeClinicalText, calculatePortfolioMetrics } from "@/lib/clinical-portfolio";
import type { ClinicalPortfolioItem } from "@/types/clinicalPortfolio";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import * as portfolioService from "@/services/clinicalPortfolioService";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockPortfolioItems: ClinicalPortfolioItem[] = [
  {
    id: "session-1",
    clinic_id: "clinic-alfa",
    clinic_name: "Clínica Alfa",
    patient_id: "patient-1",
    patient_pseudonym: "Paciente M. R. S.",
    patient_demographics: "34 anos • Feminino",
    session_date: "2026-09-10T14:30:00.000Z",
    scheduled_start_at: "2026-09-10T14:30:00.000Z",
    pain_score: 6,
    complexity_score: 3,
    notes_sanitized: "Paciente relata melhora na mobilidade articular após liberação miofascial.",
    treatment_sanitized: "Exercícios de estabilização escapular (3x12) e crioterapia.",
    status: "concluido",
    tags: [{ id: "tag-1", name: "Coluna Cervical", color: "#86EFAC" }],
  },
  {
    id: "session-2",
    clinic_id: "clinic-beta",
    clinic_name: "Clínica Beta Fisio",
    patient_id: "patient-2",
    patient_pseudonym: "Paciente J. C. O.",
    patient_demographics: "45 anos • Masculino",
    session_date: "2026-09-12T10:00:00.000Z",
    scheduled_start_at: "2026-09-12T10:00:00.000Z",
    pain_score: 2,
    complexity_score: 1,
    notes_sanitized: "Quadro álgico controlado, boa amplitude de movimento.",
    treatment_sanitized: "Alongamento global e reeducação postural.",
    status: "concluido",
  },
  {
    id: "session-3",
    clinic_id: "clinic-alfa",
    clinic_name: "Clínica Alfa",
    patient_id: "patient-3",
    patient_pseudonym: "Paciente A. L.",
    patient_demographics: "28 anos • Feminino",
    session_date: "2026-09-13T16:00:00.000Z",
    scheduled_start_at: "2026-09-13T16:00:00.000Z",
    pain_score: 8,
    complexity_score: 4,
    notes_sanitized: "Pós-operatório de LCA, dor moderada a intensa na flexão.",
    treatment_sanitized: "Drenagem linfática e mobilização passiva suave.",
    status: "concluido",
  },
];

const mockBaseSchemaWithShowInPatientList: AnamnesisTemplateSchema = [
  {
    id: "eva_field",
    label: "Escala EVA",
    type: "slider",
    min: 0,
    max: 10,
    systemKey: "pain_score",
    showInPatientList: true,
  },
];

const mockBaseSchemaWithoutShowInPatientList: AnamnesisTemplateSchema = [
  {
    id: "eva_field",
    label: "Escala EVA",
    type: "slider",
    min: 0,
    max: 10,
    systemKey: "pain_score",
    showInPatientList: false,
  },
];

describe("PersonalClinicalPortfolio - Helpers & Sanitization", () => {
  it("generates LGPD-compliant patient pseudonym from full name", () => {
    expect(formatPatientPseudonym("Maria Rita Souza")).toBe("Paciente M. R. S.");
    expect(formatPatientPseudonym("João Carlos")).toBe("Paciente J. C.");
    expect(formatPatientPseudonym("")).toBe("Paciente Anônimo");
    expect(formatPatientPseudonym(null)).toBe("Paciente Anônimo");
    expect(formatPatientPseudonym("Paciente M. R. S.")).toBe("Paciente M. R. S.");
  });

  it("formats patient demographics accurately", () => {
    expect(formatDemographics(34, "Feminino")).toBe("34 anos • Feminino");
    expect(formatDemographics(1, "masculino")).toBe("1 ano • Masculino");
    expect(formatDemographics(null, "Feminino")).toBe("Feminino");
    expect(formatDemographics(45, null)).toBe("45 anos");
    expect(formatDemographics(null, null)).toBe("Perfil não informado");
  });

  it("sanitizes sensitive identifying information from clinical notes for LGPD compliance", () => {
    const rawNote = "Paciente portador do CPF 123.456.789-00, contato pelo email maria@gmail.com ou tel (11) 98765-4321.";
    const sanitized = sanitizeClinicalText(rawNote);

    expect(sanitized).not.toContain("123.456.789-00");
    expect(sanitized).not.toContain("maria@gmail.com");
    expect(sanitized).not.toContain("98765-4321");
    expect(sanitized).toContain("[CPF OMITIDO - LGPD]");
    expect(sanitized).toContain("[E-MAIL OMITIDO - LGPD]");
    expect(sanitized).toContain("[CONTATO OMITIDO - LGPD]");
  });

  it("calculates accurate aggregate metrics", () => {
    const metrics = calculatePortfolioMetrics(mockPortfolioItems);
    expect(metrics.totalAttendances).toBe(3);
    expect(metrics.totalClinics).toBe(2); // Alfa & Beta
    expect(metrics.averagePainScore).toBe(5.3);
    expect(metrics.averageComplexityScore).toBe(2.7);
  });
});

describe("PortfolioCompactSessionCard Component", () => {
  it("renders compact format with border, clinic badge, LGPD pseudonym, demographics and tags", () => {
    render(
      <PortfolioCompactSessionCard
        session={mockPortfolioItems[0]}
        baseSchema={mockBaseSchemaWithShowInPatientList}
      />
    );

    expect(screen.getByText("Paciente M. R. S. • 34 anos • Feminino")).toBeInTheDocument();
    expect(screen.getByText("Clínica Alfa")).toBeInTheDocument();
    expect(screen.getByText("concluido")).toBeInTheDocument();
    expect(screen.getByText("Coluna Cervical")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Abrir atendimento/i })).toBeInTheDocument();
  });

  it("renders real full patient name when available instead of pseudonym", () => {
    const itemWithRealName: ClinicalPortfolioItem = {
      ...mockPortfolioItems[0],
      patient_name: "Eduardo Henrique Vianna",
    };

    render(
      <PortfolioCompactSessionCard
        session={itemWithRealName}
        baseSchema={mockBaseSchemaWithShowInPatientList}
      />
    );

    expect(screen.getByText("Eduardo Henrique Vianna • 34 anos • Feminino")).toBeInTheDocument();
  });

  it("renders dynamic indicator only when showInPatientList is true", () => {
    const { rerender } = render(
      <PortfolioCompactSessionCard
        session={mockPortfolioItems[0]}
        baseSchema={mockBaseSchemaWithShowInPatientList}
      />
    );

    // Indicator rendered because showInPatientList: true
    expect(screen.getByTestId("preview-indicator-compact")).toBeInTheDocument();
    expect(screen.getByText("EVA:")).toBeInTheDocument();
    expect(screen.getByText("6/10")).toBeInTheDocument();

    // Rerender with schema where showInPatientList: false -> indicator must NOT be rendered
    rerender(
      <PortfolioCompactSessionCard
        session={mockPortfolioItems[0]}
        baseSchema={mockBaseSchemaWithoutShowInPatientList}
      />
    );

    expect(screen.queryByTestId("preview-indicator-compact")).not.toBeInTheDocument();
  });

  it("expands inline panel when clicking chevron with Queixa principal and Tratamento tabs", () => {
    render(
      <PortfolioCompactSessionCard
        session={mockPortfolioItems[0]}
        baseSchema={mockBaseSchemaWithShowInPatientList}
      />
    );

    expect(screen.queryByTestId("expanded-panel-session-1")).not.toBeInTheDocument();

    const toggleBtn = screen.getByTestId("toggle-expand-btn-session-1");
    fireEvent.click(toggleBtn);

    expect(screen.getByTestId("expanded-panel-session-1")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Queixa principal/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Tratamento/i })).toBeInTheDocument();
    expect(screen.getByText(/liberação miofascial/i)).toBeInTheDocument();

    // Switch to Tratamento tab
    fireEvent.click(screen.getByRole("tab", { name: /Tratamento/i }));
    expect(screen.getByText(/estabilização escapular/i)).toBeInTheDocument();
  });

  it("calls onViewDetails when clicking card or pressing Enter/Space without toggling inline panel", () => {
    const onViewDetails = vi.fn();
    render(
      <PortfolioCompactSessionCard
        session={mockPortfolioItems[0]}
        baseSchema={mockBaseSchemaWithShowInPatientList}
        onViewDetails={onViewDetails}
      />
    );

    const card = screen.getByTestId("portfolio-compact-card-session-1");
    fireEvent.click(card);

    expect(onViewDetails).toHaveBeenCalledTimes(1);
    expect(onViewDetails).toHaveBeenCalledWith(mockPortfolioItems[0]);
    // Clicking card should NOT open inline panel
    expect(screen.queryByTestId("expanded-panel-session-1")).not.toBeInTheDocument();

    // Keydown Enter on Card
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onViewDetails).toHaveBeenCalledTimes(2);

    // Keydown Space on Card
    fireEvent.keyDown(card, { key: " " });
    expect(onViewDetails).toHaveBeenCalledTimes(3);

    // Clicking chevron toggles inline panel and stops propagation (does not trigger onViewDetails)
    const toggleBtn = screen.getByTestId("toggle-expand-btn-session-1");
    fireEvent.click(toggleBtn);
    expect(screen.getByTestId("expanded-panel-session-1")).toBeInTheDocument();
    expect(onViewDetails).toHaveBeenCalledTimes(3);

    // Clicking view-details-btn triggers onViewDetails
    const detailsBtn = screen.getByTestId("view-details-btn-session-1");
    fireEvent.click(detailsBtn);
    expect(onViewDetails).toHaveBeenCalledTimes(4);
  });
});

describe("PersonalClinicalPortfolioTab Component", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the institutional LGPD banner", () => {
    render(<PersonalClinicalPortfolioTab initialItems={mockPortfolioItems} />);

    expect(screen.getByText("Acervo Técnico Profissional")).toBeInTheDocument();
    expect(
      screen.getByText(/Registro dos atendimentos e evoluções clínicas realizados sob sua responsabilidade técnica/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/dados de contato e identificação civil de pacientes são pseudonimizados/i)).toBeInTheDocument();
  });

  it("displays metric cards with consistent full-screen KPIs: Total, Clínicas, Concluídos", () => {
    render(<PersonalClinicalPortfolioTab initialItems={mockPortfolioItems} />);

    expect(screen.getByTestId("metric-total-attendances")).toHaveTextContent("3");
    expect(screen.getByTestId("metric-total-clinics")).toHaveTextContent("2");
    expect(screen.getByTestId("metric-completed-attendances")).toHaveTextContent("3");
    expect(screen.queryByTestId("metric-averages")).not.toBeInTheDocument();
  });

  it("renders list of attendance items in compact card format", () => {
    render(<PersonalClinicalPortfolioTab initialItems={mockPortfolioItems} />);

    expect(screen.getByText("Paciente M. R. S. • 34 anos • Feminino")).toBeInTheDocument();
    expect(screen.getAllByText("Clínica Alfa").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Paciente J. C. O. • 45 anos • Masculino")).toBeInTheDocument();
    expect(screen.getByText("Clínica Beta Fisio")).toBeInTheDocument();
  });

  it("filters attendances by search keyword", () => {
    render(<PersonalClinicalPortfolioTab initialItems={mockPortfolioItems} />);

    const searchInput = screen.getByTestId("portfolio-search-input");
    fireEvent.change(searchInput, { target: { value: "miofascial" } });

    expect(screen.getByText(/Paciente M. R. S./)).toBeInTheDocument();
    expect(screen.queryByText(/Paciente J. C. O./)).not.toBeInTheDocument();
    expect(screen.queryByText(/Paciente A. L./)).not.toBeInTheDocument();
  });

  it("formats patient demographics with dateOfBirth fallback when age is omitted", () => {
    const birthYear = new Date().getFullYear() - 30;
    const dob = `${birthYear}-01-01`;
    const result = formatDemographics(null, "Feminino", dob);
    expect(result).toBe("30 anos • Feminino");
  });

  it("fetches data automatically when userId is provided without initialItems", async () => {
    vi.spyOn(portfolioService, "fetchPersonalClinicalPortfolio").mockResolvedValue(mockPortfolioItems);

    render(<PersonalClinicalPortfolioTab userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText(/Paciente M. R. S./)).toBeInTheDocument();
    });

    expect(portfolioService.fetchPersonalClinicalPortfolio).toHaveBeenCalledWith("user-123");
  });

  it("displays error recovery state when data fetching fails and allows retry", async () => {
    const fetchSpy = vi.spyOn(portfolioService, "fetchPersonalClinicalPortfolio")
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce(mockPortfolioItems);

    render(<PersonalClinicalPortfolioTab userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByTestId("portfolio-error-state")).toBeInTheDocument();
    });

    expect(screen.getByText("Não foi possível carregar seu acervo técnico")).toBeInTheDocument();

    const retryBtn = screen.getByRole("button", { name: /tentar novamente/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText(/Paciente M. R. S./)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

describe("PersonalClinicalPortfolioModal Component", () => {
  it("renders when open is true and contains the portfolio tab", () => {
    const onOpenChange = vi.fn();

    render(
      <PersonalClinicalPortfolioModal
        open={true}
        onOpenChange={onOpenChange}
        initialItems={mockPortfolioItems}
      />
    );

    expect(screen.getByTestId("personal-clinical-portfolio-modal")).toBeInTheDocument();
    expect(screen.getByText("Meu Portfólio Clínico")).toBeInTheDocument();
    expect(screen.getByText(/Paciente M. R. S./)).toBeInTheDocument();
  });
});

describe("ClinicalRecordEvolutionModal Component", () => {
  const itemWithFormResponse: ClinicalPortfolioItem = {
    ...mockPortfolioItems[0],
    anamnesis_form_response: {
      nivel_dor: "Dor Moderada",
      exercicios_prescritos: "Fortalecimento de manguito rotador",
    },
  };

  it("navigates directly to session detail page when clicking card in PersonalClinicalPortfolioTab", async () => {
    mockNavigate.mockClear();
    const itemWithRouteKeys: ClinicalPortfolioItem = {
      ...mockPortfolioItems[0],
      clinic_route_key: "clinica-alfa-sp",
      patient_ref: "PAC-001",
    };

    render(
      <MemoryRouter>
        <PersonalClinicalPortfolioTab initialItems={[itemWithRouteKeys]} />
      </MemoryRouter>
    );

    // Click the card
    const card = screen.getByTestId("portfolio-compact-card-session-1");
    fireEvent.click(card);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/espacopessoal/portfolio/session-1");
  });

  it("renders ClinicalRecordEvolutionModal directly with read-only and responsive layout", () => {
    const onOpenChange = vi.fn();
    render(
      <ClinicalRecordEvolutionModal
        item={itemWithFormResponse}
        open={true}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByTestId("clinical-record-evolution-modal")).toBeInTheDocument();
    expect(screen.getByText("Somente leitura")).toBeInTheDocument();

    const closeBtn = screen.getByTestId("close-evolution-modal");
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
