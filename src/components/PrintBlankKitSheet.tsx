import React from "react";
import {
  type AnamnesisField,
  type AnamnesisTemplateSchema,
  buildTemplateLayout,
  type TemplateLayoutItem,
} from "@/lib/anamnesis-forms";
import { toRgbaString } from "@/lib/group-colors";

export interface PrintBlankKitSheetProps {
  clinicName?: string;
  clinicLogoUrl?: string | null;
  includeHeader?: boolean;
  includePatientRegistration?: boolean;
  includeUniversalBase?: boolean;
  universalBaseSchema?: AnamnesisTemplateSchema | null;
  selectedTemplateName?: string | null;
  selectedTemplateSchema?: AnamnesisTemplateSchema | null;
  selectedSectionIds?: string[];
  printColorMode?: "color" | "monochrome";
}

const isEditorPlaceholderHelpText = (helpText?: string | null) => {
  if (!helpText) return true;
  const clean = helpText.trim();
  return (
    clean === "Agrupe campos lado a lado com rolagem horizontal." ||
    clean === "Texto introdutório da seção." ||
    clean === "Campos obrigatórios da primeira parte da anamnese."
  );
};

const filterPrintableSchema = (
  schema: AnamnesisTemplateSchema,
  selectedSectionIds?: string[]
): AnamnesisTemplateSchema => {
  const isSectionSelected = (sectionId: string) => {
    if (!selectedSectionIds || selectedSectionIds.length === 0) return true;
    return selectedSectionIds.includes(sectionId);
  };

  const excludedSectionIds = new Set<string>();
  schema.forEach((f) => {
    if ((f.type === "section" || f.type === "horizontal_section") && !isSectionSelected(f.id)) {
      excludedSectionIds.add(f.id);
    }
  });

  return schema
    .filter((field) => {
      if (field.type === "section_selector") return false;
      if (excludedSectionIds.has(field.id)) return false;
      if (field.groupKey && excludedSectionIds.has(field.groupKey)) return false;
      return true;
    })
    .map((field) => {
      const parent = schema.find((p) => p.id === field.groupKey);
      if (parent && parent.type === "section_selector") {
        return { ...field, groupKey: null };
      }
      return field;
    });
};

