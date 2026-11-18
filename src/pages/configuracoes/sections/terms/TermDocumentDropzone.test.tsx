import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TermDocumentDropzone } from "./TermDocumentDropzone";

describe("TermDocumentDropzone", () => {
  it("renders in full variant with dropzone instructions and format badges", () => {
    const handleScanned = vi.fn();
    render(<TermDocumentDropzone variant="full" onScanned={handleScanned} />);

    expect(
      screen.getByText("Arraste um documento para criar um novo modelo")
    ).toBeInTheDocument();
    expect(screen.getByText(".PDF (OCR Local)")).toBeInTheDocument();
    expect(screen.getByText(".DOCX")).toBeInTheDocument();
    expect(screen.getByText(".MD")).toBeInTheDocument();
  });

  it("renders in compact variant for modal with compact labels", () => {
    const handleScanned = vi.fn();
    render(<TermDocumentDropzone variant="compact" onScanned={handleScanned} />);

    expect(
      screen.getByText("Importar redação de arquivo (.pdf, .docx, .md)")
    ).toBeInTheDocument();
    expect(screen.getByText(".PDF (OCR)")).toBeInTheDocument();
  });

  it("updates visual state on drag enter and drag leave", () => {
    const handleScanned = vi.fn();
    render(<TermDocumentDropzone variant="full" onScanned={handleScanned} />);

    const dropzone = screen.getByRole("button", {
      name: /Zona de Drag and Drop/i,
    });

    fireEvent.dragEnter(dropzone, {
      dataTransfer: { items: [{ kind: "file" }] },
    });
    expect(dropzone.className).toContain("border-primary");

    fireEvent.dragLeave(dropzone);
    expect(dropzone.className).not.toContain("border-primary bg-primary/10 ring-4");
  });
});
