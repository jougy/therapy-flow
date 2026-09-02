import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { RolePermissionSwitch } from "./RolePermissionSwitch";
import { RolesManagementModal } from "./RolesManagementModal";
import { OperationalRolesModal } from "./OperationalRolesModal";
import { TeamDirectoryTable } from "./TeamDirectoryTable";
import { EditMemberModal } from "./EditMemberModal";
import { RevokeAccessModal } from "./RevokeAccessModal";
import type { ClinicOperationalRoleDefinition, ActiveMember, RolePermissionItem } from "../types";

vi.mock("@/components/tutorial/ComponentHelpButton", () => ({
  ComponentHelpButton: () => null,
}));

describe("Team Subcomponents", () => {
  describe("RolePermissionSwitch", () => {
    it("renders with a11y label combining itemTitle and displayLabel", () => {
      const onToggle = vi.fn();
      render(
        <RolePermissionSwitch
          checked={false}
          kind="view"
          itemTitle="Pacientes"
          label="Ver"
          onToggle={onToggle}
        />
      );

      const switchBtn = screen.getByRole("switch", { name: "Pacientes: Ver" });
      expect(switchBtn).toBeInTheDocument();
      expect(switchBtn).toHaveAttribute("aria-checked", "false");

      fireEvent.click(switchBtn);
      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it("renders default displayLabel and handles disabled state", () => {
      const onToggle = vi.fn();
      render(
        <RolePermissionSwitch
          checked={true}
          disabled={true}
          kind="delete"
          itemTitle="Atendimentos"
          onToggle={onToggle}
        />
      );

      const switchBtn = screen.getByRole("switch", { name: "Atendimentos: Excluir" });
      expect(switchBtn).toBeDisabled();
      expect(switchBtn).toHaveAttribute("aria-checked", "true");

      fireEvent.click(switchBtn);
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  describe("RolesManagementModal", () => {
    const mockRoles: ClinicOperationalRoleDefinition[] = [
      {
        base_operational_role: "owner",
        clinic_id: "clinic-1",
        description: "Conta principal",
        is_system: true,
        label: "Proprietário(a)",
        role_key: "owner",
        sort_order: 0,
      },
      {
        base_operational_role: "admin",
        clinic_id: "clinic-1",
        description: "Administrador da clínica",
        is_system: true,
        label: "Administrador(a)",
        role_key: "admin",
        sort_order: 10,
      },
    ];

    const mockItems: RolePermissionItem[] = [
      {
        category: "clinical",
        description: "Fichas e pacientes",
        details: "Acesso detalhado",
        key: "patients",
        title: "Pacientes",
        actions: [
          { kind: "view", capability: "patients.read", label: "Ver" },
        ],
      },
    ];

    it("renders hierarchy sidebar and executes dirty check on role label rename", () => {
      const onSaveRoleLabel = vi.fn();
      const onSelectOperationalRole = vi.fn();

      render(
        <RolesManagementModal
          open={true}
          onOpenChange={vi.fn()}
          operationalRoleDefinitions={mockRoles}
          selectedOperationalRole="admin"
          onSelectOperationalRole={onSelectOperationalRole}
          roleUsageCounts={{ owner: 1, admin: 2 }}
          rolePermissionCategory="all"
          onSelectPermissionCategory={vi.fn()}
          categories={[{ id: "all", label: "Todas" }]}
          categoryCounts={{ all: 1, clinical: 1, agenda: 0, team: 0, admin: 0, finance: 0 }}
          visibleRolePermissionItems={mockItems}
          selectedRoleCapabilities={{ "patients.read": true } as any}
          onToggleRoleCapability={vi.fn()}
          canEditSelectedRole={true}
          canMoveSelectedRole={true}
          canDeleteSelectedRole={false}
          hasRolesManagePermission={true}
          savingRoleDefinition={false}
          selectedRoleIndex={1}
          onCreateOperationalRole={vi.fn()}
          onSaveRoleLabel={onSaveRoleLabel}
          onMoveRole={vi.fn()}
          onDeleteRole={vi.fn()}
        />
      );

      expect(screen.getByText("Hierarquias")).toBeInTheDocument();
      expect(screen.getByText("Administrador(a)")).toBeInTheDocument();
      expect(screen.getByText("2 pessoas")).toBeInTheDocument();

      const input = screen.getByDisplayValue("Administrador(a)");
      // Blur without change -> should NOT call onSaveRoleLabel
      fireEvent.blur(input);
      expect(onSaveRoleLabel).not.toHaveBeenCalled();

      // Change and blur -> should call onSaveRoleLabel
      fireEvent.change(input, { target: { value: "Gestor Geral" } });
      fireEvent.blur(input);
      expect(onSaveRoleLabel).toHaveBeenCalledWith("Gestor Geral");
    });
  });

  describe("EditMemberModal", () => {
    const mockMember: ActiveMember = {
      id: "mem-1",
      user_id: "user-1",
      operational_role: "professional",
      membership_status: "active",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      full_name: "Dr. Roberto Silva",
      email: "roberto@example.com",
      job_title: "Fisioterapeuta",
      specialty: "Ortopedia; Fisiatria",
      working_hours: "08h - 17h",
    };

    it("renders member fields and preview tags", () => {
      const onSpecialtyChange = vi.fn();
      render(
        <EditMemberModal
          member={mockMember}
          onClose={vi.fn()}
          assignableRoleDefinitions={[]}
          role="professional"
          onRoleChange={vi.fn()}
          jobTitle="Fisioterapeuta"
          onJobTitleChange={vi.fn()}
          specialty="Ortopedia; Fisiatria"
          onSpecialtyChange={onSpecialtyChange}
          workingHours="08h - 17h"
          onWorkingHoursChange={vi.fn()}
          status="active"
          onStatusChange={vi.fn()}
          canManageRoles={true}
          saving={false}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByText("Dr. Roberto Silva")).toBeInTheDocument();
      expect(screen.getByText("roberto@example.com")).toBeInTheDocument();
      expect(screen.getByText("Ortopedia")).toBeInTheDocument();
      expect(screen.getByText("Fisiatria")).toBeInTheDocument();
    });
  });

  describe("RevokeAccessModal", () => {
    const mockMember: ActiveMember = {
      id: "mem-1",
      user_id: "user-1",
      operational_role: "professional",
      membership_status: "active",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      full_name: "Dr. Roberto Silva",
      email: "roberto@example.com",
    };

    it("renders warning and calls onConfirm on confirmation click", () => {
      const onConfirm = vi.fn();
      render(
        <RevokeAccessModal
          member={mockMember}
          onClose={vi.fn()}
          isRevoking={false}
          onConfirm={onConfirm}
        />
      );

      expect(screen.getByText(/Revogar Acesso à Clínica/i)).toBeInTheDocument();
      expect(screen.getByText(/Roberto Silva/i)).toBeInTheDocument();

      const revokeBtn = screen.getByRole("button", { name: /^revogar acesso$/i });
      fireEvent.click(revokeBtn);
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe("OperationalRolesModal", () => {
    const mockRoles: ClinicOperationalRoleDefinition[] = [
      {
        base_operational_role: "owner",
        clinic_id: "clinic-1",
        description: "Conta principal",
        is_system: true,
        label: "Proprietário(a)",
        role_key: "owner",
        sort_order: 0,
      },
      {
        base_operational_role: "admin",
        clinic_id: "clinic-1",
        description: "Administrador da clínica",
        is_system: true,
        label: "Administrador(a)",
        role_key: "admin",
        sort_order: 10,
      },
    ];

    it("renders mobile role selector and allows changing operational role", () => {
      const setSelectedOperationalRole = vi.fn();
      render(
        <OperationalRolesModal
          open={true}
          onOpenChange={vi.fn()}
          sortedOperationalRoleDefinitions={mockRoles}
          selectedOperationalRole="admin"
          setSelectedOperationalRole={setSelectedOperationalRole}
          selectedRoleDefinition={mockRoles[1]}
          editingRoleLabel="Administrador(a)"
          setEditingRoleLabel={vi.fn()}
          rolePermissionCategory="all"
          setRolePermissionCategory={vi.fn()}
          savingRoleDefinition={false}
          roleUsageCounts={{ owner: 1, admin: 2 }}
          rolePermissionCategoryCounts={{ all: 0, clinical: 0, agenda: 0, team: 0, admin: 0, finance: 0 }}
          visibleRolePermissionItems={[]}
          selectedRoleCapabilities={{} as any}
          canEditSelectedRole={true}
          canMoveSelectedRole={true}
          canDeleteSelectedRole={false}
          selectedRoleIndex={1}
          onToggleRoleCapability={vi.fn()}
          onCreateOperationalRole={vi.fn()}
          onMoveSelectedRole={vi.fn()}
          onDeleteSelectedRole={vi.fn()}
          onSaveSelectedRoleLabel={vi.fn()}
        />
      );

      // Verify the mobile select label and trigger
      expect(screen.getByText("Selecionar Papel:")).toBeInTheDocument();
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  describe("TeamDirectoryTable", () => {
    const mockMembers: ActiveMember[] = [
      {
        id: "mem-1",
        user_id: "user-1",
        operational_role: "admin",
        membership_status: "active",
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
        full_name: "Arthur Mendes Carvalho",
        email: "arthur@example.com",
      },
      {
        id: "mem-2",
        user_id: "user-2",
        operational_role: "professional",
        membership_status: "active",
        is_active: true,
        created_at: "2026-01-02T00:00:00Z",
        full_name: "Beatriz Santos",
        email: "beatriz@example.com",
      },
    ];

    it("filters members reactively based on searchTerm with accent insensitivity", () => {
      const { rerender } = render(
        <TeamDirectoryTable
          members={mockMembers}
          sortedOperationalRoleDefinitions={[]}
          searchTerm=""
          setSearchTerm={vi.fn()}
          roleFilter="all"
          setRoleFilter={vi.fn()}
          statusFilter="all"
          setStatusFilter={vi.fn()}
          togglingMemberId={null}
          canEditCollaborators={true}
          canDeleteCollaborators={true}
          canManageMember={() => true}
          onOpenEditMember={vi.fn()}
          onToggleMemberStatus={vi.fn()}
          onOpenRevokeAccess={vi.fn()}
        />
      );

      expect(screen.getByText("Arthur Mendes Carvalho")).toBeInTheDocument();
      expect(screen.getByText("Beatriz Santos")).toBeInTheDocument();

      // Rerender with filtered search with/without accents
      rerender(
        <TeamDirectoryTable
          members={mockMembers}
          sortedOperationalRoleDefinitions={[]}
          searchTerm="beatriz"
          setSearchTerm={vi.fn()}
          roleFilter="all"
          setRoleFilter={vi.fn()}
          statusFilter="all"
          setStatusFilter={vi.fn()}
          togglingMemberId={null}
          canEditCollaborators={true}
          canDeleteCollaborators={true}
          canManageMember={() => true}
          onOpenEditMember={vi.fn()}
          onToggleMemberStatus={vi.fn()}
          onOpenRevokeAccess={vi.fn()}
        />
      );

      expect(screen.queryByText("Arthur Mendes Carvalho")).not.toBeInTheDocument();
      expect(screen.getByText("Beatriz Santos")).toBeInTheDocument();
    });

    it("filters members using internal state and matches normalized accents", () => {
      const accentedMembers: ActiveMember[] = [
        {
          id: "mem-3",
          user_id: "user-3",
          operational_role: "professional",
          membership_status: "active",
          is_active: true,
          created_at: "2026-01-01T00:00:00Z",
          full_name: "João Médico Clínico",
          email: "joao@example.com",
          job_title: "Médico Geral",
          specialty: "Acupuntura",
        },
      ];

      render(
        <TeamDirectoryTable
          members={accentedMembers}
          sortedOperationalRoleDefinitions={[]}
          togglingMemberId={null}
          canEditCollaborators={true}
          canDeleteCollaborators={true}
          canManageMember={() => true}
          onOpenEditMember={vi.fn()}
          onToggleMemberStatus={vi.fn()}
          onOpenRevokeAccess={vi.fn()}
        />
      );

      expect(screen.getByText("João Médico Clínico")).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText("Buscar colaborador...");
      // Type "joao" without accents
      fireEvent.change(searchInput, { target: { value: "joao" } });
      expect(screen.getByText("João Médico Clínico")).toBeInTheDocument();

      // Type "medico" without accents
      fireEvent.change(searchInput, { target: { value: "medico" } });
      expect(screen.getByText("João Médico Clínico")).toBeInTheDocument();

      // Type "clinico" without accents
      fireEvent.change(searchInput, { target: { value: "clinico" } });
      expect(screen.getByText("João Médico Clínico")).toBeInTheDocument();
    });
  });

  describe("PendingInvitationsList", () => {
    it("calls onGetInviteLinkOnly when copying invitation link", async () => {
      const { PendingInvitationsList } = await import("./PendingInvitationsList");
      const onGetInviteLinkOnly = vi.fn().mockResolvedValue(undefined);
      const onResendInvite = vi.fn().mockResolvedValue(undefined);

      const mockPending: any = [
        {
          id: "inv-1",
          clinic_id: "clinic-1",
          email: "colaborador@clinica.com",
          operational_role: "professional",
          job_title: "Psicólogo(a)",
          specialty: "TCC; Infantil",
          status: "pending",
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString(),
          account_state: "invite_sent",
          pending_reason: "Aguardando confirmação",
        },
      ];

      render(
        <PendingInvitationsList
          pendingInvitations={mockPending}
          resendingId={null}
          cancelingId={null}
          canInviteCollaborators={true}
          canDeleteCollaborators={true}
          onResendInvite={onResendInvite}
          onCancelInvite={vi.fn()}
          onGetInviteLinkOnly={onGetInviteLinkOnly}
        />
      );

      expect(screen.getByText("colaborador@clinica.com")).toBeInTheDocument();
      expect(screen.getByText("TCC")).toBeInTheDocument();
      expect(screen.getByText("Infantil")).toBeInTheDocument();

      const copyBtn = screen.getByRole("button", { name: /copiar link/i });
      fireEvent.click(copyBtn);

      expect(onGetInviteLinkOnly).toHaveBeenCalledWith(mockPending[0]);
      expect(onResendInvite).not.toHaveBeenCalled();
    });

    it("opens confirmation dialog before cancelling invitation and cancels on confirm", async () => {
      const { PendingInvitationsList } = await import("./PendingInvitationsList");
      const onCancelInvite = vi.fn().mockResolvedValue(undefined);

      const mockPending: any = [
        {
          id: "inv-2",
          clinic_id: "clinic-1",
          email: "teste@clinica.com",
          operational_role: "assistant",
          job_title: "Recepcionista",
          specialty: null,
          status: "pending",
          created_at: new Date().toISOString(),
          expires_at: new Date().toISOString(),
          account_state: "invite_sent",
          pending_reason: "Aguardando confirmação",
        },
      ];

      render(
        <PendingInvitationsList
          pendingInvitations={mockPending}
          resendingId={null}
          cancelingId={null}
          canInviteCollaborators={true}
          canDeleteCollaborators={true}
          onResendInvite={vi.fn()}
          onCancelInvite={onCancelInvite}
        />
      );

      const cancelBtn = screen.getByRole("button", { name: /cancelar/i });
      fireEvent.click(cancelBtn);

      // Dialog should open
      expect(screen.getByText("Cancelar convite de colaborador?")).toBeInTheDocument();
      expect(screen.getAllByText("teste@clinica.com").length).toBeGreaterThanOrEqual(2);
      expect(onCancelInvite).not.toHaveBeenCalled();

      // Click confirm action
      const confirmCancelBtn = screen.getByRole("button", { name: /sim, cancelar convite/i });
      fireEvent.click(confirmCancelBtn);

      expect(onCancelInvite).toHaveBeenCalledWith("inv-2");
    });
  });
});
