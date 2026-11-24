import { useRef, useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ExternalLink, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { compressImageToWebp } from "@/lib/image-compression";
import { getPatientPath } from "@/lib/patient-routing";
import { cn } from "@/lib/utils";

interface PatientAvatarProps {
  patientId: string;
  patientCode?: string | null;
  patientName: string;
  avatarUrl?: string | null;
  gender?: string | null;
  size?: "sm" | "md";
  showViewPatientAction?: boolean;
  onAvatarUpdated?: (newAvatarUrl: string | null) => void;
  className?: string;
}

const sizeClasses = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
} as const;

const iconSizeClasses = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
} as const;

export function PatientAvatar({
  patientId,
  patientCode,
  patientName,
  avatarUrl,
  gender,
  size = "sm",
  showViewPatientAction = false,
  onAvatarUpdated,
  className,
}: PatientAvatarProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null | undefined>(avatarUrl);

  const effectiveAvatarUrl = localAvatarUrl !== undefined ? localAvatarUrl : avatarUrl;

  const handleOpenModal = (event: SyntheticEvent) => {
    event.stopPropagation();
    setLocalAvatarUrl(avatarUrl);
    setOpen(true);
  };

  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    try {
      const webpDataUrl = await compressImageToWebp(file, {
        maxSize: 256,
        quality: 0.62,
        targetMaxBytes: 28_000,
      });

      const { error } = await supabase
        .from("patients")
        .update({ avatar_url: webpDataUrl })
        .eq("id", patientId);

      if (error) throw error;

      setLocalAvatarUrl(webpDataUrl);
      onAvatarUpdated?.(webpDataUrl);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["patients"] }),
        queryClient.invalidateQueries({ queryKey: ["patient", patientId] }),
      ]);
      toast.success("Foto de perfil atualizada.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar foto de perfil.";
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewPatient = () => {
    setOpen(false);
    navigate(getPatientPath({ id: patientId, patient_code: patientCode }));
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpenModal}
        title={`Foto de perfil de ${patientName}`}
        aria-label={`Ver ou alterar foto de perfil de ${patientName}`}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full border border-border/70 bg-muted/60 text-muted-foreground hover:border-primary/50 hover:bg-muted transition-colors shrink-0 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          sizeClasses[size],
          className,
        )}
      >
        {effectiveAvatarUrl ? (
          <img
            src={effectiveAvatarUrl}
            alt={patientName}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : gender === "feminino" ? (
          <span className="text-xs font-medium leading-none" aria-hidden="true">♀</span>
        ) : gender === "masculino" ? (
          <span className="text-xs font-medium leading-none" aria-hidden="true">♂</span>
        ) : (
          <User className={iconSizeClasses[size]} aria-hidden="true" />
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl p-5"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="truncate text-base">{patientName}</DialogTitle>
            <DialogDescription className="text-xs">
              Foto de perfil do paciente (compactada em WebP)
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center py-2">
            {effectiveAvatarUrl ? (
              <img
                src={effectiveAvatarUrl}
                alt={patientName}
                className="h-56 w-56 sm:h-64 sm:w-64 rounded-2xl object-cover border border-border shadow-sm"
              />
            ) : (
              <div className="flex h-56 w-56 sm:h-64 sm:w-64 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/40 text-muted-foreground">
                <User className="h-16 w-16 opacity-60" />
                <span className="text-xs">Sem foto de perfil</span>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            disabled={isUploading}
          />

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-center">
            {showViewPatientAction && (
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto min-h-[44px]"
                onClick={handleViewPatient}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Ver paciente
              </Button>
            )}
            <Button
              type="button"
              className="w-full sm:w-auto min-h-[44px]"
              onClick={handleTriggerFileInput}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              {effectiveAvatarUrl ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
