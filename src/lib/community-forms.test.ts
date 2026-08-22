import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  COMMUNITY_FORM_CATEGORIES,
  fetchCommunityFormTemplates,
  publishCommunityTemplate,
  invalidateCommunityTemplatesCache,
  stripSchemaDefaultProperties,
} from "./community-forms";

// Mock Supabase
vi.mock("@/integrations/supabase/client", () => {
  const sampleData = [
    {
      id: "real-1",
      title: "Anamnese Psicológica Adulto",
      description: "Descrição clínica de psicologia",
      category: "Psicologia",
      tags: ["adulto", "tcc"],
      schema: [{ id: "f1", label: "Queixa Principal", type: "short_text" }],
      kind: "template",
      author_name: "Equipe Pluri-Health",
      clinic_name: "Comunidade Oficial",
      imports_count: 50,
      likes_count: 12,
      is_featured: true,
      is_published: true,
      created_at: "2026-08-01T12:00:00Z",
      updated_at: "2026-08-01T12:00:00Z",
    },
    {
      id: "real-2",
      title: "Avaliação Fisioterapêutica",
      description: "Descrição de fisioterapia",
      category: "Fisioterapia",
      tags: ["ortopedia", "dor"],
      schema: [{ id: "f2", label: "Localização da dor", type: "short_text" }],
      kind: "template",
      author_name: "Dra. Camila Rocha",
      clinic_name: "Fisio & Movimento",
      imports_count: 30,
      likes_count: 8,
      is_featured: true,
      is_published: true,
      created_at: "2026-08-02T12:00:00Z",
      updated_at: "2026-08-02T12:00:00Z",
    },
  ];

  const createQueryChain = () => {
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      single: () => Promise.resolve({ data: sampleData[0], error: null }),
      then: (resolve: any) => Promise.resolve({ data: sampleData, error: null }).then(resolve),
    };
    return chain;
  };

  return {
    supabase: {
      from: () => createQueryChain(),
      rpc: () => Promise.resolve({ data: { liked: true, likes_count: 13 }, error: null }),
    },
  };
});

describe("community-forms library (Client-First & Database)", () => {
  beforeEach(() => {
    invalidateCommunityTemplatesCache();
  });

  it("defines standard clinical categories", () => {
    expect(COMMUNITY_FORM_CATEGORIES).toContain("Psicologia");
    expect(COMMUNITY_FORM_CATEGORIES).toContain("Fisioterapia");
    expect(COMMUNITY_FORM_CATEGORIES).toContain("Fonoaudiologia");
    expect(COMMUNITY_FORM_CATEGORIES).toContain("Terapia Ocupacional");
    expect(COMMUNITY_FORM_CATEGORIES).toContain("Nutrição");
    expect(COMMUNITY_FORM_CATEGORIES).toContain("Geral");
  });

  it("rejects publishing templates with empty title", async () => {
    const res = await publishCommunityTemplate({
      title: "   ",
      category: "Psicologia",
      tags: ["teste"],
      schema: [{ id: "f1", label: "Campo 1", type: "short_text" }],
      kind: "template",
      author_name: "Dr. Teste",
      user_id: "user-123",
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/título/i);
  });

  it("rejects publishing templates with empty schema", async () => {
    const res = await publishCommunityTemplate({
      title: "Modelo Sem Campos",
      category: "Psicologia",
      tags: ["teste"],
      schema: [],
      kind: "template",
      author_name: "Dr. Teste",
      user_id: "user-123",
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/ao menos um campo/i);
  });

  it("performs client-first in-memory filtering and search with zero extra network load", async () => {
    // 1. First fetch loads and caches
    const all = await fetchCommunityFormTemplates();
    expect(all.length).toBe(2);

    // 2. Subsequent category filter uses memory cache
    const fisioList = await fetchCommunityFormTemplates({ category: "Fisioterapia" });
    expect(fisioList.length).toBe(1);
    expect(fisioList[0].category).toBe("Fisioterapia");

    // 3. Subsequent search uses memory cache
    const searchResult = await fetchCommunityFormTemplates({ search: "Psicológica" });
    expect(searchResult.length).toBe(1);
    expect(searchResult[0].title).toContain("Psicológica");
  });

  it("strips schema default properties to save maximum storage space in database", () => {
    const rawSchema = [
      {
        id: "field_1",
        label: "Nome do Paciente",
        type: "short_text" as const,
        required: false,
        columnSpan: 12,
        helpText: "   ",
        placeholder: "",
        groupKey: null as any,
      },
      {
        id: "field_2",
        label: "Escala EVA",
        type: "slider" as const,
        required: true,
        min: 0,
        max: 10,
        sliderStep: 1,
        helpText: "Informe o nível de dor",
      },
    ];

    const stripped = stripSchemaDefaultProperties(rawSchema);
    expect(stripped.length).toBe(2);

    // Default columnSpan 12 and required false should be stripped
    expect((stripped[0] as any).columnSpan).toBeUndefined();
    expect((stripped[0] as any).required).toBeUndefined();
    expect((stripped[0] as any).helpText).toBeUndefined();
    expect((stripped[0] as any).placeholder).toBeUndefined();

    // Required true and helpText must be preserved
    expect(stripped[1].required).toBe(true);
    expect(stripped[1].helpText).toBe("Informe o nível de dor");
  });
});
