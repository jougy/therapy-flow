import React from "react";
import { AlertCircle, RefreshCw, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ComponentHelpButton } from "@/components/tutorial/ComponentHelpButton";
import { useClinicTeamData } from "./team/hooks/useClinicTeamData";
import { CapacityOverviewCards } from "./team/components/CapacityOverviewCards";
import { CollaboratorInviteCard } from "./team/components/CollaboratorInviteCard";
import { PendingInvitationsList } from "./team/components/PendingInvitationsList";
import { TeamDirectoryTable } from "./team/components/TeamDirectoryTable";
import { RolesManagementModal } from "./team/components/RolesManagementModal";
import { EditMemberDialog } from "./team/components/EditMemberDialog";
import { RevokeMemberDialog } from "./team/components/RevokeMemberDialog";

export const ClinicTeamSection: React.FC = () => {
  const {
    authClinic,
    subscriptionPlan,
    loading,
    fetchError,
    retryLoadTeamData,
    members,
    pendingInvitations,
    activeSessions,
    concurrentAccessCapacity,
    // RBAC Modal
    roleManagementOpen,
    setRoleManagementOpen,
    selectedOperationalRole,
    setSelectedOperationalRole,
    rolePermissionCategory,
    setRolePermissionCategory,
    sortedOperationalRoleDefinitions,
    selectedRoleDefinition,
    editingRoleLabel,
    setEditingRoleLabel,
    savingRoleDefinition,
    roleUsageCounts,
    rolePermissionCategoryCounts,
    visibleRolePermissionItems,
    selectedRoleCapabilities,
    canEditSelectedRole,
    canMoveSelectedRole,
    canDeleteSelectedRole,
    selectedRoleIndex,
    handleToggleRoleCapability,
    handleCreateOperationalRole,
    handleMoveSelectedRole,
    handleDeleteSelectedRole,
    handleSaveSelectedRoleLabel,
    // Permissões
    isAccountOwner,
    canInviteCollaborators,
    inviteDisabledReason,
    canEditCollaborators,
    canDeleteCollaborators,
    canManageRoles,
    // Convites
    sendingInvite,
    lastGeneratedInviteUrl,
    lastGeneratedInviteEmail,
    handleSendInvite,
    handleCopyLink,
    handleGetInviteLinkOnly,
    resendingId,
    cancelingId,
    handleResendInvite,
    handleCancelInvite,
    canManageMember,
    togglingMemberId,
    handleToggleMemberStatus,
    sendingCompletionMemberId,
    handleSendCompletionInvite,
    // Edição
    editingMember,
    setEditingMember,
    editMemberRole,
    setEditMemberRole,
    editMemberJobTitle,
    setEditMemberJobTitle,
    editMemberSpecialty,
    setEditMemberSpecialty,
    editMemberWorkingHours,
    setEditMemberWorkingHours,
    editMemberStatus,
    setEditMemberStatus,
    savingMember,
    handleOpenEditMember,
    handleSaveMember,
    assignableRoleDefinitions,
    // Revogação
    revokingMember,
    setRevokingMember,
    isRevoking,
    handleConfirmRevokeAccess,
  } = useClinicTeamData();

  if (loading) {
    return (
      <div className="space-y-6" data-testid="clinic-team-skeleton">
        {/* Card Principal Skeleton */}
        <Card>
          {/* CardHeader Skeleton */}
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-72 sm:w-96" />
            </div>
            <Skeleton className="h-9 w-44 shrink-0 rounded-md" />
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Banner Skeleton */}
            <Skeleton className="h-16 w-full rounded-lg" />

            {/* 4 Cards de Capacidade Skeleton */}
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>

            {/* Acessos Ativos Skeleton */}
            <Skeleton className="h-24 w-full rounded-xl" />
          </CardContent>
        </Card>

        {/* Card de Convite Skeleton */}
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
          </CardContent>
        </Card>

        {/* Tabela de Colaboradores Skeleton */}
        <Card>
          <CardHeader className="space-y-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-4 w-56" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOneSeatPlan =
    subscriptionPlan === "solo" ||
    subscriptionPlan === "prof_basico" ||
    subscriptionPlan === "prof_medio";

  if (isOneSeatPlan && !canInviteCollaborators) {
    const routeKey = authClinic?.route_key;
    const billingPath = routeKey
      ? `/clinica/${routeKey}/configuracoes/assinatura`
      : "/configuracoes/assinatura";

    return (
      <div className="space-y-6">
        <Card className="border-amber-200/70 bg-gradient-to-br from-amber-50/60 via-background to-amber-50/30 dark:from-amber-950/20 dark:via-background dark:to-amber-950/10 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl">Gestão de Equipe e Colaboradores</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Recurso exclusivo a partir do plano Profissional Top (2 acessos) ou Clínicas.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              Seu espaço está atualmente em um plano <strong>Individual (1 Acesso)</strong>, ideal para atendimento autônomo. 
              Para convidar uma secretária ou assistente (Você + Apoio), ou expandir para equipe com múltiplos acessos simultâneos, conheça os planos de expansão.
            </p>
            <div className="pt-2">
              <Button asChild className="gap-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white hover:from-amber-700 hover:to-amber-600 shadow-sm">
                <a href={billingPath}>
                  <Sparkles className="h-4 w-4" />
                  Conhecer Planos de Expansão
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Erro com botão "Tentar novamente" */}
      {fetchError && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-destructive"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">
              {fetchError || "Não foi possível carregar as informações da equipe da clínica."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void retryLoadTeamData()}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0 gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Bloco Superior Principal: Colaboradores e Acessos & Gerenciar Papéis Operacionais */}
      <Card data-tutorial="settings-team-main-card">
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl">Colaboradores e acessos</CardTitle>
              <ComponentHelpButton helpId="settings-team-block" size="sm" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Gerencie os membros da equipe, convites oficiais e papéis operacionais da clínica.
            </p>
          </div>

          <RolesManagementModal
            open={roleManagementOpen}
            onOpenChange={setRoleManagementOpen}
            trigger={
              <Button type="button" variant="outline" className="gap-2 shrink-0">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Gerenciar papéis operacionais
              </Button>
            }
            operationalRoleDefinitions={sortedOperationalRoleDefinitions}
            selectedOperationalRole={selectedOperationalRole}
            onSelectOperationalRole={setSelectedOperationalRole}
            selectedRoleDefinition={selectedRoleDefinition}
            editingRoleLabel={editingRoleLabel}
            setEditingRoleLabel={setEditingRoleLabel}
            rolePermissionCategory={rolePermissionCategory}
            onSelectPermissionCategory={setRolePermissionCategory}
            savingRoleDefinition={savingRoleDefinition}
            roleUsageCounts={roleUsageCounts}
            categoryCounts={rolePermissionCategoryCounts}
            visibleRolePermissionItems={visibleRolePermissionItems}
            selectedRoleCapabilities={selectedRoleCapabilities}
            canEditSelectedRole={canEditSelectedRole}
            canMoveSelectedRole={canMoveSelectedRole}
            canDeleteSelectedRole={canDeleteSelectedRole}
            selectedRoleIndex={selectedRoleIndex}
            onToggleRoleCapability={handleToggleRoleCapability}
            onCreateOperationalRole={handleCreateOperationalRole}
            onMoveRole={handleMoveSelectedRole}
            onDeleteRole={handleDeleteSelectedRole}
            onSaveSelectedRoleLabel={handleSaveSelectedRoleLabel}
          />
        </CardHeader>

        <CardContent className="space-y-4">
          <CapacityOverviewCards
            membersCount={members.length}
            activeSessions={activeSessions}
            concurrentCapacity={concurrentAccessCapacity}
            isAccountOwner={isAccountOwner}
          />
        </CardContent>
      </Card>

      {/* Formulário de Envio de Convite */}
      <CollaboratorInviteCard
        canInviteCollaborators={canInviteCollaborators}
        inviteDisabledReason={inviteDisabledReason}
        clinicName={authClinic?.name}
        sendingInvite={sendingInvite}
        lastGeneratedInviteUrl={lastGeneratedInviteUrl}
        lastGeneratedInviteEmail={lastGeneratedInviteEmail}
        assignableRoleDefinitions={assignableRoleDefinitions}
        onSendInvite={handleSendInvite}
        onCopyLink={handleCopyLink}
      />

      {/* Convites Pendentes */}
      <PendingInvitationsList
        pendingInvitations={pendingInvitations}
        resendingId={resendingId}
        cancelingId={cancelingId}
        canInviteCollaborators={canInviteCollaborators}
        canDeleteCollaborators={canDeleteCollaborators}
        lastGeneratedInviteUrl={lastGeneratedInviteUrl}
        lastGeneratedInviteEmail={lastGeneratedInviteEmail}
        onResendInvite={handleResendInvite}
        onCancelInvite={handleCancelInvite}
        onCopyLink={handleCopyLink}
        onGetInviteLinkOnly={handleGetInviteLinkOnly}
      />

      {/* Lista de Membros da Equipe */}
      <TeamDirectoryTable
        members={members}
        sortedOperationalRoleDefinitions={sortedOperationalRoleDefinitions}
        togglingMemberId={togglingMemberId}
        canEditCollaborators={canEditCollaborators}
        canDeleteCollaborators={canDeleteCollaborators}
        canManageMember={canManageMember}
        onOpenEditMember={handleOpenEditMember}
        onToggleMemberStatus={handleToggleMemberStatus}
        onOpenRevokeAccess={(member) => setRevokingMember(member)}
        onSendCompletionInvite={handleSendCompletionInvite}
        sendingCompletionMemberId={sendingCompletionMemberId}
      />

      {/* Modal de Edição de Colaborador */}
      <EditMemberDialog
        editingMember={editingMember}
        onClose={() => setEditingMember(null)}
        editMemberRole={editMemberRole}
        setEditMemberRole={setEditMemberRole}
        editMemberJobTitle={editMemberJobTitle}
        setEditMemberJobTitle={setEditMemberJobTitle}
        editMemberSpecialty={editMemberSpecialty}
        setEditMemberSpecialty={setEditMemberSpecialty}
        editMemberWorkingHours={editMemberWorkingHours}
        setEditMemberWorkingHours={setEditMemberWorkingHours}
        editMemberStatus={editMemberStatus}
        setEditMemberStatus={setEditMemberStatus}
        savingMember={savingMember}
        canManageRoles={canManageRoles}
        assignableRoleDefinitions={assignableRoleDefinitions}
        onSaveMember={handleSaveMember}
      />

      {/* Modal de Confirmação de Revogação de Acesso */}
      <RevokeMemberDialog
        revokingMember={revokingMember}
        onClose={() => setRevokingMember(null)}
        isRevoking={isRevoking}
        onConfirmRevoke={handleConfirmRevokeAccess}
      />
    </div>
  );
};

