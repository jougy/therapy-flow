import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getLegacyGroupHex, normalizeGroupName, sanitizeColorSlotId } from "@/lib/group-colors";
import type { ClinicGroupColorSlot } from "@/components/GroupColorPaletteField";
import { PATIENT_EXTRA_QUERY_KEYS } from "@/hooks/queries/usePatientExtraQueries";
import type { GroupSuggestion, PatientGroup, PatientGroupStatus } from "../pacienteDetalheTypes";
import { isLockedSystemGroup } from "../pacienteDetalheHelpers";

interface Params {
  id: string | undefined;
  realPatientId: string | undefined;
  clinicId: string | null | undefined;
  user: User | null;
  groups: PatientGroup[];
  groupSuggestions: GroupSuggestion[];
  clinicColorSlots: ClinicGroupColorSlot[];
  resolvedClinicColorSlots: ClinicGroupColorSlot[];
  queryClient: QueryClient;
  invalidatePatientData: (patientId: string, clinicId?: string | null, keys?: string[]) => Promise<void>;
  optimisticAddOrUpdateGroup: (group: PatientGroup) => void;
  optimisticDeleteGroup: (groupId: string) => void;
}

export function usePatientCareLineActions(params: Params) {
  const {
    id, realPatientId, clinicId, user, groups, groupSuggestions, clinicColorSlots,
    resolvedClinicColorSlots, queryClient, invalidatePatientData, optimisticAddOrUpdateGroup, optimisticDeleteGroup,
  } = params;

  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<PatientGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupComboboxOpen, setGroupComboboxOpen] = useState(false);
  const [groupColor, setGroupColor] = useState(getLegacyGroupHex("lavender"));
  const [groupColorSlotId, setGroupColorSlotId] = useState<string | null>(null);
  const [groupStatus, setGroupStatus] = useState<PatientGroupStatus>("em_andamento");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingEvolutionGroup, setEditingEvolutionGroup] = useState<{ id: string; name: string } | null>(null);
  const [savingEvolutionGroupName, setSavingEvolutionGroupName] = useState(false);

  const getSlotById = useCallback(
    (slotId: string | null) => resolvedClinicColorSlots.find((s) => s.id === slotId) ?? null,
    [resolvedClinicColorSlots]
  );

  useEffect(() => {
    if (!groupColorSlotId) return;
    const slot = getSlotById(groupColorSlotId);
    if (slot && slot.color_hex !== groupColor) setGroupColor(slot.color_hex);
  }, [getSlotById, groupColor, groupColorSlotId]);

  const openNewGroup = () => {
    const defaultSlot = resolvedClinicColorSlots[1] ?? resolvedClinicColorSlots[0] ?? null;
    setEditingGroup(null); setGroupName(""); setGroupComboboxOpen(false);
    setGroupColor(defaultSlot?.color_hex ?? getLegacyGroupHex("lavender"));
    setGroupColorSlotId(sanitizeColorSlotId(defaultSlot?.id));
    setGroupStatus("em_andamento"); setGroupDialogOpen(true);
  };

  const openEditGroup = (g: PatientGroup) => {
    if (isLockedSystemGroup(g)) {
      toast({ title: "Este grupo reservado do sistema não pode ser editado dessa forma", variant: "destructive" });
      return;
    }
    setEditingGroup(g); setGroupName(g.name); setGroupComboboxOpen(false);
    setGroupColor(getLegacyGroupHex(g.color)); setGroupColorSlotId(sanitizeColorSlotId(g.clinic_color_slot_id));
    setGroupStatus((g.status as PatientGroupStatus) || "em_andamento"); setGroupDialogOpen(true);
  };

  const handleSelectGroupSuggestion = (s: GroupSuggestion) => {
    setGroupName(s.name);
    const slot = getSlotById(s.clinic_color_slot_id);
    setGroupColor(slot?.color_hex ?? getLegacyGroupHex(s.color || "lavender"));
    setGroupColorSlotId(sanitizeColorSlotId(slot?.id ?? s.clinic_color_slot_id));
    setGroupStatus((s.status as PatientGroupStatus) || "em_andamento");
    setGroupComboboxOpen(false);
  };

  const handleCreateTypedGroupName = () => { setGroupName(groupName.trim().replace(/\s+/g, " ")); setGroupComboboxOpen(false); };

  const upsertGroupTemplate = async (p: { clinicColorSlotId: string | null; color: string; name: string; status: PatientGroupStatus }) => {
    if (!clinicId || !user) return;
    await supabase.from("patient_group_templates").upsert({
      clinic_id: clinicId, clinic_color_slot_id: sanitizeColorSlotId(p.clinicColorSlotId),
      color: p.color, created_by: user.id, name: p.name, normalized_name: normalizeGroupName(p.name), status: p.status,
    }, { onConflict: "clinic_id,normalized_name" });
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim() || !id || !user) return;
    const norm = normalizeGroupName(groupName);
    if (groups.find((g) => editingGroup?.id !== g.id && normalizeGroupName(g.name) === norm)) {
      toast({ title: "Grupo já existe neste paciente", description: "Escolha o grupo existente na lista ou use outro nome.", variant: "destructive" });
      return;
    }
    setSavingGroup(true);
    const clinicRes = await supabase.rpc("get_user_clinic_id", { _user_id: user.id });
    const suggestion = !editingGroup ? groupSuggestions.find((s) => normalizeGroupName(s.name) === norm) : undefined;
    const slot = getSlotById(suggestion?.clinic_color_slot_id ?? null);
    const resolvedColor = slot?.color_hex || (suggestion?.color ? getLegacyGroupHex(suggestion.color) : groupColor);
    const resolvedSlotId = sanitizeColorSlotId(slot?.id ?? suggestion?.clinic_color_slot_id ?? groupColorSlotId);
    const resolvedStatus = (suggestion?.status as PatientGroupStatus | null) || groupStatus;

    if (editingGroup) {
      const editSlotId = sanitizeColorSlotId(groupColorSlotId);
      optimisticAddOrUpdateGroup({ ...editingGroup, clinic_color_slot_id: editSlotId, name: groupName.trim(), color: groupColor, status: groupStatus });
      const { error } = await supabase.from("patient_groups").update({ clinic_color_slot_id: editSlotId, name: groupName.trim(), color: groupColor, status: groupStatus }).eq("id", editingGroup.id);
      if (error) { toast({ title: "Erro ao atualizar grupo", variant: "destructive" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["groups"]); }
      else { await upsertGroupTemplate({ clinicColorSlotId: editSlotId, color: groupColor, name: groupName.trim(), status: groupStatus }); toast({ title: "Grupo atualizado" }); }
    } else {
      const { data: inserted, error } = await supabase.from("patient_groups").insert({
        clinic_color_slot_id: resolvedSlotId, name: groupName.trim(), color: resolvedColor, group_kind: "custom",
        status: resolvedStatus, is_default: false, patient_id: realPatientId || id, user_id: user.id, clinic_id: clinicRes.data,
      }).select("*").single();
      if (error || !inserted) { toast({ title: "Erro ao criar grupo", variant: "destructive" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["groups"]); }
      else { optimisticAddOrUpdateGroup(inserted); await upsertGroupTemplate({ clinicColorSlotId: resolvedSlotId, color: resolvedColor, name: groupName.trim(), status: resolvedStatus }); toast({ title: "Grupo criado" }); }
    }
    setSavingGroup(false); setGroupDialogOpen(false);
  };

  const handleSaveClinicColorSlot = async (slotIndex: number, colorHex: string, alpha: number) => {
    if (!clinicId) return;
    const existing = clinicColorSlots.find((s) => s.slot_index === slotIndex) ?? null;
    const payload = { alpha, clinic_id: clinicId, color_hex: colorHex, slot_index: slotIndex };
    const { data, error } = await supabase.from("clinic_group_color_slots").upsert(existing ? { ...payload, id: existing.id } : payload, { onConflict: "clinic_id,slot_index" }).select("*").single();
    if (error || !data) { toast({ title: "Erro ao salvar cor da clínica", description: error?.message, variant: "destructive" }); return; }
    await Promise.all([
      supabase.from("patient_groups").update({ color: colorHex }).eq("clinic_id", clinicId).eq("clinic_color_slot_id", data.id),
      supabase.from("patient_group_templates").update({ color: colorHex }).eq("clinic_id", clinicId).eq("clinic_color_slot_id", data.id),
    ]);
    setGroupColorSlotId(data.id); setGroupColor(colorHex);
    toast({ title: "Paleta da clínica atualizada" });
    if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["groups"]);
  };

  const handleDeleteGroup = async (groupId: string) => {
    const group = groups.find((i) => i.id === groupId);
    if (group && isLockedSystemGroup(group)) {
      toast({ title: "Este grupo reservado do sistema não pode ser excluído", variant: "destructive" });
      setDeleteConfirmId(null); return;
    }
    optimisticDeleteGroup(groupId); setDeleteConfirmId(null);
    await supabase.from("sessions").update({ group_id: null }).eq("group_id", groupId);
    const { error } = await supabase.from("patient_groups").delete().eq("id", groupId);
    if (error) { toast({ title: "Erro ao excluir grupo", variant: "destructive" }); if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["groups", "sessions"]); }
    else toast({ title: "Grupo excluído" });
  };

  const handleSaveEvolutionGroupName = async () => {
    if (!editingEvolutionGroup) return;
    setSavingEvolutionGroupName(true);
    const trimmed = editingEvolutionGroup.name.trim() || null;
    const { error } = await supabase.from("patient_evolution_groups").update({ custom_name: trimmed }).eq("id", editingEvolutionGroup.id);
    if (error) toast({ title: "Erro ao salvar nome do ciclo", variant: "destructive" });
    else {
      toast({ title: "Nome do ciclo atualizado com sucesso" });
      if (realPatientId) {
        queryClient.setQueryData<Array<{ id: string; custom_name: string | null }>>(
          PATIENT_EXTRA_QUERY_KEYS.evolutionGroups(realPatientId),
          (curr = []) => curr.map((g) => (g.id === editingEvolutionGroup.id ? { ...g, custom_name: trimmed } : g))
        );
      }
      setEditingEvolutionGroup(null);
    }
    setSavingEvolutionGroupName(false);
  };

  return {
    groupDialogOpen, setGroupDialogOpen, editingGroup, groupName, setGroupName, groupComboboxOpen, setGroupComboboxOpen,
    groupColor, setGroupColor, groupColorSlotId, setGroupColorSlotId, groupStatus, setGroupStatus, savingGroup,
    deleteConfirmId, setDeleteConfirmId, openNewGroup, openEditGroup, handleSelectGroupSuggestion,
    handleCreateTypedGroupName, handleSaveGroup, handleSaveClinicColorSlot, handleDeleteGroup,
    editingEvolutionGroup, setEditingEvolutionGroup, savingEvolutionGroupName, handleSaveEvolutionGroupName,
  };
}
