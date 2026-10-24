import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ClinicalSpellcheckInput, ClinicalSpellcheckTextarea } from "@/components/spellcheck";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { createTreatmentBlock, type TreatmentBlock } from "@/lib/session-treatment";
import { Plus, Trash2 } from "lucide-react";

export interface SessionTreatmentFieldsProps {
  locked: boolean;
  treatmentBlocks: TreatmentBlock[];
  treatmentGeneralGuidance: string;
  onTreatmentBlocksChange: React.Dispatch<React.SetStateAction<TreatmentBlock[]>>;
  onTreatmentGeneralGuidanceChange: (val: string) => void;
  clinicId?: string;
}

export const SessionTreatmentFields = ({
  locked,
  treatmentBlocks,
  treatmentGeneralGuidance,
  onTreatmentBlocksChange,
  onTreatmentGeneralGuidanceChange,
  clinicId,
}: SessionTreatmentFieldsProps) => {
  const addTreatmentBlock = () => {
    onTreatmentBlocksChange((current) => [...current, createTreatmentBlock(current.length)]);
  };

  const updateTreatmentBlock = (blockId: string, changes: Partial<TreatmentBlock>) => {
    onTreatmentBlocksChange((current) =>
      current.map((block) => (block.id === blockId ? { ...block, ...changes } : block))
    );
  };

  const removeTreatmentBlock = (blockId: string) => {
    onTreatmentBlocksChange((current) => current.filter((block) => block.id !== blockId));
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium">Receituário de tratamento</h3>
              <ComponentHelpButton helpId="session-tab-treatment" size="xs" />
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Adicione blocos com o nome do tratamento, frequência, duração e instruções específicas.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={addTreatmentBlock} disabled={locked}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar bloco
          </Button>
        </div>

        {treatmentBlocks.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum bloco de tratamento adicionado. Use o botão "+" para montar o receituário.
          </div>
        ) : (
          <div className="space-y-4">
            {treatmentBlocks.map((block, index) => (
              <div key={block.id} className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">Bloco {index + 1}</p>
                    <p className="text-sm text-muted-foreground">Tratamento com frequência, duração e instruções.</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeTreatmentBlock(block.id)}
                    disabled={locked}
                    aria-label="Remover bloco"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nome do tratamento</Label>
                    <ClinicalSpellcheckInput
                      value={block.name}
                      onChangeValue={(val) => updateTreatmentBlock(block.id, { name: val })}
                      placeholder="Ex: Alongamento lombar"
                      disabled={locked}
                      clinicId={clinicId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>De quanto em quanto tempo</Label>
                    <ClinicalSpellcheckInput
                      value={block.frequency}
                      onChangeValue={(val) => updateTreatmentBlock(block.id, { frequency: val })}
                      placeholder="Ex: a cada 8h"
                      disabled={locked}
                      clinicId={clinicId}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Por quanto tempo</Label>
                    <ClinicalSpellcheckInput
                      value={block.duration}
                      onChangeValue={(val) => updateTreatmentBlock(block.id, { duration: val })}
                      placeholder="Ex: por 15 dias"
                      disabled={locked}
                      clinicId={clinicId}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Quantidade de séries</Label>
                      <ClinicalSpellcheckInput
                        value={block.series}
                        onChangeValue={(val) => updateTreatmentBlock(block.id, { series: val })}
                        placeholder="Opcional"
                        disabled={locked}
                        clinicId={clinicId}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade de repetições</Label>
                      <ClinicalSpellcheckInput
                        value={block.repetitions}
                        onChangeValue={(val) => updateTreatmentBlock(block.id, { repetitions: val })}
                        placeholder="Opcional"
                        disabled={locked}
                        clinicId={clinicId}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Instruções adicionais</Label>
                  <ClinicalSpellcheckTextarea
                    value={block.instructions}
                    onChangeValue={(val) => updateTreatmentBlock(block.id, { instructions: val })}
                    placeholder="Descreva detalhes do bloco de tratamento..."
                    rows={3}
                    disabled={locked}
                    clinicId={clinicId}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <Label htmlFor="treatment-general-guidance" className="text-sm font-medium">
            Orientações gerais e observações
          </Label>
          <ClinicalSpellcheckTextarea
            id="treatment-general-guidance"
            value={treatmentGeneralGuidance}
            onChangeValue={(val) => onTreatmentGeneralGuidanceChange(val)}
            placeholder="Registre orientações gerais do receituário, alertas e observações importantes..."
            className="mt-1.5"
            rows={5}
            disabled={locked}
            clinicId={clinicId}
          />
        </div>
      </CardContent>
    </Card>
  );
};
