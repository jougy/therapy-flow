import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { buildPublicAppUrl } from "@/lib/public-app-url";
import {
  logRuntimeError,
  logRuntimeInfo,
  logRuntimeRpc,
  logRuntimeFunction,
} from "@/lib/runtime-debug";
import type {
  ActiveMember,
  ClinicOperationalRoleDefinition,
  PendingCollaboratorInvitation,
} from "../types";

export const extractEdgeFunctionErrorMessage = async (
  error: unknown,
  fallbackMessage: string
): Promise<string> => {
  if (!error || typeof error !== "object") return fallbackMessage;
  const errObj = error as Record<string, unknown>;
  try {
    const ctx = errObj.context;
    if (ctx && typeof (ctx as any).clone === "function") {
      const cloned = (ctx as any).clone();
      if (typeof cloned.json === "function") {
        const body = await cloned.json();
        if (body?.error) return String(body.error);
        if (body?.message) return String(body.message);
      }
    } else if (ctx && typeof (ctx as any).json === "function") {
      const body = await (ctx as any).json();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    }
  } catch {
    // Ignora falha de parse JSON
  }
  return typeof errObj.message === "string" && errObj.message ? errObj.message : fallbackMessage;
};

export interface UseTeamInvitationsParams {
  clinicId?: string | null;
  operationalRoleDefinitions: ClinicOperationalRoleDefinition[];
  isAccountOwner?: boolean;
  actorRoleIndex?: number;
  roleIndexMap?: Map<string, number>;
  onTeamDataChanged: () => Promise<void> | void;
}

