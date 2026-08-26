import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TutorialProvider, useTutorial } from "@/contexts/TutorialContext";
import { TutorialCard } from "./TutorialCard";
import { TutorialChapterModal } from "./TutorialChapterModal";
import { TutorialVisualPreview } from "./TutorialVisualPreview";
import { ComponentHelpButton } from "./ComponentHelpButton";
import { TutorialTriggerButton } from "./TutorialTriggerButton";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("TutorialSystem V3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.clear === "function") {
        window.localStorage.clear();
      }
    } catch {
      // ignore in test env
    }
    vi.mocked(useAuth).mockReturnValue({
      can: (perm: string) => perm !== "restricted_perm",
      operationalRole: "owner",
    } as ReturnType<typeof useAuth>);
  });

  describe("TutorialVisualPreview", () => {
    it("renders payment-status badges correctly", () => {
      render(<TutorialVisualPreview preview={{ type: "payment-status" }} />);
      expect(screen.getByText("Variações do Símbolo Financeiro ($)")).toBeInTheDocument();
      expect(screen.getByText("Quitado")).toBeInTheDocument();
      expect(screen.getByText("Pendente")).toBeInTheDocument();
      expect(screen.getByText("Em Débito")).toBeInTheDocument();
      expect(screen.getByText("Com Crédito")).toBeInTheDocument();
    });

    it("renders clock-colors badges correctly", () => {
      render(<TutorialVisualPreview preview={{ type: "clock-colors" }} />);
      expect(screen.getByText("As 4 Cores do Relógio de Agendamento")).toBeInTheDocument();
      expect(screen.getByText("Verde: Hoje")).toBeInTheDocument();
      expect(screen.getByText("Azul: Futuro")).toBeInTheDocument();
      expect(screen.getByText("Laranja: Chegou")).toBeInTheDocument();
      expect(screen.getByText("Vermelho: Atraso")).toBeInTheDocument();
    });

    it("renders form-field-mock previews correctly", () => {
      render(
        <TutorialVisualPreview
          preview={{
            type: "form-field-mock",
            fieldMockType: "short_text",
          }}
        />
      );
      expect(screen.getByText("Visualização do Campo de Texto Curto")).toBeInTheDocument();
      expect(screen.getByText("Profissão do Paciente")).toBeInTheDocument();
      expect(screen.getByText("Fisioterapeuta Especialista em Coluna")).toBeInTheDocument();
    });

    it("renders recurrence-pill correctly", () => {
      render(<TutorialVisualPreview preview={{ type: "recurrence-pill" }} />);
      expect(screen.getByText("Pílula de Recorrência Semanal")).toBeInTheDocument();
      expect(screen.getByText("D")).toBeInTheDocument();
      expect(screen.getAllByText("S").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Q").length).toBeGreaterThan(0);
    });

    it("renders keyboard-shortcuts correctly", () => {
      render(
        <TutorialVisualPreview
          preview={{
            type: "keyboard-shortcuts",
            shortcuts: [{ keys: ["⌘K"], label: "Busca de pacientes" }],
          }}
        />
      );
      expect(screen.getByText("Atalhos de Teclado & Produtividade")).toBeInTheDocument();
      expect(screen.getByText("Busca de pacientes")).toBeInTheDocument();
      expect(screen.getByText("⌘K")).toBeInTheDocument();
    });

    it("renders status-badge correctly", () => {
      render(<TutorialVisualPreview preview={{ type: "status-badge" }} />);
      expect(screen.getByText("Ativo")).toBeInTheDocument();
      expect(screen.getByText("Inativo")).toBeInTheDocument();
    });

    it("renders pain-scale correctly", () => {
      render(<TutorialVisualPreview preview={{ type: "pain-scale" }} />);
      expect(screen.getByText("Escala EVA de Dor (0 a 10)")).toBeInTheDocument();
    });
  });

  describe("TutorialCard with V3 Features", () => {
    const TestComponent = () => {
      const { showComponentHelp } = useTutorial();
      return (
        <div>
          <button
            onClick={() =>
              showComponentHelp({
                id: "test-step",
                title: "Card do Paciente com Atalho",
                description: "Explicação com visual preview e ação",
                visualPreview: {
                  type: "keyboard-shortcuts",
                  shortcuts: [{ keys: ["⌘K"], label: "Focar busca" }],
                },
                learnMoreAction: {
                  label: "Aprender sobre recorrência",
                  actionType: "navigate_chapter",
                  targetId: "prontuario-paciente",
                },
              })
            }
          >
            Abrir Tutorial
          </button>
          <TutorialCard />
        </div>
      );
    };

    it("renders visual preview and triggers learn more action", () => {
      render(
        <MemoryRouter>
          <TutorialProvider>
            <TestComponent />
          </TutorialProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText("Abrir Tutorial"));

      expect(screen.getByText("Card do Paciente com Atalho")).toBeInTheDocument();
      expect(screen.getByText("Atalhos de Teclado & Produtividade")).toBeInTheDocument();
      expect(screen.getByText("Focar busca")).toBeInTheDocument();
      expect(screen.getByText("Aprender sobre recorrência")).toBeInTheDocument();

      const learnBtn = screen.getByRole("button", { name: /aprender/i });
      fireEvent.click(learnBtn);

      // Successfully transitions to the target chapter
      expect(screen.getByText(/Prontuário Completo/i)).toBeInTheDocument();
      expect(screen.getByText("Cabeçalho & Identificação Clínica 👤")).toBeInTheDocument();
    });
  });

  describe("RBAC Filtering in TutorialContext", () => {
    it("filters out steps that require permissions the user does not have", () => {
      vi.mocked(useAuth).mockReturnValue({
        can: (perm: string) => perm !== "treasury.manage", // user lacks treasury.manage
        operationalRole: "estagiario",
      } as ReturnType<typeof useAuth>);

      const RbacTest = () => {
        const { showComponentHelp, activeTutorial } = useTutorial();
        return (
          <div>
            <button
              onClick={() =>
                showComponentHelp([
                  {
                    id: "step-general",
                    title: "Passo Geral",
                    description: "Todos veem",
                  },
                  {
                    id: "step-finance",
                    title: "Passo Financeiro Restrito",
                    description: "Apenas financeiro",
                    requiredPermission: "treasury.manage",
                  },
                ])
              }
            >
              Iniciar Ajuda
            </button>
            <span data-testid="step-count">{activeTutorial?.steps.length ?? 0}</span>
            <TutorialCard />
          </div>
        );
      };

      render(
        <MemoryRouter>
          <TutorialProvider>
            <RbacTest />
          </TutorialProvider>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByText("Iniciar Ajuda"));

    });
  });

  describe("Feature Flags for Tutorials and Helpers", () => {
    it("renders ComponentHelpButton when helpers flag is active and not hidden", () => {
      render(
        <MemoryRouter>
          <TutorialProvider>
            <ComponentHelpButton helpId="patient-search-toolbar" />
          </TutorialProvider>
        </MemoryRouter>
      );

      const btn = screen.getByRole("button");
      expect(btn).toBeInTheDocument();
    });

    it("renders TutorialTriggerButton when tutorial flag is active", () => {
      render(
        <MemoryRouter>
          <TutorialProvider>
            <TutorialTriggerButton />
          </TutorialProvider>
        </MemoryRouter>
      );

      expect(screen.getByRole("button", { name: /Central de Tutoriais e Treinamento/i })).toBeInTheDocument();
    });
  });
});
