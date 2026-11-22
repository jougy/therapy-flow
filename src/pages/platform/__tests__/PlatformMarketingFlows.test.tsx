import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PlatformMarketingFlowsView } from "../marketing-flows/PlatformMarketingFlowsView";

window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

const mockToast = vi.fn();
vi.mock("@/hooks/use-toast", () => ({
  toast: (...args: unknown[]) => mockToast(...args),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(async () => ({ data: { success: true }, error: null })),
    },
    from: vi.fn(() => ({
      select: () => ({
        is: () => ({
          order: async () => ({ data: [], error: null }),
        }),
      }),
    })),
  },
}));

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-xyflow-canvas">{children}</div>
  ),
  Background: () => <div />,
  Controls: () => <div />,
  MiniMap: () => <div />,
  Handle: () => <div />,
  Position: { Left: "left", Right: "right", Top: "top", Bottom: "bottom" },
  addEdge: (edge: unknown, edges: unknown[]) => [...edges, edge],
  useNodesState: (initial: unknown[]) => {
    const [nodes, setNodes] = React.useState(initial);
    return [nodes, setNodes, vi.fn()];
  },
  useEdgesState: (initial: unknown[]) => {
    const [edges, setEdges] = React.useState(initial);
    return [edges, setEdges, vi.fn()];
  },
}));

const TabsContext = React.createContext<{
  activeValue?: string;
  onValueChange?: (v: string) => void;
}>({});

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children, value, onValueChange, ...props }: any) => (
    <TabsContext.Provider value={{ activeValue: value, onValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  ),
  TabsList: ({ children, ...props }: any) => (
    <div role="tablist" {...props}>
      {children}
    </div>
  ),
  TabsTrigger: ({ value, children, ...props }: any) => {
    const { activeValue, onValueChange } = React.useContext(TabsContext);
    return (
      <button
        role="tab"
        type="button"
        aria-selected={value === activeValue}
        onClick={() => onValueChange?.(value)}
        {...props}
      >
        {children}
      </button>
    );
  },
  TabsContent: ({ value, children, ...props }: any) => {
    const { activeValue } = React.useContext(TabsContext);
    if (value !== activeValue) return null;
    return (
      <div role="tabpanel" {...props}>
        {children}
      </div>
    );
  },
}));

describe("PlatformMarketingFlowsView — Botzom Visual Builder & TypeZap", () => {
  it("renderiza Botzom Visual Builder, alterna para TypeZap e executa template DAG com checkpoints", async () => {
    render(<PlatformMarketingFlowsView />);

    expect(screen.getByTestId("platform-marketing-flows-view")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("mock-xyflow-canvas")).toBeInTheDocument();
    });

    // Subaba TypeZap
    fireEvent.click(screen.getByRole("tab", { name: /TypeZap/i }));
    await waitFor(() => {
      expect(screen.getByText(/Typebot Qualificação Pluri Fisio/i)).toBeInTheDocument();
    });

    // Subaba Templates Prontos + execução DAG
    fireEvent.click(screen.getByRole("tab", { name: /Templates Prontos/i }));
    await waitFor(() => {
      expect(screen.getByTestId("marketing-flow-card-flow-sdr-hunt")).toBeInTheDocument();
    });

    const runButtons = screen.getAllByRole("button", { name: /Executar Agora/i });
    fireEvent.click(runButtons[0]);

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: expect.stringMatching(/Execução DAG concluída/i) }),
      );
    });
  });
});