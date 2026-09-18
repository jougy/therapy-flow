import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  PrintResponsibilityModal,
  sanitizeDocumentTitle,
} from "@/components/PrintResponsibilityModal";
import { safeRestoreBodyPointerEvents } from "@/components/ui/dialog";

// Mock supabase
const mockMaybeSingle = vi.fn().mockResolvedValue({
  data: {
    value: {
      print_terms: {
        content: "### Termos de Teste Customizados\n[Link Seguro](https://example.com)\n[Link Inseguro](javascript:alert(1))",
      },
    },
  },
  error: null,
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          abortSignal: () => ({
            maybeSingle: () => mockMaybeSingle(),
          }),
        }),
      }),
    }),
  },
}));

describe("PrintResponsibilityModal - Security & Efficiency Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.pointerEvents = "";
  });

  describe("1. Security & XSS Sanitization: sanitizeDocumentTitle", () => {
    it("strips malicious script tags from document title", () => {
      const malicious = '<script>alert("xss")</script>Prontuário Clínico';
      const clean = sanitizeDocumentTitle(malicious);
      expect(clean).not.toContain("<script>");
      expect(clean).not.toContain("</script>");
      expect(clean).toContain("Prontuário Clínico");
    });

    it("strips markdown injection syntax to prevent visual hijacking", () => {
      const hijacked = "## Header [Clique aqui](https://malicious.com) **Bold**";
      const clean = sanitizeDocumentTitle(hijacked);
      expect(clean).not.toContain("[");
      expect(clean).not.toContain("]");
      expect(clean).not.toContain("**");
      expect(clean).not.toContain("##");
      expect(clean).toContain("Header");
      expect(clean).toContain("Clique aqui");
    });

    it("returns default fallback when undefined or empty string is provided", () => {
      expect(sanitizeDocumentTitle(undefined)).toBe("dados da plataforma");
      expect(sanitizeDocumentTitle("")).toBe("dados da plataforma");
      expect(sanitizeDocumentTitle("   ")).toBe("dados da plataforma");
    });

    it("truncates excessively long titles to limit buffer and DOM layout shifts", () => {
      const longTitle = "A".repeat(300);
      const clean = sanitizeDocumentTitle(longTitle);
      expect(clean.length).toBeLessThanOrEqual(100);
    });
  });

  describe("2. LGPD Strict Enforcement", () => {
    it("keeps print button disabled and does NOT call onConfirm if accepted is false", async () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <PrintResponsibilityModal
          isOpen={true}
          documentTitle="Prontuário #123"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const confirmBtn = screen.getByRole("button", { name: /aceitar e imprimir/i });
      expect(confirmBtn).toBeDisabled();

      // Attempting click on disabled button
      fireEvent.click(confirmBtn);
      expect(onConfirm).not.toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByText(/Termo de Responsabilidade para Impressão/i)).toBeInTheDocument();
      });
    });

    it("calls onConfirm only after checking the required LGPD checkbox", async () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();

      render(
        <PrintResponsibilityModal
          isOpen={true}
          documentTitle="Prontuário #123"
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const checkbox = screen.getByRole("checkbox");
      fireEvent.click(checkbox);

      const confirmBtn = screen.getByRole("button", { name: /aceitar e imprimir/i });
      expect(confirmBtn).not.toBeDisabled();

      fireEvent.click(confirmBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("3. Markdown Link Sanitization", () => {
    it("neutralizes javascript: URLs in markdown, rendering safe non-anchor text", async () => {
      render(
        <PrintResponsibilityModal
          isOpen={true}
          documentTitle="Relatório Geral"
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(screen.getByText("Link Inseguro")).toBeInTheDocument();
      });

      // The unsafe link text should exist, but NOT as an anchor with javascript: protocol
      const unsafeLinkText = screen.getByText("Link Inseguro");
      expect(unsafeLinkText.tagName.toLowerCase()).not.toBe("a");
      expect(unsafeLinkText.closest("a")).toBeNull();

      // The safe link should be rendered as a valid anchor with rel="noopener noreferrer"
      const safeLink = screen.getByRole("link", { name: "Link Seguro" });
      expect(safeLink).toHaveAttribute("href", "https://example.com");
      expect(safeLink).toHaveAttribute("rel", "noopener noreferrer");
      expect(safeLink).toHaveAttribute("target", "_blank");
    });
  });

  describe("4. Escape Key and Event Listener Cleanup", () => {
    it("calls onCancel when Escape key is pressed", () => {
      const onCancel = vi.fn();

      render(
        <PrintResponsibilityModal
          isOpen={true}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("removes the Escape event listener when unmounted", () => {
      const onCancel = vi.fn();

      const { unmount } = render(
        <PrintResponsibilityModal
          isOpen={true}
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      );

      unmount();

      // Triggering Escape after unmount should not call onCancel
      fireEvent.keyDown(window, { key: "Escape" });
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe("5. Pointer Events Restoration Safeguard", () => {
    it("safeRestoreBodyPointerEvents restores document.body.style.pointerEvents when no modals open", async () => {
      document.body.style.pointerEvents = "none";
      expect(document.body.style.pointerEvents).toBe("none");

      safeRestoreBodyPointerEvents();

      await waitFor(() => {
        expect(document.body.style.pointerEvents).toBe("");
      });
    });
  });
});
