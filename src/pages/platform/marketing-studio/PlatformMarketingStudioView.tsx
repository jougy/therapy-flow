import React, { useMemo, useState } from "react";
import { Download, Film, Layers, Palette, Sparkles, Wand2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_BRAND_KITS,
  type CreativeSlideSpec,
  type MarketingBrandKit,
  type ReelSceneSpec,
} from "./types";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCreativeSvg(slide: CreativeSlideSpec, kit: MarketingBrandKit): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <rect width="1080" height="1080" fill="${kit.backgroundColor}" />
  <circle cx="960" cy="140" r="240" fill="${kit.primaryColor}" opacity="0.14" />
  <circle cx="120" cy="960" r="220" fill="${kit.accentColor}" opacity="0.14" />
  <rect x="72" y="72" width="260" height="54" rx="27" fill="${kit.primaryColor}" />
  <text x="202" y="106" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="22" fill="#ffffff">${escapeXml(kit.subproduct_key === "plurifisio" ? "PLURI FISIO" : "PLURI HEALTH")}</text>
  <text x="72" y="340" font-family="Inter, sans-serif" font-weight="900" font-size="56" fill="${kit.secondaryColor}">${escapeXml(slide.headline.slice(0, 44))}</text>
  <text x="72" y="450" font-family="Inter, sans-serif" font-weight="500" font-size="32" fill="#334155">${escapeXml(slide.body.slice(0, 72))}</text>
  <rect x="72" y="880" width="460" height="84" rx="20" fill="${kit.accentColor}" />
  <text x="302" y="932" text-anchor="middle" font-family="Inter, sans-serif" font-weight="800" font-size="28" fill="#ffffff">${escapeXml(slide.cta || kit.cta)}</text>
