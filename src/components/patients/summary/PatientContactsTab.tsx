import React, { useMemo } from "react";
import { Lock, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Database } from "@/integrations/supabase/types";
import type { PatientEmergencyContact } from "@/lib/patient-clinical-profile";
import { cleanDigits } from "@/lib/patient-formatting";
import { formatPatientPhone } from "@/lib/patient-registration";
import { SummaryBlock } from "@/components/patients/SummaryBlock";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientContactsTabProps {
  patient: Patient;
  emergencyContact: PatientEmergencyContact;
  canViewContacts: boolean;
}

export const PatientContactsTab: React.FC<PatientContactsTabProps> = ({
  patient,
  emergencyContact,
  canViewContacts,
}) => {
  const phoneDigits = useMemo(() => cleanDigits(patient.phone), [patient.phone]);
  const whatsappDigits = useMemo(() => {
    if (!phoneDigits) return null;
    return phoneDigits.startsWith("55") && phoneDigits.length >= 12
      ? phoneDigits
      : `55${phoneDigits}`;
  }, [phoneDigits]);
  const whatsappUrl = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null;

  const emergencyPhoneDigits = useMemo(
    () => cleanDigits(emergencyContact.phone),
    [emergencyContact.phone]
  );
  const emergencyWhatsappDigits = useMemo(() => {
    if (!emergencyPhoneDigits) return null;
    return emergencyPhoneDigits.startsWith("55") && emergencyPhoneDigits.length >= 12
      ? emergencyPhoneDigits
      : `55${emergencyPhoneDigits}`;
  }, [emergencyPhoneDigits]);
  const emergencyWhatsappUrl = emergencyWhatsappDigits
    ? `https://wa.me/${emergencyWhatsappDigits}`
    : null;

  return (
    <div className="space-y-5">
      {/* Banner de Sigilo Assistencial */}
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5 text-xs leading-relaxed">
          <p className="font-semibold text-foreground">Sigilo Assistencial e Proteção de Dados (LGPD)</p>
          <p className="text-muted-foreground">
            Estes canais de contato são de natureza estritamente assistencial e confidencial. O uso é
            restrito ao cuidado clínico, agendamentos e suporte ao paciente.
          </p>
        </div>
      </div>

      {canViewContacts ? (
        <>
          <SummaryBlock
            title="Contato Pessoal"
            description="Canais primários de comunicação com o paciente."
            values={[
              {
                label: "Telefone / WhatsApp",
                value: patient.phone ? formatPatientPhone(patient.phone) : null,
                fallback: "Não informado",
                action: phoneDigits ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                      <a href={`tel:${phoneDigits}`}>
                        <Phone className="h-3 w-3 text-primary" />
                        Ligar
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <a href={whatsappUrl!} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </a>
                    </Button>
                  </div>
                ) : null,
              },
              {
                label: "E-mail",
                value: patient.email,
                fallback: "Não informado",
                action: patient.email ? (
                  <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                    <a href={`mailto:${patient.email}`}>
                      <Mail className="h-3 w-3 text-primary" />
                      Enviar e-mail
                    </a>
                  </Button>
                ) : null,
              },
            ]}
          />

          <SummaryBlock
            title="Contato de Emergência"
            description="Pessoa de referência para situações sensíveis ou comunicação assistencial rápida."
            values={[
              { label: "Nome", value: emergencyContact.name, fallback: "Não informado" },
              {
                label: "Parentesco ou vínculo",
                value: emergencyContact.relationship,
                fallback: "Não informado",
              },
              {
                label: "Telefone de emergência",
                value: emergencyContact.phone ? formatPatientPhone(emergencyContact.phone) : null,
                fallback: "Não informado",
                action: emergencyPhoneDigits ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                      <a href={`tel:${emergencyPhoneDigits}`}>
                        <Phone className="h-3 w-3 text-primary" />
                        Ligar
                      </a>
                    </Button>
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                    >
                      <a href={emergencyWhatsappUrl!} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="h-3 w-3" />
                        WhatsApp
                      </a>
                    </Button>
                  </div>
                ) : null,
              },
            ]}
          />
        </>
      ) : (
        <Card className="border-border/70 shadow-sm p-6 text-center space-y-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Acesso restrito por Sigilo Profissional</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Você não possui credenciais suficientes para visualizar os dados de contato direto deste
              paciente.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};
