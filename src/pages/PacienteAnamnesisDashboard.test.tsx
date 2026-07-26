import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PacienteAnamnesisDashboard from "@/pages/PacienteAnamnesisDashboard";
import { useAuth } from "@/hooks/useAuth";

const navigateMock = vi.fn();

const ensureLocalStorage = () => {
  if (window.localStorage) {
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
    flags: { dashboards_patient: true },
    loading: false,
    isFeatureEnabled: (key: string) => key === "dashboards_patient",
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
    expect(screen.getByText("Maria Silva")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bloco padrão" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ficha ortopédica" })).toBeInTheDocument();
    expect(screen.getByText("Mobilidade")).toBeInTheDocument();
    expect(screen.getByText("Retorno com menos dor.")).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "bar" } });

    await waitFor(() => {
      expect(window.localStorage.getItem("therapy-flow:patient-anamnesis-dashboard:v1:clinic-1:patient-1")).toContain("\"base:pain_score\":\"bar\"");
    });

    fireEvent.change(selects[0], { target: { value: "template-1" } });
    expect(screen.queryByRole("heading", { name: "Bloco padrão" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ficha ortopédica" })).toBeInTheDocument();
  });
});
