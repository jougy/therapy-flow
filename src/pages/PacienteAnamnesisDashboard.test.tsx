import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PacienteAnamnesisDashboard from "@/pages/PacienteAnamnesisDashboard";
import { useAuth } from "@/hooks/useAuth";

const navigateMock = vi.fn();

const ensureLocalStorage = () => {
  if (window.localStorage && typeof window.localStorage.clear === "function") {
    return;
  }

  const storage = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

vi.mock("@/contexts/FeatureFlagsContext", () => ({
  useFeatureFlags: () => ({
    flags: { dashboards_patient: true, print_general: true },
    loading: false,
    isFeatureEnabled: (key: string) => key === "dashboards_patient" || key === "print_general",
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
    useParams: () => ({ id: "patient-1" }),
  };
});

vi.mock("recharts", () => {
  const Component = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    Area: Component,
    AreaChart: Component,
    Bar: Component,
    BarChart: Component,
    CartesianGrid: Component,
    Cell: Component,
    Line: Component,
    LineChart: Component,
    Pie: Component,
    PieChart: Component,
    PolarAngleAxis: Component,
    PolarGrid: Component,
    PolarRadiusAxis: Component,
    Radar: Component,
    RadarChart: Component,
    ResponsiveContainer: Component,
    XAxis: Component,
    YAxis: Component,
  };
});

vi.mock("@/components/ui/chart", () => ({
  ChartContainer: ({ children }: { children?: ReactNode }) => <div data-testid="chart">{children}</div>,
  ChartTooltip: () => null,
  ChartTooltipContent: () => null,
}));

vi.mock("@/components/ui/select", () => {
  const extractText = (node: ReactNode): string => {
    if (typeof node === "string" || typeof node === "number") {
      return String(node);
    }

    if (!node) {
      return "";
    }

    return Children.toArray(node)
      .map((child) => {
        if (isValidElement<{ children?: ReactNode }>(child)) {
          return extractText(child.props.children);
        }

        return extractText(child);
      })
      .join("")
      .trim();
  };

  const collectItems = (node: ReactNode): Array<{ label: string; value: string }> =>
    Children.toArray(node).flatMap((child) => {
      if (!isValidElement<{ children?: ReactNode; value?: string }>(child)) {
        return [];
      }

      const childType = child.type as { displayName?: string };
      if (childType.displayName === "MockSelectItem") {
        return [{ label: extractText(child.props.children), value: child.props.value ?? "" }];
      }

      return collectItems(child.props.children);
    });

  const Select = ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => {
    const items = collectItems(children);
    return (
      <select onChange={(event) => onValueChange?.(event.target.value)} role="combobox" value={value ?? ""}>
        {items.map((item) => (
          <option key={item.value} value={item.value}>{item.label}</option>
        ))}
      </select>
    );
  };

  const SelectTrigger = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const SelectValue = ({ children, placeholder }: { children?: ReactNode; placeholder?: string }) => <>{children ?? placeholder}</>;
  const SelectContent = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const SelectItem = ({ children }: { children?: ReactNode }) => <>{children}</>;
  SelectItem.displayName = "MockSelectItem";

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

vi.mock("@/integrations/supabase/client", () => {
  const patient = {
    age: 40,
    id: "patient-1",
    name: "Maria Silva",
    phone: "11999999999",
    registration_complete: true,
  };

  const clinic = {
    anamnesis_base_schema: [
      { id: "base_section", label: "Base", type: "section" },
      { groupKey: "base_section", id: "pain_score", label: "Dor", min: 0, max: 10, systemKey: "pain_score", type: "slider" },
    ],
  };

  const sessions = [
    {
      anamnesis: {},
      anamnesis_form_response: {
        mobility: "low",
        notes: "Paciente caminhou melhor.",
      },
      anamnesis_template_id: "template-1",
      complexity_score: null,
      id: "session-1",
      pain_score: 8,
      session_date: "2026-01-01T12:00:00.000Z",
      status: "concluído",
    },
    {
      anamnesis: {},
      anamnesis_form_response: {
        mobility: "high",
        notes: "Retorno com menos dor.",
      },
      anamnesis_template_id: "template-1",
      complexity_score: null,
      id: "session-2",
      pain_score: 5,
      session_date: "2026-01-03T12:00:00.000Z",
      status: "rascunho",
    },
    {
      anamnesis: {},
      anamnesis_form_response: {
        dim_str: 9,
        dim_agi: 7,
        dim_res: 8,
      },
      anamnesis_template_id: "template-radar",
      complexity_score: null,
      id: "session-3",
      pain_score: 2,
      session_date: "2026-01-05T12:00:00.000Z",
      status: "concluído",
    },
  ];

  const templates = [
    {
      id: "template-1",
      name: "Ficha ortopédica",
      schema: [
        { id: "template_section", label: "Avaliação", type: "section" },
        {
          groupKey: "template_section",
          id: "mobility",
          label: "Mobilidade",
          options: [
            { id: "low", label: "Baixa" },
            { id: "high", label: "Alta" },
          ],
          type: "select",
        },
        { groupKey: "template_section", id: "notes", label: "Notas", type: "long_text" },
      ],
    },
    {
      id: "template-radar",
      name: "Ficha de Status Clínico",
      schema: [
        { id: "radar_sec", label: "Polígono de Status", type: "radar_section" },
        { groupKey: "radar_sec", id: "dim_str", label: "Força", min: 0, max: 10, type: "slider" },
        { groupKey: "radar_sec", id: "dim_agi", label: "Agilidade", min: 0, max: 10, type: "slider" },
        { groupKey: "radar_sec", id: "dim_res", label: "Resistência", min: 0, max: 10, type: "slider" },
      ],
    },
  ];

  const createQuery = (table: string) => {
    const resolve = () => {
      if (table === "patients") return { data: patient, error: null };
      if (table === "clinics") return { data: clinic, error: null };
      if (table === "sessions") return { data: sessions, error: null };
      if (table === "anamnesis_form_templates") return { data: templates, error: null };
      return { data: [], error: null };
    };

    const query = {
      eq: () => query,
      in: () => query,
      order: () => query,
      select: () => query,
      single: () => Promise.resolve(resolve()),
      then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
        Promise.resolve(resolve()).then(onFulfilled, onRejected),
    };

    return query;
  };

  return {
    supabase: {
      from: (table: string) => createQuery(table),
    },
  };
});

describe("PacienteAnamnesisDashboard", () => {
  beforeEach(() => {
    ensureLocalStorage();
    vi.mocked(useAuth).mockReturnValue({
      clinic: { route_key: "clinica-teste" },
      clinicId: "clinic-1",
    } as ReturnType<typeof useAuth>);
    navigateMock.mockClear();
    window.localStorage.clear();
  });

  it("renders anamnesis dashboard data, filters by template, and stores chart preferences", async () => {
    render(
      <MemoryRouter>
        <PacienteAnamnesisDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText("Dashboard de Anamnese")).toBeInTheDocument();
    expect(screen.getAllByText("Maria Silva").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("heading", { name: "Bloco padrão" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("heading", { name: "Ficha ortopédica" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Mobilidade").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Retorno com menos dor.").length).toBeGreaterThanOrEqual(1);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "bar" } });

    await waitFor(() => {
      expect(window.localStorage.getItem("therapy-flow:patient-anamnesis-dashboard:v1:clinic-1:patient-1")).toContain("\"base:pain_score\":\"bar\"");
    });

    fireEvent.change(selects[0], { target: { value: "template-1" } });
    expect(screen.queryByRole("heading", { name: "Bloco padrão" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Ficha ortopédica" }).length).toBeGreaterThanOrEqual(1);
  });

  it("renders radar_section status polygon and allows switching chart views", async () => {
    render(
      <MemoryRouter>
        <PacienteAnamnesisDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText("Dashboard de Anamnese")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Ficha de Status Clínico" }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Polígono de Status").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Força:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Agilidade:").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Resistência:").length).toBeGreaterThanOrEqual(1);
  });

  it("renders print button and renders #print-patient-stats-root matching active configuration", async () => {
    vi.mocked(useAuth).mockReturnValue({
      can: () => true,
      clinic: { id: "clinic-1", name: "Clínica Pluri Teste", route_key: "clinica-teste" },
      clinicId: "clinic-1",
      profile: { full_name: "Dr. Terapeuta", email: "terapeuta@teste.com" },
      user: { email: "terapeuta@teste.com" },
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <PacienteAnamnesisDashboard />
      </MemoryRouter>
    );

    expect(await screen.findByText("Dashboard de Anamnese")).toBeInTheDocument();

    // Check print button presence
    const printButtons = screen.getAllByRole("button", { name: /imprimir/i });
    expect(printButtons.length).toBeGreaterThanOrEqual(1);

    // Verify print portal is rendered in document.body
    const printRoot = document.body.querySelector("#print-patient-stats-root");
    expect(printRoot).not.toBeNull();
    expect(printRoot).toHaveClass("print:block");
    expect(printRoot?.textContent).toContain("Clínica Pluri Teste");
    expect(printRoot?.textContent).toContain("Relatório de Evolução e Estatísticas de Anamnese");
    expect(printRoot?.textContent).toContain("Maria Silva");
    expect(printRoot?.textContent).toContain("Impresso por: Dr. Terapeuta");
    expect(printRoot?.textContent).toContain("Filtro de Fichas: Todas as fichas");

    // Change chart type on pain_score to bar
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "bar" } });

    // Print root should reflect active chart type (Barras)
    expect(printRoot?.textContent).toContain("Barras · Evolução numérica");

    // Change filter to template-1
    fireEvent.change(selects[0], { target: { value: "template-1" } });
    expect(printRoot?.textContent).toContain("Filtro de Fichas: Ficha ortopédica");
    expect(printRoot?.textContent).not.toContain("Bloco padrão");
    expect(printRoot?.textContent).toContain("Ficha ortopédica");
  });
});
