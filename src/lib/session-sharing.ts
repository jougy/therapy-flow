import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type SessionShareCollaborator = {
  email: string | null;
  full_name: string | null;
  id: string;
  job_title: string | null;
  operational_role: string | null;
};

export type SessionShareRecipient = SessionShareCollaborator & {
  created_at: string | null;
  shared_by_user_id?: string | null;
};

export type SessionShareSummary = {
  recipients: SessionShareRecipient[];
  session_id: string;
  share_count: number;
};

const isRecord = (value: Json): value is Record<string, Json | undefined> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: Json | undefined) => (typeof value === "string" ? value : null);

const readNumber = (value: Json | undefined) => (typeof value === "number" ? value : 0);

const parseCollaborator = (value: Json): SessionShareCollaborator | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  if (!id) {
    return null;
  }

  return {
    id,
    email: readString(value.email),
    full_name: readString(value.full_name),
    job_title: readString(value.job_title),
    operational_role: readString(value.operational_role),
  };
};

const parseRecipient = (value: Json): SessionShareRecipient | null => {
  const collaborator = parseCollaborator(value);
  if (!collaborator || !isRecord(value)) {
    return null;
  }

  return {
    ...collaborator,
    created_at: readString(value.created_at),
    shared_by_user_id: readString(value.shared_by_user_id),
  };
};

const parseRecipients = (value: Json | undefined): SessionShareRecipient[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(parseRecipient).filter((item): item is SessionShareRecipient => item !== null);
};

export const parseSessionShareSummaries = (value: Json): SessionShareSummary[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!isRecord(item)) {
        return null;
      }

      const sessionId = readString(item.session_id);
      if (!sessionId) {
        return null;
      }

      return {
        session_id: sessionId,
        share_count: readNumber(item.share_count),
        recipients: parseRecipients(item.recipients),
      };
    })
    .filter((item): item is SessionShareSummary => item !== null);
};

export const fetchClinicShareCollaborators = async (clinicId?: string | null) => {
  const { data, error } = await supabase.rpc("get_clinic_share_collaborators", {
    _clinic_id: clinicId ?? undefined,
  });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(parseCollaborator).filter((item): item is SessionShareCollaborator => item !== null);
};

export const fetchSessionShareRecipients = async (sessionId: string) => {
  const { data, error } = await supabase.rpc("get_session_share_recipients", {
    _session_id: sessionId,
  });

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(parseRecipient).filter((item): item is SessionShareRecipient => item !== null);
};

export const fetchSessionShareSummaries = async (sessionIds: string[]) => {
  if (sessionIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase.rpc("get_session_share_summary", {
    _session_ids: sessionIds,
  });

  if (error) {
    throw error;
  }

  return parseSessionShareSummaries(data);
};

export const shareSessionsWithCollaborators = async (sessionIds: string[], userIds: string[]) => {
  const { data, error } = await supabase.rpc("share_sessions_with_collaborators", {
    _session_ids: sessionIds,
    _user_ids: userIds,
  });

  if (error) {
    throw error;
  }

  return data;
};

export const getShareRecipientLabel = (recipient: Pick<SessionShareRecipient, "email" | "full_name">) =>
  recipient.full_name?.trim() || recipient.email?.trim() || "Colaborador";
