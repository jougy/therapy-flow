import React from "react";
import { Building2, Clock3, Stethoscope, UsersRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PlatformDirectoryItem } from "./types";
import { compactDocument, itemLabels, metadataNumber } from "./platform-api";
import { getEntityTheme } from "./directory-utils";

export interface DirectoryPillProps {
  icon: LucideIcon;
  label: string;
  value: number;
  colorClass?: string;
}

export const DirectoryPill: React.FC<DirectoryPillProps> = ({
  icon: Icon,
  label,
  value,
  colorClass = "bg-primary/10 text-primary",
}) => (
  <div className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm">
    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorClass}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  </div>
);

export interface DirectoryCardProps {
  item: PlatformDirectoryItem;
  onClick: () => void;
}

export const DirectoryCard: React.FC<DirectoryCardProps> = ({ item, onClick }) => {
  const isPending = Boolean(item.metadata?.is_pending_registration);
  const isOwner = Boolean(item.metadata?.is_owner);
  const Icon = item.item_type === "clinic" ? Building2 : item.item_type === "account" ? (isPending ? Clock3 : UsersRound) : Stethoscope;
  const theme = getEntityTheme(item.item_type, isOwner, isPending);

  const renderStatusBadge = () => {
    if (isPending) {
      if (item.status === "unconfirmed_email") return <Badge variant="destructive">E-mail não verificado</Badge>;
      if (item.status === "pending_login") return <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">Aguardando login</Badge>;
      return <Badge variant="outline" className="border-amber-500/40 text-amber-600 dark:text-amber-400">Convite pendente</Badge>;
    }
    if (item.status === "expiring_soon") return <Badge className="bg-amber-500/15 text-amber-800 border-amber-400/40">Vence em breve</Badge>;
    if (item.status === "expired") return <Badge variant="destructive">Vencido / Expirado</Badge>;
    if (item.status === "banned") return <Badge variant="destructive">Bloqueado</Badge>;
    if (item.status === "paused") return <Badge variant="secondary">Pausado</Badge>;
    if (item.status === "personal") return <Badge variant="outline" className="border-blue-500/40 text-blue-600">Conta Pessoal</Badge>;
    if (item.status === "active") {
      const pausedCount = (item.metadata?.paused_clinics_count as number) || 0;
      const showPausedBadge =
        item.item_type === "account" &&
        (pausedCount > 0 || Boolean(item.metadata?.has_mixed_statuses));
      const pausedLabel =
        pausedCount > 0
          ? `${pausedCount} ${pausedCount === 1 ? "clínica pausada" : "clínicas pausadas"}`
          : "vínculo pausado";

      return (
        <>
          <Badge
            variant="outline"
            className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 font-medium"
          >
            Ativo
          </Badge>
          {showPausedBadge && (
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 font-normal"
            >
              {pausedLabel}
            </Badge>
          )}
        </>
      );
    }
    return item.status ? <Badge variant="outline">{item.status}</Badge> : null;
  };

  return (
    <button
      type="button"
      className={`grid w-full gap-3 rounded-xl border p-4 text-left shadow-sm transition-colors ${theme.cardBorderHover} hover:bg-accent/40 grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_auto] ${
        theme.cardBg ?? "bg-card"
      }`}
      onClick={onClick}
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${theme.iconBg} ${theme.iconText}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-base font-semibold text-foreground">{item.title}</p>
          <Badge className={`border font-medium ${theme.badgeClass}`}>
            {isPending ? "Pendente" : isOwner ? "Owner" : itemLabels[item.item_type]}
          </Badge>
          {renderStatusBadge()}
          {isPending && (
            <Badge className="bg-amber-500/15 text-amber-900 dark:text-amber-200 border-amber-400/30 text-[10px]">
              Pendência de cadastro
            </Badge>
          )}
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {item.metadata?.pending_reason ? String(item.metadata.pending_reason) : (item.subtitle ?? item.clinic_name ?? "Sem subtítulo")}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{compactDocument(item.primary_document)}</span>
          {item.secondary_document && <span>{item.secondary_document}</span>}
          {item.item_type === "account" && metadataNumber(item.metadata, "clinics_count") > 1 ? (
            <Badge variant="outline" className="border-purple-500/40 text-purple-600 dark:text-purple-300 font-normal">
              {metadataNumber(item.metadata, "clinics_count")} clínicas associadas
            </Badge>
          ) : (
            item.clinic_name && item.item_type !== "clinic" && <span>{item.clinic_name}</span>
          )}
          {typeof item.metadata?.age === "number" && <span>{item.metadata.age} anos</span>}
          {item.created_at && (
            <span className="font-mono text-neutral-500">
              {isPending ? "Convidado em: " : "Cadastrado: "}
              {new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      </div>
      {item.item_type === "clinic" && (
        <div className="col-span-2 md:col-span-1 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground pt-2 md:pt-0 border-t md:border-t-0 md:min-w-48">
          <span><strong className="block text-sm text-foreground">{metadataNumber(item.metadata, "team_count")}</strong>equipe</span>
          <span><strong className="block text-sm text-foreground">{metadataNumber(item.metadata, "patients_count")}</strong>pacientes</span>
          <span><strong className="block text-sm text-foreground">{metadataNumber(item.metadata, "sessions_count")}</strong>atend.</span>
        </div>
      )}
    </button>
  );
};
