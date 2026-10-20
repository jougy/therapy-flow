import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { RolePermissionSwitch } from "./RolePermissionSwitch";
import { cn } from "@/lib/utils";
import type { AccessCapability } from "@/lib/rbac";
import {
  ROLE_PERMISSION_CATEGORIES,
  type ClinicOperationalRoleDefinition,
  type RolePermissionAction,
  type RolePermissionCategoryId,
  type RolePermissionItem,
} from "../types";

export interface RolesManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;

  // Definitions & Selection
  operationalRoleDefinitions?: ClinicOperationalRoleDefinition[];
  sortedOperationalRoleDefinitions?: ClinicOperationalRoleDefinition[];
  selectedOperationalRole: string;
  onSelectOperationalRole?: (roleKey: string) => void;
  setSelectedOperationalRole?: (roleKey: string) => void;
  selectedRoleDefinition?: ClinicOperationalRoleDefinition;

  // Label editing (supports controlled or dirty-check uncontrolled)
  editingRoleLabel?: string;
  setEditingRoleLabel?: (label: string) => void;
  onSaveRoleLabel?: (newLabel: string) => Promise<void> | void;
  onSaveSelectedRoleLabel?: () => Promise<void> | void;

  // Role usage counts
  roleUsageCounts: Record<string, number>;

  // Category filter
  rolePermissionCategory: RolePermissionCategoryId;
  onSelectPermissionCategory?: (category: RolePermissionCategoryId) => void;
  setRolePermissionCategory?: (category: RolePermissionCategoryId) => void;
  categories?: Array<{ id: RolePermissionCategoryId; label: string }>;
  categoryCounts?: Record<RolePermissionCategoryId, number>;
  rolePermissionCategoryCounts?: Record<RolePermissionCategoryId, number>;

  // Permission items & capabilities
  visibleRolePermissionItems: RolePermissionItem[];
  selectedRoleCapabilities: Record<AccessCapability, boolean>;
  onToggleRoleCapability: (capability: AccessCapability, nextChecked: boolean) => Promise<void> | void;

  // Permissions & States
  canEditSelectedRole: boolean;
  canMoveSelectedRole: boolean;
  canDeleteSelectedRole: boolean;
  hasRolesManagePermission?: boolean;
  savingRoleDefinition: boolean;
  selectedRoleIndex: number;

  // Actions
  onCreateOperationalRole: () => Promise<void> | void;
  onMoveRole?: (direction: "up" | "down") => Promise<void> | void;
  onMoveSelectedRole?: (direction: "up" | "down") => Promise<void> | void;
  onDeleteRole?: () => Promise<void> | void;
  onDeleteSelectedRole?: () => Promise<void> | void;
}

import { PermissionHelpButton, PermissionItemCard } from "./PermissionItemCard";
export { PermissionHelpButton, PermissionItemCard };

