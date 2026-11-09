import React from "react";
import { FeatureFlagCategory } from "@/lib/feature-flags-catalog";
import {
  Settings,
  ShieldAlert,
  Sparkles,
  Box,
  LayoutDashboard,
  FileText,
  ClipboardList,
  CreditCard,
  Printer,
  Shield,
  HelpCircle,
  Calendar,
  Megaphone,
} from "lucide-react";

export const getCategoryIcon = (category: FeatureFlagCategory): React.ReactElement => {
  switch (category) {
    case 'Governança': return <Shield className="w-4 h-4 text-emerald-600" />;
    case 'Storage/Arquivos': return <Box className="w-4 h-4" />;
    case 'Notificações': return <ShieldAlert className="w-4 h-4" />;
    case 'Dashboards': return <LayoutDashboard className="w-4 h-4" />;
    case 'Formulários': return <FileText className="w-4 h-4" />;
    case 'Prontuário/Atendimentos': return <ClipboardList className="w-4 h-4" />;
    case 'Impressão': return <Printer className="w-4 h-4" />;
    case 'UI/Experiência': return <Sparkles className="w-4 h-4" />;
    case 'Tutoriais & Ajuda': return <HelpCircle className="w-4 h-4 text-sky-500" />;
    case 'Assinaturas': return <CreditCard className="w-4 h-4" />;
    case 'Agenda': return <Calendar className="w-4 h-4 text-primary" />;
    case 'Marketing': return <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
    default: return <Settings className="w-4 h-4" />;
  }
};

export interface TagItem {
  id: string;
  name: string;
  color: string;
}

export interface FeatureFlagRecord {
  key: string;
  value: unknown;
  scope?: string;
  tag_id?: string | null;
  clinic_id?: string | null;
}

export type FlagSourceType = "global" | "tag" | "clinic" | "default";

export interface FlagSourceInfo {
  type: FlagSourceType;
  label: string;
  tagName?: string;
}
