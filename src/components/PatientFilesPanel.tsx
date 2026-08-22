import { useMemo, useRef, useState } from "react";
import { AlertCircle, FileImage, FileText, Loader2, RefreshCcw, ListFilter } from "lucide-react";
import { ErrorDiagnosticDialog } from "@/components/ErrorDiagnosticDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/hooks/use-toast";
import type { AppDiagnosticError } from "@/lib/app-diagnostics";
import {
  enqueuePatientFileUpload,
  usePatientFileUploadQueue,
} from "@/lib/patient-file-upload-queue";
import {
  normalizePatientUploadContentType,
  validatePatientFileUploadCandidate,
} from "@/lib/patient-file-uploads";
import { usePatientFilesContext } from "@/contexts/PatientFilesContext";
import { FileThumbnailCard } from "@/components/FileThumbnailCard";
import { Badge } from "@/components/ui/badge";
import { getDesignLabButtonClass, designLabIconClass, designLabLabelClass } from "@/lib/design-animations";

type FileStatusFilter = "all" | "pending" | "uploaded" | "failed" | "deleted";
type FileTypeFilter = "all" | "image" | "pdf";

const queueStatusLabels: Record<string, string> = {
  confirming: "Confirmando",
  failed: "Falhou",
  processing: "Otimizando",
  queued: "Na fila",
  uploaded: "Enviado",
  uploading: "Enviando",
};

const statusClassNames: Record<string, string> = {
  deleted: "border-muted bg-muted text-muted-foreground",
  failed: "border-destructive/20 bg-destructive/10 text-destructive",
  pending: "border-warning/20 bg-warning/10 text-warning",
  uploaded: "border-success/20 bg-success/10 text-success",
};

const isUuid = (value: string | null | undefined) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

