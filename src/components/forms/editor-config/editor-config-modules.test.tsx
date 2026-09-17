import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Type } from "lucide-react";
import { ConfigSwitchCard } from "./ConfigSwitchCard";
import { ConfigActionBar } from "./ConfigActionBar";
import { ComponentsTab } from "./ComponentsTab";
import { PropertiesTab } from "./PropertiesTab";
import { MenusTab } from "./MenusTab";
import { OptionsTab } from "./OptionsTab";
import { DEFAULT_FORM_EDITOR_FLAG_CONFIG } from "@/lib/feature-flags-catalog";

describe("editor-config modular components", () => {
  describe("ConfigSwitchCard", () => {
    it("renders label, description and toggles switch", () => {
      const onToggle = vi.fn();
      render(
        <ConfigSwitchCard
          label="Meu Campo"
          description="Descrição do campo de teste"
          icon={Type}
          checked={false}
          onCheckedChange={onToggle}
          accentColor="blue"
        />
      );

      expect(screen.getByText("Meu Campo")).toBeInTheDocument();
      expect(screen.getByText("Descrição do campo de teste")).toBeInTheDocument();

      const switchElem = screen.getByRole("switch", { name: "Meu Campo" });
      expect(switchElem).not.toBeChecked();

      fireEvent.click(switchElem);
      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it("renders checked state with accent color", () => {
      render(
        <ConfigSwitchCard
          label="Campo Ativo"
          description="Descrição"
          icon={Type}
          checked={true}
          onCheckedChange={vi.fn()}
          accentColor="purple"
        />
      );

      const switchElem = screen.getByRole("switch", { name: "Campo Ativo" });
      expect(switchElem).toBeChecked();
    });
  });

  describe("ConfigActionBar", () => {
    it("calls onEnableAll and onDisableAll handlers", () => {
      const onEnableAll = vi.fn();
      const onDisableAll = vi.fn();

      render(
        <ConfigActionBar
          title="Barra de Ações"
          description="Descrição da barra de teste"
          onEnableAll={onEnableAll}
          onDisableAll={onDisableAll}
          enableLabel="Ativar Todos"
          disableLabel="Desativar Todos"
          accentColor="amber"
        />
      );

      expect(screen.getByText("Barra de Ações")).toBeInTheDocument();
      expect(screen.getByText("Descrição da barra de teste")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /^Ativar Todos$/i }));
      expect(onEnableAll).toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /^Desativar Todos$/i }));
      expect(onDisableAll).toHaveBeenCalled();
    });
  });

  describe("ComponentsTab", () => {
    it("renders categories and handles toggling", () => {
      const onToggle = vi.fn();
      const onEnableAll = vi.fn();
      const onDisableAll = vi.fn();

      render(
        <ComponentsTab
          components={DEFAULT_FORM_EDITOR_FLAG_CONFIG.components}
          onToggleComponent={onToggle}
          onEnableAll={onEnableAll}
          onDisableAll={onDisableAll}
        />
      );

      expect(screen.getByText("Básicos")).toBeInTheDocument();
      expect(screen.getByText("Texto curto")).toBeInTheDocument();
      expect(screen.getByText("Opções & Seleção")).toBeInTheDocument();
      expect(screen.getByText("Estrutura & Agrupamento")).toBeInTheDocument();
      expect(screen.getByText("Especiais")).toBeInTheDocument();

      const shortTextSwitch = screen.getByRole("switch", { name: "Texto curto" });
      fireEvent.click(shortTextSwitch);
      expect(onToggle).toHaveBeenCalledWith("short_text", false);
    });
  });

  describe("PropertiesTab", () => {
    it("renders field properties and handles toggling", () => {
      const onToggle = vi.fn();
      render(
        <PropertiesTab
          properties={DEFAULT_FORM_EDITOR_FLAG_CONFIG.properties}
          onToggleProperty={onToggle}
          onEnableAll={vi.fn()}
          onDisableAll={vi.fn()}
        />
      );

      expect(screen.getByText("Obrigatório")).toBeInTheDocument();
      expect(screen.getByText("Resumo do paciente")).toBeInTheDocument();

      const reqSwitch = screen.getByRole("switch", { name: "Obrigatório" });
      fireEvent.click(reqSwitch);
      expect(onToggle).toHaveBeenCalledWith("required", false);
    });
  });

  describe("MenusTab", () => {
    it("renders editor menus and handles toggling", () => {
      const onToggle = vi.fn();
      render(
        <MenusTab
          menus={DEFAULT_FORM_EDITOR_FLAG_CONFIG.menus}
          onToggleMenu={onToggle}
          onEnableAll={vi.fn()}
          onDisableAll={vi.fn()}
        />
      );

      expect(screen.getByText("Menu de Componentes")).toBeInTheDocument();
      expect(screen.getByText("Aba Fluxo")).toBeInTheDocument();

      const menuSwitch = screen.getByRole("switch", { name: "Menu de Componentes" });
      fireEvent.click(menuSwitch);
      expect(onToggle).toHaveBeenCalledWith("palette_sidebar", false);
    });
  });

  describe("OptionsTab", () => {
    it("renders option groups and handles toggling", () => {
      const onToggle = vi.fn();
      render(
        <OptionsTab
          options={DEFAULT_FORM_EDITOR_FLAG_CONFIG.options}
          onToggleOption={onToggle}
          onEnableAll={vi.fn()}
          onDisableAll={vi.fn()}
        />
      );

      expect(screen.getByText("Opções do Fluxo")).toBeInTheDocument();
      expect(screen.getByText("Reordenar")).toBeInTheDocument();
      expect(screen.getByText("Opções de Design")).toBeInTheDocument();

      const reorderSwitch = screen.getByRole("switch", { name: "Reordenar" });
      fireEvent.click(reorderSwitch);
      expect(onToggle).toHaveBeenCalledWith("flow_reorder", false);
    });
  });
});
