import React, { useState } from "react";
import {
  Calendar,
  CheckSquare,
  Clock,
  Download,
  Eye,
  FileText,
  Heart,
  Layers,
  List,
  MapPin,
  Sliders,
  Sparkles,
  Table,
  Tag,
  Trash2,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { type CommunityFormTemplate, toggleLikeCommunityTemplate } from "@/lib/community-forms";
import { type AnamnesisField } from "@/lib/anamnesis-forms";

interface CommunityFormCardProps {
  template: CommunityFormTemplate;
  onPreview?: (template: CommunityFormTemplate) => void;
  onImport: (template: CommunityFormTemplate) => void;
  onDelete?: (template: CommunityFormTemplate) => void;
  onOpenDetail?: (template: CommunityFormTemplate) => void;
  isOwner?: boolean;
}

const CATEGORY_COLORS: Record<string, { badge: string; bgGradient: string; borderAccent: string }> = {
  Psicologia: {
    badge: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    bgGradient: "from-purple-500/10 via-purple-500/5 to-transparent",
    borderAccent: "border-purple-500/30",
  },
  Fisioterapia: {
    badge: "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    bgGradient: "from-blue-500/10 via-blue-500/5 to-transparent",
    borderAccent: "border-blue-500/30",
  },
  Fonoaudiologia: {
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    bgGradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    borderAccent: "border-emerald-500/30",
  },
  "Terapia Ocupacional": {
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    bgGradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    borderAccent: "border-amber-500/30",
  },
  Nutrição: {
    badge: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300 border-green-200 dark:border-green-800",
    bgGradient: "from-green-500/10 via-green-500/5 to-transparent",
    borderAccent: "border-green-500/30",
  },
  Psiquiatria: {
    badge: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
    bgGradient: "from-indigo-500/10 via-indigo-500/5 to-transparent",
    borderAccent: "border-indigo-500/30",
  },
  Neuropsicologia: {
    badge: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    bgGradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    borderAccent: "border-rose-500/30",
  },
  Pediatria: {
    badge: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 border-teal-200 dark:border-teal-800",
    bgGradient: "from-teal-500/10 via-teal-500/5 to-transparent",
    borderAccent: "border-teal-500/30",
  },
  Geral: {
    badge: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-800",
    bgGradient: "from-slate-500/10 via-slate-500/5 to-transparent",
    borderAccent: "border-slate-500/30",
  },
};

/**
 * Mini Blueprint / Wireframe visual mockup of the form
 */
const MiniFormBlueprint = ({
  previewFields,
  totalCount,
}: {
  previewFields?: AnamnesisField[];
  totalCount: number;
}) => {
  const visibleFields = (previewFields || []).slice(0, 4);

  return (
    <div className="w-full h-28 bg-muted/40 p-3 rounded-t-lg border-b overflow-hidden relative select-none flex flex-col justify-between group-hover:bg-muted/60 transition-colors">
      {/* Blueprint grid lines */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(120,120,120,0.15)_1px,transparent_1px)] [background-size:8px_8px] pointer-events-none" />

      <div className="space-y-1.5 z-10 relative">
        {visibleFields.map((field, idx) => {
          if (field.type === "section" || field.type === "horizontal_section" || field.type === "section_selector") {
            return (
              <div key={idx} className="h-4 w-4/5 rounded bg-primary/15 flex items-center px-1.5 gap-1 border border-primary/20">
                <Layers className="h-2.5 w-2.5 text-primary" />
                <span className="text-[9px] font-semibold text-primary truncate">{field.label || "Seção"}</span>
              </div>
            );
          }

          if (field.type === "slider") {
            return (
              <div key={idx} className="h-4 w-full bg-background/80 border rounded px-2 flex items-center justify-between shadow-2xs">
                <span className="text-[8px] text-muted-foreground truncate">{field.label}</span>
                <div className="w-12 h-1 bg-primary/30 rounded-full relative">
                  <div className="absolute left-1/2 -top-0.5 h-2 w-2 rounded-full bg-primary" />
                </div>
              </div>
            );
          }

          if (field.type === "checklist" || field.type === "multiple_choice") {
            return (
              <div key={idx} className="h-4 w-full bg-background/80 border rounded px-1.5 flex items-center gap-1.5 shadow-2xs">
                <div className="h-2 w-2 rounded-xs border border-primary/60 bg-primary/10" />
                <span className="text-[8px] text-muted-foreground truncate">{field.label}</span>
              </div>
            );
          }

          if (field.type === "table") {
            return (
              <div key={idx} className="h-4 w-full bg-background/80 border rounded px-1.5 flex items-center gap-1 shadow-2xs">
                <Table className="h-2.5 w-2.5 text-muted-foreground" />
                <div className="flex-1 grid grid-cols-2 gap-1">
                  <div className="h-1.5 bg-muted rounded" />
                  <div className="h-1.5 bg-muted rounded" />
                </div>
              </div>
            );
          }

          // default text / date / number
          return (
            <div key={idx} className="h-4 w-full bg-background/80 border rounded px-1.5 flex items-center justify-between shadow-2xs">
              <span className="text-[8px] text-muted-foreground truncate">{field.label}</span>
              <div className="h-1.5 w-8 bg-muted/80 rounded" />
            </div>
          );
        })}
      </div>

      {totalCount > 4 && (
        <div className="z-10 flex justify-end">
          <span className="text-[9px] font-medium text-muted-foreground bg-background/90 px-1.5 py-0.5 rounded shadow-2xs border">
            +{totalCount - 4} outros campos
          </span>
        </div>
      )}
    </div>
  );
};

