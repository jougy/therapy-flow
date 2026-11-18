import { supabase } from "@/integrations/supabase/client";
import type { DocumentSignatureStatus, DocumentSignerRole } from "./types";

export interface CreateDocumentSignatureInput {
  clinicId: string;
  patientId: string;
  sessionId?: string | null;
  templateId?: string | null;
  templateTitle: string;
  renderedMarkdown: string;
  signToken: string;
  status: DocumentSignatureStatus;
  signerName?: string | null;
  signerCpf?: string | null;
  signerRole?: DocumentSignerRole | null;
  signatureImageUrl?: string | null;
  signatureMetadata?: Record<string, unknown>;
  signedAt?: string | null;
  createdBy?: string | null;
}

export interface CreatedDocumentSignatureRecord {
  id: string;
  sign_token: string;
  status: DocumentSignatureStatus;
  signed_at: string | null;
}

export interface PublicDocumentSignaturePayload {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_logo_url: string | null;
  patient_id: string;
  patient_name: string | null;
  session_id: string | null;
  template_id: string | null;
  template_title: string;
  rendered_markdown: string;
  status: DocumentSignatureStatus;
  signer_name: string | null;
  signer_role: DocumentSignerRole | null;
  signed_at: string | null;
  already_signed: boolean;
  created_at: string;
  signer_cpf?: string | null;
  signature_image_url?: string | null;
  signature_metadata?: Record<string, unknown> | null;
  council_registration?: string | null;
  global_user_id?: string | null;
}

export interface SubmitDocumentSignatureInput {
  token: string;
  signerName: string;
  signerCpf: string | null;
  signatureImageUrl: string;
  metadata: Record<string, unknown>;
}

export interface SubmitDocumentSignatureResult {
  success: boolean;
  id: string;
  status: DocumentSignatureStatus;
  signer_name: string;
  signed_at: string;
  template_title: string;
}

interface ClinicDocumentSignaturesInsertQuery {
  insert: (payload: Record<string, unknown>) => {
    select: (columns: string) => {
      single: () => Promise<{
        data: CreatedDocumentSignatureRecord | null;
        error: { message: string } | null;
      }>;
    };
  };
}

/**
 * Cria um registro de solicitação ou assinatura na tabela `clinic_document_signatures`.
 */
export async function createDocumentSignatureRecord(
  input: CreateDocumentSignatureInput
): Promise<CreatedDocumentSignatureRecord> {
  const tableClient = supabase.from(
    "clinic_document_signatures" as unknown as "clinics"
  ) as unknown as ClinicDocumentSignaturesInsertQuery;

  const cleanCpf = input.signerCpf ? input.signerCpf.replace(/\D/g, "") : null;

  const { data, error } = await tableClient
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      session_id: input.sessionId || null,
      template_id: input.templateId || null,
      template_title: input.templateTitle,
      rendered_markdown: input.renderedMarkdown,
      sign_token: input.signToken,
      status: input.status,
      signer_name: input.signerName || null,
      signer_cpf: cleanCpf && cleanCpf.length > 0 ? cleanCpf : null,
      signer_role: input.signerRole || null,
      signature_image_url: input.signatureImageUrl || null,
      signature_metadata: input.signatureMetadata || {},
      signed_at: input.signedAt || null,
      created_by: input.createdBy || null,
    })
    .select("id, sign_token, status, signed_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Não foi possível registrar a solicitação de assinatura.");
  }

  return data;
}

/**
 * Carrega os dados públicos do documento para assinatura remota via RPC `get_document_signature_by_token`.
 */
export async function getDocumentSignatureByToken(
  token: string
): Promise<PublicDocumentSignaturePayload> {
  const { data, error } = await supabase.rpc(
    "get_document_signature_by_token" as never,
    { p_token: token } as never
  );

  if (error || !data || typeof data !== "object") {
    throw new Error(error?.message || "Documento não encontrado ou link expirado.");
  }

  return data as unknown as PublicDocumentSignaturePayload;
}

/**
 * Submete a assinatura digital remota via RPC `submit_document_signature_by_token`.
 */
export async function submitDocumentSignatureByToken(
  input: SubmitDocumentSignatureInput
): Promise<SubmitDocumentSignatureResult> {
  const cleanCpf = input.signerCpf ? input.signerCpf.replace(/\D/g, "") : null;

  const { data, error } = await supabase.rpc(
    "submit_document_signature_by_token" as never,
    {
      p_token: input.token,
      p_signer_name: input.signerName.trim(),
      p_signer_cpf: cleanCpf && cleanCpf.length > 0 ? cleanCpf : null,
      p_signature_image_url: input.signatureImageUrl,
      p_metadata: input.metadata,
    } as never
  );

  if (error || !data || typeof data !== "object") {
    throw new Error(error?.message || "Não foi possível registrar sua assinatura digital.");
  }

  return data as unknown as SubmitDocumentSignatureResult;
}
