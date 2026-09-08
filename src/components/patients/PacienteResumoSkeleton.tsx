import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LoadingFeedback } from "@/components/ui/loading-feedback";

interface PacienteResumoSkeletonProps {
  onRetry?: () => void;
}

export const PacienteResumoSkeleton: React.FC<PacienteResumoSkeletonProps> = ({ onRetry }) => {
  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in duration-300">
      {/* Cabeçalho Skeleton */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <Skeleton className="h-8 w-36 rounded-lg" />
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-7 w-52 rounded-md" />
            </div>
            <Skeleton className="h-4 w-40 rounded-md" />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-4 w-28 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
        </div>

        {/* Ações do cabeçalho */}
        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
        </div>
      </div>

      {/* Abas Skeleton (Mobile-first com scroll suave e affordance) */}
      <div className="relative w-full">
        <div className="flex w-full overflow-x-auto overscroll-x-contain gap-1.5 p-1.5 rounded-2xl bg-muted/40 [-webkit-overflow-scrolling:touch] no-scrollbar">
          <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-xl" />
          <Skeleton className="h-9 w-24 shrink-0 rounded-xl" />
          <Skeleton className="h-9 w-28 shrink-0 rounded-xl" />
          <Skeleton className="h-9 w-32 shrink-0 rounded-xl" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/80 to-transparent rounded-r-2xl sm:hidden"
        />
      </div>

      {/* Bloco de feedback dinâmico progressivo com LoadingFeedback */}
      <div className="rounded-2xl border border-border/70 bg-card/50 p-2 shadow-xs">
        <LoadingFeedback
          message="Carregando resumo clínico do paciente..."
          onRetry={onRetry}
          className="py-6"
        />
      </div>

      {/* Card estrutural com grids de campos do resumo */}
      <Card className="border-border/70 shadow-xs">
        <CardHeader className="pb-3 space-y-2">
          <Skeleton className="h-5 w-44 rounded-md" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-muted/20 px-4 py-3 space-y-2">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
