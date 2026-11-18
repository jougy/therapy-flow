import React from "react";
import { ShieldCheck, Eye, Scale, FileText, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import termsOfServiceOwnerRaw from "@/assets/terms-of-service.md?raw";
import termsOfServiceColaboradorRaw from "@/assets/terms-of-service-colaborador.md?raw";
import privacyPolicyRaw from "@/assets/privacy-policy.md?raw";
import type { PreviewDocState } from "./types";

interface PluriImmutableTermsSectionProps {
  onPreview: (preview: PreviewDocState) => void;
}

export const PluriImmutableTermsSection: React.FC<PluriImmutableTermsSectionProps> = ({
  onPreview,
}) => {
  const immutableTerms = [
    {
      id: "owner_terms",
      title: "Termos de Uso e Licenciamento - Administrador (Owner)",
      filename: "terms-of-service.md",
      icon: Scale,
      description:
        "Contrato de licenciamento da plataforma, responsabilidades operacionais do titular, SLAs de disponibilidade, propriedade intelectual e governança institucional.",
      content: termsOfServiceOwnerRaw,
    },
    {
      id: "colaborador_terms",
      title: "Termos de Uso e Conduta - Colaborador da Clínica",
      filename: "terms-of-service-colaborador.md",
      icon: FileText,
      description:
        "Código de conduta profissional, sigilo e confidencialidade clínica, segurança de acessos e conformidade com conselhos de classe para terapeutas e equipe.",
      content: termsOfServiceColaboradorRaw,
    },
    {
      id: "privacy_policy",
      title: "Política de Privacidade e Proteção de Dados (LGPD / HIPAA)",
      filename: "privacy-policy.md",
      icon: Lock,
      description:
        "Bases legais (Arts. 7º, 11 e 14 da LGPD), criptografia de prontuários, retenção regulatória de 20 anos (CFM 1.821/2007) e diretrizes de sigilo inviolável.",
      content: privacyPolicyRaw,
    },
  ];

  return (
    <div className="space-y-4 pt-6 border-t border-neutral-200/80 dark:border-neutral-800">
      {/* Cabeçalho da Seção Oficial */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-sky-600 dark:text-sky-400" />
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50">
            Termos Oficiais da Plataforma Pluri-Health
          </h3>
        </div>
      </div>

      {/* Grid de Cartões Imutáveis */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {immutableTerms.map((term) => {
          const Icon = term.icon;
          return (
            <Card
              key={term.id}
              className="border shadow-sm flex flex-col justify-between bg-card/60 hover:bg-card transition-colors"
            >
              <CardHeader className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-sm font-semibold leading-tight">
                      {term.title}
                    </CardTitle>
                  </div>
                </div>
                <CardDescription className="text-xs line-clamp-3 leading-relaxed">
                  {term.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-4 pt-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-xs h-8 gap-1.5"
                  onClick={() =>
                    onPreview({
                      title: term.title,
                      content: term.content,
                      isImmutable: true,
                    })
                  }
                >
                  <Eye className="w-3.5 h-3.5" />
                  Consultar redação oficial
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
