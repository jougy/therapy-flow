import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { featureFlagsCatalog, FeatureFlagCategory } from "@/lib/feature-flags-catalog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings, ShieldAlert, Sparkles, Box, LayoutDashboard, FileText, ClipboardList, MessageSquare, Globe, Tag, RefreshCw, CreditCard, Printer, Save, X, AlertTriangle, CheckCircle2, Loader2, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { FeatureConfigModal } from "@/components/FeatureConfigModal";
import { TermsConfigModal } from "@/components/TermsConfigModal";

const getCategoryIcon = (category: FeatureFlagCategory) => {
  switch (category) {
    case 'Governança': return <Shield className="w-4 h-4 text-emerald-600" />;
    case 'Storage/Arquivos': return <Box className="w-4 h-4" />;
    case 'Notificações': return <ShieldAlert className="w-4 h-4" />;
    case 'Dashboards': return <LayoutDashboard className="w-4 h-4" />;
    case 'Formulários': return <FileText className="w-4 h-4" />;
    case 'Prontuário/Atendimentos': return <ClipboardList className="w-4 h-4" />;
    case 'Impressão': return <Printer className="w-4 h-4" />;
    case 'UI/Experiência': return <Sparkles className="w-4 h-4" />;
    case 'Assinaturas': return <CreditCard className="w-4 h-4" />;
    default: return <Settings className="w-4 h-4" />;
  }
};

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface FeatureFlagRecord {
  key: string;
  value: unknown;
}

