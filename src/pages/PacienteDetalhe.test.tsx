import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PacienteDetalhe from "@/pages/PacienteDetalhe";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const navigateMock = vi.fn();

const supabaseMocks = vi.hoisted(() => ({
  deleteCalls: [] as Array<{ table: string; filters: Array<{ column: string; value: unknown }> }>,
  from: vi.fn(),
  rpc: vi.fn(),
  updateCalls: [] as Array<{
    payload: Record<string, unknown>;
    table: string;
    filters: Array<{ column: string; value: unknown }>;
  }>,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
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

  const collectItems = (node: ReactNode): Array<{ label: string; value: string }> => {
    return Children.toArray(node).flatMap((child) => {
      if (!isValidElement<{ children?: ReactNode; value?: string }>(child)) {
        return [];
      }

      const childType = child.type as { displayName?: string };

      if (childType.displayName === "MockSelectItem") {
        return [
          {
            label: extractText(child.props.children),
            value: child.props.value ?? "",
          },
        ];
      }

      return collectItems(child.props.children);
    });
  };

  const Select = ({
    children,
    disabled,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => {
    const items = collectItems(children);

    return (
      <select
        disabled={disabled}
        onChange={(event) => onValueChange?.(event.target.value)}
        role="combobox"
        value={value ?? ""}
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
    );
  };

  const SelectTrigger = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const SelectValue = ({ children, placeholder }: { children?: ReactNode; placeholder?: string }) => <>{children ?? placeholder}</>;
  const SelectContent = ({ children }: { children?: ReactNode }) => <>{children}</>;
  const SelectItem = ({ children }: { children?: ReactNode }) => <>{children}</>;

  SelectItem.displayName = "MockSelectItem";

  return {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  };
});

vi.mock("@/integrations/supabase/client", () => {
  const patient = {
    age: 32,
    cpf: "12345678901",
    created_at: "2026-04-01T12:00:00.000Z",
    date_of_birth: "1994-04-01",
    email: "paciente@example.com",
    gender: "feminino",
    id: "patient-1",
    name: "Maria Silva",
    phone: "11999999999",
    pronoun: "ela/dela",
    rg: "1234567",
    status: "ativo",
  };

  const createQueryBuilder = (table: string) => {
    let mode: "delete" | "select" | "update" = "select";
    let payload: Record<string, unknown> = {};
    const filters: Array<{ column: string; value: unknown }> = [];

    const resolveData = () => {
      switch (table) {
        case "patients":
          return patient;
        case "patient_groups":
          return [];
        case "sessions":
          return [];
        case "clinics":
          return { anamnesis_base_schema: [] };
        case "profiles":
          return [];
        default:
          return [];
      }
    };

    const execute = () => {
      if (mode === "delete") {
        supabaseMocks.deleteCalls.push({ filters: [...filters], table });
        return { data: null, error: null };
      }

      if (mode === "update") {
        supabaseMocks.updateCalls.push({ filters: [...filters], payload, table });
        return { data: null, error: null };
      }

      return { data: resolveData(), error: null };
    };

    const builder = {
      delete: () => {
        mode = "delete";
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      },
      in: (column: string, values: unknown) => {
        filters.push({ column, value: values });
        return builder;
      },
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: resolveData(), error: null }),
      not: () => builder,
      order: () => builder,
      select: () => {
        mode = "select";
        return builder;
      },
      single: () => Promise.resolve({ data: resolveData(), error: null }),
      then: (
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(execute()).then(resolve, reject),
      update: (nextPayload: Record<string, unknown>) => {
        mode = "update";
        payload = nextPayload;
        return builder;
      },
    };

    return builder;
  };

  return {
    supabase: {
      from: vi.fn((table: string) => createQueryBuilder(table)),
      rpc: supabaseMocks.rpc,
    },
  };
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/pacientes/patient-1"]}>
      <Routes>
        <Route path="/pacientes/:id" element={<PacienteDetalhe />} />
      </Routes>
    </MemoryRouter>
  );

describe("PacienteDetalhe", () => {
  beforeEach(() => {
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false;
    }

    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {};
    }

    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {};
    }

    navigateMock.mockReset();
    supabaseMocks.deleteCalls = [];
    supabaseMocks.updateCalls = [];
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      accountRole: "account_owner",
      can: (capability) => capability !== "treasury.manage",
      capabilities: {} as never,
      clinic: null,
      clinicId: "clinic-1",
      isSuperAdmin: false,
      loading: false,
      membership: null,
      membershipStatus: "active",
      operationalRole: "owner",
      profile: null,
      refreshAuthState: vi.fn(async () => {}),
      session: null,
      signOut: vi.fn(async () => {}),
      subscriptionPlan: "clinic",
      user: {
        id: "owner-1",
      } as never,
    });

    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
  });

  it("shows the delete option for owner/admin flows", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Maria Silva" });

    expect(screen.getByRole("option", { name: "Excluir" })).toBeInTheDocument();
  });

  it("hides the delete option for non-admin flows", async () => {
    vi.mocked(useAuth).mockReturnValue({
      accountRole: null,
      can: () => false,
      capabilities: {} as never,
      clinic: null,
      clinicId: "clinic-1",
      isSuperAdmin: false,
      loading: false,
      membership: null,
      membershipStatus: "active",
      operationalRole: "professional",
      profile: null,
      refreshAuthState: vi.fn(async () => {}),
      session: null,
      signOut: vi.fn(async () => {}),
      subscriptionPlan: "clinic",
      user: {
        id: "professional-1",
      } as never,
    });

    renderPage();

    await screen.findByRole("heading", { name: "Maria Silva" });

    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "Excluir" })).not.toBeInTheDocument();
    });
  });

  it("confirms deletion, deletes the patient, and redirects to the homepage", async () => {
    renderPage();

    await screen.findByRole("heading", { name: "Maria Silva" });

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "delete" } });

    expect(await screen.findByRole("heading", { name: /excluir paciente/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^excluir$/i }));

    await waitFor(() => {
      expect(supabaseMocks.deleteCalls).toEqual([
        {
          filters: [{ column: "id", value: "patient-1" }],
          table: "patients",
        },
      ]);
    });

    expect(navigateMock).toHaveBeenCalledWith("/", {
      replace: true,
      state: {
        deletedPatientId: "patient-1",
        refreshPatientsAt: expect.any(Number),
      },
    });
    expect(toast).toHaveBeenCalledWith({ title: "Paciente excluído" });
  });
});
