export interface MarketingBrandKit {
  id: string;
  name: string;
  subproduct_key: "plurifisio" | "plurihealth";
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  tone: string;
  cta: string;
}

export interface CreativeSlideSpec {
  id: string;
  headline: string;
  body: string;
  cta: string;
}

export interface ReelSceneSpec {
  id: string;
  durationSec: number;
  hookText: string;
  narration: string;
  visualNote: string;
}

export const DEFAULT_BRAND_KITS: MarketingBrandKit[] = [
  {
    id: "bk-plurifisio",
    name: "Pluri Fisio — Kit Oficial",
    subproduct_key: "plurifisio",
    primaryColor: "#0284c7",
    secondaryColor: "#0f172a",
    accentColor: "#10b981",
    backgroundColor: "#f0f9ff",
    tone: "Clínico, prático e próximo do fisioterapeuta",
    cta: "Teste grátis na sua clínica",
  },
  {
    id: "bk-plurihealth",
    name: "Pluri Health — Enterprise",
    subproduct_key: "plurihealth",
    primaryColor: "#2563eb",
    secondaryColor: "#0f172a",
    accentColor: "#06b6d4",
    backgroundColor: "#f8fafc",
    tone: "Institucional, seguro (LGPD/CFM) e escalável",
    cta: "Agende demonstração executiva",
  },
];