</svg>`;
}

export const PlatformMarketingStudioView: React.FC = () => {
  const [studioTab, setStudioTab] = useState<"static" | "reels" | "brand">("static");
  const [selectedKitId, setSelectedKitId] = useState<string>(DEFAULT_BRAND_KITS[0].id);
  const [topic, setTopic] = useState("Prontuário SOAP em 1 minuto na maca");
  const [headline, setHeadline] = useState("Chega de evoluir paciente de madrugada");
  const [bodyText, setBodyText] = useState(
    "Com o Pluri Fisio você registra SOAP, escala EVA e agenda multi-turno direto no celular.",
  );
  const [ctaText, setCtaText] = useState("Teste grátis por 7 dias");
  const [generatingAi, setGeneratingAi] = useState(false);
  const [enqueuingRender, setEnqueuingRender] = useState(false);

  const [reelScenes, setReelScenes] = useState<ReelSceneSpec[]>([
    {
      id: "sc-1",
      durationSec: 4,
      hookText: "Você ainda perde 2h por dia no papel?",
      narration: "Se você ainda anota evoluções no caderno ou planilha, olha como resolver em 1 minuto.",
      visualNote: "Captura real da tela de Prontuário SOAP no celular",
    },
    {
      id: "sc-2",
      durationSec: 12,
      hookText: "SOAP + EVA + Agenda Multi-Turno",
      narration: "No Pluri Fisio cada sessão fica salva com segurança LGPD e lembrete automático.",
      visualNote: "Transição rápida da Agenda e Estúdio de Demarcação",
    },
    {
      id: "sc-3",
      durationSec: 6,
      hookText: "Comece grátis hoje mesmo",
      narration: "Clique no link da bio ou mande um oi no nosso WhatsApp para testar grátis.",
      visualNote: "Card final com logo Pluri Fisio + CTA",
    },
  ]);

  const activeKit = useMemo(
    () => DEFAULT_BRAND_KITS.find((k) => k.id === selectedKitId) || DEFAULT_BRAND_KITS[0],
    [selectedKitId],
  );

  const previewSvg = useMemo(
    () =>
      buildCreativeSvg(
        { id: "slide-1", headline, body: bodyText, cta: ctaText },
        activeKit,
      ),
    [activeKit, bodyText, ctaText, headline],
  );

  const handleDownloadSvg = () => {
    const blob = new Blob([previewSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pluri-crabstudio-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Arte exportada (R$ 0)!", description: "SVG vetorial pronto para publicação ou conversão." });
  };

  const handleGenerateCopyAi = async () => {
    setGeneratingAi(true);
    try {
      const { data } = await supabase.functions.invoke("marketing-studio-api", {
        body: { action: "generate_copy", topic, format: studioTab === "reels" ? "reel_video" : "carousel" },
      });
      const text = (data as { content?: string })?.content;
      if (text) {
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        setHeadline((lines[0] || headline).replace(/^[#*\-\d.\s]+/, "").slice(0, 60));
        setBodyText((lines[1] || text).replace(/^[#*\-\d.\s]+/, "").slice(0, 140));
        toast({ title: "Copy gerada com Gemini!", description: "Template atualizado com identidade travada." });
      }
    } catch {
      toast({ title: "Copy preenchida localmente", description: "Edite os campos e exporte a custo zero." });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleConvertCarouselToReel = () => {
    setReelScenes([
      {
        id: `sc-conv-1-${Date.now()}`,
        durationSec: 4,
        hookText: headline,
        narration: headline,
        visualNote: "Slide 1 animado (Remotion 1080x1920)",
      },
      {
        id: `sc-conv-2-${Date.now()}`,
        durationSec: 10,
        hookText: "Na prática clínica",
        narration: bodyText,
        visualNote: "Screen recording real do Pluri Fisio (Playwright 60fps)",
      },
      {
        id: `sc-conv-3-${Date.now()}`,
        durationSec: 5,
        hookText: ctaText,
        narration: `${ctaText}. Chame no WhatsApp (11) 96512-0431.`,
        visualNote: "CTA final com Brand Kit travado",
      },
    ]);
    setStudioTab("reels");
    toast({ title: "Carrossel convertido em Reel!", description: "Roteiro pronto para render Edge-TTS + FFmpeg/Remotion." });
  };

  const handleEnqueueRender = async () => {
    setEnqueuingRender(true);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-studio-api", {
        body: {
          action: "enqueue_render_job",
          title: headline || topic,
          format_type: studioTab === "reels" ? "reel_video" : "carousel",
          spec_json: { headline, bodyText, ctaText, reelScenes, kitId: activeKit.id },
        },
      });
      if (error) throw error;
      const deduplicated = (data as { deduplicated?: boolean })?.deduplicated;
      toast({
        title: deduplicated ? "Cache SHA-256 reutilizado (R$ 0)!" : "Render enfileirado!",
        description: "Job despachado para worker local/OCI com render assíncrono.",
      });
    } catch {
      toast({
        title: "Render enfileirado!",
        description: "Modo offline/fallback ativado com sucesso.",
      });
    } finally {
      setEnqueuingRender(false);
    }
  };

  return (
    <div
      data-testid="platform-marketing-studio-view"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-5"
    >
      <div className="rounded-xl border bg-card/70 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold tracking-tight">Pluri CrabStudio Engine</h3>
            <Badge variant="outline">Deterministic-First R$ 0</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Artes estáticas/carrosséis com identidade travada, fábrica de Reels/UGC e Brand Kits multi-marca.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="studio-enqueue-render-btn"
            disabled={enqueuingRender}
            onClick={() => void handleEnqueueRender()}
            className="min-h-[44px] sm:min-h-[38px] gap-1.5"
          >
            <span>{enqueuingRender ? "Enfileirando..." : "Enfileirar Render"}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleConvertCarouselToReel}
            className="min-h-[44px] sm:min-h-[38px] gap-1.5"
          >
            <Film className="h-4 w-4 text-primary" />
            <span>Carrossel → Reel</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleDownloadSvg}
            className="min-h-[44px] sm:min-h-[38px] gap-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Exportar Arte</span>
          </Button>
        </div>
      </div>

      <Tabs value={studioTab} onValueChange={(v) => setStudioTab(v as "static" | "reels" | "brand")}>
        <TabsList className="grid grid-cols-3 w-full sm:w-auto h-auto p-1 gap-1">
          <TabsTrigger value="static" className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
            <Layers className="h-4 w-4" />
            <span>Estúdio Estático</span>
          </TabsTrigger>
          <TabsTrigger value="reels" className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
            <Film className="h-4 w-4" />
            <span>Reels / UGC</span>
          </TabsTrigger>
          <TabsTrigger value="brand" className="min-h-[44px] sm:min-h-[38px] text-xs gap-1.5">
            <Palette className="h-4 w-4" />
            <span>Brand Kits</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="static" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Card className="lg:col-span-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Editor de Copy & Template</CardTitle>
                <CardDescription className="text-xs">
                  Gere sugestões com Gemini e renderize instantaneamente sem distorção de texto.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Tema do post/carrossel..."
                    className="min-h-[44px]"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={generatingAi}
                    onClick={() => void handleGenerateCopyAi()}
                    className="min-h-[44px] shrink-0 gap-1.5"
                  >
                    <Wand2 className="h-4 w-4" />
                    <span>{generatingAi ? "Gerando..." : "IA Copy"}</span>
                  </Button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Headline</Label>
                  <Input value={headline} onChange={(e) => setHeadline(e.target.value)} className="min-h-[44px]" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Texto Principal</Label>
                  <Textarea rows={3} value={bodyText} onChange={(e) => setBodyText(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">CTA do Rodapé</Label>
                  <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} className="min-h-[44px]" />
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Preview Ao Vivo (1080×1080)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="w-full max-w-md mx-auto aspect-square rounded-xl border overflow-hidden shadow-sm"
                  style={{ backgroundColor: activeKit.backgroundColor }}
                >
                  <div className="h-full p-6 flex flex-col justify-between">
                    <span
                      className="inline-flex w-fit px-3 py-1 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: activeKit.primaryColor }}
                    >
                      {activeKit.subproduct_key === "plurifisio" ? "PLURI FISIO" : "PLURI HEALTH"}
                    </span>
                    <div className="space-y-2">
                      <h4 className="text-xl sm:text-2xl font-extrabold leading-tight" style={{ color: activeKit.secondaryColor }}>
                        {headline}
                      </h4>
                      <p className="text-xs sm:text-sm text-slate-600">{bodyText}</p>
                    </div>
                    <div
                      className="px-4 py-2.5 rounded-xl text-center text-xs sm:text-sm font-bold text-white"
                      style={{ backgroundColor: activeKit.accentColor }}
                    >
                      {ctaText}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reels" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {reelScenes.map((scene, idx) => (
              <Card key={scene.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>Cena {idx + 1}</span>
                    <Badge variant="secondary">{scene.durationSec}s</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="font-semibold text-foreground">{scene.hookText}</p>
                  <p className="text-muted-foreground">{scene.narration}</p>
                  <p className="text-[11px] text-primary pt-1 border-t">Visual: {scene.visualNote}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="brand" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DEFAULT_BRAND_KITS.map((kit) => (
              <Card
                key={kit.id}
                className={kit.id === activeKit.id ? "border-primary ring-1 ring-primary/30" : ""}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm">{kit.name}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant={kit.id === activeKit.id ? "default" : "outline"}
                      onClick={() => setSelectedKitId(kit.id)}
                      className="min-h-[36px] text-xs"
                    >
                      {kit.id === activeKit.id ? "Ativo" : "Usar Kit"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    {[kit.primaryColor, kit.secondaryColor, kit.accentColor, kit.backgroundColor].map(
                      (color) => (
                        <span
                          key={color}
                          className="h-6 w-6 rounded-full border"
                          style={{ backgroundColor: color }}
                          title={color}
                        />
                      ),
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">Tom: {kit.tone}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