export const RolesManagementModal: React.FC<RolesManagementModalProps> = ({
  open,
  onOpenChange,
  trigger,
  operationalRoleDefinitions,
  sortedOperationalRoleDefinitions,
  selectedOperationalRole,
  onSelectOperationalRole,
  setSelectedOperationalRole,
  selectedRoleDefinition: passedSelectedRoleDefinition,
  editingRoleLabel,
  setEditingRoleLabel,
  onSaveRoleLabel,
  onSaveSelectedRoleLabel,
  roleUsageCounts,
  rolePermissionCategory,
  onSelectPermissionCategory,
  setRolePermissionCategory,
  categories,
  categoryCounts,
  rolePermissionCategoryCounts,
  visibleRolePermissionItems,
  selectedRoleCapabilities,
  onToggleRoleCapability,
  canEditSelectedRole,
  canMoveSelectedRole,
  canDeleteSelectedRole,
  hasRolesManagePermission,
  savingRoleDefinition,
  selectedRoleIndex,
  onCreateOperationalRole,
  onMoveRole,
  onMoveSelectedRole,
  onDeleteRole,
  onDeleteSelectedRole,
}) => {
  const roleDefs = operationalRoleDefinitions || sortedOperationalRoleDefinitions || [];
  const onSelectRole = onSelectOperationalRole || setSelectedOperationalRole;
  const onMove = onMoveRole || onMoveSelectedRole;
  const onDelete = onDeleteRole || onDeleteSelectedRole;
  const onCategoryChange = onSelectPermissionCategory || setRolePermissionCategory;
  const activeCategories = categories || ROLE_PERMISSION_CATEGORIES;
  const activeCategoryCounts = categoryCounts || rolePermissionCategoryCounts || ({} as Record<RolePermissionCategoryId, number>);
  const canManage = hasRolesManagePermission ?? canEditSelectedRole;

  const activeSelectedRole = useMemo(() => {
    if (passedSelectedRoleDefinition) return passedSelectedRoleDefinition;
    return (
      roleDefs.find((role) => role.role_key === selectedOperationalRole) ||
      roleDefs[0]
    );
  }, [passedSelectedRoleDefinition, roleDefs, selectedOperationalRole]);

  // Índice real e canMoveUp / canMoveDown
  const currentRoleIndex = useMemo(() => {
    if (typeof selectedRoleIndex === "number" && selectedRoleIndex >= 0) {
      return selectedRoleIndex;
    }
    return roleDefs.findIndex((r) => r.role_key === activeSelectedRole?.role_key);
  }, [selectedRoleIndex, roleDefs, activeSelectedRole?.role_key]);

  const canMoveUp =
    canMoveSelectedRole &&
    !savingRoleDefinition &&
    currentRoleIndex > 1;

  const canMoveDown =
    canMoveSelectedRole &&
    !savingRoleDefinition &&
    currentRoleIndex >= 1 &&
    currentRoleIndex < roleDefs.length - 1;

  // Suporte a estado controlado ou local com dirty checking
  const isLabelControlled = typeof editingRoleLabel === "string" && typeof setEditingRoleLabel === "function";
  const [localLabel, setLocalLabel] = useState(activeSelectedRole?.label || "");

  useEffect(() => {
    if (!isLabelControlled && activeSelectedRole) {
      setLocalLabel(activeSelectedRole.label);
    }
  }, [isLabelControlled, activeSelectedRole?.role_key, activeSelectedRole?.label]);

  const currentLabel = isLabelControlled ? editingRoleLabel : localLabel;

  const handleLabelChange = (val: string) => {
    if (isLabelControlled) {
      setEditingRoleLabel?.(val);
    } else {
      setLocalLabel(val);
    }
  };

  const handleBlurLabel = () => {
    const trimmed = currentLabel.trim();
    if (!activeSelectedRole) return;

    if (onSaveRoleLabel) {
      if (trimmed && trimmed !== activeSelectedRole.label) {
        void onSaveRoleLabel(trimmed);
      } else if (!trimmed) {
        if (isLabelControlled) {
          setEditingRoleLabel?.(activeSelectedRole.label);
        } else {
          setLocalLabel(activeSelectedRole.label);
        }
      }
    } else if (onSaveSelectedRoleLabel) {
      void onSaveSelectedRoleLabel();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] w-[calc(100vw-2rem)] p-0 sm:max-w-5xl flex flex-col overflow-hidden rounded-2xl">
        <DialogHeader className="border-b px-6 py-4 flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2 pr-6">
            <DialogTitle className="text-lg font-bold">Gerenciar papéis operacionais</DialogTitle>
            <ComponentHelpButton helpId="settings-team-roles-modal-block" size="sm" />
          </div>
          <DialogDescription className="sr-only">
            Painel para configurar papéis operacionais e permissões da equipe da clínica.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Hierarquias na Lateral do Modal (Fixa à esquerda em desktop; oculta em mobile em favor do Select no topo) */}
          <aside className="hidden md:flex md:w-72 border-r bg-muted/20 p-4 shrink-0 flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between gap-2 shrink-0">
              <p className="text-sm font-semibold text-foreground">Hierarquias</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => void onCreateOperationalRole()}
                disabled={savingRoleDefinition || !canManage}
              >
                <Plus className="h-3.5 w-3.5" />
                Novo papel
              </Button>
            </div>
            <div className="space-y-1.5 overflow-y-auto pr-1 flex-1">
              {roleDefs.map((role) => {
                const isSelected = selectedOperationalRole === role.role_key;
                const isOwnerRole = role.role_key === "owner";
                const count = roleUsageCounts[role.role_key] ?? 0;

                return (
                  <button
                    key={role.role_key}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition-all",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                        : "bg-background hover:bg-muted/60 text-foreground"
                    )}
                    onClick={() => onSelectRole?.(role.role_key)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{role.label}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground font-normal">
                        {count} pessoa{count === 1 ? "" : "s"}
                      </span>
                    </span>
                    {isOwnerRole ? (
                      <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Conteúdo de Permissões do Papel Selecionado (Scrollável à direita) */}
          <section className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background p-3 sm:p-5">
            {/* Topo Compacto: Mobile (3 linhas finas) / Desktop (layout espaçado) */}
            <div className="mb-2 shrink-0 space-y-2">
              {/* Linha 1 Mobile: Dropdown do Papel + Ações (Subir, Descer, Excluir, Novo) */}
              <div className="flex md:hidden items-center justify-between gap-1.5">
                <span className="sr-only">Selecionar Papel:</span>
                <div className="flex-1 min-w-0">
                  <Select
                    value={selectedOperationalRole}
                    onValueChange={(val) => onSelectRole?.(val)}
                  >
                    <SelectTrigger className="w-full h-8 text-xs bg-muted/30 font-medium" aria-label="Selecionar Papel:">
                      <SelectValue placeholder="Escolha um papel..." />
                    </SelectTrigger>
                    <SelectContent>
                      {roleDefs.map((role) => {
                        const count = roleUsageCounts[role.role_key] ?? 0;
                        return (
                          <SelectItem key={role.role_key} value={role.role_key} className="text-xs">
                            {role.label} ({count} pessoa{count === 1 ? "" : "s"})
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={!canMoveUp}
                    onClick={() => void onMove?.("up")}
                    aria-label="Subir papel na hierarquia"
                    title={currentRoleIndex <= 1 ? "Papel já está no topo dos cargos configuráveis (abaixo do Proprietário)" : "Subir na hierarquia"}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={!canMoveDown}
                    onClick={() => void onMove?.("down")}
                    aria-label="Descer papel na hierarquia"
                    title={currentRoleIndex >= roleDefs.length - 1 ? "Papel já está na base da hierarquia" : "Descer na hierarquia"}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={!canDeleteSelectedRole || savingRoleDefinition}
                    onClick={() => void onDelete?.()}
                    aria-label="Excluir papel"
                    title="Excluir papel"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="default"
                    className="h-8 w-8 shrink-0"
                    onClick={() => void onCreateOperationalRole()}
                    disabled={savingRoleDefinition || !canManage}
                    title="Criar novo papel"
                    aria-label="Criar novo papel"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Linha 2 Mobile / Topo Desktop: Edição de Nome do Papel e Status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Input
                    className="h-8 max-w-xs text-xs sm:text-sm font-semibold"
                    value={currentLabel}
                    maxLength={40}
                    disabled={!canEditSelectedRole || savingRoleDefinition}
                    onChange={(e) => handleLabelChange(e.target.value)}
                    onBlur={handleBlurLabel}
                    placeholder="Nome do papel"
                  />
                  {/* Controles de movimentação/exclusão em Desktop (ocultos em mobile onde estão na Linha 1) */}
                  <div className="hidden md:flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={!canMoveUp}
                      onClick={() => void onMove?.("up")}
                      aria-label="Subir papel na hierarquia"
                      title={currentRoleIndex <= 1 ? "Papel já está no topo dos cargos configuráveis (abaixo do Proprietário)" : "Subir na hierarquia"}
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8"
                      disabled={!canMoveDown}
                      onClick={() => void onMove?.("down")}
                      aria-label="Descer papel na hierarquia"
                      title={currentRoleIndex >= roleDefs.length - 1 ? "Papel já está na base da hierarquia" : "Descer na hierarquia"}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={!canDeleteSelectedRole || savingRoleDefinition}
                      onClick={() => void onDelete?.()}
                      aria-label="Excluir papel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!canEditSelectedRole ? (
                    <Badge variant="outline" className="text-[11px] h-6 px-2 text-amber-600 border-amber-300">
                      Somente leitura
                    </Badge>
                  ) : activeSelectedRole?.role_key === "owner" ? (
                    <Badge variant="secondary" className="text-[11px] h-6 px-2">
                      Topo (Owner)
                    </Badge>
                  ) : null}

                  {/* Informação/Descrição do papel como Popover compacto em mobile, texto expandido em desktop */}
                  <div className="md:hidden">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                          <CircleHelp className="h-4 w-4" />
                          <span className="sr-only">Descrição do papel</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 text-xs p-3" align="end">
                        <p className="font-medium text-foreground mb-1">{activeSelectedRole?.label}</p>
                        <p className="text-muted-foreground leading-relaxed">
                          {!canEditSelectedRole
                            ? "Seu nível de acesso atual não permite alterar este papel (somente papéis em hierarquia inferior podem ser editados)."
                            : activeSelectedRole?.role_key === "owner"
                            ? "Conta principal da clínica. Gestão irrestrita de permissões e diretrizes operacionais."
                            : activeSelectedRole?.description ||
                              "Acompanha a equipe, ajusta acessos e gerencia configurações operacionais da clínica."}
                        </p>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              {/* Descrição em Desktop */}
              <p className="hidden md:block text-xs text-muted-foreground max-w-2xl">
                {!canEditSelectedRole
                  ? "Seu nível de acesso atual não permite alterar este papel (somente papéis em hierarquia inferior podem ser editados)."
                  : activeSelectedRole?.role_key === "owner"
                  ? "Conta principal da clínica. Gestão irrestrita de permissões e diretrizes operacionais."
                  : activeSelectedRole?.description ||
                    "Acompanha a equipe, ajusta acessos e gerencia configurações operacionais da clínica."}
              </p>

              {/* Linha 3 Mobile / Barra Desktop: Filtro de Categorias com Scroll Horizontal Suave */}
              <div className="w-full max-w-full min-w-0 overflow-x-auto touch-pan-x no-scrollbar py-0.5">
                <div className="flex items-center gap-1.5 w-max">
                  {activeCategories.map((category) => {
                    const isActive = rolePermissionCategory === category.id;
                    const count = activeCategoryCounts[category.id] ?? 0;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => onCategoryChange?.(category.id)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs whitespace-nowrap transition-all shrink-0",
                          isActive
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                            : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        {category.label}
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                            isActive
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted-foreground/20 text-muted-foreground"
                          )}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Cabeçalho da Tabela */}
            <div className="hidden sm:grid grid-cols-[minmax(0,1fr),auto] gap-3 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground shrink-0 border-b pb-2">
              <span>Função</span>
              <span className="text-right pr-2">Ações e Permissões</span>
            </div>

            {/* Lista de Permissões com Rolagem Independente */}
            <div className="space-y-2 overflow-y-auto flex-1 pr-1 pb-4">
              {visibleRolePermissionItems.map((item) => (
                <PermissionItemCard
                  key={item.key}
                  item={item}
                  capabilities={selectedRoleCapabilities}
                  canEdit={canEditSelectedRole}
                  onToggleRoleCapability={onToggleRoleCapability}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Rodapé Fixo */}
        <DialogFooter className="px-6 py-3 border-t bg-card shrink-0 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Concluir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
