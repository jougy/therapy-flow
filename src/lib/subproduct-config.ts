/**
 * Subproduct Multi-Tenant Architecture & Brand Umbrella Catalog.
 *
 * Directrizes:
 * - Identifica dinamicamente o subproduto pelo hostname (ex: app.plurifisio.com.br vs app.pluri.health).
 * - Centraliza IDs de Analytics (GA4 Measurement ID, Meta Pixel ID, Microsoft Clarity / Hitmap).
 * - Fornece metadados de SEO, AEO e Schema.org JSON-LD médicos/saúde.
 */

export type SubproductKey =
  | "plurifisio"
  | "pluripsy"
  | "plurinutri"
  | "plurinatu"
  | "plurihealth";

export interface SubproductSEO {
  title: string;
  description: string;
  keywords: string[];
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: "summary_large_image";
  themeColor: string;
}

export interface SubproductConfig {
  key: SubproductKey;
  name: string;
  brandTitle: string;
  tagline: string;
  primaryDomain: string;
  appDomain: string;
  supportedDomains: string[];
  defaultProfession: string;
  councilName: string;
  councilPlaceholder: string;
  metaPixelId: string;
  gaMeasurementId: string;
  clarityProjectId?: string;
  seo: SubproductSEO;
}

export const SUBPRODUCTS_CATALOG: Record<SubproductKey, SubproductConfig> = {
  plurifisio: {
    key: "plurifisio",
    name: "Pluri Fisio",
    brandTitle: "Pluri Fisio",
    tagline: "Gestão Clínica & Prontuário Eletrônico para Fisioterapia e Terapia Ocupacional",
    primaryDomain: "plurifisio.com.br",
    appDomain: "app.plurifisio.com.br",
    supportedDomains: ["plurifisio.com.br", "app.plurifisio.com.br", "www.plurifisio.com.br"],
    defaultProfession: "fisioterapeuta",
    councilName: "CREFITO",
    councilPlaceholder: "Ex: 123456-F",
    metaPixelId: import.meta.env.VITE_META_PIXEL_ID || "1073846021935349",
    gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || "G-HM85XTZRHT",
    clarityProjectId: import.meta.env.VITE_CLARITY_PROJECT_ID || "qj4s7f3g",
    seo: {
      title: "Pluri Fisio — Software de Gestão e Prontuário para Fisioterapia",
      description:
        "Sistema completo de gestão clínica, prontuário SOAP, evolução rápida em 30s, agenda WhatsApp e controle de pacotes para fisioterapeutas e clínicas.",
      keywords: [
        "software para fisioterapia",
        "prontuário eletrônico fisioterapia",
        "sistema para clínica de fisioterapia",
        "agenda fisioterapeuta whatsapp",
        "prontuário soap fisioterapia",
        "plurifisio",
        "pluri fisio",
      ],
      canonicalUrl: "https://plurifisio.com.br",
      ogTitle: "Pluri Fisio — Gestão Clínica & Prontuário para Fisioterapia",
      ogDescription:
        "Evolua atendimentos em 30 segundos, organize agendas e receba com PIX/Cartão sem burocracia.",
      ogImage: "/branding/logo/pluri_health_icon_gradient.svg",
      twitterCard: "summary_large_image",
      themeColor: "#0284c7",
    },
  },

  pluripsy: {
    key: "pluripsy",
    name: "Pluri Psy",
    brandTitle: "Pluri Psy",
    tagline: "Gestão Clínica & Prontuário Sigiloso para Psicologia",
    primaryDomain: "pluripsy.com.br",
    appDomain: "app.pluripsy.com.br",
    supportedDomains: ["pluripsy.com.br", "app.pluripsy.com.br", "www.pluripsy.com.br"],
    defaultProfession: "psicologo",
    councilName: "CRP",
    councilPlaceholder: "Ex: 06/123456",
    metaPixelId: import.meta.env.VITE_META_PIXEL_ID || "1073846021935349",
    gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || "G-HM85XTZRHT",
    seo: {
      title: "Pluri Psy — Gestão Clínica e Prontuário para Psicólogos",
      description: "Prontuário sigiloso, anamnese psicológica e gestão de sessões em conformidade estrita com o CFP.",
      keywords: ["software psicologia", "prontuario psicologo", "pluripsy"],
      canonicalUrl: "https://pluripsy.com.br",
      ogTitle: "Pluri Psy — Prontuário Sigiloso para Psicologia",
      ogDescription: "Gestão de consultório de psicologia com segurança e sigilo profissional.",
      ogImage: "/branding/logo/pluri_health_icon_gradient.svg",
      twitterCard: "summary_large_image",
      themeColor: "#7c3aed",
    },
  },

  plurinutri: {
    key: "plurinutri",
    name: "Pluri Nutri",
    brandTitle: "Pluri Nutri",
    tagline: "Gestão Clínica & Prescrição para Nutrição",
    primaryDomain: "plurinutri.com.br",
    appDomain: "app.plurinutri.com.br",
    supportedDomains: ["plurinutri.com.br", "app.plurinutri.com.br", "www.plurinutri.com.br"],
    defaultProfession: "nutricionista",
    councilName: "CRN",
    councilPlaceholder: "Ex: 12345",
    metaPixelId: import.meta.env.VITE_META_PIXEL_ID || "1073846021935349",
    gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || "G-HM85XTZRHT",
    seo: {
      title: "Pluri Nutri — Gestão Clínica para Nutricionistas",
      description: "Prontuário nutricional, avaliação antropométrica e gestão de planos alimentares.",
      keywords: ["software nutricao", "prontuario nutricionista", "plurinutri"],
      canonicalUrl: "https://plurinutri.com.br",
      ogTitle: "Pluri Nutri — Gestão Clínica para Nutrição",
      ogDescription: "Acompanhamento nutricional completo e simplificado.",
      ogImage: "/branding/logo/pluri_health_icon_gradient.svg",
      twitterCard: "summary_large_image",
      themeColor: "#059669",
    },
  },

  plurinatu: {
    key: "plurinatu",
    name: "Pluri Natu",
    brandTitle: "Pluri Natu",
    tagline: "Gestão Clínica para Terapias Integrativas e Naturais",
    primaryDomain: "plurinatu.com.br",
    appDomain: "app.plurinatu.com.br",
    supportedDomains: ["plurinatu.com.br", "app.plurinatu.com.br", "www.plurinatu.com.br"],
    defaultProfession: "naturopata",
    councilName: "Registro Profissional",
    councilPlaceholder: "Ex: 12345",
    metaPixelId: import.meta.env.VITE_META_PIXEL_ID || "1073846021935349",
    gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || "G-HM85XTZRHT",
    seo: {
      title: "Pluri Natu — Gestão Clínica para Práticas Integrativas",
      description: "Prontuário e anamnese para terapeutas integrativos, acupuntura e naturopatia.",
      keywords: ["software terapias integrativas", "naturopatia", "plurinatu"],
      canonicalUrl: "https://plurinatu.com.br",
      ogTitle: "Pluri Natu — Gestão Integrativa",
      ogDescription: "Gestão de atendimentos e fichas integrativas.",
      ogImage: "/branding/logo/pluri_health_icon_gradient.svg",
      twitterCard: "summary_large_image",
      themeColor: "#d97706",
    },
  },

  plurihealth: {
    key: "plurihealth",
    name: "Pluri Health",
    brandTitle: "Pluri Health",
    tagline: "Sistema de Gestão Clínica Integrada para Clínicas Multidisciplinares",
    primaryDomain: "pluri.health",
    appDomain: "app.pluri.health",
    supportedDomains: ["pluri.health", "app.pluri.health", "localhost", "127.0.0.1"],
    defaultProfession: "fisioterapeuta",
    councilName: "Conselho Regional",
    councilPlaceholder: "Ex: CREFITO, CRM, CRP",
    metaPixelId: import.meta.env.VITE_META_PIXEL_ID || "1073846021935349",
    gaMeasurementId: import.meta.env.VITE_GA_MEASUREMENT_ID || "G-HM85XTZRHT",
    clarityProjectId: import.meta.env.VITE_CLARITY_PROJECT_ID || "qj4s7f3g",
    seo: {
      title: "Pluri Health — Sistema de Gestão para Clínicas e Equipes de Saúde",
      description:
        "Plataforma completa de prontuário eletrônico, governança, agendas por salas e faturamento integrada para clínicas de saúde.",
      keywords: [
        "gestao clinica",
        "prontuario eletronico multiprofissional",
        "sistema clinica integrada",
        "pluri health",
      ],
      canonicalUrl: "https://pluri.health",
      ogTitle: "Pluri Health — Gestão Clínica Integrada",
      ogDescription: "Prontuário eletrônico, agenda de salas e faturamento seguro para equipes de saúde.",
      ogImage: "/branding/logo/pluri_health_icon_gradient.svg",
      twitterCard: "summary_large_image",
      themeColor: "#0284c7",
    },
  },
};

