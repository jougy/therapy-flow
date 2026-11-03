import React from "react";
import defaultAdultTermsMarkdown from "@/assets/adult-terms-of-consent.md?raw";
import defaultMinorTermsMarkdown from "@/assets/minor-terms-of-responsibility.md?raw";
import defaultPrintTermsMarkdown from "@/assets/print-terms-of-responsibility.md?raw";
import defaultTermsMarkdown from "@/assets/terms-of-service.md?raw";
import { Shield, Users, Globe, Printer, FileText, Baby } from "lucide-react";

export interface TermsDocItem {
  content: string;
  filename: string;
  updatedAt: string;
}

export interface TermsConfigPayload {
  owner_br?: TermsDocItem;
  user_br?: TermsDocItem;
  owner_intl?: TermsDocItem;
  user_intl?: TermsDocItem;
  print_terms?: TermsDocItem;
  adult_terms?: TermsDocItem;
  minor_terms?: TermsDocItem;
  minor_consent?: TermsDocItem;
  publishedVersion?: string;
  publishedAt?: string;
}

export type DocTypeKey =
  | "owner_br"
  | "user_br"
  | "owner_intl"
  | "user_intl"
  | "print_terms"
  | "adult_terms"
  | "minor_terms";

export interface DocTypeDef {
  key: DocTypeKey;
  label: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultFallback?: { filename: string; content: string };
}

export const DOC_TYPES: DocTypeDef[] = [
  {
    key: "owner_br",
    label: "Termos Owner (Brasil)",
    badge: "PT-BR | Owner",
    description: "Direcionado especificamente para administradores/owners de clínicas no Brasil.",
    icon: Shield,
    defaultFallback: {
      filename: "terms-of-service-owner-br.md (Padrão)",
      content: defaultTermsMarkdown,
    },
  },
  {
    key: "user_br",
    label: "Termos Usuários (Brasil)",
    badge: "PT-BR | Todos",
    description: "Aplicável a todos os usuários brasileiros (profissionais, assistentes, estagiários e owners).",
    icon: Users,
    defaultFallback: {
      filename: "terms-of-service-user-br.md (Padrão)",
      content: defaultTermsMarkdown,
    },
  },
  {
    key: "owner_intl",
    label: "Termos Owner (Internacional)",
    badge: "EN | Owner",
    description: "Direcionado para administradores/owners de clínicas internacionais (em inglês).",
    icon: Globe,
    defaultFallback: {
      filename: "terms-of-service-owner-intl.md (Padrão)",
      content: defaultTermsMarkdown,
    },
  },
  {
    key: "user_intl",
    label: "Termos Usuários (Internacional)",
    badge: "EN | Todos",
    description: "Aplicável a todos os usuários internacionais (em inglês, incluindo owners).",
    icon: Users,
    defaultFallback: {
      filename: "terms-of-service-user-intl.md (Padrão)",
      content: defaultTermsMarkdown,
    },
  },
  {
    key: "print_terms",
    label: "Termo de Responsabilidade para Impressão",
    badge: "PT-BR | Impressão LGPD",
    description: "Exibido a qualquer usuário antes de realizar a impressão de relatórios e dados sensíveis.",
    icon: Printer,
    defaultFallback: {
      filename: "print-terms-of-responsibility.md (Padrão)",
      content: defaultPrintTermsMarkdown,
    },
  },
  {
    key: "adult_terms",
    label: "Termo de Consentimento Livre e Esclarecido (Adultos)",
    badge: "PT-BR | Adultos",
    description: "Termo de consentimento (TCLE), conformidade com a LGPD (Arts. 7º e 11) e normas de saúde (CFM 1.821/2007) para pacientes adultos.",
    icon: FileText,
    defaultFallback: {
      filename: "adult-terms-of-consent.md (Padrão)",
      content: defaultAdultTermsMarkdown,
    },
  },
  {
    key: "minor_terms",
    label: "Termo de Consentimento para Menor de Idade (LGPD)",
    badge: "PT-BR | Menor de Idade LGPD",
    description: "Termo de consentimento específico e em destaque para coleta e tratamento de dados de crianças e adolescentes (Art. 14 da LGPD).",
    icon: Baby,
    defaultFallback: {
      filename: "minor-terms-of-responsibility.md (Padrão)",
      content: defaultMinorTermsMarkdown,
    },
  },
];