export const CommunityFormCard: React.FC<CommunityFormCardProps> = ({
  template,
  onPreview,
  onImport,
  onDelete,
  onOpenDetail,
  isOwner = false,
}) => {
  const [likesCount, setLikesCount] = useState(template.likes_count);
  const [hasLiked, setHasLiked] = useState(template.has_liked ?? false);
  const [isLiking, setIsLiking] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLiking) return;
    setIsLiking(true);
    try {
      const res = await toggleLikeCommunityTemplate(template.id);
      setHasLiked(res.liked);
      setLikesCount(res.likes_count);
    } finally {
      setIsLiking(false);
    }
  };

  const displayFieldsCount = template.fields_count || template.schema?.length || 0;
  const styleConfig = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.Geral;

  const handleClickCard = () => {
    if (onOpenDetail) {
      onOpenDetail(template);
    } else if (onPreview) {
      onPreview(template);
    }
  };

  return (
    <Card
      onClick={handleClickCard}
      className="flex flex-col justify-between transition-all duration-200 hover:shadow-lg hover:border-primary/50 group relative overflow-hidden bg-card cursor-pointer"
    >
      {/* Featured Ribbon */}
      {template.is_featured && (
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-gradient-to-l from-amber-500 to-amber-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Destaque
          </div>
        </div>
      )}

      <div>
        {/* Dynamic Form Blueprint / Wireframe preview header */}
        <MiniFormBlueprint
          previewFields={template.preview_fields || template.schema}
          totalCount={displayFieldsCount}
        />

        <CardHeader className="p-4 pb-2">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <Badge variant="outline" className={`text-xs font-medium border ${styleConfig.badge}`}>
              {template.category}
            </Badge>
            {template.kind === "base" && (
              <Badge variant="secondary" className="text-[10px]">
                Bloco Base
              </Badge>
            )}
          </div>

          <CardTitle className="text-sm sm:text-base font-bold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {template.title}
          </CardTitle>

          {template.description && (
            <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1 leading-relaxed">
              {template.description}
            </CardDescription>
          )}
        </CardHeader>

        <CardContent className="px-4 py-2 space-y-2.5">
          {/* Tags */}
          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 3).map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded"
                >
                  <Tag className="h-2 w-2 opacity-50" />
                  {tag}
                </span>
              ))}
              {template.tags.length > 3 && (
                <span className="text-[10px] text-muted-foreground self-center">
                  +{template.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Author info & metrics */}
          <div className="pt-2 border-t flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate max-w-[150px]" title={template.author_name}>
              <User className="h-3 w-3 shrink-0 opacity-70" />
              <span className="truncate text-[11px] font-medium">{template.author_name}</span>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="flex items-center gap-1 text-[11px]" title="Campos cadastrados">
                <Layers className="h-3 w-3 opacity-70" />
                {fieldsCount}
              </span>

              <button
                type="button"
                onClick={handleLike}
                disabled={isLiking}
                className={`flex items-center gap-1 text-[11px] transition-colors hover:text-rose-500 ${
                  hasLiked ? "text-rose-500 font-semibold" : "text-muted-foreground"
                }`}
                title="Favoritar este modelo"
              >
                <Heart className={`h-3 w-3 ${hasLiked ? "fill-rose-500" : ""}`} />
                {likesCount}
              </button>
            </div>
          </div>
        </CardContent>
      </div>

      <CardFooter
        className="p-3.5 pt-2.5 bg-muted/15 border-t flex items-center gap-2 justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Download className="h-3 w-3 opacity-70" />
          <span>{template.imports_count} usos</span>
        </div>

        <div className="flex items-center gap-1.5">
          {isOwner && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => onDelete(template)}
              title="Excluir da biblioteca"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={handleClickCard}
          >
            <Eye className="h-3 w-3" />
            Ver Detalhes
          </Button>

          <Button
            size="sm"
            className="h-7 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onImport(template)}
          >
            <Download className="h-3 w-3" />
            Importar
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