/**
 * Resolve o subproduto atual baseado no hostname do navegador.
 */
export function resolveCurrentSubproduct(): SubproductConfig {
  if (typeof window === "undefined" || !window.location) {
    return SUBPRODUCTS_CATALOG.plurifisio;
  }

  const hostname = window.location.hostname.toLowerCase();

  if (hostname.includes("plurifisio") || hostname.includes("fisioterapia")) {
    return SUBPRODUCTS_CATALOG.plurifisio;
  }

  if (hostname.includes("pluripsy") || hostname.includes("psicologia")) {
    return SUBPRODUCTS_CATALOG.pluripsy;
  }

  if (hostname.includes("plurinutri") || hostname.includes("nutricao")) {
    return SUBPRODUCTS_CATALOG.plurinutri;
  }

  if (hostname.includes("plurinatu")) {
    return SUBPRODUCTS_CATALOG.plurinatu;
  }

  if (hostname.includes("pluri.health")) {
    return SUBPRODUCTS_CATALOG.plurihealth;
  }

  // Em localhost / dev, default para Pluri Fisio (foco prioritário)
  return SUBPRODUCTS_CATALOG.plurifisio;
}

/**
 * Gera o Schema.org JSON-LD estruturado para SEO/AEO.
 */
export function generateStructuredDataSchema(config: SubproductConfig): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: config.name,
        applicationCategory: "HealthApplication",
        operatingSystem: "Web, Android, iOS, Windows, macOS, Linux",
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "BRL",
          lowPrice: "57.00",
          highPrice: "447.00",
          offerCount: "6",
        },
        description: config.seo.description,
        url: config.seo.canonicalUrl,
        publisher: {
          "@type": "Organization",
          name: "Pluri Health Inc.",
          url: "https://pluri.health",
          logo: "https://pluri.health/branding/logo/pluri_health_icon_gradient.svg",
        },
      },
      {
        "@type": "MedicalBusiness",
        name: config.name,
        description: config.tagline,
        url: config.seo.canonicalUrl,
        priceRange: "$$",
        currenciesAccepted: "BRL",
        paymentAccepted: "Credit Card, PIX, Boleto",
        areaServed: {
          "@type": "Country",
          name: "Brazil",
        },
      },
    ],
  };
}
