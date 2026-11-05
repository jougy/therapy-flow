import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  Calendar,
  Download,
  FileCheck2,
  FileText,
  Printer,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import defaultTermsMarkdown from "@/assets/terms-of-service.md?raw";
import defaultColaboradorTermsMarkdown from "@/assets/terms-of-service-colaborador.md?raw";
import defaultPrivacyMarkdown from "@/assets/privacy-policy.md?raw";
import type { TermsConfigPayload } from "@/components/terms/types";
import {
  cleanDocumentMarkdown,
  extractHeadings,
  slugify,
  type ParsedHeading,
} from "./legal/legal-markdown-utils";
import { TableOfContents } from "./legal/TableOfContents";

interface PublicLegalDocumentsProps {
  initialTab?: "termos" | "privacidade";
}

export const PublicLegalDocuments: React.FC<PublicLegalDocumentsProps> = ({
  initialTab = "termos",
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  // Determina a aba ativa baseando-se no path da URL ou prop inicial
  const isPrivacyPath =
    location.pathname.includes("privacidade") || location.pathname.includes("privacy");
  const activeTab: "termos" | "privacidade" = isPrivacyPath ? "privacidade" : "termos";

  const [termsData, setTermsData] = useState<TermsConfigPayload | null>(null);
  const [activeHeadingId, setActiveHeadingId] = useState<string>("");

  useEffect(() => {
    let isSubscribed = true;
    const fetchLatestTerms = async () => {
      try {
        const { data } = await supabase
          .from("feature_flags")
          .select("value")
          .eq("key", "terms_of_service_management")
          .maybeSingle();

        if (data?.value && isSubscribed) {
          setTermsData(data.value as TermsConfigPayload);
        }
      } catch (err) {
        console.warn("[Legal] Erro ao carregar termos remotos, usando padrão:", err);
      }
    };

    void fetchLatestTerms();
    return () => {
      isSubscribed = false;
    };
  }, []);

  const handleTabChange = (val: string) => {
    if (val === "privacidade") {
      navigate("/privacidade");
    } else {
      navigate("/termos");
    }
  };

  // Montagem do conteúdo
  const contentToDisplay = useMemo(() => {
    if (activeTab === "privacidade") {
      const rawPrivacy = termsData?.user_intl?.content || defaultPrivacyMarkdown;
      return cleanDocumentMarkdown(rawPrivacy);
    }

    // Para Termos: Sequencial com Parte 1 (Owner) e Parte 2 (Colaborador)
    const rawOwner = termsData?.owner_br?.content || defaultTermsMarkdown;
    const rawColab = termsData?.user_br?.content || defaultColaboradorTermsMarkdown;

    const cleanOwner = cleanDocumentMarkdown(rawOwner);
    const cleanColab = cleanDocumentMarkdown(rawColab);

    return [
      "# Parte I — Termos da Clínica e Contrato de Licenciamento (Owner)",
      cleanOwner,
      "\n---\n",
      "# Parte II — Termos de Uso e Código de Conduta do Colaborador (Membro da Equipe)",
      cleanColab,
    ].join("\n\n");
  }, [activeTab, termsData]);

  // Extrai lista de títulos para o sumário lateral (em Privacidade ou Termos, foca nos tópicos principais inteiros)
  const headings = useMemo(() => {
    return extractHeadings(contentToDisplay, {
      maxLevel: activeTab === "privacidade" ? 2 : 3,
    });
  }, [contentToDisplay, activeTab]);

  // Scroll spy para destacar o item ativo no sumário
  useEffect(() => {
    const handleScroll = () => {
      const headingElements = headings
        .map((h) => document.getElementById(h.id))
        .filter((el): el is HTMLElement => Boolean(el));

      const scrollPos = window.scrollY + 120;
      let currentActive = "";

      for (const el of headingElements) {
        if (el.offsetTop <= scrollPos) {
          currentActive = el.id;
        } else {
          break;
        }
      }

      if (currentActive) {
        setActiveHeadingId(currentActive);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [headings]);

  const scrollToHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 90;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
      setActiveHeadingId(id);
    }
  };

  const versionDate =
    termsData?.publishedAt ||
    termsData?.owner_br?.updatedAt ||
    new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Custom components para react-markdown adicionar IDs automáticos nos headings
  const markdownComponents = useMemo(
    () => ({
      h1: ({ children, ...props }: any) => {
        const titleText = String(children).replace(/[*_`]/g, "").trim();
        const id = slugify(titleText);
        return (
          <h2
            id={id}
            {...props}
            className="text-xl sm:text-2xl font-black tracking-tight text-primary mt-10 mb-4 pb-2 border-b-2 border-primary/20 scroll-mt-24"
          >
            {children}
          </h2>
        );
      },
      h2: ({ children, ...props }: any) => {
        const titleText = String(children).replace(/[*_`]/g, "").trim();
        const id = slugify(titleText);
        return (
          <h3
            id={id}
            {...props}
            className="text-lg sm:text-xl font-bold tracking-tight text-foreground mt-8 mb-3 scroll-mt-24"
          >
            {children}
          </h3>
        );
      },
      h3: ({ children, ...props }: any) => {
        const titleText = String(children).replace(/[*_`]/g, "").trim();
        const id = slugify(titleText);
        return (
          <h4
            id={id}
            {...props}
            className="text-base font-semibold text-foreground mt-6 mb-2 scroll-mt-24"
          >
            {children}
          </h4>
        );
      },
    }),
    []
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Barra de Navegação Superior */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/auth")}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar ao login</span>
            </Button>
            <div className="h-4 w-[1px] bg-border" />
            <div className="flex items-center gap-2">
              <img
                src="/branding/logo/pluri_health_icon_gradient.svg"
                alt="Pluri Health"
                className="h-6 w-6"
              />
              <span className="font-semibold text-sm tracking-tight text-foreground">
                Pluri Health
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-2 text-xs h-9 border-border/80 hover:bg-accent"
            >
              <Printer className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 sm:py-12">
        {/* Cabeçalho do Documento */}
        <div className="mb-8 space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Documentos Oficiais & Compliance Legal</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {activeTab === "termos" ? "Termos de Uso e Licenciamento" : "Política de Privacidade e LGPD"}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Atualizado em: <strong className="text-foreground">{versionDate}</strong>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
              Versão Vigente da Plataforma
            </span>
          </div>

          {/* Abas para alternar entre Termos e Privacidade */}
          <div className="pt-2 print:hidden">
            <Tabs
              value={activeTab}
              onValueChange={handleTabChange}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid w-full sm:w-auto grid-cols-2">
                <TabsTrigger value="termos" className="text-xs gap-2">
                  <FileText className="h-3.5 w-3.5" />
                  Termos de Uso
                </TabsTrigger>
                <TabsTrigger value="privacidade" className="text-xs gap-2">
                  <Shield className="h-3.5 w-3.5" />
                  Privacidade (LGPD)
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Layout de Conteúdo com Sumário Fixo / Retrátil */}
        <div className="relative w-full">
          {/* Card do Conteúdo Markdown Renderizado */}
          <Card className="w-full border border-border/80 shadow-sm bg-card overflow-hidden">
            <CardContent className="p-6 sm:p-10">
              <article className="prose prose-sm sm:prose-base dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-primary prose-a:underline hover:prose-a:text-primary/80 prose-hr:border-border">
                <ReactMarkdown components={markdownComponents}>
                  {contentToDisplay}
                </ReactMarkdown>
              </article>
            </CardContent>
          </Card>

          {/* Sumário Fixo na Tela (Centralizado Verticalmente à Direita) */}
          <TableOfContents
            headings={headings}
            activeId={activeHeadingId}
            onHeadingClick={scrollToHeading}
          />
        </div>

        {/* Rodapé Informativo */}
        <div className="mt-8 pt-6 border-t border-border/60 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Pluri Health Tecnologia. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <Link to="/auth" className="hover:text-foreground transition-colors">
              Acessar Plataforma
            </Link>
            <span>•</span>
            <a
              href="mailto:suporte@plurifisio.com.br"
              className="hover:text-foreground transition-colors"
            >
              Dúvidas Jurídicas e DPO
            </a>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PublicLegalDocuments;
