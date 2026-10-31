import React from "react";
import { Badge } from "@/components/ui/badge";
import { Camera, Printer, Download, Eye } from "lucide-react";

export interface TelemetryRecord {
  id: string;
  clinic_id: string;
  user_id: string | null;
  user_name: string | null;
  event_type: "print_screen" | "document_print" | "page_view" | "export_pdf" | string;
  pathname: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PlatformClinicStatisticsProps {
  clinicId: string;
  counts?: {
    sessions?: number;
    patients?: number;
    collaborators?: number;
    forms?: number;
  };
}

export const formatPrecisionTimestamp = (isoString: string) => {
  if (!isoString) return "-";
  const date = new Date(isoString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  const ms = String(date.getMilliseconds()).padStart(3, "0");

  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}.${ms}`;
};

export const getEventBadge = (eventType: string) => {
  switch (eventType) {
    case "print_screen":
      return (
        <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900 flex items-center gap-1.5 font-medium">
          <Camera className="w-3.5 h-3.5 text-red-600" /> Captura de Tela (Print)
        </Badge>
      );
    case "document_print":
      return (
        <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900 flex items-center gap-1.5 font-medium">
          <Printer className="w-3.5 h-3.5 text-blue-600" /> Impressão de Doc
        </Badge>
      );
    case "export_pdf":
      return (
        <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-900 flex items-center gap-1.5 font-medium">
          <Download className="w-3.5 h-3.5 text-purple-600" /> Exportação PDF
        </Badge>
      );
    case "page_view":
    default:
      return (
        <Badge variant="outline" className="bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5 text-neutral-500" /> Navegação
        </Badge>
      );
  }
};
