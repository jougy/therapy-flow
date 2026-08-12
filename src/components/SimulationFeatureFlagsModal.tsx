import { useState } from "react";
import { SlidersHorizontal, RotateCcw, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { featureFlagsCatalog } from "@/lib/feature-flags-catalog";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";

interface SimulationFeatureFlagsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SimulationFeatureFlagsModal({ open, onOpenChange }: SimulationFeatureFlagsModalProps) {
  const { flagOverrides, isFeatureEnabled, resetFlagOverrides, setFlagOverride } = useFeatureFlags();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = Array.from(new Set(featureFlagsCatalog.map((f) => f.category)));
  const activeOverrideCount = Object.keys(flagOverrides).length;

  const filteredFlags = featureFlagsCatalog.filter((flag) => {
    const matchesSearch =
      flag.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flag.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || flag.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-6 overflow-hidden sm:rounded-2xl">
        <DialogHeader className="pb-3 border-b shrink-0">
          <div className="flex items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Feature Flags da Simulação
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Alterne instantaneamente o comportamento das funcionalidades nesta sessão de teste.
                </DialogDescription>
              </div>
            </div>
            {activeOverrideCount > 0 && (
              <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-900 font-medium">
                {activeOverrideCount} {activeOverrideCount === 1 ? "override ativo" : "overrides ativos"}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row items-center gap-2 py-3 shrink-0 border-b">
          <div className="relative w-full sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar feature flag por nome, chave ou descrição..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs sm:text-sm"
            />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 px-3 py-1 text-xs border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">Todas categorias ({featureFlagsCatalog.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {activeOverrideCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-100"
                onClick={resetFlagOverrides}
                title="Resetar todos os overrides em memória"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Resetar
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-3">
          {filteredFlags.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              Nenhuma feature flag encontrada com o filtro atual.
            </div>
          ) : (
            filteredFlags.map((flag) => {
              const isOverridden = flag.key in flagOverrides;
              const enabled = isFeatureEnabled(flag.key);

              return (
                <div
                  key={flag.key}
                  className={`p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-4 ${
                    isOverridden
                      ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20"
                      : "border-border/60 bg-card hover:bg-accent/40"
                  }`}
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-xs sm:text-sm text-foreground">
                        {flag.label}
                      </span>
                      <Badge variant="secondary" className="text-[10px] py-0 h-4 px-1.5 font-normal">
                        {flag.category}
                      </Badge>
                      {isOverridden && (
                        <Badge className="text-[10px] py-0 h-4 px-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium">
                          Modificado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {flag.description}
                    </p>
                    <code className="text-[10px] text-muted-foreground/80 font-mono bg-muted/60 px-1.5 py-0.5 rounded inline-block">
                      {flag.key}
                    </code>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${enabled ? "text-emerald-600" : "text-slate-400"}`}>
                        {enabled ? "ON" : "OFF"}
                      </span>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(val) => setFlagOverride(flag.key, val)}
                        aria-label={`Alternar ${flag.label}`}
                      />
                    </div>
                    {isOverridden && (
                      <button
                        type="button"
                        className="text-[11px] text-amber-700 hover:underline flex items-center gap-1"
                        onClick={() => {
                          const nextOverrides = { ...flagOverrides };
                          delete nextOverrides[flag.key];
                          resetFlagOverrides();
                          Object.entries(nextOverrides).forEach(([k, v]) => setFlagOverride(k, v));
                        }}
                      >
                        Desfazer
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
