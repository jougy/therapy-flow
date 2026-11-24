import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SessaoDetalheSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Carregando atendimento"
      className="mx-auto w-full min-w-0 max-w-full space-y-6 px-1 pb-24 sm:pb-8 sm:max-w-[min(100vw-2rem,1680px)] sm:px-6 lg:max-w-[min(100vw-3rem,1760px)] overflow-x-hidden"
    >
      {/* Cabeçalho Skeleton */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="min-w-0 space-y-2">
              <Skeleton className="h-6 w-48 max-w-full rounded-md" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-10 w-28 rounded-lg" />
            <Skeleton className="h-10 w-36 rounded-lg" />
          </div>
        </div>
      </div>

      {/* Cards de resumo Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-6 w-40 rounded-md" />
            <Skeleton className="h-3.5 w-32 rounded" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-6 w-36 rounded-md" />
            <Skeleton className="h-3.5 w-44 rounded" />
          </CardContent>
        </Card>
        <Card className="md:col-span-2 xl:col-span-1">
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-6 w-44 rounded-md" />
            <Skeleton className="h-3.5 w-28 rounded" />
          </CardContent>
        </Card>
      </div>

      {/* Bloco principal Skeleton */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex gap-2 overflow-hidden">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  );
}
