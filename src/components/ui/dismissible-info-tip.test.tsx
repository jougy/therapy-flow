import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DismissibleInfoTip } from "@/components/ui/dismissible-info-tip";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

describe("DismissibleInfoTip", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({
      user: { id: "test-user-123" },
    });
  });

  it("renders children text and info icon when not dismissed", () => {
    render(
      <DismissibleInfoTip id="test-tip">
        Esta é uma mensagem explicativa.
      </DismissibleInfoTip>
    );

    expect(screen.getByText("Esta é uma mensagem explicativa.")).toBeInTheDocument();
    expect(screen.getByRole("note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dispensar aviso permanentemente/i })).toBeInTheDocument();
  });

  it("dismisses message on button click and persists to localStorage", () => {
    const onDismissMock = vi.fn();

    render(
      <DismissibleInfoTip id="test-tip" onDismiss={onDismissMock}>
        Dica para novos usuários.
      </DismissibleInfoTip>
    );

    const closeBtn = screen.getByRole("button", { name: /dispensar aviso permanentemente/i });
    fireEvent.click(closeBtn);

    expect(screen.queryByText("Dica para novos usuários.")).not.toBeInTheDocument();
    expect(onDismissMock).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("pluri_dismissed_infotip_test-tip_test-user-123")).toBe("true");
  });

  it("does not render if already dismissed in localStorage", () => {
    localStorage.setItem("pluri_dismissed_infotip_already-dismissed_test-user-123", "true");

    const { container } = render(
      <DismissibleInfoTip id="already-dismissed">
        Nunca deve aparecer.
      </DismissibleInfoTip>
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByText("Nunca deve aparecer.")).not.toBeInTheDocument();
  });

  it("respects global scope without user id", () => {
    render(
      <DismissibleInfoTip id="global-tip" scope="global">
        Aviso global.
      </DismissibleInfoTip>
    );

    const closeBtn = screen.getByRole("button", { name: /dispensar aviso permanentemente/i });
    fireEvent.click(closeBtn);

    expect(localStorage.getItem("pluri_dismissed_infotip_global-tip_global")).toBe("true");
  });
});
