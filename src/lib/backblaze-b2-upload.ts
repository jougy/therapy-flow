/**
 * Utilitário de Upload Direto para Backblaze B2 (Zero Supabase Storage)
 * 
 * Garante que imagens clínicas, fotografias e anexos de anotação visual
 * sejam enviados com criptografia e armazenamento exclusivo no Backblaze B2,
 * nunca passando pelo Supabase Storage.
 */

import { supabase } from "@/integrations/supabase/client";

export interface DirectB2UploadResult {
  uploadId: string;
  downloadUrl: string;
  publicUrl?: string;
  objectKey: string;
  filename: string;
  width: number;
  height: number;
  byteSize: number;
}

export async function uploadImageToBackblazeB2(params: {
  blob: Blob;
  filename: string;
  width: number;
  height: number;
  clinicId?: string | null;
  patientId?: string | null;
  sessionId?: string | null;
}): Promise<DirectB2UploadResult> {
  const { blob, filename, width, height, clinicId, patientId, sessionId } = params;

  if (!clinicId) {
    throw new Error("Clínica não informada para armazenamento no Backblaze B2.");
  }

  // 1. Solicita URL pré-assinada de upload direto no B2 via Edge Function
  const { data: b2Data, error: b2Error } = await supabase.functions.invoke("b2-upload-url", {
    body: {
      category: "image",
      clinicId,
      patientId: patientId || undefined,
      sessionId: sessionId || undefined,
      filename,
      byteSize: blob.size,
      originalByteSize: blob.size,
      storedByteSize: blob.size,
      contentType: "image/webp",
      originalContentType: "image/webp",
      storedContentType: "image/webp",
      imageWidth: width,
      imageHeight: height,
    },
  });

  if (b2Error || !b2Data) {
    const errorMsg = b2Error?.message || "Não foi possível obter credenciais seguras do Backblaze B2.";
    throw new Error(errorMsg);
  }

  const uploadId = String(b2Data.uploadId || "");
  const uploadUrl = b2Data.uploadUrl;
  const objectKey = String(b2Data.objectKey || "");

  // 2. Se o arquivo foi deduplicado no servidor pelo hash
  if (b2Data.deduplicatedFrom || !uploadUrl) {
    // Resolve URL de leitura assinada
    const { data: dlData } = await supabase.functions.invoke("b2-download-url", {
      body: { uploadId },
    });

    return {
      uploadId,
      downloadUrl: dlData?.downloadUrl || b2Data.publicUrl || b2Data.downloadUrl || "",
      publicUrl: b2Data.publicUrl,
      objectKey,
      filename,
      width,
      height,
      byteSize: blob.size,
    };
  }

  // 3. PUT direto no Backblaze B2 (Browser -> Backblaze B2 diretamente)
  const putResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "image/webp",
      ...(b2Data.headers || {}),
    },
    body: blob,
  });

  if (!putResponse.ok) {
    throw new Error(`Backblaze B2 recusou o upload direto (${putResponse.status}).`);
  }

  // 4. Confirmação do upload no Backblaze B2
  if (patientId) {
    await supabase.functions.invoke("b2-confirm-upload", {
      body: { uploadId },
    });
  }

  // 5. Obtenção da URL assinada segura de download
  const { data: downloadData } = await supabase.functions.invoke("b2-download-url", {
    body: { uploadId },
  });

  const finalUrl = downloadData?.downloadUrl || b2Data.downloadUrl || b2Data.publicUrl || "";

  return {
    uploadId,
    downloadUrl: finalUrl,
    publicUrl: b2Data.publicUrl,
    objectKey,
    filename,
    width,
    height,
    byteSize: blob.size,
  };
}
