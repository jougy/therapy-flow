import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  HELPERS_PAGE_GROUPS,
  getHelperDefaultData,
  type HelperItemInfo,
  type HelperItemConfig,
  type HelpersFeatureFlagValue,
} from "./tutorial-registry";
import {
  HelpCircle,
  Search,
  RotateCcw,
  Eye,
  EyeOff,
  Building2,
  Users,
  UserPlus,
  ClipboardList,
  Stethoscope,
  LayoutDashboard,
  Settings,
  FileEdit,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const getPageIcon = (iconName: string) => {
  switch (iconName) {
    case "Building2": return <Building2 className="w-4 h-4 text-blue-500" />;
    case "Users": return <Users className="w-4 h-4 text-indigo-500" />;
    case "UserPlus": return <UserPlus className="w-4 h-4 text-emerald-500" />;
    case "ClipboardList": return <ClipboardList className="w-4 h-4 text-amber-500" />;
    case "Stethoscope": return <Stethoscope className="w-4 h-4 text-teal-500" />;
    case "LayoutDashboard": return <LayoutDashboard className="w-4 h-4 text-purple-500" />;
    case "Settings": return <Settings className="w-4 h-4 text-slate-500" />;
    case "FileEdit": return <FileEdit className="w-4 h-4 text-rose-500" />;
    default: return <HelpCircle className="w-4 h-4 text-sky-500" />;
  }
};

export interface HelpersConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Record<string, unknown>;
  onSave?: (payload: Record<string, unknown>) => void;
  scope?: "global" | "tag" | "clinic";
  tagId?: string;
  clinicId?: string;
}

