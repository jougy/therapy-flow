import React, { useState } from "react";
import {
  Calendar,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Layers,
  List,
  MapPin,
  RotateCcw,
  Sliders,
  Sparkles,
  Table,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { type AnamnesisField, type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

interface InteractiveFormLivePreviewProps {
  schema: AnamnesisTemplateSchema;
  title: string;
}

export const InteractiveFormLivePreview: React.FC<InteractiveFormLivePreviewProps> = ({
  schema,
  title,
}) => {
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const handleReset = () => {
    setFormValues({});
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionId]: prev[sectionId] === undefined ? false : !prev[sectionId],
    }));
  };

  const handleValueChange = (fieldId: string, value: any) => {
    setFormValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleCheckboxToggle = (fieldId: string, optionLabel: string) => {
    const currentList: string[] = Array.isArray(formValues[fieldId]) ? formValues[fieldId] : [];
    if (currentList.includes(optionLabel)) {
      handleValueChange(
        fieldId,
        currentList.filter((item) => item !== optionLabel)
      );
    } else {
      handleValueChange(fieldId, [...currentList, optionLabel]);
    }
  };

  return (
    <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
      {/* Interactive Simulator Top Bar */}
      <div className="bg-muted/40 border-b px-5 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Simulador de Preenchimento Real (Live Sandbox)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs gap-1.5"
            title="Resetar respostas do teste"
          >
            <RotateCcw className="h-3 w-3" />
            Limpar Teste
          </Button>
        </div>
      </div>

      {/* Form Canvas */}
      <div className="p-6 space-y-6">
        {schema.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum campo estruturado neste modelo.
          </div>
        ) : (
          schema.map((field: AnamnesisField, index: number) => {
            const isSection =
              field.type === "section" ||
              field.type === "horizontal_section" ||
              field.type === "section_selector";

            // If this is a section header
            if (isSection) {
              const isOpen = openSections[field.id] !== false; // default open
              return (
                <div
                  key={field.id || index}
                  className="rounded-xl border border-primary/20 bg-primary/5 overflow-hidden transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleSection(field.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-primary/10 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-6 w-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                        <Layers className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">
                          {field.label || "Seção de Atendimento"}
                        </h4>
                        {field.helpText && (
                          <p className="text-xs text-muted-foreground">{field.helpText}</p>
                        )}
                      </div>
                    </div>

                    <div className="text-muted-foreground">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </button>
                </div>
              );
            }

            // Normal Input Field
            const value = formValues[field.id] ?? "";

            return (
              <div
                key={field.id || index}
                className="space-y-2 rounded-xl border p-4 bg-background hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label htmlFor={field.id} className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <span>{field.label || "Campo"}</span>
                    {field.required && (
                      <span className="text-rose-500 font-bold" title="Obrigatório">
                        *
                      </span>
                    )}
                  </Label>

                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    {field.type}
                  </Badge>
                </div>

                {field.helpText && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <HelpCircle className="h-3 w-3 shrink-0 opacity-70" />
                    {field.helpText}
                  </p>
                )}

                {/* Render field type input */}
                {field.type === "short_text" && (
                  <Input
                    id={field.id}
                    value={value}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    placeholder={field.placeholder || "Digite sua resposta..."}
                    className="text-xs"
                  />
                )}

                {field.type === "long_text" && (
                  <Textarea
                    id={field.id}
                    value={value}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    placeholder={field.placeholder || "Escreva detalhadamente..."}
                    rows={3}
                    className="text-xs"
                  />
                )}

                {field.type === "number" && (
                  <Input
                    id={field.id}
                    type="number"
                    value={value}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    placeholder="0"
                    className="text-xs w-36"
                  />
                )}

                {field.type === "date" && (
                  <Input
                    id={field.id}
                    type="date"
                    value={value}
                    onChange={(e) => handleValueChange(field.id, e.target.value)}
                    className="text-xs w-48"
                  />
                )}

                {field.type === "slider" && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {field.sliderMinLabel || `Mínimo (${field.min ?? 0})`}
                      </span>
                      <span className="font-bold text-primary text-sm px-2 py-0.5 bg-primary/10 rounded">
                        {typeof value === "number" ? value : field.min ?? 0}
                      </span>
                      <span className="text-muted-foreground">
                        {field.sliderMaxLabel || `Máximo (${field.max ?? 10})`}
                      </span>
                    </div>
                    <Slider
                      min={field.min ?? 0}
                      max={field.max ?? 10}
                      step={field.sliderStep ?? 1}
                      value={[typeof value === "number" ? value : field.min ?? 0]}
                      onValueChange={([val]) => handleValueChange(field.id, val)}
                    />
                  </div>
                )}

                {field.type === "select" && (
                  <Select value={value} onValueChange={(val) => handleValueChange(field.id, val)}>
                    <SelectTrigger id={field.id} className="text-xs w-full">
                      <SelectValue placeholder="Selecione uma opção..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(field.options || []).map((opt) => (
                        <SelectItem key={opt.id} value={opt.label || opt.id} className="text-xs">
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {(field.type === "checklist" || field.type === "multiple_choice") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {(field.options || []).map((opt) => {
                      const selectedList: string[] = Array.isArray(value) ? value : [];
                      const isChecked = selectedList.includes(opt.label);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => handleCheckboxToggle(field.id, opt.label)}
                          className={`flex items-center space-x-2.5 rounded-lg border p-2.5 cursor-pointer transition-colors ${
                            isChecked
                              ? "bg-primary/10 border-primary text-foreground"
                              : "bg-card hover:bg-muted/40 text-muted-foreground"
                          }`}
                        >
                          <Checkbox checked={isChecked} />
                          <span className="text-xs font-medium leading-none">{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {field.type === "table" && (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/50 border-b">
                        <tr>
                          {(field.options || []).map((col) => (
                            <th key={col.id} className="p-2.5 font-semibold text-foreground">
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b">
                          {(field.options || []).map((col) => (
                            <td key={col.id} className="p-2">
                              <Input
                                placeholder="Preencher..."
                                className="h-8 text-xs bg-background"
                              />
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {field.type === "address_block" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    <Input placeholder="CEP..." className="text-xs" />
                    <Input placeholder="Cidade..." className="text-xs sm:col-span-2" />
                    <Input placeholder="Endereço / Logradouro..." className="text-xs sm:col-span-3" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
