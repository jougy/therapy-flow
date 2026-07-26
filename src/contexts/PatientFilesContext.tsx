import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";
import { deleteUploadedPatientFile, removePatientFileUploadQueueItem, isPatientFileUploadImage } from "@/lib/patient-file-upload-queue";

export type PatientFileUploadRow = Database["public"]["Tables"]["patient_file_uploads"]["Row"] & {
  session?: {
    id: string;
    status: string;
    scheduled_start_at: string | null;
    patient_arrived_at: string | null;
    group?: {
      id: string;
      name: string;
      color: string | null;
      status: string;
    } | null;
  } | null;
};

interface DownloadResponse {
  downloadUrl?: string;
  filename?: string;
  originalContentType?: string;
  storageEncoding?: "gzip" | "deflate" | null;
  storedContentType?: string;
}

const readBlobForPreview = async (download: DownloadResponse) => {
  if (!download.downloadUrl) throw new Error("URL de download ausente.");
  const response = await fetch(download.downloadUrl);
  if (!response.ok || !response.body) throw new Error("Não foi possível baixar o arquivo.");

  if (download.storageEncoding && "DecompressionStream" in window) {
    const stream = response.body.pipeThrough(new DecompressionStream(download.storageEncoding));
    return new Response(stream).blob();
  }

  return response.blob();
};

interface PatientFilesContextValue {
  files: PatientFileUploadRow[];
  loading: boolean;
  refreshFiles: () => Promise<void>;
  handlePreview: (file: PatientFileUploadRow) => Promise<void>;
  handleDownload: (file: PatientFileUploadRow) => Promise<void>;
  handleDelete: (file: PatientFileUploadRow, queueItemId?: string) => Promise<void>;
  deletingUploadId: string | null;
}

const PatientFilesContext = createContext<PatientFilesContextValue | null>(null);

export function PatientFilesProvider({
  children,
  clinicId,
  patientId,
}: {
  children: React.ReactNode;
  clinicId: string | null;
  patientId: string;
}) {
  const [files, setFiles] = useState<PatientFileUploadRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingUploadId, setDeletingUploadId] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewIsImage, setPreviewIsImage] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");

  const refreshFiles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("patient_file_uploads")
      .select(`
        *,
        session:sessions (
          id,
          status,
          scheduled_start_at,
          patient_arrived_at,
          group:patient_groups (
            id,
            name,
            color,
            status
          )
        )
      `)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar arquivos", description: error.message, variant: "destructive" });
    } else {
      setFiles((data ?? []) as PatientFileUploadRow[]);
    }
    setLoading(false);
  }, [patientId]);

  useEffect(() => {
    void refreshFiles();
  }, [refreshFiles]);

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ patientId?: string }>)?.detail;
      if (detail?.patientId === patientId) {
        void refreshFiles();
      }
    };
    window.addEventListener("patient-file-uploads-updated", listener);
    return () => window.removeEventListener("patient-file-uploads-updated", listener);
  }, [refreshFiles, patientId]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const getDownload = async (uploadId: string) => {
    const { data, error } = await supabase.functions.invoke("b2-download-url", {
      body: { uploadId },
    });
    if (error) throw new Error(error.message);
    return data as DownloadResponse;
  };

  const handleDownload = async (file: PatientFileUploadRow) => {
    try {
      const download = await getDownload(file.id);
      if (!download.downloadUrl) throw new Error("URL de download ausente.");

      if (download.storageEncoding) {
        const blob = await readBlobForPreview(download);
        const url = URL.createObjectURL(new Blob([blob], { type: download.originalContentType ?? file.content_type }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = download.filename ?? file.original_filename;
        anchor.click();
        URL.revokeObjectURL(url);
        return;
      }
      window.open(download.downloadUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast({ title: "Erro ao baixar arquivo", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  };

  const handlePreview = async (file: PatientFileUploadRow) => {
    try {
      const download = await getDownload(file.id);
      if (!download.downloadUrl) throw new Error("URL de visualização ausente.");
      const isImage = isPatientFileUploadImage(file.original_content_type ?? file.content_type);

      if (previewUrl) URL.revokeObjectURL(previewUrl);

      if (download.storageEncoding || isImage) {
        const blob = await readBlobForPreview(download);
        setPreviewUrl(URL.createObjectURL(new Blob([blob], { type: download.originalContentType ?? file.content_type })));
      } else {
        setPreviewUrl(download.downloadUrl);
      }

      setPreviewIsImage(isImage);
      setPreviewTitle(file.original_filename);
      setPreviewOpen(true);
    } catch (error) {
      toast({ title: "Erro ao visualizar arquivo", description: error instanceof Error ? error.message : "Tente novamente.", variant: "destructive" });
    }
  };

  const handleDelete = async (file: PatientFileUploadRow, queueItemId?: string) => {
    if (!clinicId) return;
    try {
      setDeletingUploadId(file.id);
      await deleteUploadedPatientFile({
        clinicId,
        fileName: file.original_filename,
        patientId,
        sessionId: file.session_id,
        uploadId: file.id,
      });
      setFiles((current) => current.filter((f) => f.id !== file.id));
      if (queueItemId) removePatientFileUploadQueueItem(queueItemId);
      toast({ title: "Arquivo descartado", description: "O arquivo foi removido do storage e da lista." });
      window.dispatchEvent(new CustomEvent("patient-file-uploads-updated", {
        detail: {
          patientId,
          sessionId: file.session_id,
          uploadId: file.id,
        },
      }));
    } catch (error) {
      toast({
        title: "Erro ao descartar arquivo",
        description: error instanceof Error ? error.message : "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setDeletingUploadId(null);
    }
  };

  return (
    <PatientFilesContext.Provider value={{ files, loading, refreshFiles, handlePreview, handleDownload, handleDelete, deletingUploadId }}>
      {children}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="h-[85vh] w-[calc(100vw-1rem)] max-w-5xl">
          <DialogHeader>
            <DialogTitle className="truncate">{previewTitle}</DialogTitle>
          </DialogHeader>
          {previewUrl ? (
            previewIsImage ? (
              <img src={previewUrl} alt={previewTitle} className="mx-auto max-h-[72vh] max-w-full rounded-lg object-contain" />
            ) : (
              <iframe title={previewTitle} src={previewUrl} className="h-[72vh] w-full rounded-lg border" />
            )
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              <Upload className="mr-2 h-4 w-4" />
              Preparando visualização
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PatientFilesContext.Provider>
  );
}

export function usePatientFilesContext() {
  const context = useContext(PatientFilesContext);
  if (!context) {
    throw new Error("usePatientFilesContext must be used within a PatientFilesProvider");
  }
  return context;
}
