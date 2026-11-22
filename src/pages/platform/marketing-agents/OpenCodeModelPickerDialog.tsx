import React, { useMemo, useState } from "react";
import { Check, Cpu, RefreshCw, Sparkles, Terminal } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LlmModelCatalogItem } from "./suiteTypes";

export type ModelPickerCategory =
  | "all"
  | "free"
  | "local_ollama"
  | "opencode_free"
  | "pulumi"
  | "byok";

interface OpenCodeModelPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProviderSlug?: string;
  selectedModelId?: string;
  catalog: LlmModelCatalogItem[];
  onSelectModel: (item: LlmModelCatalogItem) => void;
  onRefreshLive?: () => Promise<void>;
  refreshing?: boolean;
}

const CATEGORY_PILLS: Array<{ id: ModelPickerCategory; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "free", label: "Grátis R$ 0" },
  { id: "local_ollama", label: "Local Ollama" },
  { id: "opencode_free", label: "OpenCode Free" },
  { id: "pulumi", label: "Pulumi Cloud" },
  { id: "byok", label: "Nuvem BYOK" },
];

function matchesCategory(item: LlmModelCatalogItem, cat: ModelPickerCategory): boolean {
  if (cat === "all") return true;
  if (cat === "free") return item.isFree;
  if (cat === "local_ollama") return item.isLocal || item.providerType === "local_ollama";
  if (cat === "opencode_free") return item.providerType === "opencode_free";
  if (cat === "pulumi") return item.isPulumiDefault || item.providerSlug === "gemini-pulumi" || item.providerType === "gemma_cloud";
  return !item.isLocal && !item.isFree && !item.isPulumiDefault;
}

function formatContextWindow(tokens: number): string {
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M ctx`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}k ctx`;
  return `${tokens} ctx`;
}

export const OpenCodeModelPickerDialog: React.FC<OpenCodeModelPickerDialogProps> = ({
  open,
  onOpenChange,
  selectedProviderSlug,
  selectedModelId,
  catalog,
  onSelectModel,
  onRefreshLive,
  refreshing = false,
}) => {
  const [category, setCategory] = useState<ModelPickerCategory>("all");
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(
    () => catalog.filter((item) => matchesCategory(item, category)),
    [catalog, category],
  );

  const groupedItems = useMemo(() => {
    const groups = new Map<string, LlmModelCatalogItem[]>();
    for (const item of filteredItems) {
      const key = item.providerLabel || item.providerSlug;
      const list = groups.get(key) || [];
      list.push(item);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [filteredItems]);

  const trimmedSearch = search.trim();
  const hasExactMatch = useMemo(
    () =>
      trimmedSearch.length > 0 &&
      catalog.some((m) => m.id.toLowerCase() === trimmedSearch.toLowerCase()),
    [catalog, trimmedSearch],
  );

  const handleSelect = (item: LlmModelCatalogItem) => {
    onSelectModel(item);
    onOpenChange(false);
  };

  const handleSelectCustom = () => {
    if (!trimmedSearch) return;
    handleSelect({
      id: trimmedSearch,
      name: `${trimmedSearch} (Custom OpenAI-Compatible)`,
      providerType: "custom_openai",
      providerSlug: "custom-openai",
      providerLabel: "Custom / Endpoint Próprio",
      isFree: false,
      isLocal: false,
      isPulumiDefault: false,
      supportsThinking: false,
      disableThinkingRecommended: false,
      contextWindow: 128000,
      speedTier: "fast",
      notes: "Modelo digitado manualmente (custom_openai).",
    });
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <div className="border-b px-3 py-2.5 space-y-2 bg-muted/20 w-full max-w-full min-w-0">
        <div className="flex items-center justify-between gap-2 pr-7">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground min-w-0">
            <Terminal className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">Seletor de Modelos (OpenCode / Ollama / Pulumi)</span>
          </div>
          {onRefreshLive && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={refreshing}
              onClick={() => void onRefreshLive()}
              className="min-h-[36px] px-2 text-xs gap-1 shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Sincronizando..." : "Atualizar"}</span>
            </Button>
          )}
        </div>

        <div className="w-full overflow-x-auto touch-pan-x pb-0.5">
          <div className="flex items-center gap-1.5 w-max">
            {CATEGORY_PILLS.map((pill) => {
              const active = category === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setCategory(pill.id)}
                  className={`min-h-[36px] px-2.5 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Buscar modelo, provedor ou digitar ID customizado (ex: gemma4:e4b)..."
      />

      <CommandList className="max-h-[58dvh]">
        <CommandEmpty className="py-5 px-4 text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Nenhum modelo do catálogo corresponde a &ldquo;{trimmedSearch}&rdquo;.
          </p>
          {trimmedSearch.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleSelectCustom}
              className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Usar modelo customizado &ldquo;{trimmedSearch}&rdquo;</span>
            </Button>
          )}
        </CommandEmpty>

        {groupedItems.map(([groupLabel, items], idx) => (
          <React.Fragment key={groupLabel}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={groupLabel}>
              {items.map((item) => {
                const isSelected =
                  selectedModelId === item.id &&
                  (!selectedProviderSlug || selectedProviderSlug === item.providerSlug);
                return (
                  <CommandItem
                    key={`${item.providerSlug}::${item.id}`}
                    value={`${item.name} ${item.id} ${item.providerLabel} ${item.providerSlug}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-start justify-between gap-2 py-2.5 cursor-pointer"
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <Cpu className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold truncate">{item.name}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                        </div>
                        <div className="flex flex-wrap items-center gap-1">
                          <code className="text-[10px] text-muted-foreground font-mono truncate max-w-[200px]">
                            {item.id}
                          </code>
                          <span className="text-[10px] text-muted-foreground">
                            • {formatContextWindow(item.contextWindow)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.isFree && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" variant="outline">
                              R$ 0 GRÁTIS
                            </Badge>
                          )}
                          {item.isLocal && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30" variant="outline">
                              LOCAL (ESTE PC)
                            </Badge>
                          )}
                          {item.isPulumiDefault && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30" variant="outline">
                              PULUMI PADRÃO
                            </Badge>
                          )}
                          {item.disableThinkingRecommended && (
                            <Badge className="text-[9px] px-1.5 py-0" variant="secondary">
                              SEM THINKING
                            </Badge>
                          )}
                          {item.speedTier === "ultra_fast" && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" variant="outline">
                              RÁPIDO
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}

        {trimmedSearch.length > 1 && !hasExactMatch && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Modelo Customizado (Endpoint OpenAI-Compatible)">
              <CommandItem
                value={`custom ${trimmedSearch}`}
                onSelect={handleSelectCustom}
                className="flex items-center gap-2 py-2.5 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">
                    Usar ID customizado: <code className="font-mono">{trimmedSearch}</code>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Roteia via provedor custom_openai / endpoint local compatível
                  </p>
                </div>
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
};