export const PatientFilesPanel = ({
  clinicId,
  disabledReason,
  patientId,
  sessionId,
  title = "Arquivos",
  variant = "session",
}: {
  clinicId: string | null;
  disabledReason?: string;
  patientId: string;
  sessionId?: string | null;
  title?: string;
  variant?: "patient" | "session";
}) => {
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const queue = usePatientFileUploadQueue();
  const { files, loading, refreshFiles } = usePatientFilesContext();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<AppDiagnosticError | null>(null);
  const [statusFilter, setStatusFilter] = useState<FileStatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<FileTypeFilter>("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [sessionStatusFilter, setSessionStatusFilter] = useState("all");
  const [groupStatusFilter, setGroupStatusFilter] = useState("all");
  const canUpload = Boolean(clinicId) && !disabledReason;
  const normalizedSessionId = variant === "session" && isUuid(sessionId) ? sessionId : null;

  const activeFilterCount = [
    statusFilter !== "all",
    typeFilter !== "all",
    groupFilter !== "all",
    sessionStatusFilter !== "all",
    groupStatusFilter !== "all",
  ].filter(Boolean).length;

  // Since PatientFilesPanel might be used in Session scope or Global scope, we need to filter `files` if we are in session scope.
  const localFiles = useMemo(() => {
    if (variant === "session" && normalizedSessionId) {
      return files.filter(f => f.session_id === normalizedSessionId);
    }
    return files;
  }, [files, variant, normalizedSessionId]);

  const visibleFiles = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase("pt-BR");

    return localFiles.filter((file) => {
      const type = normalizePatientUploadContentType(file.original_content_type ?? file.content_type);
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "image" && type.startsWith("image/")) ||
        (typeFilter === "pdf" && type === "application/pdf");
      const matchesStatus = statusFilter === "all" || file.status === statusFilter;
      const matchesSearch = !search || file.original_filename.toLocaleLowerCase("pt-BR").includes(search);
      const matchesGroup = groupFilter === "all" || file.session?.group?.id === groupFilter;
      const matchesSessionStatus = sessionStatusFilter === "all" || file.session?.status === sessionStatusFilter;
      const matchesGroupStatus = groupStatusFilter === "all" || file.session?.group?.status === groupStatusFilter;

      return matchesType && matchesStatus && matchesSearch && matchesGroup && matchesSessionStatus && matchesGroupStatus;
    });
  }, [localFiles, searchTerm, statusFilter, typeFilter, groupFilter, sessionStatusFilter, groupStatusFilter]);

  const uniqueGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    localFiles.forEach((f) => {
      if (f.session?.group) map.set(f.session.group.id, f.session.group);
    });
    return Array.from(map.values());
  }, [localFiles]);

  const uniqueSessionStatuses = useMemo(() => {
    const set = new Set<string>();
    localFiles.forEach((f) => {
      if (f.session?.status) set.add(f.session.status);
    });
    return Array.from(set);
  }, [localFiles]);

  const uniqueGroupStatuses = useMemo(() => {
    const set = new Set<string>();
    localFiles.forEach((f) => {
      if (f.session?.group?.status) set.add(f.session.group.status);
    });
    return Array.from(set);
  }, [localFiles]);

  const relatedQueueItems = queue.filter((item) =>
    item.patientId === patientId && (variant === "patient" || item.sessionId === normalizedSessionId)
  );

  const handleFiles = (nextFiles: FileList | null) => {
    if (!clinicId || disabledReason || !nextFiles) return;

    Array.from(nextFiles).forEach((file) => {
      const validation = validatePatientFileUploadCandidate(file);
      if (!validation.isValid) {
        toast({ title: file.name, description: validation.errors.join(" "), variant: "destructive" });
        return;
      }

      enqueuePatientFileUpload({
        clinicId,
        file,
        patientId,
        sessionId: normalizedSessionId,
      });
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {/* Header Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">{title}</h2>
              {variant === "session" ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    PDFs e imagens são otimizados no navegador antes do envio para o storage privado.
                  </p>
                  {disabledReason ? <p className="mt-1 text-sm text-warning">{disabledReason}</p> : null}
                </>
              ) : null}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void refreshFiles()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Atualizar
            </Button>
          </div>

          {variant === "session" ? (
            <>
              <div className="grid gap-2 sm:grid-cols-3">
                <Button type="button" onClick={() => pdfInputRef.current?.click()} disabled={!canUpload}>
                  <FileText className="mr-2 h-4 w-4" />
                  Enviar PDF
                </Button>
                <Button type="button" variant="secondary" onClick={() => imageInputRef.current?.click()} disabled={!canUpload}>
                  <FileImage className="mr-2 h-4 w-4" />
                  Enviar imagens
                </Button>
                <Button type="button" variant="outline" onClick={() => docInputRef.current?.click()} disabled={!canUpload}>
                  <FileText className="mr-2 h-4 w-4 text-blue-500" />
                  Enviar DOC/DOCX
                </Button>
              </div>

              <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => {
                  handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <input
                ref={docInputRef}
                type="file"
                accept="application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
                multiple
                className="hidden"
                onChange={(event) => {
                  handleFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </>
          ) : null}

          {variant === "patient" ? (
            <div className="flex items-center gap-3 w-full">
              <div className="relative flex-1">
                <Input 
                  id="patient-file-search" 
                  value={searchTerm} 
                  onChange={(event) => setSearchTerm(event.target.value)} 
                  placeholder="Buscar arquivo por nome..." 
                  className="pl-4"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    className={getDesignLabButtonClass("hover:w-[108px]")}
                    aria-label={activeFilterCount > 0 ? `Filtro, ${activeFilterCount} ativos` : "Filtro"}
                  >
                    <ListFilter className={designLabIconClass} />
                    <span className={designLabLabelClass}>Filtro</span>
                    {activeFilterCount > 0 && <Badge variant="secondary" className="ml-1 shrink-0">{activeFilterCount}</Badge>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4" align="end">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-3">Filtros de Arquivos</h4>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tipo</Label>
                      <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as FileTypeFilter)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="pdf">PDF</SelectItem>
                          <SelectItem value="image">Imagem</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status de Envio</Label>
                      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as FileStatusFilter)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="pending">Processando</SelectItem>
                          <SelectItem value="uploaded">Enviado</SelectItem>
                          <SelectItem value="failed">Falhou</SelectItem>
                          <SelectItem value="deleted">Removido</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Grupo</Label>
                      <Select value={groupFilter} onValueChange={setGroupFilter}>
                        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueGroups.map((g) => (
                            <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status da Sessão</Label>
                      <Select value={sessionStatusFilter} onValueChange={setSessionStatusFilter}>
                        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueSessionStatuses.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {relatedQueueItems.length > 0 ? (
        <div className="space-y-2">
          {relatedQueueItems.map((item) => (
            <div key={item.id} className="rounded-lg border bg-background p-3 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.fileName}</p>
                  <p className="text-xs text-muted-foreground">{queueStatusLabels[item.status] ?? item.status}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {item.status === "failed" && item.diagnosticError ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label="Abrir diagnóstico do erro"
                      onClick={() => setSelectedDiagnostic(item.diagnosticError)}
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  ) : null}
                  <Badge variant="outline" className={item.status === "failed" ? statusClassNames.failed : ""}>
                    {item.progress}%
                  </Badge>
                </div>
              </div>
              <Progress value={item.progress} className="mt-2 h-2" />
              {item.error ? <p className="mt-2 text-xs text-destructive">{item.error}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      {visibleFiles.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground bg-card shadow-sm">
          Nenhum arquivo registrado.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {visibleFiles.map((file) => (
            <FileThumbnailCard 
              key={file.id} 
              file={file} 
              showSessionLink={variant === "patient"} 
            />
          ))}
        </div>
      )}

      <ErrorDiagnosticDialog
        diagnostic={selectedDiagnostic}
        open={Boolean(selectedDiagnostic)}
        onOpenChange={(open) => {
          if (!open) setSelectedDiagnostic(null);
        }}
      />
    </div>
  );
};
