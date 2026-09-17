import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FormEditorConfigModal } from "./FormEditorConfigModal";

const supabaseMocks = vi.hoisted(() => ({
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: supabaseMocks.from,
    rpc: supabaseMocks.rpc,
  },
}));

vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
}));

describe("FormEditorConfigModal", () => {
  beforeEach(() => {
    supabaseMocks.from.mockReset();
    supabaseMocks.rpc.mockReset();

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    });

    supabaseMocks.from.mockReturnValue({
      select: mockSelect,
    });
  });

  it("renders 4 tabs and components successfully", () => {
    render(
      <FormEditorConfigModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: /Editor de Formulários/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Componentes/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Propriedades/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Menus/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Opções por Menu/i })).toBeInTheDocument();

    // Check components
    expect(screen.getByText("Texto curto")).toBeInTheDocument();
    expect(screen.getByText("Tabela")).toBeInTheDocument();
    expect(screen.getByText("Bloco de Endereço")).toBeInTheDocument();
  });

  it("switches to properties tab and toggles switches", () => {
    render(
      <FormEditorConfigModal
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Propriedades/i }));
    expect(screen.getByText("Obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Resumo do paciente")).toBeInTheDocument();
    expect(screen.getByText("Dashboard global")).toBeInTheDocument();
    expect(screen.getByText("Filtrar")).toBeInTheDocument();
    expect(screen.getByText("Agrupar")).toBeInTheDocument();
  });

  it("saves changes via supabase RPC", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <FormEditorConfigModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    const saveBtn = screen.getByRole("button", { name: /Salvar Configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith(
        "upsert_feature_flag",
        expect.objectContaining({
          _key: "forms_editor",
          _description: "Editor de Formulários",
        })
      );
      expect(onSave).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("validates scope requirements and rejects missing tag_id for tag scope", async () => {
    render(
      <FormEditorConfigModal
        isOpen={true}
        onClose={vi.fn()}
        scope="tag"
      />
    );

    const saveBtn = screen.getByRole("button", { name: /Salvar Configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).not.toHaveBeenCalled();
    });
  });

  it("sanitizes payload and passes correct scope to RPC for clinic scope", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null });
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(
      <FormEditorConfigModal
        isOpen={true}
        onClose={onClose}
        onSave={onSave}
        scope="clinic"
        clinicId="clinic-uuid-123"
        initialData={{
          components: { short_text: true, unknown_injection: true } as unknown as Record<string, boolean>,
        }}
      />
    );

    const saveBtn = screen.getByRole("button", { name: /Salvar Configurações/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(supabaseMocks.rpc).toHaveBeenCalledWith(
        "upsert_feature_flag",
        expect.objectContaining({
          _key: "forms_editor",
          _scope: "clinic",
          _clinic_id: "clinic-uuid-123",
          _tag_id: undefined,
          _value: expect.objectContaining({
            components: expect.not.objectContaining({
              unknown_injection: true,
            }),
          }),
        })
      );
    });
  });
});

