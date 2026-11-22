import React, { useState, useEffect } from "react";
import { Award, Bot, Cpu, Palette, Workflow } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlatformAffiliatesPage } from "./PlatformAffiliatesPage";
import { PlatformAutoLeadsView } from "./auto-leads";
import { PlatformMarketingAgentsView } from "./marketing-agents";
import { PlatformMarketingStudioView } from "./marketing-studio";
import { PlatformMarketingFlowsView } from "./marketing-flows";

export type MarketingSubtab = "afiliados" | "auto-lead" | "agentes" | "studio" | "fluxos";

export interface PlatformMarketingPageProps {
  initialSubtab?: MarketingSubtab;
}

function readSubtabFromUrl(): MarketingSubtab | null {
  if (typeof window === "undefined") return null;
  try {
    const param = new URLSearchParams(window.location.search).get("subtab");
    if (
      param === "auto-lead" ||
      param === "afiliados" ||
      param === "agentes" ||
      param === "studio" ||
      param === "fluxos"
    ) {
      return param;
    }
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
    const valid: MarketingSubtab =
      next === "auto-lead" || next === "agentes" || next === "studio" || next === "fluxos"
        ? next
        : "afiliados";
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
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-xl border bg-card/60 p-3 shadow-2xs">
          <div className="space-y-0.5 min-w-0">
            <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground">
              Central de Marketing & Pluri Growth OS
            </h2>
            <p className="text-xs text-muted-foreground">
              Afiliados, Auto-Lead, Agentes WhatsApp IA (Chip (11) 96512-0431), CrabStudio e Fluxos DAG.
            </p>
          </div>

          <div className="w-full lg:w-auto overflow-x-auto touch-pan-x pb-0.5">
            <TabsList className="inline-flex sm:grid sm:grid-cols-5 w-max sm:w-auto h-auto p-1 gap-1">
              <TabsTrigger
                value="afiliados"
                data-testid="marketing-subtab-affiliates"
                className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
              >
                <Award className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Afiliados</span>
              </TabsTrigger>
              <TabsTrigger
                value="auto-lead"
                data-testid="marketing-subtab-auto-lead"
                className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
              >
                <Bot className="h-4 w-4 text-primary shrink-0" />
                <span>Auto-Lead</span>
              </TabsTrigger>
              <TabsTrigger
                value="agentes"
                data-testid="marketing-subtab-agentes"
                className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
              >
                <Cpu className="h-4 w-4 text-emerald-500 shrink-0" />
                <span>Agentes</span>
              </TabsTrigger>
              <TabsTrigger
                value="studio"
                data-testid="marketing-subtab-studio"
                className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
              >
                <Palette className="h-4 w-4 text-sky-500 shrink-0" />
                <span>CrabStudio</span>
              </TabsTrigger>
              <TabsTrigger
                value="fluxos"
                data-testid="marketing-subtab-fluxos"
                className="gap-1.5 text-xs min-h-[44px] sm:min-h-[38px] px-3 whitespace-nowrap"
              >
                <Workflow className="h-4 w-4 text-violet-500 shrink-0" />
                <span>Fluxos</span>
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="afiliados" className="mt-0">
          <PlatformAffiliatesPage />
        </TabsContent>

        <TabsContent value="auto-lead" className="mt-0">
          <PlatformAutoLeadsView />
        </TabsContent>

        <TabsContent value="agentes" className="mt-0">
          <PlatformMarketingAgentsView />
        </TabsContent>

        <TabsContent value="studio" className="mt-0">
          <PlatformMarketingStudioView />
        </TabsContent>

        <TabsContent value="fluxos" className="mt-0">
          <PlatformMarketingFlowsView />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlatformMarketingPage;
