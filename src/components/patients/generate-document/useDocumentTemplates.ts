import { useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLocalCacheItem,
  getSyncMemoryCacheItem,
  setLocalCacheItem,
} from "@/lib/indexed-db-persister";
import { isOfflineOrNetworkError } from "@/lib/local-first/networkError";
import defaultAdultTermsMarkdown from "@/assets/adult-terms-of-consent.md?raw";
import defaultMinorTermsMarkdown from "@/assets/minor-terms-of-responsibility.md?raw";
import defaultPrintTermsMarkdown from "@/assets/print-terms-of-responsibility.md?raw";
import type { DocumentTemplateItem } from "./types";

interface UseDocumentTemplatesParams {
  open: boolean;
  clinicId?: string | null;
  initialTemplateId?: string;
}

interface CachedClinicDocTemplates {
  clinicCnpj: string;
  standardAdultContent: string;
  standardMinorContent: string;
  customTemplates: DocumentTemplateItem[];
}

export const CLINIC_DOC_TEMPLATES_CACHE_KEY = (clinicId: string) =>
  `clinic_doc_templates_${clinicId}`;

export function useDocumentTemplates({
  open,
  clinicId,
  initialTemplateId,
}: UseDocumentTemplatesParams) {
  const cacheKey = clinicId ? CLINIC_DOC_TEMPLATES_CACHE_KEY(clinicId) : null;
  const syncCached = cacheKey ? getSyncMemoryCacheItem<CachedClinicDocTemplates>(cacheKey) : null;

  const [loading, setLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(initialTemplateId || "std-adult");
  const [standardAdultContent, setStandardAdultContent] = useState<string>(
    syncCached?.standardAdultContent || defaultAdultTermsMarkdown
  );
  const [standardMinorContent, setStandardMinorContent] = useState<string>(
    syncCached?.standardMinorContent || defaultMinorTermsMarkdown
  );
  const [customTemplates, setCustomTemplates] = useState<DocumentTemplateItem[]>(
    syncCached?.customTemplates ?? []
  );
  const [clinicCnpj, setClinicCnpj] = useState<string>(syncCached?.clinicCnpj || "");

  const applyCachedTemplates = useCallback((cached: CachedClinicDocTemplates) => {
    setStandardAdultContent(cached.standardAdultContent || defaultAdultTermsMarkdown);
    setStandardMinorContent(cached.standardMinorContent || defaultMinorTermsMarkdown);
    setClinicCnpj(cached.clinicCnpj || "");
    setCustomTemplates(Array.isArray(cached.customTemplates) ? cached.customTemplates : []);
  }, []);

  const loadTemplatesAndSettings = useCallback(async () => {
    if (!open) return;
    setLoading(true);

    try {
      if (initialTemplateId) {
        setSelectedTemplateId(initialTemplateId);
      }

      if (!clinicId || !cacheKey) {
        setStandardAdultContent(defaultAdultTermsMarkdown);
        setStandardMinorContent(defaultMinorTermsMarkdown);
        setClinicCnpj("");
        setCustomTemplates([]);
        return;
      }

      const cached = await getLocalCacheItem<CachedClinicDocTemplates>(cacheKey);
      if (cached) {
        applyCachedTemplates(cached);
      }

      // Fallback imediato offline: usa cache da clínica se existir ou os .md?raw do bundle
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      let resolvedAdultContent = defaultAdultTermsMarkdown;
      let resolvedMinorContent = defaultMinorTermsMarkdown;
      let resolvedCnpj = "";
      const loadedCustoms: DocumentTemplateItem[] = [];

      const { data: clinicData, error: clinicError } = await supabase
        .from("clinics")
        .select("id, name, cnpj, custom_fields")
        .eq("id", clinicId)
        .maybeSingle();

      if (clinicError) {
        if (isOfflineOrNetworkError(clinicError) || cached) {
          return;
        }
      }

      if (clinicData) {
        resolvedCnpj = clinicData.cnpj || "";
        const custom = (clinicData.custom_fields || {}) as Record<string, unknown>;
        const clinicTerms = (custom.clinic_terms || {}) as {
          adult_terms?: { content?: string };
          minor_terms?: { content?: string };
        };

        if (clinicTerms.adult_terms?.content) {
          resolvedAdultContent = clinicTerms.adult_terms.content;
        }
        if (clinicTerms.minor_terms?.content) {
          resolvedMinorContent = clinicTerms.minor_terms.content;
        }

        if (Array.isArray(custom.clinic_document_templates)) {
          for (const item of custom.clinic_document_templates as Array<Record<string, unknown>>) {
            if (item?.id && item?.title && (item.content || item.content_markdown || item.content_md)) {
              loadedCustoms.push({
                id: String(item.id),
                title: String(item.title),
                description: item.description ? String(item.description) : undefined,
                category: String(item.category || "custom"),
                content: String(item.content_md || item.content_markdown || item.content || ""),
                isCustom: true,
              });
            }
          }
        }
      }

      try {
        const { data: dbRows, error: dbError } = await (supabase.from(
          "clinic_document_templates" as unknown as "clinics"
        ) as unknown as {
          select: (cols: string) => {
            eq: (col: string, val: string) => {
              eq: (col2: string, val2: boolean) => {
                is: (col3: string, val3: null) => Promise<{ data: unknown[] | null; error: unknown }>;
              };
            };
          };
        })
          .select("*")
          .eq("clinic_id", clinicId)
          .eq("is_active", true)
          .is("deleted_at", null);

        if (!dbError && Array.isArray(dbRows)) {
          for (const row of dbRows as Array<Record<string, unknown>>) {
            const rowId = String(row.id);
            const alreadyExists = loadedCustoms.some((c) => c.id === rowId);
            if (!alreadyExists) {
              loadedCustoms.push({
                id: rowId,
                title: String(row.title || "Modelo Customizado"),
                description: row.description ? String(row.description) : undefined,
                category: String(row.category || "custom"),
                content: String(row.content_md || row.content_markdown || row.content || ""),
                isCustom: true,
                isFromTable: true,
              });
            }
          }
        }
      } catch {
        // Mantém modelos carregados de custom_fields
      }

      if (!clinicError) {
        setStandardAdultContent(resolvedAdultContent);
        setStandardMinorContent(resolvedMinorContent);
        setClinicCnpj(resolvedCnpj);
        setCustomTemplates(loadedCustoms);

        void setLocalCacheItem(cacheKey, {
          clinicCnpj: resolvedCnpj,
          standardAdultContent: resolvedAdultContent,
          standardMinorContent: resolvedMinorContent,
          customTemplates: loadedCustoms,
        });
      }
    } catch (err) {
      if (!isOfflineOrNetworkError(err)) {
        console.warn("Falha ao carregar modelos para geração de documento:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [open, clinicId, cacheKey, initialTemplateId, applyCachedTemplates]);

  useEffect(() => {
    void loadTemplatesAndSettings();
  }, [loadTemplatesAndSettings]);

  const availableTemplates: DocumentTemplateItem[] = useMemo(() => {
    const standards: DocumentTemplateItem[] = [
      {
        id: "std-adult",
        title: "Termo de Consentimento Adulto (TCLE)",
        description: "Consentimento Livre e Esclarecido (LGPD Arts. 7º e 11 / CFM 1.821)",
        category: "adult_consent",
        content: standardAdultContent,
      },
      {
        id: "std-minor",
        title: "Termo de Consentimento para Menores",
        description: "Autorização de pais/responsáveis legais (LGPD Art. 14)",
        category: "minor_consent",
        content: standardMinorContent,
      },
      {
        id: "std-print",
        title: "Termo de Responsabilidade para Impressão",
        description: "Custódia física e descarte seguro de dados sensíveis",
        category: "print_responsibility",
        content: defaultPrintTermsMarkdown,
      },
    ];

    return [...standards, ...customTemplates];
  }, [standardAdultContent, standardMinorContent, customTemplates]);

  const selectedTemplate = useMemo(() => {
    return availableTemplates.find((t) => t.id === selectedTemplateId) || availableTemplates[0];
  }, [availableTemplates, selectedTemplateId]);

  return {
    loading,
    clinicCnpj,
    customTemplates,
    availableTemplates,
    selectedTemplate,
    selectedTemplateId,
    setSelectedTemplateId,
  };
}
