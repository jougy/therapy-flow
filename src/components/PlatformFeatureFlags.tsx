import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { featureFlagsCatalog, FeatureFlagCategory } from "@/lib/feature-flags-catalog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Settings, ShieldAlert, Sparkles, Box, LayoutDashboard, FileText, ClipboardList, MessageSquare, Globe, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { FeatureConfigModal } from "@/components/FeatureConfigModal";

const getCategoryIcon = (category: FeatureFlagCategory) => {
  switch (category) {
    case 'Storage/Arquivos': return <Box className="w-4 h-4" />;
    case 'Notificações': return <ShieldAlert className="w-4 h-4" />;
    case 'Dashboards': return <LayoutDashboard className="w-4 h-4" />;
    case 'Formulários': return <FileText className="w-4 h-4" />;
    case 'Prontuário/Atendimentos': return <ClipboardList className="w-4 h-4" />;
    case 'UI/Experiência': return <Sparkles className="w-4 h-4" />;
    default: return <Settings className="w-4 h-4" />;
  }
};

export function PlatformFeatureFlags({ clinicId }: { clinicId?: string }) {
  const categories = Array.from(new Set(featureFlagsCatalog.map(f => f.category)));
  const [activeCategory, setActiveCategory] = useState<FeatureFlagCategory>(categories[0] as FeatureFlagCategory);
  
  const [activeFlags, setActiveFlags] = useState<Record<string, boolean>>({});
  const [rawFlags, setRawFlags] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Context selection (Global vs Tag vs Clinic)
  const [contextType, setContextType] = useState<"global" | "tag" | "clinic">(clinicId ? "clinic" : "global");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [tags, setTags] = useState<any[]>([]);

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

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    loadFlags();
  }, [contextType, selectedTagId, clinicId]);

  const loadTags = async () => {
    try {
      const { data, error } = await supabase.from("clinic_tags").select("*").order("name");
      if (error) throw error;
      setTags(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar tags", description: error.message, variant: "destructive" });
    }
  };

  const loadFlags = async () => {
    setLoading(true);
    try {
      let query = supabase.from("feature_flags").select("*").eq("scope", contextType);
      
      if (contextType === "tag") {
        if (!selectedTagId) {
          setActiveFlags({});
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
      const rawMap: Record<string, any> = {};
      data?.forEach((f: any) => {
        const isObj = f.value && typeof f.value === 'object';
        flagsMap[f.key] = isObj ? f.value.enabled === true : (f.value === true || f.value === "true");
        rawMap[f.key] = f.value;
      });
      setActiveFlags(flagsMap);
      setRawFlags(rawMap);
    } catch (error: any) {
      toast({ title: "Erro ao carregar flags", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, currentValue: boolean) => {
    if (contextType === "tag" && !selectedTagId) {
      toast({ title: "Selecione uma tag", description: "Você precisa selecionar uma tag para configurar suas flags.", variant: "destructive" });
      return;
    }

    const newState = !currentValue;
    const isConfigurable = featureFlagsCatalog.find(f => f.key === key)?.hasConfiguration;
    
    // Value to save
    let valueToSave: any = newState;
    if (isConfigurable) {
      const raw = rawFlags[key] || {};
      if (typeof raw === 'object') {
        valueToSave = { ...raw, enabled: newState };
      } else {
        valueToSave = { enabled: newState };
      }
    }

    // Optimistic Update
    setActiveFlags(prev => ({ ...prev, [key]: newState }));
    if (isConfigurable) {
      setRawFlags(prev => ({ ...prev, [key]: valueToSave }));
    }
    
    try {
      const { error } = await supabase.rpc("upsert_feature_flag", {
        _key: key,
        _scope: contextType,
        _tag_id: contextType === "tag" ? selectedTagId : undefined,
        _clinic_id: contextType === "clinic" ? clinicId : undefined,
        _value: valueToSave,
        _description: featureFlagsCatalog.find(f => f.key === key)?.description,
      });

      if (error) throw error;
    } catch (error: any) {
      setActiveFlags(prev => ({ ...prev, [key]: currentValue }));
      toast({ title: "Erro ao salvar flag", description: error.message, variant: "destructive" });
    }
  };

  const openJustificationModal = (key: string) => {
    setSelectedFlagKey(key);
    setTargetState(!activeFlags[key]);
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
    
    let valueToSave: any = newState;
    if (isConfigurable) {
      const raw = rawFlags[key] || {};
      if (typeof raw === 'object') {
        valueToSave = { ...raw, enabled: newState };
      } else {
        valueToSave = { enabled: newState };
      }
    }

    setActiveFlags(prev => ({ ...prev, [key]: newState }));
    if (isConfigurable) {
      setRawFlags(prev => ({ ...prev, [key]: valueToSave }));
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

      if (notifyOwner || notifyAdmin || notifyPro) {
        toast({ title: "Notificações", description: "Notificações seriam enviadas para as equipes selecionadas." });
      }

      toast({ title: "Alteração justificada salva." });
    } catch (error: any) {
      setActiveFlags(prev => ({ ...prev, [key]: !newState }));
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const filteredFeatures = featureFlagsCatalog.filter(f => f.category === activeCategory);

  return (
    <div className="flex flex-col gap-6">
      
      {/* Top Context Selector - Hidden in Clinic Detail Context */}
      {!clinicId && (
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-neutral-200/60 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-neutral-900">Contexto de Configuração</h2>
            <p className="text-sm text-neutral-500">
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
              <SelectTrigger className="w-full bg-neutral-50">
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
                  : "text-neutral-600 hover:bg-neutral-100/80 hover:text-neutral-900"
              )}
            >
              {getCategoryIcon(category as FeatureFlagCategory)}
              {category}
            </button>
          ))}
        </div>

        {/* Main List Area */}
        <div className="md:col-span-8">
          <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 overflow-hidden relative min-h-[450px]">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm z-10">
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
                <div className="mb-2">
                  <h2 className="text-xl font-semibold text-neutral-800 flex items-center gap-2">
                    {getCategoryIcon(activeCategory)}
                    {activeCategory}
                  </h2>
                </div>

                <div className="flex flex-col gap-4">
                  {filteredFeatures.map((feature) => {
                    const isOn = !!activeFlags[feature.key];
                    return (
                      <div 
                        key={feature.key} 
                        className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 p-5 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-neutral-50 hover:border-neutral-200 transition-colors"
                      >
                        <div className="flex-1 space-y-1">
                          <h3 className="font-semibold text-neutral-900 text-base">{feature.label}</h3>
                          <p className="text-sm text-neutral-500 leading-relaxed">
                            {feature.description}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-3 shrink-0">
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
                          
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider",
                              isOn ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-600"
                            )}>
                              {isOn ? 'On' : 'Off'}
                            </span>
                            <Switch 
                              checked={isOn} 
                              onCheckedChange={() => handleToggle(feature.key, isOn)} 
                              className="data-[state=checked]:bg-emerald-500"
                            />
                          </div>
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
    </div>
  );
}
