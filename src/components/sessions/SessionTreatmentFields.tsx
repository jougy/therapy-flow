import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { createTreatmentBlock, type TreatmentBlock } from "@/lib/session-treatment";
import { Plus, Trash2 } from "lucide-react";

export interface SessionTreatmentFieldsProps {
  locked: boolean;
  treatmentBlocks: TreatmentBlock[];
  treatmentGeneralGuidance: string;
  onTreatmentBlocksChange: React.Dispatch<React.SetStateAction<TreatmentBlock[]>>;
  onTreatmentGeneralGuidanceChange: (val: string) => void;
}

export const SessionTreatmentFields = ({
  locked,
  treatmentBlocks,
  treatmentGeneralGuidance,
  onTreatmentBlocksChange,
  onTreatmentGeneralGuidanceChange,
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
                    <Input
                      value={block.name}
                      onChange={(event) => updateTreatmentBlock(block.id, { name: event.target.value })}
                      placeholder="Ex: Alongamento lombar"
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>De quanto em quanto tempo</Label>
                    <Input
                      value={block.frequency}
                      onChange={(event) => updateTreatmentBlock(block.id, { frequency: event.target.value })}
                      placeholder="Ex: a cada 8h"
                      disabled={locked}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Por quanto tempo</Label>
                    <Input
                      value={block.duration}
                      onChange={(event) => updateTreatmentBlock(block.id, { duration: event.target.value })}
                      placeholder="Ex: por 15 dias"
                      disabled={locked}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Quantidade de séries</Label>
                      <Input
                        value={block.series}
                        onChange={(event) => updateTreatmentBlock(block.id, { series: event.target.value })}
                        placeholder="Opcional"
                        disabled={locked}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade de repetições</Label>
                      <Input
                        value={block.repetitions}
                        onChange={(event) => updateTreatmentBlock(block.id, { repetitions: event.target.value })}
                        placeholder="Opcional"
                        disabled={locked}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Instruções adicionais</Label>
                  <Textarea
                    value={block.instructions}
                    onChange={(event) => updateTreatmentBlock(block.id, { instructions: event.target.value })}
                    placeholder="Descreva detalhes do bloco de tratamento..."
                    rows={3}
                    disabled={locked}
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
          <Textarea
            id="treatment-general-guidance"
            value={treatmentGeneralGuidance}
            onChange={(event) => onTreatmentGeneralGuidanceChange(event.target.value)}
            placeholder="Registre orientações gerais do receituário, alertas e observações importantes..."
            className="mt-1.5"
            rows={5}
            disabled={locked}
          />
        </div>
      </CardContent>
    </Card>
  );
};
