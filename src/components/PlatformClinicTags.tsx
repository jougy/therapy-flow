import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { GroupColorPaletteField, type ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Tag, Check, LayoutTemplate, Loader2, Edit2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const INITIAL_PALETTE_SLOTS: ClinicGroupColorSlot[] = [
  { id: "1", color_hex: "#3b82f6", alpha: 100, slot_index: 0 },
  { id: "2", color_hex: "#10b981", alpha: 100, slot_index: 1 },
  { id: "3", color_hex: "#f59e0b", alpha: 100, slot_index: 2 },
  { id: "4", color_hex: "#ef4444", alpha: 100, slot_index: 3 },
  { id: "5", color_hex: "#8b5cf6", alpha: 100, slot_index: 4 },
  { id: "6", color_hex: "#ec4899", alpha: 100, slot_index: 5 },
];

export function PlatformClinicTags() {
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState("#8b5cf6");
  const [tagColorSlotId, setTagColorSlotId] = useState<string | null>("5");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  
  const [paletteSlots, setPaletteSlots] = useState<ClinicGroupColorSlot[]>(INITIAL_PALETTE_SLOTS);

  const [tags, setTags] = useState<any[]>([]);
  const [clinics, setClinics] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tagsRes, clinicsRes, relationsRes] = await Promise.all([
        supabase.from("clinic_tags").select("*").order("name"),
        supabase.rpc("list_platform_directory", { _kind: "clinic", _limit: 1000, _query: "" }),
        supabase.from("clinic_tag_relations").select("*")
      ]);

      if (tagsRes.error) throw tagsRes.error;
      if (clinicsRes.error) throw clinicsRes.error;
      if (relationsRes.error) throw relationsRes.error;

      setTags(tagsRes.data || []);
      
      const mappedClinics = (clinicsRes.data || []).map((item: any) => ({
        id: item.item_id,
        name: item.title,
      })).sort((a: any, b: any) => a.name.localeCompare(b.name));
      
      setClinics(mappedClinics);
      setRelations(relationsRes.data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveTag = async () => {
    if (!tagName.trim()) return;
    try {
      if (editingTagId) {
        const { error } = await supabase.from("clinic_tags").update({
          name: tagName.trim(),
          color: tagColor,
        }).eq("id", editingTagId);
        if (error) throw error;
        toast({ title: "Tag atualizada com sucesso" });
      } else {
        const { error } = await supabase.from("clinic_tags").insert({
          name: tagName.trim(),
          color: tagColor,
        });
        if (error) throw error;
        toast({ title: "Tag criada com sucesso" });
      }
      
      setTagName("");
      setEditingTagId(null);
      setIsDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Erro ao salvar tag", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTag = async (id: string) => {
    if (!window.confirm("Deseja realmente excluir esta tag? Ela será removida de todas as clínicas.")) return;
    try {
      const { error } = await supabase.from("clinic_tags").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Tag excluída com sucesso" });
      loadData();
    } catch (error: any) {
      toast({ title: "Erro ao excluir tag", description: error.message, variant: "destructive" });
    }
  };

  const openEditDialog = (tag: any) => {
    setEditingTagId(tag.id);
    setTagName(tag.name);
    setTagColor(tag.color);
    const slot = paletteSlots.find(s => s.color_hex.toLowerCase() === tag.color.toLowerCase());
    setTagColorSlotId(slot ? slot.id : null);
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingTagId(null);
    setTagName("");
    setTagColor("#8b5cf6");
    setTagColorSlotId("5");
    setIsDialogOpen(true);
  };

  const toggleClinicTag = async (clinicId: string, tagId: string) => {
    const isSelected = relations.some(r => r.clinic_id === clinicId && r.tag_id === tagId);
    
    // Optimistic update
    if (isSelected) {
      setRelations(prev => prev.filter(r => !(r.clinic_id === clinicId && r.tag_id === tagId)));
    } else {
      setRelations(prev => [...prev, { clinic_id: clinicId, tag_id: tagId }]);
    }

    try {
      if (isSelected) {
        const { error } = await supabase
          .from("clinic_tag_relations")
          .delete()
          .eq("clinic_id", clinicId)
          .eq("tag_id", tagId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("clinic_tag_relations")
          .insert({ clinic_id: clinicId, tag_id: tagId });
        if (error) throw error;
      }
    } catch (error: any) {
      toast({ title: "Erro ao vincular tag", description: error.message, variant: "destructive" });
      loadData(); // Revert on error
    }
  };

  if (loading) {
    return <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
            <LayoutTemplate className="w-6 h-6 text-primary" />
            Gestão de Tags de Clínicas
          </h2>
          <p className="text-neutral-500">
            Crie tags coloridas e aplique-as nas clínicas para habilitar feature flags por grupos.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <Button onClick={openCreateDialog} className="shrink-0 gap-2 shadow-sm rounded-xl h-10 px-5">
            <Plus className="w-4 h-4" /> Nova Tag
          </Button>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingTagId ? "Editar Tag" : "Criar Nova Tag"}</DialogTitle>
              <DialogDescription>
                Tags são usadas para organizar clínicas e atribuir feature flags.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="space-y-2">
                <Label>Nome da Tag</Label>
                <Input 
                  placeholder="Ex: Premium, Inadimplente, VIP..." 
                  value={tagName}
                  onChange={(e) => setTagName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Cor da Tag</Label>
                <GroupColorPaletteField
                  defaultOpen={false}
                  onPaletteSave={async (slotIndex, colorHex, alpha) => {
                    setPaletteSlots(prev => {
                      const newSlots = [...prev];
                      const existingIndex = newSlots.findIndex(s => s.slot_index === slotIndex);
                      if (existingIndex >= 0) {
                        newSlots[existingIndex] = { ...newSlots[existingIndex], color_hex: colorHex, alpha };
                      } else {
                        newSlots.push({ id: `custom-${slotIndex}`, color_hex: colorHex, alpha, slot_index: slotIndex });
                      }
                      return newSlots;
                    });
                    setTagColor(colorHex);
                    setTagColorSlotId(`custom-${slotIndex}`);
                  }}
                  onSelectSlot={(slot) => {
                    setTagColorSlotId(slot.id);
                    setTagColor(slot.color_hex);
                  }}
                  previewColorHex={tagColor}
                  selectedSlotId={tagColorSlotId}
                  slots={paletteSlots}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <Button onClick={handleSaveTag} disabled={!tagName.trim()}>
                {editingTagId ? "Salvar Alterações" : "Criar Tag"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Resumo de Tags */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200/60 flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wider">Tags Existentes</h2>
        <div className="flex flex-wrap gap-3">
          {tags.length === 0 ? (
            <p className="text-sm text-neutral-500">Nenhuma tag criada.</p>
          ) : (
            tags.map(tag => (
              <div 
                key={tag.id} 
                className="group relative text-sm px-4 py-2 flex items-center gap-2 rounded-full font-medium shadow-sm transition-all hover:scale-105 cursor-default pr-16" 
                style={{ backgroundColor: tag.color, color: "#fff" }}
              >
                <Tag className="w-4 h-4" />
                {tag.name}
                
                <div className="absolute right-1 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full p-1 backdrop-blur-sm">
                  <button 
                    onClick={() => openEditDialog(tag)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors"
                    title="Editar tag"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={() => handleDeleteTag(tag.id)}
                    className="p-1 hover:bg-white/20 rounded-full transition-colors text-white"
                    title="Excluir tag"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Matriz de Clínicas x Tags */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-200/60 overflow-hidden">
        <div className="p-6 border-b border-neutral-100 bg-neutral-50/30">
          <h2 className="text-lg font-semibold text-neutral-900">Vínculo em Massa (Clínicas x Tags)</h2>
          <p className="text-sm text-neutral-500">Clique nas tags para adicioná-las ou removê-las de cada clínica.</p>
        </div>
        <Table>
          <TableHeader className="bg-neutral-50/50">
            <TableRow>
              <TableHead className="w-[350px] font-semibold text-neutral-700">Clínica</TableHead>
              <TableHead className="font-semibold text-neutral-700">Tags Ativas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clinics.map(clinic => (
              <TableRow key={clinic.id} className="group">
                <TableCell className="font-medium text-neutral-900">{clinic.name}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {tags.map(tag => {
                      const isSelected = relations.some(r => r.clinic_id === clinic.id && r.tag_id === tag.id);
                      return (
                        <div 
                          key={tag.id}
                          onClick={() => toggleClinicTag(clinic.id, tag.id)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition-all border",
                            isSelected 
                              ? "border-transparent text-white shadow-sm scale-100" 
                              : "border-neutral-200 text-neutral-600 hover:bg-neutral-100 hover:border-neutral-300 opacity-70 hover:opacity-100"
                          )}
                          style={isSelected ? { backgroundColor: tag.color } : {}}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          {tag.name}
                        </div>
                      );
                    })}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
