import React, { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";
import { formatAddress } from "@/lib/patient-formatting";
import { SummaryBlock } from "@/components/patients/SummaryBlock";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientAddressTabProps {
  patient: Patient;
}

export const PatientAddressTab: React.FC<PatientAddressTabProps> = ({ patient }) => {
  const fullAddress = useMemo(() => formatAddress(patient), [patient]);

  const googleMapsUrl = useMemo(() => {
    if (!fullAddress) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      fullAddress.replace(/\n/g, ", ")
    )}`;
  }, [fullAddress]);

  return (
    <SummaryBlock
      title="Endereço Residencial"
      description="Dados de localização cadastrados do paciente."
      headerAction={
        googleMapsUrl ? (
          <Button asChild size="sm" variant="outline" className="gap-1.5 text-xs">
            <a href={googleMapsUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5 text-primary" />
              <span>Abrir no Google Maps</span>
            </a>
          </Button>
        ) : null
      }
      values={[
        {
          label: "Logradouro e número",
          value: [patient.street, patient.address_number].filter(Boolean).join(", ") || null,
          fallback: "Não informado",
        },
        {
          label: "Complemento",
          value: patient.address_complement,
          fallback: "Não informado",
        },
        {
          label: "Bairro",
          value: patient.neighborhood,
          fallback: "Não informado",
        },
        {
          label: "Cidade / UF",
          value: [patient.city, patient.state].filter(Boolean).join(" / ") || null,
          fallback: "Não informado",
        },
        {
          label: "CEP",
          value: patient.cep,
          fallback: "Não informado",
        },
        {
          label: "País",
          value: patient.country,
          fallback: "Brasil",
        },
      ]}
    />
  );
};
