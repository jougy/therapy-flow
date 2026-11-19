import React, { useState, useEffect } from "react";
import { Award, Bot } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformAffiliatesPage } from "./PlatformAffiliatesPage";
import { PlatformAutoLeadsView } from "./auto-leads";

export type MarketingSubtab = "afiliados" | "auto-lead";

export interface PlatformMarketingPageProps {
  initialSubtab?: MarketingSubtab;
}

function readSubtabFromUrl(): MarketingSubtab | null {
  if (typeof window === "undefined") return null;
  try {
    const param = new URLSearchParams(window.location.search).get("subtab");
    if (param === "auto-lead" || param === "afiliados") return param;
  } catch {
    // ignore URL parsing issues
  }
  return null;
}

export const PlatformMarketingPage: React.FC<PlatformMarketingPageProps> = ({
  initialSubtab,
}) => {
  const [subtab, setSubtab] = useState<MarketingSubtab>(
    () => initialSubtab || readSubtabFromUrl() || "afiliados"
  );

  useEffect(() => {
    if (initialSubtab) {
      setSubtab(initialSubtab);
    }
  }, [initialSubtab]);

  const handleSubtabChange = (next: string) => {
    const valid: MarketingSubtab = next === "auto-lead" ? "auto-lead" : "afiliados";
    setSubtab(valid);
    if (typeof window !== "undefined" && window.history?.replaceState) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("subtab", valid);
        window.history.replaceState({}, "", url.toString());
      } catch {
        // ignore history error
      }
    }
  };

  return (
    <div
      data-testid="platform-marketing-page"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-5"
    >
      <Tabs
        value={subtab}
        onValueChange={handleSubtabChange}
        className="w-full max-w-full min-w-0 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border bg-card/60 p-3 shadow-2xs">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Central de Marketing & Crescimento
            </h2>
            <p className="text-xs text-muted-foreground">
              Alterne entre a gestão de Afiliados/Parceiros e o pipeline autônomo de Auto-Lead (Apify + Lindy AI + Agendas).
            </p>
          </div>

          <TabsList className="grid grid-cols-2 w-full sm:w-auto h-auto p-1">
            <TabsTrigger
              value="afiliados"
              data-testid="marketing-subtab-affiliates"
              className="gap-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[38px] px-4"
            >
              <Award className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Afiliados</span>
            </TabsTrigger>
            <TabsTrigger
              value="auto-lead"
              data-testid="marketing-subtab-auto-lead"
              className="gap-2 text-xs sm:text-sm min-h-[44px] sm:min-h-[38px] px-4"
            >
              <Bot className="h-4 w-4 text-primary shrink-0" />
              <span>Auto-Lead</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="afiliados" className="mt-0">
          <PlatformAffiliatesPage />
        </TabsContent>

        <TabsContent value="auto-lead" className="mt-0">
          <PlatformAutoLeadsView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlatformMarketingPage;
