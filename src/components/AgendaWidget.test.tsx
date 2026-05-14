import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Children, isValidElement, type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AgendaWidget from "@/components/AgendaWidget";
import { useAuth } from "@/hooks/useAuth";

const navigateMock = vi.fn();

const supabaseMocks = vi.hoisted(() => ({
  deleteCalls: [] as Array<{ table: string; filters: Array<{ column: string; value: unknown }> }>,
  insertCalls: [] as Array<{ payload: Record<string, unknown>; table: string }>,
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
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const todayIso = today.toISOString();

  const agendaEvents = [
    {
      event_type: "atendimento",
      id: "agenda-1",
      patient_id: "patient-1",
      scheduled_for: todayIso,
      status: "aguardando_confirmacao",
      title: "Maria Silva",
    },
  ];

  const patients = [{ id: "patient-1", name: "Maria Silva" }];
  const patientGroups = [
    { group_kind: "cancelados", id: "group-cancelados", is_default: false, patient_id: "patient-1" },
  ];

  const createQueryBuilder = (table: string) => {
    let mode: "delete" | "insert" | "select" | "update" = "select";
    let payload: Record<string, unknown> = {};
    const filters: Array<{ column: string; value: unknown }> = [];

    const resolveData = () => {
      switch (table) {
        case "agenda_events":
          return agendaEvents;
        case "patients":
          return patients;
        case "patient_groups":
          return patientGroups;
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

        if (table === "agenda_events") {
          return {
            data: {
              event_type: "atendimento",
              id: "agenda-1",
              patient_id: "patient-1",
              scheduled_for: todayIso,
              status: payload.status ?? "aguardando_confirmacao",
              title: "Maria Silva",
            },
            error: null,
          };
        }

        return { data: null, error: null };
      }

      if (mode === "insert") {
        supabaseMocks.insertCalls.push({ payload, table });
        return {
          data: {
            id: table === "sessions" ? "session-1" : "agenda-2",
            ...payload,
          },
          error: null,
        };
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
      insert: (nextPayload: Record<string, unknown>) => {
        mode = "insert";
        payload = nextPayload;
        return builder;
      },
      order: () => builder,
      select: () => {
        if (mode !== "insert" && mode !== "update") {
          mode = "select";
        }
        return builder;
      },
      single: () => Promise.resolve(execute()),
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
    },
  };
});

describe("AgendaWidget", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    supabaseMocks.deleteCalls = [];
    supabaseMocks.insertCalls = [];
    supabaseMocks.updateCalls = [];
    vi.clearAllMocks();

    vi.mocked(useAuth).mockReturnValue({
      accountRole: null,
      can: () => true,
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
  });

  it("opens event details when clicking an agenda item", async () => {
    render(
      <MemoryRouter>
        <AgendaWidget />
      </MemoryRouter>
    );

    expect(await screen.findByText("Maria Silva")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Maria Silva"));

    expect(await screen.findByRole("heading", { name: "Maria Silva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /aplicar status/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /iniciar atendimento/i })).toBeInTheDocument();
  });

  it("creates a canceled session when canceling an event from the homepage agenda", async () => {
    render(
      <MemoryRouter>
        <AgendaWidget />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText("Maria Silva"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "cancelado" } });
    fireEvent.click(screen.getByRole("button", { name: /aplicar status/i }));

    await waitFor(() => {
      expect(supabaseMocks.updateCalls).toContainEqual({
        filters: [{ column: "id", value: "agenda-1" }],
        payload: { status: "cancelado" },
        table: "agenda_events",
      });
      expect(supabaseMocks.insertCalls).toContainEqual({
        payload: expect.objectContaining({
          group_id: "group-cancelados",
          patient_id: "patient-1",
          status: "cancelado",
          user_id: "owner-1",
        }),
        table: "sessions",
      });
    });
  });
});
