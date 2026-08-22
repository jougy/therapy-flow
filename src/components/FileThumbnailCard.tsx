import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Download, FileImage, FileText, Loader2, MoreVertical, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { PatientFileUploadRow, usePatientFilesContext } from "@/contexts/PatientFilesContext";
import { isPatientFileUploadImage } from "@/lib/patient-file-upload-queue";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

export function FileThumbnailCard({
  file,
  showSessionLink = false,
}: {
  file: PatientFileUploadRow;
  showSessionLink?: boolean;
}) {
  const navigate = useNavigate();
  const { handlePreview, handleDownload, handleDelete, deletingUploadId } = usePatientFilesContext();
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

  const isImage = isPatientFileUploadImage(file.original_content_type ?? file.content_type);
  const isDeleting = deletingUploadId === file.id;
  const rawContentType = (file.original_content_type ?? file.content_type ?? "").split(";")[0].trim().toLowerCase();
  const isDoc =
    rawContentType === "application/msword" ||
    rawContentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (file.original_filename ?? "").toLowerCase().endsWith(".doc") ||
    (file.original_filename ?? "").toLowerCase().endsWith(".docx");

  const Icon = isImage ? FileImage : FileText;
  const iconColorClass = isImage ? "text-blue-500" : isDoc ? "text-blue-700" : "text-red-500";
  const iconBgClass = isImage ? "bg-blue-500/10" : isDoc ? "bg-blue-700/10" : "bg-red-500/10";

  const formattedDate = file.created_at
    ? format(new Date(file.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })
    : "Data desconhecida";

  return (
    <>
      <div 
        className="group relative flex h-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md"
        style={file.session?.group?.color ? { borderLeftWidth: '4px', borderLeftColor: file.session.group.color } : undefined}
      >
        {/* Dropdown Menu no canto superior direito */}
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-background/80 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                aria-label="Opções do arquivo"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void handleDownload(file)}>
                <Download className="mr-2 h-4 w-4" />
                Baixar arquivo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={() => setDeleteAlertOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Descartar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Área clicável principal para o Preview */}
        <button
          type="button"
          onClick={() => void handlePreview(file)}
          className="flex flex-1 flex-col p-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          disabled={isDeleting}
        >
          {/* Box da Miniatura Genérica */}
          <div className="relative flex w-full items-center justify-center bg-muted/40 p-10 transition-colors group-hover:bg-muted/60 min-h-[140px]">
            {/* Badges / Tags */}
            <div className="absolute left-2 top-2 flex flex-col gap-1 items-start pointer-events-none z-10">
              {file.session?.group && (
                <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-[10px] shadow-sm font-semibold truncate max-w-[120px]">
                  {file.session.group.name}
                </Badge>
              )}
              {file.session?.status && (
                <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-[10px] shadow-sm uppercase">
                  {file.session.status.replace("_", " ")}
                </Badge>
              )}
              {file.original_byte_size && file.stored_byte_size && file.stored_byte_size < file.original_byte_size ? (
                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">
                  {`${Math.round(((file.original_byte_size - file.stored_byte_size) / file.original_byte_size) * 100)}% menor`}
                </Badge>
              ) : null}
              {file.compression_profile && (
                <Badge variant="outline" className="bg-background/80 backdrop-blur-sm text-[10px] text-muted-foreground">
                  {file.compression_profile}
                </Badge>
              )}
              {file.compression_profile === "pdf-clinical-raster-v1" && (
                <span className="text-[10px] text-amber-600 font-medium">Arquivo otimizado para armazenamento</span>
              )}
            </div>

            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${iconBgClass}`}>
              {isDeleting ? (
                <Loader2 className={`h-8 w-8 animate-spin ${iconColorClass}`} />
              ) : (
                <Icon className={`h-8 w-8 ${iconColorClass}`} />
              )}
            </div>
          </div>

          {/* Informações do Arquivo */}
          <div className="flex w-full flex-1 flex-col gap-1.5 border-t p-4 text-left">
            <h3 className="line-clamp-2 text-sm font-medium leading-snug" title={file.original_filename}>
              {file.original_filename}
            </h3>
            <div className="mt-auto flex flex-col items-start gap-2 pt-1">
              <span className="text-xs text-muted-foreground">{formattedDate}</span>
              {showSessionLink && file.session_id && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/atendimentos/${file.session_id}`);
                  }}
                >
                  Ver Sessão
                </Badge>
              )}
            </div>
          </div>
        </button>
      </div>

      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar arquivo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o arquivo do storage privado e da lista do paciente. Não será possível recuperar este envio pela plataforma.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void handleDelete(file);
                setDeleteAlertOpen(false);
              }}
            >
              Descartar definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
