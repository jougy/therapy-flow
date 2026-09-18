import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  calculateNextSundayCountdown,
  type TrashEntityType,
  type TrashItem,
} from "@/lib/trashUtils";

export const useClinicTrash = () => {
  const { clinicId, can } = useAuth();
  const canManageTrash = can("clinic_trash.manage");

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<TrashItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TrashEntityType>("sessions");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [restoringIds, setRestoringIds] = useState<string[]>([]);
  const [isBulkRestoring, setIsBulkRestoring] = useState(false);

  // Contagem regressiva até domingo
  const countdown = useMemo(() => calculateNextSundayCountdown(), []);

  // Carregar itens da lixeira via RPC get_clinic_trash_items
  const loadTrash = useCallback(async () => {
    if (!clinicId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_clinic_trash_items", {
        _clinic_id: clinicId,
        _entity_type: "all",
      });

      if (error) throw error;

      if (Array.isArray(data)) {
        setItems(data as unknown as TrashItem[]);
      } else {
        setItems([]);
      }
    } catch (err) {
      toast({
        title: "Erro ao carregar lixeira",
        description: err instanceof Error ? err.message : "Não foi possível carregar os itens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => {
    void loadTrash();
  }, [loadTrash]);

  // Limpa seleções ao trocar de aba
  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab]);

  // Filtragem dos itens por aba e termo de busca
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (item.entity_type !== activeTab) return false;
      if (!query) return true;
      const titleMatch = item.title?.toLowerCase().includes(query);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(query);
      const userMatch = item.deleted_by_name?.toLowerCase().includes(query);
      return titleMatch || subtitleMatch || userMatch;
    });
  }, [items, activeTab, searchQuery]);

  // Contadores por aba calculados em um único passe O(N)
  const { sessionCount, patientCount, formCount } = useMemo(() => {
    let sessions = 0;
    let patients = 0;
    let forms = 0;
    for (let i = 0; i < items.length; i++) {
      const type = items[i].entity_type;
      if (type === "sessions") sessions++;
      else if (type === "patients") patients++;
      else if (type === "forms") forms++;
    }
    return { sessionCount: sessions, patientCount: patients, formCount: forms };
  }, [items]);

  // Sets memoizados para buscas O(1) de seleção e restauração em lote
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const restoringSet = useMemo(() => new Set(restoringIds), [restoringIds]);

  // Paginação client-side para evitar gargalo de renderização DOM com centenas de itens
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 25;

  // Reset de página ao trocar de aba ou termo de busca
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safeCurrentPage - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, safeCurrentPage]);

  // Seleção múltipla com verificação O(1) por item através de selectedSet
  const isAllSelected = filteredItems.length > 0 && filteredItems.every((item) => selectedSet.has(item.id));
  const isSomeSelected = !isAllSelected && filteredItems.some((item) => selectedSet.has(item.id));

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((item) => item.id));
    }
  }, [isAllSelected, filteredItems]);

  const handleToggleSelectOne = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  // Restaurar um item individual
  const handleRestoreSingle = useCallback(async (item: TrashItem) => {
    if (!canManageTrash) {
      toast({
        title: "Permissão insuficiente",
        description: "Apenas administradores e proprietários podem restaurar itens da lixeira.",
        variant: "destructive",
      });
      return;
    }

    setRestoringIds((prev) => [...prev, item.id]);
    try {
      const { error } = await supabase.rpc("restore_entity_from_trash", {
        _entity_type: item.entity_type,
        _entity_ids: [item.id],
      });

      if (error) throw error;

      toast({
        title: "Item restaurado com sucesso",
        description: `"${item.title}" voltou para a lista ativa da clínica.`,
      });

      // Atualiza estado local otimista
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
    } catch (err) {
      toast({
        title: "Erro ao restaurar item",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setRestoringIds((prev) => prev.filter((id) => id !== item.id));
    }
  }, [canManageTrash]);

  // Restaurar em lote
  const handleRestoreBulk = useCallback(async () => {
    if (selectedIds.length === 0 || !canManageTrash) return;

    setIsBulkRestoring(true);
    try {
      const { error } = await supabase.rpc("restore_entity_from_trash", {
        _entity_type: activeTab,
        _entity_ids: selectedIds,
      });

      if (error) throw error;

      toast({
        title: "Itens restaurados com sucesso",
        description: `${selectedIds.length} item(ns) voltaram para a clínica.`,
      });

      // Remove da lista
      const restoredSet = new Set(selectedIds);
      setItems((prev) => prev.filter((i) => !restoredSet.has(i.id)));
      setSelectedIds([]);
    } catch (err) {
      toast({
        title: "Erro ao restaurar itens selecionados",
        description: err instanceof Error ? err.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsBulkRestoring(false);
    }
  }, [activeTab, canManageTrash, selectedIds]);

  return {
    activeTab,
    canManageTrash,
    countdown,
    filteredItems,
    formCount,
    handleRestoreBulk,
    handleRestoreSingle,
    handleToggleSelectAll,
    handleToggleSelectOne,
    isAllSelected,
    isBulkRestoring,
    isSomeSelected,
    items,
    loading,
    loadTrash,
    patientCount,
    restoringIds,
    searchQuery,
    currentPage: safeCurrentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    pageSize: PAGE_SIZE,
    selectedSet,
    restoringSet,
    selectedIds,
    sessionCount,
    setActiveTab,
    setSearchQuery,
  };
};
