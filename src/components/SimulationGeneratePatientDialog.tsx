import { useState } from "react";
import { UserPlus, Sparkles, Loader2, CheckCircle2, User, Baby, HeartHandshake } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  createSimulationTestPatient,
  type SimulationPatientPreset,
} from "@/lib/simulation-test-patient";
import { getPatientPath } from "@/lib/patient-routing";

interface SimulationGeneratePatientDialogProps {
  clinicId: string | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

export const SimulationGeneratePatientDialog = ({
  clinicId,
  onOpenChange,
  open,
}: SimulationGeneratePatientDialogProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<SimulationPatientPreset>("adult");
  const [customName, setCustomName] = useState("");
  const [includeFullProfile, setIncludeFullProfile] = useState(true);

  const handleGenerate = async () => {
    if (!clinicId) {
      toast({
        title: "Clínica não encontrada",
        description: "É necessário estar conectado a uma clínica para gerar pacientes.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    const result = await createSimulationTestPatient(supabase, clinicId, {
      includeFullProfile,
      name: customName.trim() || undefined,
      preset,
    });

    setLoading(false);

    if (!result.success || !result.data) {
      toast({
        title: "Erro ao gerar paciente teste",
        description: result.error || "Não foi possível cadastrar o paciente de teste.",
        variant: "destructive",
      });
      return;
    }

    const { id, name, patient_code } = result.data;

    toast({
      action: (
        <Button
          size="sm"
          variant="outline"
          className="border-primary text-primary hover:bg-primary hover:text-white"
          onClick={() => {
            navigate(getPatientPath(patient_code || id, "detalhe"));
          }}
        >
          Ver Paciente
        </Button>
      ),
      description: `${name} foi gerado com sucesso para simulação.`,
      title: "Paciente teste criado!",
    });

    onOpenChange(false);
    setCustomName("");
  };

  const presetOptions: Array<{
    description: string;
    icon: typeof User;
    id: SimulationPatientPreset;
    label: string;
  }> = [
    {
      description: "Paciente adulto (20-55 anos) com CPF próprio e profissão",
      icon: User,
      id: "adult",
      label: "Adulto Padrão",
    },
    {
      description: "Menor de idade (6-16 anos) com CPF do responsável vinculado",
      icon: Baby,
      id: "minor",
      label: "Menor com Responsável",
    },
    {
      description: "Paciente da terceira idade (62-82 anos) com histórico inicial",
      icon: HeartHandshake,
      id: "elderly",
      label: "Idoso (60+)",
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Sparkles className="h-5 w-5" />
            <DialogTitle>Gerador de Paciente Teste</DialogTitle>
          </div>
          <DialogDescription>
            Crie dados sintéticos realistas e válidos para testar prontuários, agendamentos e fluxos clínicos na clínica simulada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Presets */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Perfil do Paciente
            </Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {presetOptions.map((item) => {
                const Icon = item.icon;
                const isSelected = preset === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPreset(item.id)}
                    className={`flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all ${
                      isSelected
                        ? "border-amber-500 bg-amber-500/10 text-amber-950 dark:text-amber-200 ring-1 ring-amber-500"
                        : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon className={`h-4 w-4 ${isSelected ? "text-amber-600" : ""}`} />
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-amber-600" />}
                    </div>
                    <span className="text-xs font-medium text-foreground">{item.label}</span>
                    <span className="text-[11px] leading-tight text-muted-foreground">
                      {item.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Nome personalizado opcional */}
          <div className="space-y-1.5">
            <Label htmlFor="custom-patient-name" className="text-xs font-medium">
              Nome personalizado (opcional)
            </Label>
            <Input
              id="custom-patient-name"
              placeholder="Ex: João da Silva (Teste) - deixe vazio para gerar aleatório"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="text-sm"
            />
          </div>

          {/* Opções adicionais */}
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox
              id="full-profile"
              checked={includeFullProfile}
              onCheckedChange={(checked) => setIncludeFullProfile(Boolean(checked))}
            />
            <Label
              htmlFor="full-profile"
              className="text-xs font-normal leading-none cursor-pointer text-muted-foreground hover:text-foreground"
            >
              Enriquecer com profissão, anotação clínica inicial e dados de endereço
            </Label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-medium"
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Gerando...</span>
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                <span>Gerar Paciente Teste</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
