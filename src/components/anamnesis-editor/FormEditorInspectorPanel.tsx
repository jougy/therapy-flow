import React, { type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  FolderInput,
  Hexagon,
  Palette,
  Settings2,
  ToggleLeft,
  Trash2,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { OptionListEditor } from "@/components/anamnesis/OptionListEditor";
import { OptionMatrixEditor } from "@/components/anamnesis/OptionMatrixEditor";
import { SectionColorPaletteField } from "@/components/anamnesis/SectionColorPaletteField";
import {
  ANAMNESIS_FIELD_LIBRARY,
  ANAMNESIS_OPTION_LIMIT,
  ANAMNESIS_RAW_OPTIONS_INPUT_LIMIT,
  ANAMNESIS_SCHEMA_FIELD_LIMIT,
  ANAMNESIS_SLIDER_MAX,
  ANAMNESIS_SLIDER_MIN,
  hasScrollableOptionEditor,
  hasTableColumnEditor,
  hasVerticalOptionEditor,
  isContainerField,
  isSelectionChoiceFieldType,
  normalizeOptions,
  type AnamnesisField,
} from "@/lib/anamnesis-forms";
import { INPUT_LIMITS } from "@/lib/input-security";
import { toRgbaString } from "@/lib/group-colors";
import { cn } from "@/lib/utils";
import {
  DESIGNLAB_SECTION_COLOR_SLOTS,
  getFieldAccentAlpha,
  getFieldAccentColor,
  getFieldTypeIcon,
  getFieldTypeLabel,
  type DesignLabAnamnesisField,
  type DesignLabTemplateLayoutItem,
} from "./types";
import type { useFormEditorState } from "./useFormEditorState";

export interface FormEditorInspectorPanelProps {
  state: ReturnType<typeof useFormEditorState>;
}

export const FormEditorInspectorPanel: React.FC<FormEditorInspectorPanelProps> = ({ state }) => {
  const {
    rightSidebarTab,
    setRightSidebarTab,
    inspectorTab,
    setInspectorTab,
    selectedField,
    selectedFieldIds,
    templateFields,
    groupedLayout,
    visualOrderedFields,
    flowIndexById,
    selectedFieldAssignableContainers,
    sectionOptions,
    fieldLimitReached,
    isBase,
    dragOverFieldId,
    dragOverPosition,
    draggedFieldId,
    collapsedFlowNodeIds,
    toggleFlowNode,
    selectFieldAndOpenMobileInspector,
    updateField,
    updateSectionColor,
    assignFieldToSection,
    moveFieldInTree,
    duplicateField,
    removeField,
    handleAddField,
    handleFluxoDrop,
    setDraggedFieldId,
    setDragOverFieldId,
    setDragOverPosition,
  } = state;

  const isMultiSelecting = selectedFieldIds.length > 1;

  const renderFlowTreeItem = (item: DesignLabTemplateLayoutItem, depth = 0): ReactNode => {
    const field = item.field;
    const isSelected = field.id === selectedField?.id;
    const isContainer = item.type !== "field";
    const isCollapsed = collapsedFlowNodeIds.has(field.id);
    const accentColor = getFieldAccentColor(field);
    const Icon = getFieldTypeIcon(field.type, isContainer, isCollapsed);
    const assignableContainers = templateFields.filter(
      (f) => isContainerField(f) && f.id !== field.id && f.groupKey !== field.id
    );
    const visualIdx = visualOrderedFields.findIndex((tf) => tf.id === field.id);
    const isDragOver = dragOverFieldId === field.id;
    const isDraggingThis = draggedFieldId === field.id;

    return (
      <div key={field.id} className="relative">
        {isDragOver && dragOverPosition === "before" && (
          <div className="absolute -top-1 left-2 right-2 z-30 flex items-center pointer-events-none">
            <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -ml-1" />
            <div className="h-0.5 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
            <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mr-1" />
          </div>
        )}

        {isDragOver && dragOverPosition === "after" && (
          <div className="absolute -bottom-1 left-2 right-2 z-30 flex items-center pointer-events-none">
            <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -ml-1" />
            <div className="h-0.5 flex-1 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]" />
            <div className="h-2 w-2 rounded-full bg-primary ring-2 ring-background shadow-md -mr-1" />
          </div>
        )}

        <div
          draggable={true}
          onDragStart={(event) => {
            event.stopPropagation();
            setDraggedFieldId(field.id);
            event.dataTransfer.setData("text/plain", field.id);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (draggedFieldId === field.id) return;

            const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
            const relativeY = event.clientY - rect.top;

            let pos: "before" | "inside" | "after" = "after";
            if (relativeY < rect.height * 0.3) {
              pos = "before";
            } else if (isContainer && relativeY >= rect.height * 0.3 && relativeY <= rect.height * 0.7) {
              pos = "inside";
            } else {
              pos = "after";
            }

            if (dragOverFieldId !== field.id || dragOverPosition !== pos) {
              setDragOverFieldId(field.id);
              setDragOverPosition(pos);
            }
          }}
          onDragLeave={(event) => {
            event.stopPropagation();
            if (dragOverFieldId === field.id) {
              setDragOverFieldId(null);
              setDragOverPosition(null);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();

            const newFieldType = event.dataTransfer.getData(
              "application/x-form-new-field-type"
            ) as AnamnesisField["type"] | "";
            if (newFieldType) {
              handleAddField(newFieldType, isContainer ? field.id : field.groupKey);
            } else if (draggedFieldId && draggedFieldId !== field.id && dragOverPosition) {
              handleFluxoDrop(draggedFieldId, field.id, dragOverPosition);
            }

            setDraggedFieldId(null);
            setDragOverFieldId(null);
            setDragOverPosition(null);
          }}
          className={`group flex items-center gap-1.5 rounded-md border py-1.5 px-2 text-left transition cursor-grab active:cursor-grabbing ${
            isSelected
              ? "border-primary bg-primary/10 shadow-xs ring-1 ring-primary"
              : "border-transparent hover:border-border hover:bg-muted/50"
          } ${
            isDragOver && dragOverPosition === "inside"
              ? "ring-2 ring-primary border-primary bg-primary/20 scale-[1.01]"
              : ""
          } ${isDraggingThis ? "opacity-40" : ""}`}
          style={{ paddingLeft: `${depth * 18 + 4}px` }}
        >
          <button
            type="button"
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-xs ${
              isContainer ? "text-muted-foreground hover:bg-muted" : "pointer-events-none text-transparent"
            }`}
            aria-label={isCollapsed ? `Expandir ${field.label}` : `Recolher ${field.label}`}
            onClick={(event) => {
              event.stopPropagation();
              if (isContainer) toggleFlowNode(field.id);
            }}
          >
            {isContainer ? (
              isCollapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )
            ) : (
              <span className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={(e) => {
              e.stopPropagation();
              selectFieldAndOpenMobileInspector(field.id, e);
            }}
          >
            <Icon className={`h-4 w-4 shrink-0 ${isContainer ? "text-primary" : "text-muted-foreground"}`} />
            <span className="h-3 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: accentColor }} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="block truncate text-xs font-semibold leading-tight">{field.label}</span>
                {field.required && (
                  <span className="text-destructive font-bold text-xs" title="Campo obrigatório">
                    *
                  </span>
                )}
                {isContainer && (
                  <span className="ml-1 shrink-0 rounded-full bg-muted/80 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                    {item.items.length} {item.items.length === 1 ? "item" : "itens"}
                  </span>
                )}
              </span>
              <span className="block truncate text-[11px] leading-tight text-muted-foreground">
                {getFieldTypeLabel(field.type)}
              </span>
            </span>
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {flowIndexById.get(field.id)}
            </span>
          </button>

          <div className="ml-1 flex items-center gap-0.5 shrink-0 opacity-80 group-hover:opacity-100">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label={`Mover ${field.label} para cima`}
              title="Mover para cima"
              disabled={visualIdx <= 0}
              onClick={(event) => {
                event.stopPropagation();
                moveFieldInTree(field.id, -1);
              }}
            >
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label={`Mover ${field.label} para baixo`}
              title="Mover para baixo"
              disabled={visualIdx < 0 || visualIdx >= visualOrderedFields.length - 1}
              onClick={(event) => {
                event.stopPropagation();
                moveFieldInTree(field.id, 1);
              }}
            >
              <ArrowDown className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label={`Duplicar ${field.label}`}
              title="Duplicar"
              disabled={fieldLimitReached}
              onClick={(event) => {
                event.stopPropagation();
                duplicateField(field);
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label={`Excluir ${field.label}`}
              title="Excluir"
              onClick={(event) => {
                event.stopPropagation();
                removeField(field.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>

            {(assignableContainers.length > 0 || field.groupKey) && (
              <Select
                value={field.groupKey ?? "none"}
                onValueChange={(val) => assignFieldToSection(field.id, val === "none" ? null : val)}
              >
                <SelectTrigger
                  className="h-6 w-6 border-none p-0 bg-transparent text-muted-foreground hover:text-foreground shadow-none focus:ring-0 [&>svg]:hidden flex items-center justify-center"
                  aria-label={`Agrupar ou mover de seção ${field.label}`}
                  title="Agrupar ou mover de seção"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FolderInput className="h-3.5 w-3.5" />
                </SelectTrigger>
                <SelectContent align="end" className="text-xs">
                  <SelectItem value="none">Sem seção pai (Raiz)</SelectItem>
                  {assignableContainers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Mover para: {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {isContainer && !isCollapsed && item.items.length > 0 && (
          <div className="mt-1 space-y-1">
            {item.items.map((child) => renderFlowTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const flowTreeContent = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 px-1">
        <p className="text-xs text-muted-foreground">Arraste os itens para reordenar ou mover entre seções.</p>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {templateFields.length}/{ANAMNESIS_SCHEMA_FIELD_LIMIT}
        </span>
      </div>
      <div className="max-h-[55vh] space-y-1 overflow-y-auto rounded-md border bg-muted/10 p-1">
        {groupedLayout.map((item) => renderFlowTreeItem(item))}
        <div
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (dragOverFieldId !== "root_dropzone") setDragOverFieldId("root_dropzone");
          }}
          onDragLeave={(event) => {
            event.stopPropagation();
            if (dragOverFieldId === "root_dropzone") setDragOverFieldId(null);
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const newFieldType = event.dataTransfer.getData(
              "application/x-form-new-field-type"
            ) as AnamnesisField["type"] | "";
            if (newFieldType) {
              handleAddField(newFieldType, null);
            } else if (draggedFieldId) {
              assignFieldToSection(draggedFieldId, null);
            }
            setDraggedFieldId(null);
            setDragOverFieldId(null);
          }}
          className={`mt-2 rounded-md border border-dashed p-2.5 text-center text-xs transition-all ${
            dragOverFieldId === "root_dropzone"
              ? "border-primary bg-primary/20 text-primary font-semibold ring-2 ring-primary"
              : "border-border/80 bg-background/50 text-muted-foreground hover:border-primary/60 hover:bg-primary/5"
          }`}
        >
          Arraste aqui para mover para a raiz (sem seção)
        </div>
      </div>
    </div>
  );

  const inspectorContent = selectedField ? (
    <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/10 p-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">{selectedField.label}</p>
          <p className="text-[11px] text-muted-foreground">{getFieldTypeLabel(selectedField.type)}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="h-4 w-4 rounded-xs border"
            style={{
              backgroundColor: toRgbaString(
                getFieldAccentColor(selectedField),
                getFieldAccentAlpha(selectedField)
              ),
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 rounded-md bg-muted p-1 text-xs font-medium">
        {[
          { icon: Settings2, label: "Ajustes", value: "settings" as const },
          { icon: Palette, label: "Design", value: "design" as const },
          { icon: Workflow, label: "Lógica", value: "logic" as const },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              className={`flex items-center justify-center gap-1 rounded-xs px-2 py-1.5 transition ${
                inspectorTab === tab.value ? "bg-background text-foreground shadow-xs" : "text-muted-foreground"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setInspectorTab(tab.value);
              }}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="space-y-4">
        {inspectorTab === "settings" && (
          <>
            <div className="space-y-2">
              <Label>Tipo de campo</Label>
              <Select
                value={selectedField.type}
                onValueChange={(value) => updateField(selectedField.id, { type: value as AnamnesisField["type"] })}
              >
                <SelectTrigger onClick={(e) => e.stopPropagation()}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent onCloseAutoFocus={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
                  {ANAMNESIS_FIELD_LIBRARY.map((entry) => (
                    <SelectItem key={entry.type} value={entry.type}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Rótulo / Pergunta</Label>
              <Input
                value={selectedField.label}
                onChange={(event) => updateField(selectedField.id, { label: event.target.value })}
                maxLength={INPUT_LIMITS.formFieldLabel}
              />
            </div>
            <div className="space-y-2">
              <Label>Texto de ajuda (opcional)</Label>
              <Textarea
                rows={2}
                value={selectedField.helpText ?? ""}
                onChange={(event) => updateField(selectedField.id, { helpText: event.target.value })}
                maxLength={INPUT_LIMITS.formHelpText}
                placeholder="Explicação adicional para quem for preencher"
              />
            </div>
            {!isContainerField(selectedField) && selectedField.type !== "address_block" && (
              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={selectedField.placeholder ?? ""}
                  onChange={(event) => updateField(selectedField.id, { placeholder: event.target.value })}
                  maxLength={INPUT_LIMITS.formPlaceholder}
                  placeholder="Texto de exemplo no campo"
                />
              </div>
            )}
            {!isContainerField(selectedField) && (
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Obrigatório</p>
                  <p className="text-xs text-muted-foreground">Exige resposta antes de concluir o formulário.</p>
                </div>
                <Switch
                  checked={selectedField.required ?? false}
                  onCheckedChange={(checked) => updateField(selectedField.id, { required: checked === true })}
                />
              </div>
            )}
            {isBase && !isContainerField(selectedField) && (
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Resumo do paciente</p>
                  <p className="text-xs text-muted-foreground">Mostra este campo na lista de atendimentos.</p>
                </div>
                <Switch
                  checked={selectedField.showInPatientList ?? false}
                  onCheckedChange={(checked) => updateField(selectedField.id, { showInPatientList: checked === true })}
                />
              </div>
            )}
            {isSelectionChoiceFieldType(selectedField.type) && (
              <div className="space-y-2">
                <Label>Modo de seleção</Label>
                <Select
                  value={selectedField.type}
                  onValueChange={(value) => updateField(selectedField.id, { type: value as AnamnesisField["type"] })}
                >
                  <SelectTrigger onClick={(e) => e.stopPropagation()}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent onCloseAutoFocus={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
                    <SelectItem value="multiple_choice">Múltipla escolha (única resposta)</SelectItem>
                    <SelectItem value="checklist">Checklist (várias respostas)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedField.type === "section_selector" && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <ToggleLeft className="h-4 w-4" />
                  <span>Módulos Dinâmicos Automáticos</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Os switches deste Seletor são gerados automaticamente pelas <strong>Seções</strong> adicionadas dentro
                  dele. Para incluir novos módulos, basta arrastar seções para o interior deste contêiner.
                </p>
              </div>
            )}
            {selectedField.type === "radar_section" && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                  <Hexagon className="h-4 w-4" />
                  <span>Polígono de Status</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Os vértices e valores do polígono são gerados automaticamente a partir dos campos <strong>Slidebar</strong> ou <strong>Numéricos</strong> inseridos dentro desta seção. No painel do paciente, todas as métricas são consolidadas em um gráfico multi-série interativo.
                </p>
              </div>
            )}
            {(selectedField.type === "checklist" ||
              selectedField.type === "multiple_choice" ||
              selectedField.type === "select" ||
              selectedField.type === "table") && (
              <div className="space-y-2">
                <Label>
                  {hasTableColumnEditor(selectedField.type) ? "Colunas da tabela" : "Opções disponíveis"}
                </Label>
                {hasScrollableOptionEditor(selectedField.type) ? (
                  <OptionMatrixEditor
                    options={selectedField.options}
                    maxOptions={ANAMNESIS_OPTION_LIMIT}
                    onChange={(options) => updateField(selectedField.id, { options })}
                  />
                ) : hasTableColumnEditor(selectedField.type) || hasVerticalOptionEditor(selectedField.type) ? (
                  <OptionListEditor
                    options={selectedField.options}
                    maxOptions={ANAMNESIS_OPTION_LIMIT}
                    onChange={(options) => updateField(selectedField.id, { options })}
                  />
                ) : (
                  <Textarea
                    rows={4}
                    value={(selectedField.options ?? []).map((option) => option.label).join("\n")}
                    onChange={(event) =>
                      updateField(selectedField.id, { options: normalizeOptions(event.target.value) })
                    }
                    placeholder="Uma opção por linha"
                    maxLength={ANAMNESIS_RAW_OPTIONS_INPUT_LIMIT}
                  />
                )}
              </div>
            )}
            {selectedField.type === "slider" && (
              <div className="space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Mínimo</Label>
                    <Input
                      type="number"
                      value={selectedField.min ?? 0}
                      onChange={(event) => updateField(selectedField.id, { min: Number(event.target.value) })}
                      min={ANAMNESIS_SLIDER_MIN}
                      max={ANAMNESIS_SLIDER_MAX - 1}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Máximo</Label>
                    <Input
                      type="number"
                      value={selectedField.max ?? 10}
                      onChange={(event) => updateField(selectedField.id, { max: Number(event.target.value) })}
                      min={ANAMNESIS_SLIDER_MIN + 1}
                      max={ANAMNESIS_SLIDER_MAX}
                      step={1}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Passo / Incremento (Step)</Label>
                  <Input
                    type="number"
                    value={selectedField.sliderStep ?? 1}
                    onChange={(event) =>
                      updateField(selectedField.id, {
                        sliderStep: Math.max(0.1, Number(event.target.value) || 1),
                      })
                    }
                    min={0.1}
                    max={50}
                    step={0.5}
                    placeholder="1"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Rótulo Mínimo (Esq.)</Label>
                    <Input
                      value={selectedField.sliderMinLabel ?? ""}
                      onChange={(event) => updateField(selectedField.id, { sliderMinLabel: event.target.value })}
                      placeholder="Ex: Sem dor"
                      maxLength={40}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Rótulo Máximo (Dir.)</Label>
                    <Input
                      value={selectedField.sliderMaxLabel ?? ""}
                      onChange={(event) => updateField(selectedField.id, { sliderMaxLabel: event.target.value })}
                      placeholder="Ex: Dor máxima"
                      maxLength={40}
                    />
                  </div>
                </div>
              </div>
            )}
            {(() => {
              const parent = templateFields.find((f) => f.id === selectedField.groupKey);
              if (parent?.type !== "horizontal_section") return null;

              return (
                <div className="space-y-2">
                  <Label>Largura na Seção Horizontal</Label>
                  <Select
                    value={selectedField.columnSpan ?? "auto"}
                    onValueChange={(val) =>
                      updateField(selectedField.id, { columnSpan: val as AnamnesisField["columnSpan"] })
                    }
                  >
                    <SelectTrigger onClick={(e) => e.stopPropagation()}>
                      <SelectValue placeholder="Automático" />
                    </SelectTrigger>
                    <SelectContent onCloseAutoFocus={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
                      <SelectItem value="auto">Automático (conforme conteúdo)</SelectItem>
                      <SelectItem value="1/4">1/4 da linha (25%)</SelectItem>
                      <SelectItem value="1/3">1/3 da linha (33%)</SelectItem>
                      <SelectItem value="1/2">1/2 da linha (50%)</SelectItem>
                      <SelectItem value="2/3">2/3 da linha (66%)</SelectItem>
                      <SelectItem value="full">Linha inteira (100%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })()}
          </>
        )}

        {inspectorTab === "design" && (
          <>
            <div className="space-y-3">
              <p className="text-sm font-medium">
                {isContainerField(selectedField) ? "Cor de destaque da seção" : "Cor de destaque do campo"}
              </p>
              <SectionColorPaletteField
                alpha={getFieldAccentAlpha(selectedField)}
                colorHex={getFieldAccentColor(selectedField)}
                onChange={({ alpha, colorHex }) => updateSectionColor(selectedField.id, colorHex, alpha)}
                slots={DESIGNLAB_SECTION_COLOR_SLOTS}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {DESIGNLAB_SECTION_COLOR_SLOTS.slice(0, 6).map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  className="h-9 rounded-md border transition hover:scale-[1.02]"
                  style={{ backgroundColor: toRgbaString(slot.color_hex, slot.alpha) }}
                  onClick={(e) => {
                    e.stopPropagation();
                    updateSectionColor(selectedField.id, slot.color_hex, slot.alpha);
                  }}
                  aria-label={`Aplicar cor ${slot.slot_index + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {inspectorTab === "logic" && (
          <>
            {selectedField.type === "section_selector" ? (
              <p className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-md border">
                O Seletor de Seções atua na raiz do formulário e gerencia suas próprias seções modulares.
              </p>
            ) : (
              <div className="space-y-2">
                <Label>
                  {isContainerField(selectedField) ? "Seção pai (aninhamento)" : "Contêiner / Seção pai"}
                </Label>
                <Select
                  value={selectedField.groupKey ?? "none"}
                  onValueChange={(value) =>
                    assignFieldToSection(selectedField.id, value === "none" ? null : value)
                  }
                >
                  <SelectTrigger onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Sem contêiner" />
                  </SelectTrigger>
                  <SelectContent onCloseAutoFocus={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
                    <SelectItem value="none">
                      {isContainerField(selectedField) ? "Sem seção pai (Raiz)" : "Sem contêiner (Raiz)"}
                    </SelectItem>
                    {selectedFieldAssignableContainers.map((container) => (
                      <SelectItem key={container.id} value={container.id}>
                        {container.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!isContainerField(selectedField) && selectedField.type !== "section_selector" && (
              <div className="space-y-2">
                <Label>Visibilidade condicional</Label>
                <p className="text-xs text-muted-foreground">
                  Exibe este campo somente quando uma seção específica estiver ligada no Seletor de Seções.
                </p>
                <Select
                  value={selectedField.sectionKey ?? "none"}
                  onValueChange={(value) =>
                    updateField(selectedField.id, { sectionKey: value === "none" ? null : value })
                  }
                >
                  <SelectTrigger onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Sempre visível" />
                  </SelectTrigger>
                  <SelectContent onCloseAutoFocus={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
                    <SelectItem value="none">Sempre visível</SelectItem>
                    {sectionOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => duplicateField(selectedField)}
            disabled={fieldLimitReached}
          >
            <Copy className="mr-2 h-3.5 w-3.5" />
            Duplicar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => removeField(selectedField.id)}
            disabled={isBase && !!selectedField.systemKey}
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Excluir
          </Button>
        </div>
      </div>
    </div>
  ) : (
    <div className="py-8 text-center text-xs text-muted-foreground space-y-2">
      <Workflow className="mx-auto h-8 w-8 text-muted-foreground/40" />
      <p className="font-medium">Nenhum campo selecionado</p>
      <p className="text-[11px]">
        Clique em um campo no canvas ou na árvore de fluxo para editar suas propriedades.
      </p>
    </div>
  );

  return (
    <Card data-tutorial="form-editor-inspector" className="flex flex-col h-full max-h-full overflow-hidden border-border/70 bg-background/95 shadow-sm">
      <CardHeader className="shrink-0 space-y-2 border-b bg-muted/20 p-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-xs font-semibold">
          <button
            type="button"
            data-tutorial="form-editor-inspector-flow"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors",
              rightSidebarTab === "flow"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setRightSidebarTab("flow")}
          >
            <Workflow className="h-3.5 w-3.5 text-primary" />
            <span>Fluxo</span>
          </button>
          <button
            type="button"
            data-tutorial="form-editor-inspector-props"
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md py-1.5 transition-colors relative",
              rightSidebarTab === "properties"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setRightSidebarTab("properties")}
          >
            <Settings2 className="h-3.5 w-3.5 text-primary" />
            <span>Propriedades</span>
            {selectedField && <span className="h-2 w-2 rounded-full bg-primary" />}
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 p-3 overflow-y-auto">
        {rightSidebarTab === "flow" ? flowTreeContent : inspectorContent}
      </CardContent>
    </Card>
  );
};
