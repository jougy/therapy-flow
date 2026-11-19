import { useMemo, useSyncExternalStore } from "react";
import {
  getRuntimeClinicSubproduct,
  resolveCurrentSubproduct,
  subscribeRuntimeClinicSubproduct,
  type SubproductConfig,
  type SubproductKey,
  type SubproductRailConfig,
} from "@/lib/subproduct-config";

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
  isFullPlatform: boolean;
  rail: SubproductRailConfig;
  isProfessionAllowed: (profession: string) => boolean;
  isScopeAllowed: (scope: string) => boolean;
}

function buildBrandConfig(subproduct: SubproductConfig): BrandConfig {
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
    isFullPlatform: subproduct.rail.isFullPlatform,
    rail: subproduct.rail,
    isProfessionAllowed: (profession: string) => {
      if (subproduct.rail.isFullPlatform || subproduct.rail.allowedProfessions.length === 0) return true;
      return subproduct.rail.allowedProfessions.includes(profession.toLowerCase());
    },
    isScopeAllowed: (scope: string) => {
      if (subproduct.rail.isFullPlatform || subproduct.rail.anamnesisScopes.length === 0) return true;
      return subproduct.rail.anamnesisScopes.includes(scope.toLowerCase());
    },
  };
}

/**
 * Retorna os dados da marca ativa computados a partir do subproduto do domínio e da clínica ativa.
 */
export function getActiveBrand(clinicSubproductKey?: string | null): BrandConfig {
  const subproduct = resolveCurrentSubproduct(clinicSubproductKey);
  return buildBrandConfig(subproduct);
}

/**
 * Inicializa/atualiza a marca ativa no documento (document.title).
 */
export function initializeDocumentBrand(clinicSubproductKey?: string | null): BrandConfig {
  const brand = getActiveBrand(clinicSubproductKey);
  if (typeof document !== "undefined") {
    if (!document.title || document.title.includes("Pluri Health") || document.title.includes("Pluri Fisio")) {
      document.title = brand.isFisio
        ? "Pluri Fisio — Software de Gestão e Prontuário para Fisioterapia"
        : `${brand.name} — ${brand.tagline}`;
    }
  }
  return brand;
}

/**
 * Hook reativo para uso em componentes React.
 * Reage automaticamente quando a clínica logada altera o subproduto ativo.
 */
export function useActiveBrand(): BrandConfig {
  const runtimeClinicKey = useSyncExternalStore(
    subscribeRuntimeClinicSubproduct,
    getRuntimeClinicSubproduct,
    () => null,
  );
  return useMemo(() => getActiveBrand(runtimeClinicKey), [runtimeClinicKey]);
}
