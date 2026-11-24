import type { FC } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export const PatientTabSkeleton: FC = () => (
  <div
    className="w-full max-w-full min-w-0 space-y-4 py-2 animate-in fade-in duration-200"
    aria-busy="true"
    aria-label="Carregando seção do paciente"
  >
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
      <Skeleton className="h-20 rounded-2xl" />
    </div>
    <Skeleton className="h-36 w-full rounded-2xl" />
    <div className="space-y-2.5">
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-16 w-full rounded-xl" />
    </div>
  </div>
);
