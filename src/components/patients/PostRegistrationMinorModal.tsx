import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Smartphone,
  PenTool,
  Printer,
  ChevronRight,
  ShieldCheck,
  Baby,
  ArrowRight,
} from "lucide-react";
import type { SharePatientData } from "@/components/patients/SharePatientRegistrationModal";
import { calculateAgeDetails } from "@/lib/patient-registration";

export type MinorCollectionChannel = "whatsapp" | "in_person" | "paper";

interface PostRegistrationMinorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: SharePatientData | null;
  clinicName?: string;
  onSelectChannel: (channel: MinorCollectionChannel, includeFullRegistration: boolean) => void;
  onSkip: () => void;
}

export const PostRegistrationMinorModal: React.FC<PostRegistrationMinorModalProps> = ({
  open,
  onOpenChange,
  patient,
  clinicName = "nossa clínica",
  onSelectChannel,
  onSkip,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<MinorCollectionChannel>("whatsapp");
  const [includeFullRegistration, setIncludeFullRegistration] = useState(true);

  const ageDetails = calculateAgeDetails(patient?.date_of_birth);
  const ageLabel = ageDetails?.label || (patient?.age ? `${patient.age} anos` : "menor de idade");
  const guardianName = patient?.responsible_name || "Responsável Legal";
  const guardianRel = patient?.responsible_relationship || "Responsável";

  const handleProceed = () => {
    onOpenChange(false);
    onSelectChannel(selectedChannel, includeFullRegistration);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden sm:rounded-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b bg-amber-500/10">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs tracking-wider uppercase">
            <Baby className="w-4 h-4" />
            Autorização de Menor (LGPD Art. 14)
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground mt-1">
            Pré-cadastro de {patient?.name} ({ageLabel}) concluído!
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            Por exigência da legislação (LGPD), os atendimentos e a guarda de prontuário clínico de crianças e adolescentes exigem consentimento formal de um responsável legal (<strong>{guardianName} - {guardianRel}</strong>).
          </DialogDescription>
        </DialogHeader>

        {/* Content with 3 channels */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
            Como deseja colher a assinatura neste momento?
          </p>

          <div className="space-y-3">
            {/* Canal 1: WhatsApp / Celular */}
            <div
              onClick={() => setSelectedChannel("whatsapp")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedChannel === "whatsapp"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground flex items-center gap-2">
                    Enviar por WhatsApp / Celular
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      Recomendado
                    </span>
                  </span>
                  <input
                    type="radio"
                    name="minor_channel"
                    checked={selectedChannel === "whatsapp"}
                    onChange={() => setSelectedChannel("whatsapp")}
                    className="accent-primary h-4 w-4"
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Gera mensagem personalizada para <strong>{guardianName}</strong> com link seguro. O responsável lê o termo e autoriza digitalmente no próprio smartphone em 1 minuto.
                </p>

                {selectedChannel === "whatsapp" && (
                  <div className="pt-2">
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center space-x-2 bg-background/80 p-2.5 rounded-lg border text-xs"
                    >
                      <Checkbox
                        id="include-full-reg"
                        checked={includeFullRegistration}
                        onCheckedChange={(c) => setIncludeFullRegistration(Boolean(c))}
                      />
                      <Label htmlFor="include-full-reg" className="text-xs cursor-pointer font-normal text-muted-foreground">
                        Incluir também o preenchimento da ficha de saúde na mesma mensagem
                      </Label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Canal 2: Presencial na Tela */}
            <div
              onClick={() => setSelectedChannel("in_person")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedChannel === "in_person"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                <PenTool className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">
                    Assinar agora nesta tela (Presencial)
                  </span>
                  <input
                    type="radio"
                    name="minor_channel"
                    checked={selectedChannel === "in_person"}
                    onChange={() => setSelectedChannel("in_person")}
                    className="accent-primary h-4 w-4"
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O responsável está na recepção ou no consultório agora? Abra a lousa de assinatura digital para ele rubricar diretamente com o dedo ou mouse.
                </p>
              </div>
            </div>

            {/* Canal 3: Impressão A4 */}
            <div
              onClick={() => setSelectedChannel("paper")}
              className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-start gap-3.5 ${
                selectedChannel === "paper"
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <Printer className="w-5 h-5" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-foreground">
                    Imprimir termo físico em papel
                  </span>
                  <input
                    type="radio"
                    name="minor_channel"
                    checked={selectedChannel === "paper"}
                    onChange={() => setSelectedChannel("paper")}
                    className="accent-primary h-4 w-4"
                  />
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Gera o documento formatado em A4 para assinatura com caneta. O sistema registrará como <strong>"Pendente de Assinatura Física"</strong> no prontuário.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col-reverse sm:flex-row gap-2 justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              onSkip();
            }}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Ir para o prontuário sem colher agora
          </Button>

          <Button
            type="button"
            onClick={handleProceed}
            className="font-semibold shadow-sm gap-2"
          >
            <span>Prosseguir com este canal</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
