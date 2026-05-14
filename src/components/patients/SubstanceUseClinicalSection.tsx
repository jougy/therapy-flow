import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createSubstanceUseRecord,
  DEPENDENCY_LEVEL_OPTIONS,
  type DependencyLevelValue,
  type PatientClinicalProfile,
  type PatientSubstanceUseRecord,
} from "@/lib/patient-clinical-profile";

type ClinicalProfileUpdater = <K extends keyof PatientClinicalProfile>(
  key: K,
  value: PatientClinicalProfile[K],
) => void;

const BoolChoice = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-background p-3">
    <p className="text-sm font-medium">{label}</p>
    <div className="grid grid-cols-2 rounded-lg bg-muted p-1">
      <Button className="h-8 rounded-md px-4" onClick={() => onChange(true)} size="sm" type="button" variant={value ? "default" : "ghost"}>
        Sim
      </Button>
      <Button className="h-8 rounded-md px-4" onClick={() => onChange(false)} size="sm" type="button" variant={!value ? "default" : "ghost"}>
        Não
      </Button>
    </div>
  </div>
);

const UseRecordFields = ({
  blockLabel,
  onRemove,
  onUpdate,
  record,
}: {
  blockLabel: string;
  onRemove: () => void;
  onUpdate: (changes: Partial<PatientSubstanceUseRecord>) => void;
  record: PatientSubstanceUseRecord;
}) => (
  <div className="space-y-4 rounded-xl border border-border/70 bg-background p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="font-medium">{blockLabel}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remover registro">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Nome</Label>
        <Input
          value={record.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
          placeholder="Ex: cigarro, álcool, cannabis, café, jogo..."
        />
      </div>
      <div className="space-y-2">
        <Label>Quando começou</Label>
        <Input
          value={record.started_at}
          onChange={(event) => onUpdate({ started_at: event.target.value })}
          placeholder="Ex: há 2 anos, adolescência, 2024..."
        />
      </div>
      <div className="space-y-2">
        <Label>É ilícito?</Label>
        <div className="grid grid-cols-2 rounded-lg border border-border/70 bg-muted p-1">
          <Button className="h-9 rounded-md" onClick={() => onUpdate({ is_illicit: true })} type="button" variant={record.is_illicit ? "default" : "ghost"}>
            Sim
          </Button>
          <Button className="h-9 rounded-md" onClick={() => onUpdate({ is_illicit: false })} type="button" variant={!record.is_illicit ? "default" : "ghost"}>
            Não
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Padrão de uso/dependência</Label>
        <Select
          value={record.dependency_level}
          onValueChange={(value) => onUpdate({ dependency_level: value as DependencyLevelValue })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o padrão observado" />
          </SelectTrigger>
          <SelectContent>
            {DEPENDENCY_LEVEL_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Frequência de uso</Label>
        <Input
          value={record.frequency}
          onChange={(event) => onUpdate({ frequency: event.target.value })}
          placeholder="Ex: diário, socialmente, 2x por semana..."
        />
      </div>
      <div className="space-y-2">
        <Label>Motivação de uso</Label>
        <Input
          value={record.motivation}
          onChange={(event) => onUpdate({ motivation: event.target.value })}
          placeholder="Ex: ansiedade, social, dor, hábito..."
        />
      </div>
    </div>

    <div className="space-y-2">
      <Label>Observações</Label>
      <Textarea
        value={record.notes}
        onChange={(event) => onUpdate({ notes: event.target.value })}
        placeholder="Registre contexto, tentativas de redução, riscos percebidos ou informações relevantes..."
        rows={3}
      />
    </div>
  </div>
);

export const SubstanceUseClinicalSection = ({
  clinicalProfile,
  updateClinicalProfile,
}: {
  clinicalProfile: PatientClinicalProfile;
  updateClinicalProfile: ClinicalProfileUpdater;
}) => {
  const updateSubstanceRecord = (recordId: string, changes: Partial<PatientSubstanceUseRecord>) => {
    updateClinicalProfile(
      "substance_use_records",
      clinicalProfile.substance_use_records.map((record) => (
        record.id === recordId ? { ...record, ...changes } : record
      )),
    );
  };

  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-muted/20 p-4">
      <div>
        <h3 className="text-sm font-semibold">Uso, substâncias e dependência</h3>
        <p className="text-xs text-muted-foreground">
          Registre substâncias lícitas, ilícitas ou comportamentos compulsivos relevantes em um único lugar.
        </p>
      </div>

      <BoolChoice
        label="Há uso de substância ou comportamento compulsivo relevante?"
        value={clinicalProfile.uses_substances}
        onChange={(value) => {
          updateClinicalProfile("uses_substances", value);
          updateClinicalProfile("has_addictions", false);
          updateClinicalProfile("addiction_records", []);
          if (!value) {
            updateClinicalProfile("substance_use_records", []);
            updateClinicalProfile("substance_use_history", "");
          }
        }}
      />

      {clinicalProfile.uses_substances ? (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => updateClinicalProfile(
                "substance_use_records",
                [...clinicalProfile.substance_use_records, createSubstanceUseRecord(clinicalProfile.substance_use_records.length)],
              )}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar registro
            </Button>
          </div>

          {clinicalProfile.substance_use_records.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum registro adicionado. Use o botão para registrar uma substância, hábito ou comportamento relevante.
            </div>
          ) : (
            clinicalProfile.substance_use_records.map((record, index) => (
              <UseRecordFields
                key={record.id}
                blockLabel={`Registro ${index + 1}`}
                record={record}
                onUpdate={(changes) => updateSubstanceRecord(record.id, changes)}
                onRemove={() => updateClinicalProfile(
                  "substance_use_records",
                  clinicalProfile.substance_use_records.filter((item) => item.id !== record.id),
                )}
              />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
};