export const HelpersConfigModal: React.FC<HelpersConfigModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSave,
  scope = "global",
  tagId,
  clinicId,
}) => {
  const [selectedPageId, setSelectedPageId] = useState<string>(HELPERS_PAGE_GROUPS[0].id);
  const [searchQuery, setSearchQuery] = useState("");
  const [helperConfigs, setHelperConfigs] = useState<Record<string, HelperItemConfig>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const data = (initialData as HelpersFeatureFlagValue) || {};
      setHelperConfigs(data.helpers || {});
      setSelectedPageId(HELPERS_PAGE_GROUPS[0].id);
      setSearchQuery("");
    }
  }, [isOpen, initialData]);

  const selectedPage = useMemo(() => {
    return HELPERS_PAGE_GROUPS.find((p) => p.id === selectedPageId) || HELPERS_PAGE_GROUPS[0];
  }, [selectedPageId]);

  // Contadores por página
  const pageStats = useMemo(() => {
    const stats: Record<string, { total: number; hidden: number; customized: number }> = {};
    HELPERS_PAGE_GROUPS.forEach((pg) => {
      let hidden = 0;
      let customized = 0;
      pg.helpers.forEach((h) => {
        const cfg = helperConfigs[h.id];
        if (cfg?.hidden) hidden++;
        if (cfg?.title || cfg?.description || cfg?.tip) customized++;
      });
      stats[pg.id] = {
        total: pg.helpers.length,
        hidden,
        customized,
      };
    });
    return stats;
  }, [helperConfigs]);

  // Helpers filtrados para a visualização
  const displayedHelpers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      return selectedPage.helpers;
    }
    // Se estiver pesquisando, busca em todas as páginas
    const allMatching: Array<HelperItemInfo & { pageTitle: string }> = [];
    HELPERS_PAGE_GROUPS.forEach((pg) => {
      pg.helpers.forEach((h) => {
        const defaultData = getHelperDefaultData(h.id);
        const cfg = helperConfigs[h.id];
        const matchTitle = (cfg?.title || defaultData.title).toLowerCase().includes(q);
        const matchDesc = (cfg?.description || defaultData.description).toLowerCase().includes(q);
        const matchName = h.name.toLowerCase().includes(q) || h.id.toLowerCase().includes(q);
        if (matchTitle || matchDesc || matchName) {
          allMatching.push({ ...h, pageTitle: pg.title });
        }
      });
    });
    return allMatching;
  }, [selectedPage, searchQuery, helperConfigs]);

  const handleToggleVisibility = (helpId: string, visible: boolean) => {
    setHelperConfigs((prev) => ({
      ...prev,
      [helpId]: {
        ...(prev[helpId] || {}),
        hidden: !visible,
      },
    }));
  };

  const handleUpdateText = (helpId: string, field: "title" | "description" | "tip", value: string) => {
    setHelperConfigs((prev) => {
      const current = prev[helpId] || {};
      const updated = { ...current, [field]: value };
      // Se limpou o texto, remove a chave para usar o default se não houver outras customizações
      if (!value.trim()) {
        delete updated[field];
      }
      return {
        ...prev,
        [helpId]: updated,
      };
    });
  };

  const handleResetHelper = (helpId: string) => {
    setHelperConfigs((prev) => {
      const next = { ...prev };
      delete next[helpId];
      return next;
    });
    toast({
      title: "Helper restaurado",
      description: "As mensagens e a visibilidade padrão deste botão foram redefinidas.",
    });
  };

  const handleBulkSetPageVisibility = (visible: boolean) => {
    setHelperConfigs((prev) => {
      const next = { ...prev };
      selectedPage.helpers.forEach((h) => {
        next[h.id] = {
          ...(next[h.id] || {}),
          hidden: !visible,
        };
      });
      return next;
    });
    toast({
      title: visible ? "Todos os botões ativados" : "Todos os botões ocultados",
      description: `Alterada a visibilidade de todos os helpers da página '${selectedPage.title}'.`,
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Obter registro atual
      let matchQuery = supabase.from("feature_flags").select("value").eq("key", "system_helpers").eq("scope", scope);
      if (scope === "tag" && tagId) matchQuery = matchQuery.eq("tag_id", tagId);
      if (scope === "clinic" && clinicId) matchQuery = matchQuery.eq("clinic_id", clinicId);
      if (scope === "global") matchQuery = matchQuery.is("tag_id", null).is("clinic_id", null);

      const { data: existingData } = await matchQuery.maybeSingle();

      const currentVal = (existingData?.value as Record<string, unknown>) || {};
      const mergedPayload: HelpersFeatureFlagValue = {
        ...currentVal,
        enabled: currentVal.enabled !== undefined ? Boolean(currentVal.enabled) : true,
        helpers: helperConfigs,
      };

      // 2. Salvar usando RPC
      const { error: upsertError } = await supabase.rpc("upsert_feature_flag", {
        _key: "system_helpers",
        _scope: scope,
        _clinic_id: scope === "clinic" ? clinicId : undefined,
        _tag_id: scope === "tag" ? tagId : undefined,
        _value: mergedPayload,
        _description: "Botões de Ajuda Rápida & Helpers Contextuais (?)",
      });

      if (upsertError) throw upsertError;

      toast({
        title: "Configurações de Helpers salvas",
        description: "A visibilidade e os textos dos botões de ajuda foram atualizados com sucesso.",
      });

      if (onSave) onSave(mergedPayload as Record<string, unknown>);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido ao salvar helpers";
      toast({
        title: "Erro ao salvar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[950px] w-[95vw] p-0 overflow-hidden flex flex-col max-h-[90dvh] rounded-2xl border-neutral-200/80 shadow-2xl">
        {/* Cabeçalho */}
        <DialogHeader className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/70 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                <HelpCircle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-semibold text-neutral-900 flex items-center gap-2">
                  Gerenciador de Helpers & Botões (?)
                  <Badge variant="outline" className="text-xs bg-sky-50 text-sky-700 border-sky-200">
                    Por Página
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm text-neutral-500 mt-0.5">
                  Configure quais botões de ajuda aparecem em cada tela e personalize os títulos, mensagens e dicas.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Barra de Busca Global de Helpers */}
        <div className="px-6 py-3 border-b border-neutral-100 bg-white flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar helper por nome, ID ou texto em todas as páginas..."
              className="pl-9 h-9 text-xs sm:text-sm bg-neutral-50/60 border-neutral-200 rounded-lg"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="h-9 px-2.5 text-xs text-neutral-500"
            >
              Limpar busca
            </Button>
          )}
        </div>

        {/* Layout Principal: Lista de Páginas + Conteúdo dos Helpers */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[420px]">
          {/* Menu Lateral de Páginas (oculto se estiver pesquisando globalmente) */}
          {!searchQuery && (
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-neutral-100 bg-neutral-50/40 p-3 overflow-y-auto shrink-0 max-h-[160px] md:max-h-none">
              <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider px-2.5 mb-2">
                Páginas da Aplicação ({HELPERS_PAGE_GROUPS.length})
              </p>
              <div className="space-y-1">
                {HELPERS_PAGE_GROUPS.map((page) => {
                  const isSelected = page.id === selectedPageId;
                  const stats = pageStats[page.id] || { total: 0, hidden: 0, customized: 0 };
                  return (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => setSelectedPageId(page.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-between group ${
                        isSelected
                          ? "bg-white text-sky-700 shadow-xs border border-sky-100"
                          : "text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="shrink-0">{getPageIcon(page.iconName)}</span>
                        <span className="truncate">{page.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {stats.hidden > 0 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-50 text-red-600 border-red-200">
                            {stats.hidden} oculto{stats.hidden > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {stats.customized > 0 && (
                          <span className="w-2 h-2 rounded-full bg-amber-500" title="Possui textos customizados" />
                        )}
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? "text-sky-600 translate-x-0.5" : "text-neutral-300 group-hover:text-neutral-400"}`} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Painel Central: Lista de Helpers da Página Selecionada */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white space-y-4">
            {/* Header da Página Selecionada */}
            {!searchQuery && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
                    {getPageIcon(selectedPage.iconName)}
                    {selectedPage.title}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-0.5">{selectedPage.description}</p>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkSetPageVisibility(true)}
                    className="h-8 text-xs text-neutral-600 hover:text-neutral-900"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Exibir todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleBulkSetPageVisibility(false)}
                    className="h-8 text-xs text-neutral-600 hover:text-neutral-900"
                  >
                    <EyeOff className="w-3.5 h-3.5 mr-1 text-red-500" /> Ocultar todos
                  </Button>
                </div>
              </div>
            )}

            {/* Listagem de Helpers */}
            {displayedHelpers.length === 0 ? (
              <div className="py-12 text-center text-neutral-400">
                <HelpCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium text-neutral-600">Nenhum helper encontrado.</p>
                <p className="text-xs text-neutral-400 mt-1">Tente pesquisar por outro termo ou selecione outra página.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {displayedHelpers.map((helper) => {
                  const defaultData = getHelperDefaultData(helper.id);
                  const config = helperConfigs[helper.id] || {};
                  const isHidden = config.hidden === true;
                  const currentTitle = config.title !== undefined ? config.title : defaultData.title;
                  const currentDescription = config.description !== undefined ? config.description : defaultData.description;
                  const currentTip = config.tip !== undefined ? config.tip : defaultData.tip;
                  const hasCustomText = Boolean(config.title || config.description || config.tip);

                  return (
                    <div
                      key={helper.id}
                      className={`p-4 rounded-xl border transition-all ${
                        isHidden
                          ? "bg-neutral-50/70 border-neutral-200/60 opacity-80"
                          : "bg-white border-neutral-200/90 shadow-xs hover:border-neutral-300"
                      }`}
                    >
                      {/* Top bar do Helper */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold ${
                            isHidden ? "bg-neutral-200 text-neutral-500" : "bg-sky-100 text-sky-700"
                          }`}>
                            ?
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-neutral-900">
                              {helper.name}
                            </span>
                            {"pageTitle" in helper && (
                              <span className="text-[11px] text-neutral-400 ml-2">
                                (em {(helper as any).pageTitle})
                              </span>
                            )}
                          </div>
                          <Badge variant="secondary" className="font-mono text-[10px] text-neutral-500 px-1.5 py-0">
                            {helper.id}
                          </Badge>
                          {defaultData.stepCount > 1 && (
                            <Badge variant="outline" className="text-[10px] text-indigo-600 bg-indigo-50 border-indigo-200 px-1.5 py-0">
                              {defaultData.stepCount} passos
                            </Badge>
                          )}
                          {hasCustomText && (
                            <Badge variant="outline" className="text-[10px] text-amber-600 bg-amber-50 border-amber-200 px-1.5 py-0">
                              Texto editado
                            </Badge>
                          )}
                        </div>

                        {/* Switch de Visibilidade */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`switch-${helper.id}`} className="text-xs text-neutral-600 font-medium cursor-pointer">
                              {isHidden ? (
                                <span className="text-red-500 flex items-center gap-1 font-semibold">
                                  <EyeOff className="w-3.5 h-3.5" /> Oculto
                                </span>
                              ) : (
                                <span className="text-emerald-600 flex items-center gap-1 font-semibold">
                                  <Eye className="w-3.5 h-3.5" /> Visível
                                </span>
                              )}
                            </Label>
                            <Switch
                              id={`switch-${helper.id}`}
                              checked={!isHidden}
                              onCheckedChange={(checked) => handleToggleVisibility(helper.id, checked)}
                            />
                          </div>

                          {(hasCustomText || isHidden) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleResetHelper(helper.id)}
                              className="h-8 px-2 text-xs text-neutral-500 hover:text-neutral-800"
                              title="Restaurar valores padrão"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Campos de Edição de Mensagem */}
                      <div className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs font-medium text-neutral-700">
                              Título da Ajuda
                            </Label>
                            <Input
                              value={currentTitle}
                              onChange={(e) => handleUpdateText(helper.id, "title", e.target.value)}
                              placeholder={defaultData.title}
                              disabled={isHidden}
                              className="h-8 text-xs mt-1 bg-neutral-50/50"
                            />
                          </div>

                          <div>
                            <Label className="text-xs font-medium text-neutral-700">
                              Mensagem / Explicação
                            </Label>
                            <Textarea
                              value={currentDescription}
                              onChange={(e) => handleUpdateText(helper.id, "description", e.target.value)}
                              placeholder={defaultData.description}
                              disabled={isHidden}
                              rows={3}
                              className="text-xs mt-1 bg-neutral-50/50 resize-none"
                            />
                          </div>

                          <div>
                            <Label className="text-xs font-medium text-neutral-700">
                              Dica Opcional (Tip)
                            </Label>
                            <Input
                              value={currentTip || ""}
                              onChange={(e) => handleUpdateText(helper.id, "tip", e.target.value)}
                              placeholder={defaultData.tip || "Ex: Dica rápida de uso..."}
                              disabled={isHidden}
                              className="h-8 text-xs mt-1 bg-neutral-50/50"
                            />
                          </div>
                        </div>

                        {/* Live Preview Card */}
                        <div className="flex flex-col justify-between p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                          <div>
                            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                              <span>Pré-visualização do Card</span>
                              <span className="text-[10px] text-sky-600 font-medium">Ao vivo</span>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-neutral-200/80 shadow-xs space-y-1.5">
                              <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-900">
                                <span>💡</span>
                                <span>{currentTitle || "Ajuda do Componente"}</span>
                              </div>
                              <p className="text-[11px] text-neutral-600 leading-relaxed">
                                {currentDescription || "Descrição do componente..."}
                              </p>
                              {currentTip && (
                                <div className="mt-2 pt-1.5 border-t border-neutral-100 flex items-start gap-1 text-[10px] text-amber-700 bg-amber-50/60 p-1.5 rounded">
                                  <span>✨</span>
                                  <span>{currentTip}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
                            <span>Seletor: {helper.targetSelector || "automático"}</span>
                            <span className={isHidden ? "text-red-500 font-medium" : "text-emerald-600 font-medium"}>
                              {isHidden ? "Não será exibido" : "Pronto para exibição"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé fixo */}
        <DialogFooter className="px-6 py-4 border-t border-neutral-100 bg-neutral-50/70 shrink-0 flex items-center justify-between gap-3">
          <div className="text-xs text-neutral-500 hidden sm:block">
            Alterações são salvas no escopo atual ({scope === "global" ? "Global" : scope === "tag" ? "Tag de Clínica" : "Clínica Específica"}).
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <DialogClose asChild>
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                Cancelar
              </Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-sky-600 hover:bg-sky-700 text-white shadow-xs"
            >
              {isSaving ? "Salvando..." : "Salvar Configurações"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