export const useTeamInvitations = ({
  clinicId,
  operationalRoleDefinitions,
  isAccountOwner = false,
  actorRoleIndex = -1,
  roleIndexMap,
  onTeamDataChanged,
}: UseTeamInvitationsParams) => {
  const [pendingInvitations, setPendingInvitations] = useState<PendingCollaboratorInvitation[]>([]);
  const [sendingInvite, setSendingInvite] = useState(false);
  const isSubmittingRef = useRef(false);
  const [lastGeneratedInviteUrl, setLastGeneratedInviteUrl] = useState("");
  const [lastGeneratedInviteEmail, setLastGeneratedInviteEmail] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [sendingCompletionMemberId, setSendingCompletionMemberId] = useState<string | null>(null);

  const effectiveRoleIndexMap = roleIndexMap ?? new Map(
    operationalRoleDefinitions.map((r, idx) => [r.role_key, idx])
  );

  const handleSendInvite = async (payload: {
    email: string;
    role: string;
    jobTitle: string;
    specialty: string;
    roleKey?: string;
    baseOperationalRole?: string;
  }) => {
    if (sendingInvite || isSubmittingRef.current) return;
    if (!clinicId || !payload.email.trim()) return;

    const selectedRoleDef = operationalRoleDefinitions.find(
      (r) => r.role_key === (payload.roleKey || payload.role)
    );
    const roleKey = payload.roleKey || selectedRoleDef?.role_key || payload.role;
    const baseOperationalRole = (payload.baseOperationalRole || selectedRoleDef?.base_operational_role || payload.role) as any;

    // Hardening de Poder Vertical: Validação contra convites para papéis superiores ou iguais
    if (!isAccountOwner) {
      if (roleKey === "owner") {
        toast({
          title: "Nível não permitido",
          description: "Não é permitido emitir convites para o papel de Proprietário.",
          variant: "destructive",
        });
        return;
      }
      const targetRoleIndex = effectiveRoleIndexMap.get(roleKey) ?? -1;
      if (actorRoleIndex >= 0 && targetRoleIndex >= 0 && targetRoleIndex <= actorRoleIndex) {
        toast({
          title: "Nível não permitido",
          description: "Você só pode convidar colaboradores para papéis hierarquicamente inferiores ao seu.",
          variant: "destructive",
        });
        return;
      }
    }

    isSubmittingRef.current = true;
    setSendingInvite(true);
    try {
      const rpcStart = performance.now();

      let { data, error } = await supabase.rpc("invite_clinic_collaborator", {
        _clinic_id: clinicId,
        _email: payload.email.trim(),
        _operational_role: baseOperationalRole,
        _role_key: roleKey,
        _job_title: payload.jobTitle.trim() || undefined,
        _specialty: payload.specialty.trim() || undefined,
      } as any);

      // Fallback Expand & Contract caso o banco remoto ainda não tenha aplicado a nova assinatura da RPC
      if (error && (error.message?.includes("_role_key") || error.code === "PGRST202")) {
        const fallback = await supabase.rpc("invite_clinic_collaborator", {
          _clinic_id: clinicId,
          _email: payload.email.trim(),
          _operational_role: baseOperationalRole,
          _job_title: payload.jobTitle.trim() || undefined,
          _specialty: payload.specialty.trim() || undefined,
        } as any);
        data = fallback.data;
        error = fallback.error;
      }
      const rpcDuration = Math.round(performance.now() - rpcStart);

      if (error) {
        logRuntimeRpc("invite_clinic_collaborator", { clinicId, email: payload.email }, "error", rpcDuration, null, error);
        logRuntimeError("team.invite_clinic_collaborator", error, { clinicId, email: payload.email });
        toast({ title: "Erro ao emitir convite", description: error.message, variant: "destructive" });
        return;
      }

      logRuntimeRpc("invite_clinic_collaborator", { clinicId, email: payload.email }, "success", rpcDuration, data);

      const resData = data as Record<string, unknown> | null;
      const token = resData?.token ? String(resData.token) : "";
      const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);

      setLastGeneratedInviteUrl(inviteUrl);
      setLastGeneratedInviteEmail(payload.email.trim());

      const fnStart = performance.now();
      const { data: sendResult, error: emailError } = await supabase.functions.invoke<{
        sent?: boolean;
        canShareLink?: boolean;
        error?: string;
        destinationUrl?: string;
      }>("send-clinic-invitation", {
        body: { inviteUrl, token },
      });
      const fnDuration = Math.round(performance.now() - fnStart);

      const hasError = Boolean(emailError || sendResult?.sent === false);
      const canShare = Boolean(sendResult?.canShareLink || inviteUrl);

      if (hasError) {
        const reason = emailError
          ? await extractEdgeFunctionErrorMessage(
              emailError,
              "Não foi possível despachar o e-mail automaticamente."
            )
          : (sendResult?.error || "Não foi possível despachar o e-mail automaticamente.");
        logRuntimeFunction("send-clinic-invitation", "error", fnDuration, { inviteUrl, reason }, emailError);
        logRuntimeError("team.send-clinic-invitation", `Falha ao despachar e-mail via Resend: ${reason}`, {
          inviteUrl,
          token,
          emailError,
          email: payload.email,
        });
        console.warn("[useTeamInvitations] Falha ao enviar e-mail de convite:", reason, emailError);

        if (canShare) {
          toast({
            title: "Convite gerado!",
            description:
              "Convite gerado! O e-mail automático não pôde ser despachado agora, mas o link está pronto para envio via WhatsApp ou cópia.",
          });
        } else {
          toast({
            title: "Convite gerado (aviso de envio)",
            description: `O link foi criado com sucesso, mas o e-mail não pôde ser despachado: ${reason}. Você pode copiar o link ou enviar no WhatsApp.`,
            variant: "destructive",
          });
        }
      } else if (sendResult?.sent === true) {
        logRuntimeFunction("send-clinic-invitation", "success", fnDuration, { email: payload.email });
        logRuntimeInfo("team.send-clinic-invitation", `Convite enviado com sucesso para ${payload.email}`);
        toast({
          title: "Convite enviado com sucesso!",
          description: "Convite enviado com sucesso para o e-mail informado!",
        });
      }

      void onTeamDataChanged();
    } finally {
      isSubmittingRef.current = false;
      setSendingInvite(false);
    }
  };

  const handleCopyLink = async (url: string, email: string) => {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: `Link de convite para ${email} copiado.` });
  };

  const handleGetInviteLinkOnly = async (invitation: PendingCollaboratorInvitation) => {
    try {
      const rpcStart = performance.now();
      let token = "";

      const { data: resendData, error: resendError } = await supabase.rpc("resend_clinic_collaborator_invitation", {
        _invitation_id: invitation.id,
      });

      if (!resendError && (resendData as any)?.token) {
        token = String((resendData as any).token);
        logRuntimeRpc("resend_clinic_collaborator_invitation", { invitationId: invitation.id }, "success", Math.round(performance.now() - rpcStart), resendData);
      } else {
        const { data, error } = await supabase.rpc("invite_clinic_collaborator", {
          _clinic_id: clinicId || undefined,
          _email: invitation.email,
          _operational_role: invitation.operational_role,
          _role_key: invitation.role_key || undefined,
          _job_title: invitation.job_title || undefined,
          _specialty: invitation.specialty || undefined,
        });
        const rpcDuration = Math.round(performance.now() - rpcStart);
        if (error) {
          logRuntimeRpc("invite_clinic_collaborator", { clinicId, email: invitation.email }, "error", rpcDuration, null, error);
          logRuntimeError("team.get_invite_link_only", error, { clinicId, email: invitation.email });
          throw new Error(resendError?.message || error.message);
        }
        logRuntimeRpc("invite_clinic_collaborator", { clinicId, email: invitation.email }, "success", rpcDuration, data);
        token = (data as Record<string, unknown>)?.token ? String((data as any).token) : "";
      }

      if (!token) throw new Error("Não foi possível gerar o link de convite.");
      const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);
      setLastGeneratedInviteUrl(inviteUrl);
      setLastGeneratedInviteEmail(invitation.email);
      await navigator.clipboard.writeText(inviteUrl);
      toast({
        title: "Link de convite copiado!",
        description: `Link exclusivo gerado e copiado para a área de transferência.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar link de convite.";
      toast({ title: "Erro ao copiar link", description: msg, variant: "destructive" });
    }
  };

  const handleResendInvite = async (invitation: PendingCollaboratorInvitation) => {
    if (resendingId || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setResendingId(invitation.id);

    try {
      const rpcStart = performance.now();
      const { data: fallbackData, error } = await supabase.rpc("invite_clinic_collaborator", {
        _clinic_id: clinicId || undefined,
        _email: invitation.email,
        _operational_role: invitation.operational_role,
        _role_key: invitation.role_key || undefined,
        _job_title: invitation.job_title || undefined,
        _specialty: invitation.specialty || undefined,
      });
      const rpcDuration = Math.round(performance.now() - rpcStart);

      if (error) {
        logRuntimeRpc("invite_clinic_collaborator", { clinicId, email: invitation.email }, "error", rpcDuration, null, error);
        logRuntimeError("team.resend_invite_rpc", error, { clinicId, email: invitation.email });
        throw new Error(error.message);
      }

      logRuntimeRpc("invite_clinic_collaborator", { clinicId, email: invitation.email }, "success", rpcDuration, fallbackData);

      const fData = fallbackData as Record<string, unknown>;
      const token = fData?.token ? String(fData.token) : "";
      const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);

      setLastGeneratedInviteUrl(inviteUrl);
      setLastGeneratedInviteEmail(invitation.email);

      const fnStart = performance.now();
      const { data: resendResult, error: emailError } = await supabase.functions.invoke<{
        sent?: boolean;
        canShareLink?: boolean;
        error?: string;
      }>("send-clinic-invitation", {
        body: { inviteUrl, token },
      });
      const fnDuration = Math.round(performance.now() - fnStart);

      const hasError = Boolean(emailError || resendResult?.sent === false);
      const canShare = Boolean(resendResult?.canShareLink || inviteUrl);

      if (hasError) {
        const reason = emailError
          ? await extractEdgeFunctionErrorMessage(
              emailError,
              "Não foi possível reenviar o e-mail automaticamente."
            )
          : (resendResult?.error || "Não foi possível reenviar o e-mail automaticamente.");
        logRuntimeFunction("send-clinic-invitation", "error", fnDuration, { inviteUrl, reason }, emailError);
        logRuntimeError("team.resend-clinic-invitation", `Falha ao reenviar e-mail via Resend: ${reason}`, {
          inviteUrl,
          token,
          emailError,
          email: invitation.email,
        });
        console.warn("[useTeamInvitations] Falha ao reenviar e-mail de convite:", reason, emailError);

        if (canShare) {
          toast({
            title: "Convite gerado!",
            description:
              "Convite gerado! O e-mail automático não pôde ser despachado agora, mas o link está pronto para envio via WhatsApp ou cópia.",
          });
        } else {
          toast({
            title: "Convite atualizado (aviso de envio)",
            description: `Novo link gerado, mas o e-mail não pôde ser despachado: ${reason}. Copie o link direto caso necessário.`,
            variant: "destructive",
          });
        }
      } else if (resendResult?.sent === true) {
        logRuntimeFunction("send-clinic-invitation", "success", fnDuration, { email: invitation.email });
        logRuntimeInfo("team.send-clinic-invitation", `Convite reenviado com sucesso para ${invitation.email}`);
        toast({
          title: "Convite enviado com sucesso!",
          description: "Convite enviado com sucesso para o e-mail informado!",
        });
      }

      setPendingInvitations((prev) =>
        prev.map((item) =>
          item.id === invitation.id
            ? {
                ...item,
                email_delivery_status: hasError ? "failed" : "sent",
                email_last_error: hasError ? (resendResult?.error || "Falha no envio") : null,
                last_resent_at: new Date().toISOString(),
              }
            : item
        )
      );

      void onTeamDataChanged();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao reenviar convite.";
      toast({ title: "Erro ao reenviar", description: msg, variant: "destructive" });
    } finally {
      isSubmittingRef.current = false;
      setResendingId(null);
    }
  };

  const handleSendCompletionInvite = async (member: ActiveMember) => {
    if (sendingCompletionMemberId || isSubmittingRef.current) return;
    if (!clinicId || !member.email) {
      toast({ title: "Dados incompletos", description: "Colaborador não possui e-mail cadastrado.", variant: "destructive" });
      return;
    }

    isSubmittingRef.current = true;
    setSendingCompletionMemberId(member.id);
    try {
      const { data: inviteData, error: inviteErr } = await supabase.rpc("invite_clinic_collaborator", {
        _clinic_id: clinicId,
        _email: member.email.trim(),
        _operational_role: member.operational_role === "owner" ? "admin" : member.operational_role,
        _role_key: member.role_key || undefined,
        _job_title: member.job_title || undefined,
        _specialty: member.specialty || undefined,
      });

      if (inviteErr) {
        throw new Error(inviteErr.message);
      }

      const invRecord = inviteData as Record<string, unknown> | null;
      const token = invRecord?.token ? String(invRecord.token) : "";
      const inviteUrl = buildPublicAppUrl(`/convite/clinica/${token}`);

      const { data: completionResult, error: fnErr } = await supabase.functions.invoke<{
        sent?: boolean;
        canShareLink?: boolean;
        error?: string;
      }>("send-clinic-invitation", {
        body: { inviteUrl, token },
      });

      const hasError = Boolean(fnErr || completionResult?.sent === false);
      const canShare = Boolean(completionResult?.canShareLink || inviteUrl);

      if (hasError) {
        const reason = fnErr
          ? await extractEdgeFunctionErrorMessage(fnErr, "Não foi possível despachar o e-mail.")
          : (completionResult?.error || "Não foi possível despachar o e-mail.");

        if (canShare) {
          toast({
            title: "Convite gerado!",
            description:
              "Convite gerado! O e-mail automático não pôde ser despachado agora, mas o link está pronto para envio via WhatsApp ou cópia.",
          });
        } else {
          toast({
            title: "Convite de regularização gerado",
            description: `O link para completar cadastro foi gerado, mas o envio automático falhou: ${reason}`,
            variant: "destructive",
          });
        }
      } else if (completionResult?.sent === true) {
        toast({
          title: "Convite enviado com sucesso!",
          description: "Convite enviado com sucesso para o e-mail informado!",
        });
      }

      void onTeamDataChanged();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Não foi possível enviar o e-mail de completar cadastro.";
      toast({
        title: "Erro ao enviar regularização",
        description: msg,
        variant: "destructive",
      });
    } finally {
      isSubmittingRef.current = false;
      setSendingCompletionMemberId(null);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    setCancelingId(invitationId);
    const previousInvitations = pendingInvitations;
    setPendingInvitations((curr) => curr.filter((i) => i.id !== invitationId));

    const { error } = await supabase.rpc("cancel_clinic_collaborator_invitation", {
      _invitation_id: invitationId,
    });

    if (error) {
      setPendingInvitations(previousInvitations);
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Convite cancelado com sucesso." });
    }
    setCancelingId(null);
  };

  return {
    pendingInvitations,
    setPendingInvitations,
    sendingInvite,
    setSendingInvite,
    lastGeneratedInviteUrl,
    lastGeneratedInviteEmail,
    resendingId,
    cancelingId,
    sendingCompletionMemberId,
    handleSendInvite,
    handleCopyLink,
    handleGetInviteLinkOnly,
    handleResendInvite,
    handleSendCompletionInvite,
    handleCancelInvite,
  };
};
