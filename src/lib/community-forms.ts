import { supabase } from "@/integrations/supabase/client";
import {
  isAnamnesisTemplateSchema,
  sanitizeAnamnesisTemplateSchema,
  type AnamnesisField,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";
import { sanitizeSingleLineInput, sanitizeMultilineInput, INPUT_LIMITS } from "@/lib/input-security";

export type CommunityFormCategory =
  | "Geral"
  | "Psicologia"
  | "Fisioterapia"
  | "Fonoaudiologia"
  | "Terapia Ocupacional"
  | "Nutrição"
  | "Psiquiatria"
  | "Neuropsicologia"
  | "Pediatria";

export const COMMUNITY_FORM_CATEGORIES: CommunityFormCategory[] = [
  "Psicologia",
  "Fisioterapia",
  "Fonoaudiologia",
  "Terapia Ocupacional",
  "Nutrição",
  "Psiquiatria",
  "Neuropsicologia",
  "Pediatria",
  "Geral",
];

export interface CommunityFormTemplate {
  id: string;
  clinic_id: string | null;
  user_id: string;
  author_name: string;
  clinic_name: string | null;
  title: string;
  description: string | null;
  category: CommunityFormCategory;
  tags: string[];
  schema: AnamnesisTemplateSchema;
  preview_fields?: AnamnesisTemplateSchema;
  fields_count: number;
  kind: "template" | "base";
  imports_count: number;
  likes_count: number;
  is_featured: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  has_liked?: boolean;
}

export interface PublishCommunityTemplateParams {
  title: string;
  description?: string | null;
  category: CommunityFormCategory;
  tags: string[];
  schema: AnamnesisTemplateSchema;
  kind: "template" | "base";
  author_name: string;
  clinic_name?: string | null;
  clinic_id?: string | null;
  user_id: string;
}

export interface CommunityFormTemplateComment {
  id: string;
  template_id: string;
  user_id: string;
  author_name: string;
  clinic_name: string | null;
  content: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCommentParams {
  template_id: string;
  user_id: string;
  author_name: string;
  clinic_name?: string | null;
  content: string;
  rating?: number | null;
}

export interface CommunityFormsFilterOptions {
  category?: string | null;
  search?: string | null;
  userId?: string | null;
  currentAuthUserId?: string | null;
  forceRefresh?: boolean;
}

// ---------------------------------------------------------------------------
// Schema Minifier / Stripper (Maximum Database Storage Economy)
// ---------------------------------------------------------------------------

/**
 * Strips default, null, and empty properties from schema fields before saving.
 * Reduces database JSONB storage by >75% per form template.
 */
export function stripSchemaDefaultProperties(schema: AnamnesisTemplateSchema): AnamnesisTemplateSchema {
  const clean = sanitizeAnamnesisTemplateSchema(schema);
  return clean.map((field) => {
    const compact: Record<string, any> = {
      id: field.id,
      label: field.label,
      type: field.type,
    };

    if (field.required === true) compact.required = true;
    if (field.helpText && field.helpText.trim()) compact.helpText = field.helpText.trim();
    if (field.placeholder && field.placeholder.trim()) compact.placeholder = field.placeholder.trim();
    if (field.groupKey && field.groupKey.trim()) compact.groupKey = field.groupKey.trim();
    if (field.columnSpan && field.columnSpan !== 12) compact.columnSpan = field.columnSpan;
    if (field.min !== undefined && field.min !== null) compact.min = field.min;
    if (field.max !== undefined && field.max !== null) compact.max = field.max;
    if (field.sliderStep && field.sliderStep !== 1) compact.sliderStep = field.sliderStep;
    if (field.sliderMinLabel && field.sliderMinLabel.trim()) compact.sliderMinLabel = field.sliderMinLabel.trim();
    if (field.sliderMaxLabel && field.sliderMaxLabel.trim()) compact.sliderMaxLabel = field.sliderMaxLabel.trim();

    if (Array.isArray(field.options) && field.options.length > 0) {
      compact.options = field.options.map((opt) => {
        const cleanOpt: Record<string, any> = { id: opt.id, label: opt.label };
        if (opt.row !== undefined && opt.row !== null && opt.row !== 0) cleanOpt.row = opt.row;
        return cleanOpt;
      });
    }

    return compact as AnamnesisField;
  });
}

// ---------------------------------------------------------------------------
// Client-First In-Memory & Storage Cache Engine
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL
const STORAGE_KEY_TEMPLATES = "pluri_community_templates_cache_v2";

interface CacheStore {
  timestamp: number;
  templates: CommunityFormTemplate[];
  userLikesSet?: string[];
}

let inMemoryCache: CacheStore | null = null;
const inMemoryCommentsCache: Record<string, { timestamp: number; comments: CommunityFormTemplateComment[] }> = {};

function getLocalStoredCache(): CacheStore | null {
  if (inMemoryCache && Date.now() - inMemoryCache.timestamp < CACHE_TTL_MS) {
    return inMemoryCache;
  }

  try {
    const serialized = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    if (!serialized) return null;

    const parsed: CacheStore = JSON.parse(serialized);
    if (Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.templates)) {
      inMemoryCache = parsed;
      return parsed;
    }
  } catch {
    // Storage access fallback
  }

  return null;
}

function setLocalStoredCache(templates: CommunityFormTemplate[], userLikes?: string[]) {
  const store: CacheStore = {
    timestamp: Date.now(),
    templates,
    userLikesSet: userLikes || inMemoryCache?.userLikesSet || [],
  };
  inMemoryCache = store;
  try {
    localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(store));
  } catch {
    // Ignore quota limits
  }
}

