import React, { useDeferredValue, useMemo, useState } from "react";
import {
  Loader2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Search,
  ShieldCheck,
  UserMinus,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { normalizeTeamSearch } from "@/lib/subaccounts";
import {
  OPERATIONAL_ROLE_LABELS,
  parseSpecialties,
  type ActiveMember,
  type ClinicOperationalRoleDefinition,
} from "../types";

export interface TeamDirectoryTableProps {
  members: ActiveMember[];
  sortedOperationalRoleDefinitions: ClinicOperationalRoleDefinition[];
  searchTerm?: string;
  setSearchTerm?: (term: string) => void;
  roleFilter?: string;
  setRoleFilter?: (role: string) => void;
  statusFilter?: "all" | "active" | "suspended" | "inactive";
  setStatusFilter?: (status: "all" | "active" | "suspended" | "inactive") => void;
  togglingMemberId: string | null;
  canEditCollaborators: boolean;
  canDeleteCollaborators: boolean;
  canManageMember: (member: ActiveMember) => boolean;
  onOpenEditMember: (member: ActiveMember) => void;
  onToggleMemberStatus: (member: ActiveMember, nextStatus: "active" | "suspended") => Promise<void>;
  onOpenRevokeAccess: (member: ActiveMember) => void;
}

export const TeamDirectoryTable: React.FC<TeamDirectoryTableProps> = ({
  members,
  sortedOperationalRoleDefinitions,
  searchTerm: controlledSearchTerm,
  setSearchTerm: controlledSetSearchTerm,
  roleFilter: controlledRoleFilter,
  setRoleFilter: controlledSetRoleFilter,
  statusFilter: controlledStatusFilter,
  setStatusFilter: controlledSetStatusFilter,
  togglingMemberId,
  canEditCollaborators,
  canDeleteCollaborators,
  canManageMember,
  onOpenEditMember,
  onToggleMemberStatus,
  onOpenRevokeAccess,
}) => {
  const [internalSearchTerm, setInternalSearchTerm] = useState("");
  const [internalRoleFilter, setInternalRoleFilter] = useState("all");
  const [internalStatusFilter, setInternalStatusFilter] = useState<"all" | "active" | "suspended" | "inactive">("all");

  const searchTerm = controlledSearchTerm !== undefined ? controlledSearchTerm : internalSearchTerm;
  const setSearchTerm = controlledSetSearchTerm || setInternalSearchTerm;
  const roleFilter = controlledRoleFilter !== undefined ? controlledRoleFilter : internalRoleFilter;
  const setRoleFilter = controlledSetRoleFilter || setInternalRoleFilter;
  const statusFilter = controlledStatusFilter !== undefined ? controlledStatusFilter : internalStatusFilter;
  const setStatusFilter = controlledSetStatusFilter || setInternalStatusFilter;

  // Otimização de busca: useDeferredValue para manter a digitação fluida sem travamento da interface
  const deferredSearch = useDeferredValue(searchTerm);
  const normalizedSearch = useMemo(() => normalizeTeamSearch(deferredSearch), [deferredSearch]);

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (normalizedSearch) {
        const matchesName = normalizeTeamSearch(m.full_name).includes(normalizedSearch);
        const matchesEmail = normalizeTeamSearch(m.email).includes(normalizedSearch);
        const matchesJob = m.job_title ? normalizeTeamSearch(m.job_title).includes(normalizedSearch) : false;
        const matchesSpecialty = m.specialty ? normalizeTeamSearch(m.specialty).includes(normalizedSearch) : false;

        if (!matchesName && !matchesEmail && !matchesJob && !matchesSpecialty) {
          return false;
        }
      }

      if (roleFilter !== "all" && m.operational_role !== roleFilter) {
        return false;
      }

      if (statusFilter !== "all" && m.membership_status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [members, normalizedSearch, roleFilter, statusFilter]);

  return (
    <Card data-tutorial="settings-team-directory-box">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Equipe da Clínica</CardTitle>
              <ComponentHelpButton helpId="settings-team-directory-block" size="sm" />
            </div>
            <CardDescription className="text-xs">
              Colaboradores vinculados à clínica ({members.length} membros).
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs w-48 sm:w-64"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 text-xs w-36">
                <SelectValue placeholder="Todos os papéis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os papéis</SelectItem>
                {sortedOperationalRoleDefinitions.map((role) => (
                  <SelectItem key={role.role_key} value={role.role_key}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as "all" | "active" | "suspended" | "inactive")}
            >
              <SelectTrigger className="h-9 text-xs w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="suspended">Suspensos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {filteredMembers.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nenhum colaborador encontrado com os filtros selecionados.
          </div>
        ) : (
          <div className="divide-y rounded-xl border">
            {filteredMembers.map((member) => {
              const isOwner = member.operational_role === "owner";
              const roleDef = sortedOperationalRoleDefinitions.find(
                (r) => r.role_key === member.operational_role
              );
              const roleLabel =
                roleDef?.label || OPERATIONAL_ROLE_LABELS[member.operational_role] || member.operational_role;
              const canManage = canManageMember(member);
              const isToggling = togglingMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                      {member.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm truncate">{member.full_name}</p>
                        {isOwner ? (
                          <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 border-amber-200 text-[10px] dark:bg-amber-950 dark:text-amber-200">
                            Proprietário
                          </Badge>
                        ) : member.membership_status === "active" ? (
                          <Badge
                            variant="outline"
                            className="text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 text-[10px]"
                          >
                            Ativo
                          </Badge>
                        ) : member.membership_status === "suspended" ? (
                          <Badge
                            variant="outline"
                            className="text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 text-[10px]"
                          >
                            Suspenso
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-slate-600 bg-slate-100 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700 text-[10px]"
                          >
                            Inativo
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                        <span>{member.email}</span>
                        {member.job_title && <span>· {member.job_title}</span>}
                        {parseSpecialties(member.specialty).map((spec, sIdx) => (
                          <Badge
                            key={`${spec}-${sIdx}`}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 font-normal bg-primary/10 text-primary border border-primary/20"
                          >
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto">
                    <div className="flex flex-col sm:items-end gap-0.5">
                      <Badge variant="outline" className="text-xs font-medium w-fit">
                        {roleLabel}
                      </Badge>
                      {member.last_seen_at && (
                        <span className="text-[11px] text-muted-foreground">
                          Último acesso: {new Date(member.last_seen_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>

                    {/* Menu de Ações do Colaborador */}
                    {isOwner ? (
                      <div className="w-8 flex justify-center">
                        <ShieldCheck className="h-4 w-4 text-primary" title="Conta Proprietária" />
                      </div>
                    ) : canManage ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Opções para ${member.full_name}`}
                            disabled={isToggling}
                          >
                            {isToggling ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel className="text-xs font-semibold">
                            Gerenciar Colaborador
                          </DropdownMenuLabel>
                          {canEditCollaborators && (
                            <DropdownMenuItem
                              onClick={() => onOpenEditMember(member)}
                              className="cursor-pointer"
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar dados e cargo
                            </DropdownMenuItem>
                          )}

                          {canEditCollaborators &&
                            (member.membership_status === "active" ? (
                              <DropdownMenuItem
                                onClick={() => void onToggleMemberStatus(member, "suspended")}
                                className="cursor-pointer text-amber-600 focus:text-amber-700"
                              >
                                <Pause className="h-4 w-4 mr-2" />
                                Pausar acesso
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => void onToggleMemberStatus(member, "active")}
                                className="cursor-pointer text-emerald-600 focus:text-emerald-700"
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Reativar acesso
                              </DropdownMenuItem>
                            ))}

                          {canDeleteCollaborators && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onOpenRevokeAccess(member)}
                                className="cursor-pointer text-destructive focus:text-destructive"
                              >
                                <UserMinus className="h-4 w-4 mr-2" />
                                Revogar acesso
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        Somente leitura
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