export const PrintBlankKitSheet: React.FC<PrintBlankKitSheetProps> = ({
  clinicName = "Clínica de Saúde",
  clinicLogoUrl,
  includeHeader = true,
  includePatientRegistration = true,
  includeUniversalBase = true,
  universalBaseSchema = [],
  selectedTemplateName,
  selectedTemplateSchema = [],
  selectedSectionIds,
  printColorMode = "color",
}) => {
  const currentDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const printableUniversalSchema = React.useMemo(
    () => filterPrintableSchema(universalBaseSchema ?? [], selectedSectionIds),
    [universalBaseSchema, selectedSectionIds]
  );

  const printableTemplateSchema = React.useMemo(
    () => filterPrintableSchema(selectedTemplateSchema ?? [], selectedSectionIds),
    [selectedTemplateSchema, selectedSectionIds]
  );

  const isColor = printColorMode === "color";

  const renderPrintableField = (field: AnamnesisField, inHorizontalSection = false) => {
    const accent = field.accentColor || (isColor ? "#0284c7" : "#0f172a");

    if (field.type === "section" || field.type === "horizontal_section") {
      const helpText = !isEditorPlaceholderHelpText(field.helpText) ? field.helpText : null;

      return (
        <div
          key={field.id}
          className={`col-span-full rounded-md px-3.5 py-2 mb-2 mt-3 break-after-avoid break-inside-avoid border-l-4 transition-all ${
            isColor
              ? "bg-slate-50/90 border-primary"
              : "bg-slate-100/90 border-slate-800"
          }`}
          style={isColor && field.accentColor ? { borderLeftColor: field.accentColor, backgroundColor: toRgbaString(field.accentColor, 8) } : {}}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: isColor && field.accentColor ? field.accentColor : isColor ? "#0284c7" : "#334155" }}
              />
              <h3
                className="text-xs font-bold uppercase tracking-wider text-slate-900"
                style={isColor && field.accentColor ? { color: field.accentColor } : {}}
              >
                {field.label}
              </h3>
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              {field.type === "horizontal_section" ? "Módulo Lado a Lado" : "Módulo Clínico"}
            </span>
          </div>
          {helpText && <p className="text-[10px] text-slate-500 italic mt-0.5 pl-4.5">{helpText}</p>}
        </div>
      );
    }

    const isFullWidthField = [
      "long_text",
      "checklist",
      "multiple_choice",
      "select",
      "table",
      "address_block",
      "slider",
    ].includes(field.type);

    const colSpanClass = inHorizontalSection
      ? "col-span-1"
      : isFullWidthField
      ? "col-span-full"
      : "col-span-1";

    const cardBorderStyle = isColor && field.accentColor
      ? { borderLeftColor: field.accentColor, borderLeftWidth: "3px" }
      : isColor
      ? { borderLeftColor: "#38bdf8", borderLeftWidth: "2.5px" }
      : {};

    switch (field.type) {
      case "short_text":
        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-tight">
                {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
              </label>
            </div>
            {field.helpText && !isEditorPlaceholderHelpText(field.helpText) && (
              <p className="text-[10px] text-slate-500 mt-0.5">{field.helpText}</p>
            )}
            <div className="h-6 border-b border-slate-300 mt-1.5 flex items-end">
              <span className="text-[10px] text-slate-300 font-mono tracking-widest pl-1">_</span>
            </div>
          </div>
        );

      case "long_text":
        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-tight">
                {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
              </label>
            </div>
            {field.helpText && !isEditorPlaceholderHelpText(field.helpText) && (
              <p className="text-[10px] text-slate-500 mt-0.5">{field.helpText}</p>
            )}
            <div className="space-y-3 pt-2 pb-1">
              <div className="border-b border-slate-200 h-5" />
              <div className="border-b border-slate-200 h-5" />
              <div className="border-b border-slate-200 h-5" />
              <div className="border-b border-slate-200 h-5" />
            </div>
          </div>
        );

      case "date":
        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-tight">
              {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
            </label>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 pt-2 font-mono">
              <span className="border border-slate-300 rounded px-2 py-0.5 bg-slate-50 text-[11px]">D D</span>
              <span>/</span>
              <span className="border border-slate-300 rounded px-2 py-0.5 bg-slate-50 text-[11px]">M M</span>
              <span>/</span>
              <span className="border border-slate-300 rounded px-2.5 py-0.5 bg-slate-50 text-[11px]">A A A A</span>
            </div>
          </div>
        );

      case "number":
        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-tight">
              {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
            </label>
            {field.helpText && !isEditorPlaceholderHelpText(field.helpText) && (
              <p className="text-[10px] text-slate-500 mt-0.5">{field.helpText}</p>
            )}
            <div className="h-6 border-b border-slate-300 mt-1.5 flex items-end">
              <span className="text-[10px] text-slate-400 font-mono">Nº [ &nbsp; &nbsp; &nbsp; &nbsp; ]</span>
            </div>
          </div>
        );

      case "checklist":
      case "multiple_choice":
      case "select": {
        const options = field.options ?? [];
        const hasManyOptions = options.length > 6;
        const isChoice = field.type === "multiple_choice";

        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-1">
              {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
            </label>
            {field.helpText && !isEditorPlaceholderHelpText(field.helpText) && (
              <p className="text-[10px] text-slate-500 mb-1.5">{field.helpText}</p>
            )}
            <div className={hasManyOptions ? "grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 pt-1" : "flex flex-wrap gap-x-5 gap-y-2 pt-1"}>
              {options.length > 0 ? (
                options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2 text-xs text-slate-800 min-w-0">
                    <span
                      className={`w-4 h-4 border-2 border-slate-400 inline-block shrink-0 bg-white ${
                        isChoice ? "rounded-full" : "rounded-[4px]"
                      }`}
                    />
                    <span className="truncate font-medium text-slate-700">{opt.label}</span>
                  </div>
                ))
              ) : (
                <div className="flex gap-6 text-xs text-slate-700 font-medium">
                  <div className="flex items-center gap-1.5"><span className="w-4 h-4 border-2 border-slate-400 rounded-[4px] bg-white inline-block" /> Sim</div>
                  <div className="flex items-center gap-1.5"><span className="w-4 h-4 border-2 border-slate-400 rounded-[4px] bg-white inline-block" /> Não</div>
                  <div className="flex items-center gap-1.5"><span className="w-4 h-4 border-2 border-slate-400 rounded-[4px] bg-white inline-block" /> Parcial</div>
                </div>
              )}
            </div>
          </div>
        );
      }

      case "slider": {
        const minVal = field.min ?? 0;
        const maxVal = field.max ?? 10;
        const minLabel = field.sliderMinLabel || "Sem dor";
        const maxLabel = field.sliderMaxLabel || "Dor máxima";
        const steps = Array.from({ length: Math.min(maxVal - minVal + 1, 11) }, (_, i) => minVal + i);

        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-3 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-[11px] font-bold text-slate-800 uppercase tracking-tight">
                {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
              </label>
              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                Escala: {minVal} a {maxVal}
              </span>
            </div>

            {/* Visual EVA ruler */}
            <div className="py-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-1">
                {steps.map((num) => (
                  <div key={num} className="flex flex-col items-center gap-1">
                    <span className="text-[11px] font-mono">{num}</span>
                    <span
                      className={`w-3.5 h-3.5 rounded-full border-2 border-slate-400 bg-white ${
                        isColor && num <= 3 ? "border-emerald-500" : isColor && num <= 7 ? "border-amber-500" : isColor ? "border-rose-500" : ""
                      }`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-[10px] font-medium text-slate-500 mt-2 px-1">
                <span className={isColor ? "text-emerald-700 font-semibold" : ""}>{minLabel}</span>
                <span className={isColor ? "text-rose-700 font-semibold" : ""}>{maxLabel}</span>
              </div>
            </div>

            <div className="flex justify-end items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-[10px] text-slate-500 font-semibold">Valor Anotado:</span>
              <span className="border-2 border-slate-400 rounded px-3 py-0.5 font-mono text-xs font-bold text-slate-800 bg-slate-50">
                [ &nbsp; &nbsp; &nbsp; &nbsp; ]
              </span>
            </div>
          </div>
        );
      }

      case "address_block":
        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-2">
              {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50"><span className="text-[10px] font-bold text-slate-500 uppercase block">CEP:</span><div className="h-4" /></div>
              <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50"><span className="text-[10px] font-bold text-slate-500 uppercase block">UF:</span><div className="h-4" /></div>
              <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50"><span className="text-[10px] font-bold text-slate-500 uppercase block">Cidade:</span><div className="h-4" /></div>
              <div className="col-span-2 border border-slate-300 rounded p-1.5 bg-slate-50/50"><span className="text-[10px] font-bold text-slate-500 uppercase block">Rua / Logradouro:</span><div className="h-4" /></div>
              <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50"><span className="text-[10px] font-bold text-slate-500 uppercase block">Nº:</span><div className="h-4" /></div>
              <div className="border border-slate-300 rounded p-1.5 bg-slate-50/50"><span className="text-[10px] font-bold text-slate-500 uppercase block">Bairro:</span><div className="h-4" /></div>
              <div className="col-span-2 border border-slate-300 rounded p-1.5 bg-slate-50/50"><span className="text-[10px] font-bold text-slate-500 uppercase block">Complemento:</span><div className="h-4" /></div>
            </div>
          </div>
        );

      case "table": {
        const columns = (field.options ?? []).length > 0
          ? field.options!
          : [{ id: "c1", label: "Item / Descrição" }, { id: "c2", label: "Status / Resultado" }, { id: "c3", label: "Observações" }];

        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-2">
              {field.label} {field.required && <span className="text-rose-500 font-black">*</span>}
            </label>
            <div className="rounded-md border border-slate-300 overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className={isColor ? "bg-slate-100 border-b-2 border-slate-300" : "bg-white border-b-2 border-slate-800"}>
                    {columns.map((col, idx) => (
                      <th key={col.id || idx} className="p-2 border-r border-slate-200 last:border-r-0 font-bold text-slate-800 text-[11px] uppercase tracking-tight">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3, 4].map((rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-200 last:border-0 h-7">
                      {columns.map((col, idx) => (
                        <td key={col.id || idx} className="p-2 border-r border-slate-200 last:border-r-0" />
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }

      default:
        return (
          <div
            key={field.id}
            className={`${colSpanClass} rounded-lg border border-slate-200/90 bg-white p-2.5 shadow-none break-inside-avoid`}
            style={cardBorderStyle}
          >
            <label className="block text-[11px] font-bold text-slate-800 uppercase tracking-tight mb-1">
              {field.label}
            </label>
            <div className="h-6 border-b border-slate-300 mt-1.5" />
          </div>
        );
    }
  };

  const renderLayoutItem = (item: TemplateLayoutItem): React.ReactNode => {
    if (item.type === "field") {
      return renderPrintableField(item.field, false);
    }

    if (item.type === "horizontal_section") {
      const helpText = !isEditorPlaceholderHelpText(item.field.helpText) ? item.field.helpText : null;
      const childCount = item.items.length;
      const borderStyle = isColor && item.field.accentColor
        ? { borderColor: item.field.accentColor, backgroundColor: toRgbaString(item.field.accentColor, 4) }
        : {};

      const gridColsClass =
        childCount >= 4
          ? "grid-cols-2 sm:grid-cols-4"
          : childCount === 3
          ? "grid-cols-1 sm:grid-cols-3"
          : childCount === 2
          ? "grid-cols-1 sm:grid-cols-2"
          : "grid-cols-1";

      return (
        <div
          key={item.field.id}
          className="col-span-full rounded-lg border border-slate-300 bg-slate-50/40 p-3 space-y-2 mb-2.5 break-inside-avoid"
          style={borderStyle}
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <h4
              className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5"
              style={isColor && item.field.accentColor ? { color: item.field.accentColor } : {}}
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block"
                style={{ backgroundColor: isColor && item.field.accentColor ? item.field.accentColor : "#334155" }}
              />
              {item.field.label}
            </h4>
            {helpText && <span className="text-[10px] text-slate-500 italic">{helpText}</span>}
          </div>
          <div className={`grid ${gridColsClass} gap-2.5`}>
            {item.items.map((childItem) => {
              if (childItem.type === "field") {
                return renderPrintableField(childItem.field, true);
              }
              return renderLayoutItem(childItem);
            })}
          </div>
        </div>
      );
    }

    // Seção Principal
    const helpText = !isEditorPlaceholderHelpText(item.field.helpText) ? item.field.helpText : null;

    return (
      <div key={item.field.id} className="col-span-full space-y-2 pt-1 mb-2 break-inside-avoid">
        <div
          className={`rounded-md px-3.5 py-2 mb-2 border-l-4 break-after-avoid break-inside-avoid transition-all ${
            isColor ? "bg-slate-50 border-primary" : "bg-slate-100 border-slate-800"
          }`}
          style={isColor && item.field.accentColor ? { borderLeftColor: item.field.accentColor, backgroundColor: toRgbaString(item.field.accentColor, 8) } : {}}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: isColor && item.field.accentColor ? item.field.accentColor : isColor ? "#0284c7" : "#334155" }}
              />
              <h3
                className="text-xs font-bold uppercase tracking-wider text-slate-900"
                style={isColor && item.field.accentColor ? { color: item.field.accentColor } : {}}
              >
                {item.field.label}
              </h3>
            </div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">
              Seção
            </span>
          </div>
          {helpText && <p className="text-[10px] text-slate-500 italic mt-0.5 pl-4.5">{helpText}</p>}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {item.items.map((childItem) => renderLayoutItem(childItem))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full bg-white text-slate-900 font-sans p-6 sm:p-8 space-y-5 print:p-0 print:m-0 print:max-w-none">
      {/* Cabeçalho Executivo da Clínica */}
      {includeHeader && (
        <div className="border-b-2 border-slate-800 pb-3 flex items-center justify-between gap-4 break-inside-avoid">
          <div className="flex items-center gap-3.5">
            {clinicLogoUrl ? (
              <img src={clinicLogoUrl} alt={clinicName} className="h-12 max-w-[160px] object-contain rounded" />
            ) : (
              <img
                src={isColor ? "/branding/logo/pluri_health_icon_gradient.svg" : "/branding/logo/pluri_health_icon_black.svg"}
                alt={clinicName}
                className="h-11 w-11 object-contain shrink-0"
              />
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{clinicName}</h1>
              <p className="text-xs text-slate-600 font-medium">Ficha de Atendimento & Prontuário Clínico</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600 space-y-1">
            <div><span className="font-bold text-slate-800">Emissão:</span> {currentDate}</div>
            <div className="inline-block px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700 border border-slate-200">
              DOC-REF-{Math.floor(100000 + Math.random() * 900000)}
            </div>
          </div>
        </div>
      )}

      {/* 1. SEÇÃO: FICHA DE CADASTRO DO PACIENTE */}
      {includePatientRegistration && (
        <div className="space-y-2.5 break-inside-avoid">
          <div
            className={`px-3.5 py-1.5 rounded-md flex items-center justify-between break-after-avoid text-white ${
              isColor ? "bg-sky-900" : "bg-slate-900"
            }`}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider">1. FICHA DE CADASTRO DO PACIENTE</h2>
            <span className="text-[10px] font-medium opacity-90">Dados de Identificação</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="col-span-2 md:col-span-3 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Nome Completo do Paciente</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Data de Nascimento</label>
              <div className="text-xs text-slate-500 pt-1.5 font-mono">___ / ___ / ______</div>
            </div>

            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">CPF</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">RG / Órgão Emissor</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Sexo / Gênero</label>
              <div className="flex gap-2.5 pt-1.5 text-[11px] font-medium text-slate-700">
                <span>[ ] M</span> <span>[ ] F</span> <span>[ ] Outro</span>
              </div>
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Profissão / Ocupação</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>

            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Telefone / WhatsApp</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 md:col-span-2 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">E-mail</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Estado Civil</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>

            <div className="col-span-2 md:col-span-3 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Endereço Residencial (Rua, Nº, Bairro)</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">CEP / Cidade - UF</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>

            <div className="col-span-2 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Responsável Legal (se menor/dependente)</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">CPF do Responsável</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Telefone do Responsável</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>

            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Convênio / Plano de Saúde</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-1 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Nº da Carteirinha</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
            <div className="col-span-2 rounded-lg border border-slate-200/90 bg-white p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Contato de Emergência (Nome e Telefone)</label>
              <div className="h-5 border-b border-slate-300 mt-1" />
            </div>
          </div>
        </div>
      )}

      {/* 2. SEÇÃO: BLOCO PADRÃO UNIVERSAL */}
      {includeUniversalBase && printableUniversalSchema.length > 0 && (
        <div className="space-y-2.5">
          <div
            className={`px-3.5 py-1.5 rounded-md flex items-center justify-between break-after-avoid text-white ${
              isColor ? "bg-slate-800" : "bg-slate-800"
            }`}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider">2. AVALIAÇÃO BASE UNIVERSAL / ANAMNESE</h2>
            <span className="text-[10px] font-medium opacity-90">Bloco Padrão da Clínica</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {buildTemplateLayout(printableUniversalSchema).map(renderLayoutItem)}
          </div>
        </div>
      )}

      {/* 3. SEÇÃO: FICHA EXTRA / TEMPLATE ESPECÍFICO */}
      {selectedTemplateName && printableTemplateSchema.length > 0 && (
        <div className="space-y-2.5">
          <div
            className={`px-3.5 py-1.5 rounded-md flex items-center justify-between break-after-avoid text-white ${
              isColor ? "bg-primary" : "bg-slate-700"
            }`}
          >
            <h2 className="text-xs font-bold uppercase tracking-wider">3. FICHA ESPECÍFICA: {selectedTemplateName}</h2>
            <span className="text-[10px] font-medium opacity-90">Modelo Complementar</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {buildTemplateLayout(printableTemplateSchema).map(renderLayoutItem)}
          </div>
        </div>
      )}

      {/* RODAPÉ E ASSINATURA */}
      <div className="pt-4 mt-6 border-t-2 border-slate-300 grid grid-cols-2 gap-8 text-xs break-inside-avoid">
        <div>
          <p className="font-bold text-slate-800 uppercase text-[11px] tracking-tight">Observações do Profissional:</p>
          <div className="border-b border-slate-200 h-6 mt-2" />
          <div className="border-b border-slate-200 h-6" />
        </div>
        <div className="flex flex-col justify-end text-center space-y-1.5">
          <div className="border-b-2 border-slate-800 mx-auto w-4/5" />
          <p className="font-bold text-slate-900 text-xs">Assinatura e Carimbo do Profissional</p>
          <p className="text-[10px] text-slate-500 font-mono">Registro Profissional: _________________ &nbsp;|&nbsp; Data: ___/___/______</p>
        </div>
      </div>
    </div>
  );
};

export default PrintBlankKitSheet;


