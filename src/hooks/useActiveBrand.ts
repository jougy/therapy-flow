import { useMemo } from "react";
import { resolveCurrentSubproduct, type SubproductConfig, type SubproductKey } from "@/lib/subproduct-config";

export interface BrandConfig {
  key: SubproductKey;
  name: string;
  brandTitle: string;
  tagline: string;
  domain: string;
  canonicalUrl: string;
  brandSuffix: string; // "Health", "Fisio", "Psy", "Nutri", "Natu"
  isFisio: boolean;
  isHealth: boolean;
}

/**
 * Retorna os dados da marca ativa computados a partir do subproduto do domínio.
 */
export function getActiveBrand(): BrandConfig {
  const subproduct: SubproductConfig = resolveCurrentSubproduct();
  const isFisio = subproduct.key === "plurifisio";
  const isHealth = subproduct.key === "plurihealth";

  let brandSuffix = "Health";
  if (isFisio) brandSuffix = "Fisio";
  else if (subproduct.key === "pluripsy") brandSuffix = "Psy";
  else if (subproduct.key === "plurinutri") brandSuffix = "Nutri";
  else if (subproduct.key === "plurinatu") brandSuffix = "Natu";

  return {
    key: subproduct.key,
    name: subproduct.name,
    brandTitle: subproduct.brandTitle,
    tagline: subproduct.tagline,
    domain: subproduct.primaryDomain,
    canonicalUrl: subproduct.seo.canonicalUrl,
    brandSuffix,
    isFisio,
    isHealth,
  };
}

/**
 * Inicializa a marca ativa no documento (document.title, meta tags).
 */
export function initializeDocumentBrand(): BrandConfig {
  const brand = getActiveBrand();
  if (typeof document !== "undefined") {
    // Alinha título inicial antes de qualquer render
    if (!document.title || document.title.includes("Pluri Health") || document.title.includes("Pluri Fisio")) {
      document.title = brand.isFisio
        ? "Pluri Fisio — Software de Gestão e Prontuário para Fisioterapia"
        : "Pluri Health — Sistema de Gestão para Clínicas e Equipes de Saúde";
    }
  }
  return brand;
}

/**
 * Hook reativo para uso em componentes React.
 */
export function useActiveBrand(): BrandConfig {
  return useMemo(() => getActiveBrand(), []);
}