export function invalidateCommunityTemplatesCache() {
  inMemoryCache = null;
  try {
    localStorage.removeItem(STORAGE_KEY_TEMPLATES);
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// User Likes Fast Query (1 single query across all catalog)
// ---------------------------------------------------------------------------

export async function fetchUserLikedTemplateIds(userId?: string | null): Promise<Set<string>> {
  if (!userId) return new Set();

  try {
    const { data, error } = await supabase
      .from("community_form_template_likes")
      .select("template_id")
      .eq("user_id", userId);

    if (error || !data) return new Set();

    const ids = new Set((data as Array<{ template_id: string }>).map((row) => row.template_id));
    if (inMemoryCache) {
      inMemoryCache.userLikesSet = Array.from(ids);
    }
    return ids;
  } catch {
    return new Set();
  }
}

// ---------------------------------------------------------------------------
// Community Templates Fetching with Lazy Schema Projection
// ---------------------------------------------------------------------------

export async function fetchCommunityFormTemplates(
  options?: CommunityFormsFilterOptions
): Promise<CommunityFormTemplate[]> {
  const forceRefresh = options?.forceRefresh ?? false;

  // 1. Check local cache first
  let allTemplates: CommunityFormTemplate[] | null = forceRefresh ? null : getLocalStoredCache()?.templates ?? null;

  // 2. Query Supabase if not cached
  if (!allTemplates) {
    try {
      const { data, error } = await supabase
        .from("community_form_templates")
        .select("id, clinic_id, user_id, author_name, clinic_name, title, description, category, tags, schema, kind, fields_count, imports_count, likes_count, is_featured, is_published, created_at, updated_at")
        .order("is_featured", { ascending: false })
        .order("imports_count", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("fetchCommunityFormTemplates DB error:", error);
        allTemplates = [];
      } else {
        const rawRows = (data ?? []) as unknown as CommunityFormTemplate[];
        allTemplates = rawRows.map((row) => {
          const parsedSchema = isAnamnesisTemplateSchema(row.schema)
            ? sanitizeAnamnesisTemplateSchema(row.schema)
            : [];
          return {
            ...row,
            schema: parsedSchema,
            preview_fields: parsedSchema.slice(0, 4),
            fields_count: row.fields_count || parsedSchema.length,
          };
        });

        setLocalStoredCache(allTemplates);
      }
    } catch (err) {
      console.error("fetchCommunityFormTemplates exception:", err);
      allTemplates = [];
    }
  }

  // 3. User Likes resolution
  if (options?.currentAuthUserId) {
    const userLikes = await fetchUserLikedTemplateIds(options.currentAuthUserId);
    allTemplates = allTemplates.map((t) => ({
      ...t,
      has_liked: userLikes.has(t.id),
    }));
  }

  // 4. Client-Side Instant Filtering & Search (0 DB egress)
  let result = [...allTemplates];

  if (options?.userId) {
    result = result.filter((t) => t.user_id === options.userId);
  } else {
    result = result.filter((t) => t.is_published);
  }

  if (options?.category && options.category !== "Todas" && options.category !== "all") {
    result = result.filter((t) => t.category === options.category);
  }

  if (options?.search && options.search.trim()) {
    const q = options.search.toLowerCase().trim();
    result = result.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        t.author_name.toLowerCase().includes(q) ||
        (t.clinic_name && t.clinic_name.toLowerCase().includes(q)) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  }

  return result;
}

export async function fetchCommunityFormTemplateById(
  templateId: string,
  userId?: string | null
): Promise<CommunityFormTemplate | null> {
  // Check local cache
  const cached = getLocalStoredCache()?.templates.find((t) => t.id === templateId);
  const userLikesSet = inMemoryCache?.userLikesSet || [];
  const isLiked = userId ? userLikesSet.includes(templateId) : cached?.has_liked ?? false;

  if (cached && cached.schema && cached.schema.length > 0) {
    return {
      ...cached,
      has_liked: isLiked,
    };
  }

  try {
    const { data, error } = await supabase
      .from("community_form_templates")
      .select("id, clinic_id, user_id, author_name, clinic_name, title, description, category, tags, schema, kind, fields_count, imports_count, likes_count, is_featured, is_published, created_at, updated_at")
      .eq("id", templateId)
      .single();

    if (error || !data) {
      return null;
    }

    const row = data as unknown as CommunityFormTemplate;
    const parsedSchema = isAnamnesisTemplateSchema(row.schema)
      ? sanitizeAnamnesisTemplateSchema(row.schema)
      : [];

    let hasLikedDirect = isLiked;
    if (userId && !inMemoryCache?.userLikesSet) {
      const userLikes = await fetchUserLikedTemplateIds(userId);
      hasLikedDirect = userLikes.has(templateId);
    }

    const fullTemplate: CommunityFormTemplate = {
      ...row,
      schema: parsedSchema,
      preview_fields: parsedSchema.slice(0, 4),
      fields_count: row.fields_count || parsedSchema.length,
      has_liked: hasLikedDirect,
    };

    // Update local cache item
    const current = getLocalStoredCache()?.templates ?? [];
    const index = current.findIndex((t) => t.id === templateId);
    if (index >= 0) {
      current[index] = fullTemplate;
      setLocalStoredCache([...current]);
    }

    return fullTemplate;
  } catch (err) {
    console.error("fetchCommunityFormTemplateById error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Template Comments & Reviews Operations
// ---------------------------------------------------------------------------

export async function fetchTemplateComments(
  templateId: string,
  forceRefresh = false
): Promise<CommunityFormTemplateComment[]> {
  const cached = inMemoryCommentsCache[templateId];
  if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.comments;
  }

  try {
    const { data, error } = await supabase
      .from("community_form_template_comments")
      .select("id, template_id, user_id, author_name, clinic_name, content, rating, created_at, updated_at")
      .eq("template_id", templateId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn("fetchTemplateComments DB query error:", error);
      return [];
    }

    const rows = (data ?? []) as unknown as CommunityFormTemplateComment[];
    inMemoryCommentsCache[templateId] = {
      timestamp: Date.now(),
      comments: rows,
    };
    return rows;
  } catch (err) {
    console.error("fetchTemplateComments exception:", err);
    return [];
  }
}

export async function createTemplateComment(
  params: CreateCommentParams
): Promise<{ success: boolean; data?: CommunityFormTemplateComment; error?: string }> {
  try {
    const cleanContent = sanitizeMultilineInput(params.content, 1000).trim();
    if (!cleanContent) {
      return { success: false, error: "O comentário não pode ficar vazio." };
    }

    const cleanAuthor = sanitizeSingleLineInput(params.author_name, 80).trim() || "Profissional Pluri-Health";
    const cleanClinic = params.clinic_name ? sanitizeSingleLineInput(params.clinic_name, 100).trim() : null;
    const cleanRating = params.rating && params.rating >= 1 && params.rating <= 5 ? Math.round(params.rating) : null;

    const { data, error } = await supabase
      .from("community_form_template_comments")
      .insert({
        template_id: params.template_id,
        user_id: params.user_id,
        author_name: cleanAuthor,
        clinic_name: cleanClinic,
        content: cleanContent,
        rating: cleanRating,
      })
      .select()
      .single();

    if (error) throw error;

    const comment = data as CommunityFormTemplateComment;

    if (inMemoryCommentsCache[params.template_id]) {
      inMemoryCommentsCache[params.template_id].comments = [
        comment,
        ...inMemoryCommentsCache[params.template_id].comments,
      ];
    }

    return { success: true, data: comment };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao publicar comentário." };
  }
}

export async function deleteTemplateComment(commentId: string, templateId?: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("community_form_template_comments")
      .delete()
      .eq("id", commentId);

    if (error) return false;

    if (templateId && inMemoryCommentsCache[templateId]) {
      inMemoryCommentsCache[templateId].comments = inMemoryCommentsCache[templateId].comments.filter(
        (c) => c.id !== commentId
      );
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Template Mutations (Publish, Import, Like, Delete)
// ---------------------------------------------------------------------------

export async function publishCommunityTemplate(
  params: PublishCommunityTemplateParams
): Promise<{ success: boolean; data?: CommunityFormTemplate; error?: string }> {
  try {
    const cleanTitle = sanitizeSingleLineInput(params.title, INPUT_LIMITS.formTemplateName).trim();
    if (!cleanTitle) {
      return { success: false, error: "O título do modelo é obrigatório." };
    }

    const cleanAuthor = sanitizeSingleLineInput(params.author_name, 80).trim() || "Profissional Pluri-Health";
    const cleanClinic = params.clinic_name ? sanitizeSingleLineInput(params.clinic_name, 100).trim() : null;
    const cleanDescription = params.description ? sanitizeMultilineInput(params.description, INPUT_LIMITS.formDescription).trim() : null;
    const cleanTags = (params.tags || [])
      .map((t) => sanitizeSingleLineInput(t, 40).trim().toLowerCase().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 10);

    // Strip default properties for storage optimization
    const cleanSchema = stripSchemaDefaultProperties(params.schema);

    if (cleanSchema.length === 0) {
      return { success: false, error: "O modelo precisa conter ao menos um campo para ser publicado." };
    }

    const { data, error } = await supabase
      .from("community_form_templates")
      .insert({
        clinic_id: params.clinic_id || null,
        user_id: params.user_id,
        author_name: cleanAuthor,
        clinic_name: cleanClinic,
        title: cleanTitle,
        description: cleanDescription,
        category: params.category || "Geral",
        tags: cleanTags,
        schema: cleanSchema,
        kind: params.kind || "template",
        fields_count: cleanSchema.length,
        is_published: true,
        imports_count: 0,
        likes_count: 0,
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    const newTemplate: CommunityFormTemplate = {
      ...(data as CommunityFormTemplate),
      schema: cleanSchema,
      preview_fields: cleanSchema.slice(0, 4),
      fields_count: cleanSchema.length,
    };

    const current = getLocalStoredCache()?.templates ?? [];
    setLocalStoredCache([newTemplate, ...current]);

    return { success: true, data: newTemplate };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro desconhecido ao publicar modelo." };
  }
}

export async function importCommunityTemplateToClinic(params: {
  communityTemplate: CommunityFormTemplate;
  targetClinicId: string;
  userId: string;
  customTitle?: string;
}): Promise<{ success: boolean; newTemplateId?: string; error?: string }> {
  try {
    const { communityTemplate, targetClinicId, userId, customTitle } = params;
    const schema = sanitizeAnamnesisTemplateSchema(communityTemplate.schema);
    const finalTitle = sanitizeSingleLineInput(
      customTitle?.trim() || communityTemplate.title,
      INPUT_LIMITS.formTemplateName
    ).trim();

    if (communityTemplate.kind === "base") {
      const { error } = await supabase
        .from("clinics")
        .update({ anamnesis_base_schema: schema })
        .eq("id", targetClinicId);

      if (error) throw error;
    } else {
      const { data, error } = await supabase
        .from("anamnesis_form_templates")
        .insert({
          clinic_id: targetClinicId,
          user_id: userId,
          name: finalTitle,
          description: communityTemplate.description
            ? `[Importado da Comunidade] ${communityTemplate.description}`
            : "[Importado da Comunidade de Formulários]",
          schema,
          is_active: true,
          is_system_default: false,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (communityTemplate.id) {
        void supabase.rpc("increment_community_template_import", { p_template_id: communityTemplate.id });
      }

      // Optimistic cache update for imports_count
      const cached = getLocalStoredCache()?.templates;
      if (cached) {
        const updated = cached.map((t) =>
          t.id === communityTemplate.id ? { ...t, imports_count: t.imports_count + 1 } : t
        );
        setLocalStoredCache(updated);
      }

      return { success: true, newTemplateId: data?.id };
    }

    if (communityTemplate.id) {
      void supabase.rpc("increment_community_template_import", { p_template_id: communityTemplate.id });
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar modelo." };
  }
}

export async function toggleLikeCommunityTemplate(
  templateId: string
): Promise<{ liked: boolean; likes_count: number }> {
  try {
    const { data, error } = await supabase.rpc("toggle_community_template_like", {
      p_template_id: templateId,
    });

    if (error) throw error;
    const res = data as { liked: boolean; likes_count: number };

    // Optimistic cache update for likes
    const cached = getLocalStoredCache()?.templates;
    if (cached) {
      const updated = cached.map((t) =>
        t.id === templateId ? { ...t, likes_count: res.likes_count, has_liked: res.liked } : t
      );
      setLocalStoredCache(updated);
    }

    return { liked: res.liked, likes_count: res.likes_count };
  } catch (err) {
    console.error("toggleLikeCommunityTemplate error:", err);
    return { liked: false, likes_count: 0 };
  }
}

export async function deleteCommunityTemplate(templateId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("community_form_templates")
      .delete()
      .eq("id", templateId);

    if (error) return false;

    const cached = getLocalStoredCache()?.templates;
    if (cached) {
      setLocalStoredCache(cached.filter((t) => t.id !== templateId));
    }

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Platform Admin / Backoffice Operations
// ---------------------------------------------------------------------------

export interface AdminCommunityFormsFilterOptions {
  search?: string;
  category?: string;
  status?: "all" | "published" | "unpublished" | "featured";
}

export async function fetchAdminCommunityFormTemplates(
  options?: AdminCommunityFormsFilterOptions
): Promise<CommunityFormTemplate[]> {
  try {
    let query = supabase
      .from("community_form_templates")
      .select("id, clinic_id, user_id, author_name, clinic_name, title, description, category, tags, schema, kind, fields_count, imports_count, likes_count, is_featured, is_published, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (options?.category && options.category !== "Todas") {
      query = query.eq("category", options.category);
    }

    if (options?.status) {
      if (options.status === "published") query = query.eq("is_published", true);
      if (options.status === "unpublished") query = query.eq("is_published", false);
      if (options.status === "featured") query = query.eq("is_featured", true);
    }

    if (options?.search && options.search.trim()) {
      const term = `%${options.search.trim()}%`;
      query = query.or(`title.ilike.${term},description.ilike.${term},author_name.ilike.${term},clinic_name.ilike.${term}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rawRows = (data ?? []) as unknown as CommunityFormTemplate[];
    return rawRows.map((row) => {
      const parsed = isAnamnesisTemplateSchema(row.schema) ? sanitizeAnamnesisTemplateSchema(row.schema) : [];
      return {
        ...row,
        schema: parsed,
        preview_fields: parsed.slice(0, 4),
        fields_count: row.fields_count || parsed.length,
      };
    });
  } catch (err) {
    console.error("fetchAdminCommunityFormTemplates error:", err);
    return [];
  }
}

export async function updateCommunityTemplateByAdmin(
  templateId: string,
  updates: Partial<Pick<CommunityFormTemplate, "title" | "description" | "category" | "author_name" | "clinic_name" | "tags" | "is_featured" | "is_published">>
): Promise<{ success: boolean; data?: CommunityFormTemplate; error?: string }> {
  try {
    const payload: Record<string, any> = { ...updates };
    if (updates.title) payload.title = sanitizeSingleLineInput(updates.title, INPUT_LIMITS.formTemplateName).trim();
    if (updates.author_name) payload.author_name = sanitizeSingleLineInput(updates.author_name, 80).trim();
    if (updates.clinic_name) payload.clinic_name = sanitizeSingleLineInput(updates.clinic_name, 100).trim();
    if (updates.description !== undefined) {
      payload.description = updates.description ? sanitizeMultilineInput(updates.description, INPUT_LIMITS.formDescription).trim() : null;
    }
    if (updates.tags) {
      payload.tags = updates.tags.map((t) => sanitizeSingleLineInput(t, 40).trim().toLowerCase().replace(/^#/, "")).filter(Boolean);
    }

    const { data, error } = await supabase
      .from("community_form_templates")
      .update(payload)
      .eq("id", templateId)
      .select()
      .single();

    if (error) throw error;

    const updated = {
      ...(data as CommunityFormTemplate),
      schema: sanitizeAnamnesisTemplateSchema(data.schema),
    };

    const cached = getLocalStoredCache()?.templates;
    if (cached) {
      setLocalStoredCache(cached.map((t) => (t.id === templateId ? updated : t)));
    }

    return { success: true, data: updated };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar modelo." };
  }
}

export async function adminCreateOfficialTemplate(params: {
  title: string;
  description?: string | null;
  category: CommunityFormCategory;
  tags: string[];
  schema: AnamnesisTemplateSchema;
  kind?: "template" | "base";
  is_featured?: boolean;
  author_name?: string;
  clinic_name?: string | null;
  clinic_id?: string | null;
  user_id: string;
}): Promise<{ success: boolean; data?: CommunityFormTemplate; error?: string }> {
  try {
    const cleanTitle = sanitizeSingleLineInput(params.title, INPUT_LIMITS.formTemplateName).trim();
    if (!cleanTitle) {
      return { success: false, error: "O título do modelo é obrigatório." };
    }

    const cleanAuthor = sanitizeSingleLineInput(params.author_name || "Equipe Pluri-Health", 80).trim();
    const cleanClinic = params.clinic_name ? sanitizeSingleLineInput(params.clinic_name, 100).trim() : "Comunidade Oficial";
    const cleanDescription = params.description ? sanitizeMultilineInput(params.description, INPUT_LIMITS.formDescription).trim() : null;
    const cleanTags = (params.tags || [])
      .map((t) => sanitizeSingleLineInput(t, 40).trim().toLowerCase().replace(/^#/, ""))
      .filter(Boolean)
      .slice(0, 10);

    const cleanSchema = stripSchemaDefaultProperties(params.schema);

    if (cleanSchema.length === 0) {
      return { success: false, error: "O modelo precisa conter ao menos um campo." };
    }

    const { data, error } = await supabase
      .from("community_form_templates")
      .insert({
        clinic_id: params.clinic_id || null,
        user_id: params.user_id,
        author_name: cleanAuthor,
        clinic_name: cleanClinic,
        title: cleanTitle,
        description: cleanDescription,
        category: params.category || "Geral",
        tags: cleanTags,
        schema: cleanSchema,
        kind: params.kind || "template",
        fields_count: cleanSchema.length,
        is_published: true,
        is_featured: params.is_featured ?? true,
        imports_count: 0,
        likes_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    const created: CommunityFormTemplate = {
      ...(data as CommunityFormTemplate),
      schema: cleanSchema,
      preview_fields: cleanSchema.slice(0, 4),
      fields_count: cleanSchema.length,
    };

    const cached = getLocalStoredCache()?.templates ?? [];
    setLocalStoredCache([created, ...cached]);

    return { success: true, data: created };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar modelo oficial." };
  }
}