export function PlatformFeatureFlags({ clinicId }: { clinicId?: string }) {
  const categories = Array.from(new Set(featureFlagsCatalog.map(f => f.category)));
  const [activeCategory, setActiveCategory] = useState<FeatureFlagCategory>(categories[0] as FeatureFlagCategory);
  
  // Saved state from database
  const [activeFlags, setActiveFlags] = useState<Record<string, boolean>>({});
  const [rawFlags, setRawFlags] = useState<Record<string, unknown>>({});

  // Draft state (Pending user confirmation via Salvar/Cancelar buttons)
  const [pendingFlags, setPendingFlags] = useState<Record<string, boolean>>({});
  const [pendingRawFlags, setPendingRawFlags] = useState<Record<string, unknown>>({});
  const [modifiedKeys, setModifiedKeys] = useState<Set<string>>(new Set());

  const [loading, setLoading] = useState(true);
  const [savingPending, setSavingPending] = useState(false);

  // Context selection (Global vs Tag vs Clinic)
  const [contextType, setContextType] = useState<"global" | "tag" | "clinic">(clinicId ? "clinic" : "global");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [tags, setTags] = useState<TagItem[]>([]);

  // Modal states
  const [justificationModalOpen, setJustificationModalOpen] = useState(false);
  const [selectedFlagKey, setSelectedFlagKey] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [notifyOwner, setNotifyOwner] = useState(false);
  const [notifyAdmin, setNotifyAdmin] = useState(false);
  const [notifyPro, setNotifyPro] = useState(false);
  const [targetState, setTargetState] = useState(false);

  // Config Modal states
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [configFlagKey, setConfigFlagKey] = useState<string | null>(null);

  // Terms Modal state
  const [termsModalOpen, setTermsModalOpen] = useState(false);

  const loadTags = async () => {
    try {
      const { data, error } = await supabase.from("clinic_tags").select("*").order("name");
      if (error) throw error;
      setTags(data || []);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao carregar tags";
      toast({ title: "Erro ao carregar tags", description: errorMessage, variant: "destructive" });
    }
  };

  const loadFlags = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase.from("feature_flags").select("*").eq("scope", contextType);
      
      if (contextType === "tag") {
        if (!selectedTagId) {
          setActiveFlags({});
          setPendingFlags({});
          setModifiedKeys(new Set());
          setLoading(false);
          return;
        }
        query = query.eq("tag_id", selectedTagId);
      } else if (contextType === "clinic" && clinicId) {
        query = query.eq("clinic_id", clinicId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const flagsMap: Record<string, boolean> = {};
      const rawMap: Record<string, unknown> = {};
      const records = (data || []) as FeatureFlagRecord[];
      records.forEach((f) => {
        const isObj = f.value && typeof f.value === 'object';
        const valObj = f.value as Record<string, unknown> | null;
        flagsMap[f.key] = isObj ? valObj?.enabled === true : (f.value === true || f.value === "true");
        rawMap[f.key] = f.value;
      });
      setActiveFlags(flagsMap);
      setPendingFlags(flagsMap);
      setRawFlags(rawMap);
      setPendingRawFlags(rawMap);
      setModifiedKeys(new Set());
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao carregar flags";
      toast({ title: "Erro ao carregar flags", description: errorMessage, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clinicId, contextType, selectedTagId]);

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    loadFlags();
  }, [loadFlags]);

  // Handle local draft toggle (does NOT save immediately to database)
  const handleToggleDraft = (key: string) => {
    if (contextType === "tag" && !selectedTagId) {
      toast({ title: "Selecione uma tag", description: "Você precisa selecionar uma tag para configurar suas flags.", variant: "destructive" });
      return;
    }

    const currentPendingValue = !!pendingFlags[key];
    const newState = !currentPendingValue;
    const isConfigurable = featureFlagsCatalog.find(f => f.key === key)?.hasConfiguration;

    let newRawValue: unknown = newState;
    if (isConfigurable) {
      const currentRaw = pendingRawFlags[key] || {};
      if (typeof currentRaw === 'object' && currentRaw !== null) {
        newRawValue = { ...currentRaw, enabled: newState };
      } else {
        newRawValue = { enabled: newState };
      }
    }

    setPendingFlags(prev => ({ ...prev, [key]: newState }));
    if (isConfigurable) {
      setPendingRawFlags(prev => ({ ...prev, [key]: newRawValue }));
    }

    setModifiedKeys(prev => {
      const next = new Set(prev);
      const originalValue = !!activeFlags[key];
      if (newState === originalValue) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Revert all draft changes back to saved state
  const handleCancelDrafts = () => {
    setPendingFlags({ ...activeFlags });
    setPendingRawFlags({ ...rawFlags });
    setModifiedKeys(new Set());
    toast({ title: "Alterações Canceladas", description: "As modificações pendentes foram descartadas." });
  };

  // Save all pending draft changes to database at once
  const handleSaveAllDrafts = async () => {
    if (modifiedKeys.size === 0) return;
    setSavingPending(true);

    try {
      const keysToSave = Array.from(modifiedKeys);
      for (const key of keysToSave) {
        const isConfigurable = featureFlagsCatalog.find(f => f.key === key)?.hasConfiguration;
        const newState = pendingFlags[key];
        const valueToSave = isConfigurable ? pendingRawFlags[key] : newState;

        const { error } = await supabase.rpc("upsert_feature_flag", {
          _key: key,
          _scope: contextType,
          _tag_id: contextType === "tag" ? selectedTagId : undefined,
          _clinic_id: contextType === "clinic" ? clinicId : undefined,
          _value: valueToSave,
          _description: featureFlagsCatalog.find(f => f.key === key)?.description,
        });

        if (error) throw error;
      }

      // Update saved baseline
      setActiveFlags({ ...pendingFlags });
      setRawFlags({ ...pendingRawFlags });
      setModifiedKeys(new Set());

      toast({
        title: "Feature Flags Atualizadas com Sucesso!",
        description: `Total de ${keysToSave.length} alteração(ões) aplicada(s) à plataforma.`,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar alterações pendentes";
      toast({ title: "Erro ao salvar", description: errorMessage, variant: "destructive" });
    } finally {
      setSavingPending(false);
    }
  };

  const openJustificationModal = (key: string) => {
    setSelectedFlagKey(key);
    setTargetState(!pendingFlags[key]);
    setReason("");
    setNotifyOwner(false);
    setNotifyAdmin(false);
    setNotifyPro(false);
    setJustificationModalOpen(true);
  };

  const submitJustification = async () => {
    if (!selectedFlagKey) return;
    
    const key = selectedFlagKey;
    const newState = targetState;
    const isConfigurable = featureFlagsCatalog.find(f => f.key === key)?.hasConfiguration;
    
    let valueToSave: unknown = newState;
    if (isConfigurable) {
      const raw = pendingRawFlags[key] || {};
      if (typeof raw === 'object' && raw !== null) {
        valueToSave = { ...raw, enabled: newState };
      } else {
        valueToSave = { enabled: newState };
      }
    }

    setPendingFlags(prev => ({ ...prev, [key]: newState }));
    if (isConfigurable) {
      setPendingRawFlags(prev => ({ ...prev, [key]: valueToSave }));
    }
    setJustificationModalOpen(false);

    try {
      const { error } = await supabase.rpc("upsert_feature_flag", {
        _key: key,
        _scope: contextType,
        _tag_id: contextType === "tag" ? selectedTagId : undefined,
        _clinic_id: contextType === "clinic" ? clinicId : undefined,
        _value: valueToSave,
        _reason: reason,
        _description: featureFlagsCatalog.find(f => f.key === key)?.description,
      });
      if (error) throw error;

      setActiveFlags(prev => ({ ...prev, [key]: newState }));
      setRawFlags(prev => ({ ...prev, [key]: valueToSave }));
      setModifiedKeys(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });

      toast({ title: "Alteração justificada salva." });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao salvar";
      toast({ title: "Erro", description: errorMessage, variant: "destructive" });
    }
  };

  const handlePublishNewTermsVersion = async (currentRaw?: Record<string, unknown>) => {
    const rawObj = (currentRaw || pendingRawFlags["terms_of_service_management"] || {}) as Record<string, unknown>;
    const newVersion = new Date().toISOString();
    const updatedPayload = {
      ...rawObj,
      publishedVersion: newVersion,
      publishedAt: newVersion,
    };

    try {
      const { error } = await supabase.rpc("upsert_feature_flag", {
        _key: "terms_of_service_management",
        _scope: contextType,
        _tag_id: contextType === "tag" ? selectedTagId : undefined,
        _clinic_id: contextType === "clinic" ? clinicId : undefined,
        _value: updatedPayload,
        _description: "Termos de Uso atualizados e publicados.",
      });

      if (error) throw error;

      setRawFlags((prev) => ({ ...prev, terms_of_service_management: updatedPayload }));
      setPendingRawFlags((prev) => ({ ...prev, terms_of_service_management: updatedPayload }));
      toast({
        title: "Termos de Uso Atualizados!",
        description: "Nova versão publicada. Todos os usuários afetados serão solicitados a aceitar no próximo login.",
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao publicar termos";
      toast({ title: "Erro ao publicar versão", description: errorMessage, variant: "destructive" });
    }
  };

  const filteredFeatures = featureFlagsCatalog.filter(f => f.category === activeCategory);
  const hasPendingChanges = modifiedKeys.size > 0;

  return (
    <div className="flex flex-col gap-6 relative">
      
      {/* Floating Action Bar for Pending Changes (Salvar / Cancelar) */}
      <AnimatePresence>
        {hasPendingChanges && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-4 bg-neutral-900 dark:bg-neutral-950 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-neutral-800"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{modifiedKeys.size} alteração(ões) pendente(s)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelDrafts}
                disabled={savingPending}
                className="h-9 px-3 text-xs bg-neutral-800 text-neutral-200 border-neutral-700 hover:bg-neutral-700"
              >
                <X className="w-3.5 h-3.5 mr-1" /> Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSaveAllDrafts}
                disabled={savingPending}
                className="h-9 px-4 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-md"
              >
                {savingPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar Alterações
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Context Selector - Hidden in Clinic Detail Context */}
      {!clinicId && (
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">Contexto de Configuração</h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Defina flags que valem para toda a plataforma ou apenas para clínicas com uma tag específica.
            </p>
          </div>
          <div className="w-full sm:w-[300px]">
            <Select 
              value={contextType === "global" ? "global" : `tag:${selectedTagId}`} 
              onValueChange={(val) => {
                if (val === "global") {
                  setContextType("global");
                  setSelectedTagId("");
                } else {
                  setContextType("tag");
                  setSelectedTagId(val.split(":")[1]);
                }
              }}
            >
              <SelectTrigger className="w-full bg-neutral-50 dark:bg-neutral-800">
                <SelectValue placeholder="Selecione o contexto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  <div className="flex items-center gap-2 font-medium">
                    <Globe className="w-4 h-4 text-primary" />
                    Global (Padrão para todas)
                  </div>
                </SelectItem>
                {tags.length > 0 && (
                  <SelectGroup>
                    <SelectLabel className="text-xs font-semibold text-neutral-500 tracking-wider">TAGS ESPECÍFICAS</SelectLabel>
                    {tags.map(tag => (
                      <SelectItem key={tag.id} value={`tag:${tag.id}`}>
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4" style={{ color: tag.color }} />
                          {tag.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        {/* Sidebar */}
        <div className="md:col-span-4 flex flex-col space-y-1">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setActiveCategory(category as FeatureFlagCategory)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200",
                activeCategory === category
                  ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                  : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100/80 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100"
              )}
            >
              {getCategoryIcon(category as FeatureFlagCategory)}
              {category}
            </button>
          ))}
        </div>

        {/* Main List Area */}
        <div className="md:col-span-8">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-200/60 dark:border-neutral-800 overflow-hidden relative min-h-[450px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-neutral-900/50 backdrop-blur-sm z-10">
                <div className="text-muted-foreground animate-pulse font-medium">Carregando flags...</div>
              </div>
            ) : contextType === "tag" && !selectedTagId ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8 z-10 text-neutral-500 space-y-3">
                <Tag className="w-12 h-12 text-neutral-300" />
                <p>Selecione uma Tag no menu acima para configurar suas Feature Flags específicas.</p>
              </div>
            ) : null}

            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className={cn("p-5 md:p-6 flex flex-col gap-5", (contextType === "tag" && !selectedTagId) ? "opacity-30 pointer-events-none" : "")}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                    {getCategoryIcon(activeCategory)}
                    {activeCategory}
                  </h2>
                  {hasPendingChanges && (
                    <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-300">
                      Modificações não salvas
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-4">
                  {filteredFeatures.map((feature) => {
                    const isOn = !!pendingFlags[feature.key];
                    const isModified = modifiedKeys.has(feature.key);

                    return (
                      <div 
                        key={feature.key} 
                        className={cn(
                          "flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-xl border transition-colors",
                          isModified
                            ? "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800"
                            : "border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 hover:bg-neutral-50 dark:hover:bg-neutral-800/70"
                        )}
                      >
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-base">{feature.label}</h3>
                            {isModified && (
                              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-mono">
                                Alterado (Pendente)
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
                          {feature.key === "terms_of_service_management" ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3"
                                onClick={() => setTermsModalOpen(true)}
                              >
                                <Settings className="w-3.5 h-3.5 mr-2" /> Configurar
                              </Button>

                              <Button
                                variant="default"
                                size="sm"
                                className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => void handlePublishNewTermsVersion()}
                              >
                                <RefreshCw className="w-3.5 h-3.5 mr-2" /> Atualizar Versão
                              </Button>
                            </>
                          ) : (
                            <>
                              {feature.hasConfiguration && (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-9 px-3"
                                  onClick={() => {
                                    setConfigFlagKey(feature.key);
                                    setConfigModalOpen(true);
                                  }}
                                >
                                  <Settings className="w-3.5 h-3.5 mr-2" /> Configurar
                                </Button>
                              )}

                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="h-9 px-2 text-neutral-500 hover:text-primary"
                                onClick={() => openJustificationModal(feature.key)}
                                title="Auditoria Avançada / Justificativa"
                              >
                                <MessageSquare className="w-4 h-4" />
                              </Button>

                              {feature.hasToggle !== false && (
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                                    isOn ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                                  )}>
                                    {isOn ? 'On' : 'Off'}
                                  </span>
                                  <Switch 
                                    checked={isOn} 
                                    onCheckedChange={() => handleToggleDraft(feature.key)} 
                                    className="data-[state=checked]:bg-emerald-500"
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Justification Modal */}
      <Dialog open={justificationModalOpen} onOpenChange={setJustificationModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Justificativa de Alteração</DialogTitle>
            <DialogDescription>
              Você está prestes a {targetState ? "LIGAR" : "DESLIGAR"} a flag <strong>{selectedFlagKey}</strong> no contexto {contextType === "clinic" ? "desta Clínica" : (contextType === "global" ? "Global" : "da Tag")}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-2">
              <Label>Motivo (Opcional)</Label>
              <Textarea 
                placeholder="Ex: Liberado para testes a pedido do dono." 
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Label>Notificar equipes sobre essa mudança</Label>
              <div className="flex flex-col gap-2">
                <div className="flex items-center space-x-2">
                  <Checkbox id="n-owner" checked={notifyOwner} onCheckedChange={(v) => setNotifyOwner(!!v)} />
                  <Label htmlFor="n-owner" className="font-normal cursor-pointer">Owners (Proprietários)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="n-admin" checked={notifyAdmin} onCheckedChange={(v) => setNotifyAdmin(!!v)} />
                  <Label htmlFor="n-admin" className="font-normal cursor-pointer">Administradores</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="n-pro" checked={notifyPro} onCheckedChange={(v) => setNotifyPro(!!v)} />
                  <Label htmlFor="n-pro" className="font-normal cursor-pointer">Profissionais de Saúde</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={submitJustification}>Confirmar Alteração</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FeatureConfigModal
        featureKey={configFlagKey}
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        scope={contextType}
        tagId={selectedTagId}
        onSave={() => loadFlags()}
      />

      <TermsConfigModal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        initialData={pendingRawFlags["terms_of_service_management"] as Record<string, unknown> | undefined}
        onSave={(payload) => {
          void handlePublishNewTermsVersion(payload);
        }}
      />
    </div>
  );
}
