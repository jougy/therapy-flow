import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Share2,
  Download,
  Copy,
  Check,
  Sparkles,
  Instagram,
  MessageCircle,
  Image as ImageIcon,
  Layers,
  Tag,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  AFFILIATE_CREATIVES,
  CreativeCategory,
  buildAffiliateLink,
  interpolateCopy,
  triggerDownloadCreative,
  type AffiliateCreative,
} from "./creatives-data";

export interface AffiliateCreativesKitModalProps {
  couponCode: string;
  affiliateSlug?: string;
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: readonly { id: CreativeCategory; label: string; icon: React.ElementType }[] = [
  { id: "stories", label: "Stories", icon: Instagram },
  { id: "feed", label: "Feed / Carrossel", icon: Layers },
  { id: "banners", label: "Banners & Selos", icon: ImageIcon },
  { id: "whatsapp", label: "WhatsApp / Grupos", icon: MessageCircle },
];

export function AffiliateCreativesKitModal({
  couponCode,
  affiliateSlug,
  isOpen,
  onClose,
}: AffiliateCreativesKitModalProps) {
  const [activeCategory, setActiveCategory] = useState<CreativeCategory>("stories");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const affiliateLink = buildAffiliateLink(affiliateSlug, couponCode);

  const handleCopy = async (creative: AffiliateCreative) => {
    const textToCopy = interpolateCopy(creative.copyTemplate, couponCode, affiliateLink);
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(creative.id);
      toast({
        title: "Legenda copiada!",
        description: "Texto pronto com seu cupom e link copiado para a área de transferência.",
      });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar automaticamente. Selecione o texto manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (creative: AffiliateCreative) => {
    const textToShare = interpolateCopy(creative.copyTemplate, couponCode, affiliateLink);

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: creative.title,
          text: textToShare,
          url: affiliateLink,
        });
        toast({
          title: "Compartilhado!",
          description: "Criativo enviado com sucesso.",
        });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") {
          return;
        }
      }
    }

    // Fallback: copia para a área de transferência
    await handleCopy(creative);
  };

  const handleDownload = (creative: AffiliateCreative) => {
    try {
      triggerDownloadCreative(creative, couponCode);
      toast({
        title: "Download iniciado",
        description: `Arte "${creative.title}" baixada em alta resolução.`,
      });
    } catch {
      toast({
        title: "Erro no download",
        description: "Não foi possível gerar a imagem no navegador.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-testid="creatives-kit-modal"
        className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-3xl"
      >
        <DialogHeader className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
                Central de Criativos & Banners
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
                Artes prontas e copies persuasivas já com seu cupom exclusivo embutido
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Banner do Cupom & Link Ativos */}
        <div className="rounded-xl border bg-muted/40 p-3 sm:p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">Seu Cupom Ativo:</span>
            <span
              data-testid="active-coupon-code"
              className="font-mono font-bold text-foreground bg-background px-2 py-0.5 rounded border"
            >
              {couponCode}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground truncate max-w-full">
            Link: <span className="text-primary underline font-mono">{affiliateLink}</span>
          </div>
        </div>

        {/* Tabs de Categorias */}
        <Tabs
          value={activeCategory}
          onValueChange={(val) => setActiveCategory(val as CreativeCategory)}
          className="w-full space-y-3"
        >
          <div className="overflow-x-auto pb-1 scrollbar-none">
            <TabsList className="w-full justify-start sm:justify-center h-10 p-1 bg-muted/60 min-w-max">
              {CATEGORIES.map(({ id, label, icon: Icon }) => (
                <TabsTrigger
                  key={id}
                  value={id}
                  data-testid={`tab-${id}`}
                  className="text-xs gap-1.5 min-h-[36px]"
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {CATEGORIES.map(({ id: catId }) => (
            <TabsContent key={catId} value={catId} className="space-y-4 mt-2">
              {AFFILIATE_CREATIVES.filter((c) => c.category === catId).map((creative) => {
                const fullCopy = interpolateCopy(
                  creative.copyTemplate,
                  couponCode,
                  affiliateLink
                );
                const isCopied = copiedId === creative.id;

                return (
                  <div
                    key={creative.id}
                    data-testid={`creative-card-${creative.id}`}
                    className="rounded-xl border bg-card p-3.5 sm:p-4 shadow-sm space-y-3 transition-all hover:border-primary/40"
                  >
                    {/* Cabeçalho do Card */}
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-snug">
                          {creative.title}
                        </h4>
                        <p className="text-xs text-muted-foreground">{creative.subtitle}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                        {creative.dimensions}
                      </Badge>
                    </div>

                    {/* Preview Visual com Gradiente */}
                    <div
                      className={`rounded-lg bg-gradient-to-br ${creative.gradient} text-white p-4 sm:p-5 relative overflow-hidden shadow-inner`}
                    >
                      <div className="space-y-2 relative z-10">
                        <span className="text-[10px] font-bold tracking-widest uppercase opacity-80 block">
                          Pluri Health • Parceiro
                        </span>
                        <h5 className="text-base sm:text-lg font-extrabold leading-tight">
                          {creative.previewHeadline}
                        </h5>
                        <p className="text-xs text-white/90 line-clamp-2">
                          {creative.previewSubtext}
                        </p>
                        <div className="inline-flex items-center gap-1.5 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] font-bold text-emerald-300 border border-emerald-400/30">
                          <span>CUPOM:</span>
                          <span className="font-mono text-white">{couponCode}</span>
                          <span className="text-emerald-300 font-semibold">• 30% OFF</span>
                        </div>
                      </div>
                    </div>

                    {/* Prévia da Copy com Cupom Embutido */}
                    <div className="bg-muted/40 p-2.5 sm:p-3 rounded-lg border border-muted text-xs space-y-1">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Legenda / Mensagem Sugerida:
                      </span>
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed select-all">
                        {fullCopy}
                      </p>
                    </div>

                    {/* Ações: Compartilhar, Baixar e Copiar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid={`btn-share-${creative.id}`}
                        onClick={() => handleShare(creative)}
                        className="min-h-[44px] text-xs font-semibold gap-1.5"
                      >
                        <Share2 className="w-3.5 h-3.5 text-primary" />
                        <span>Compartilhar</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        data-testid={`btn-download-${creative.id}`}
                        onClick={() => handleDownload(creative)}
                        className="min-h-[44px] text-xs font-semibold gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-foreground" />
                        <span>Baixar Arte</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        data-testid={`btn-copy-${creative.id}`}
                        onClick={() => handleCopy(creative)}
                        className={`min-h-[44px] text-xs font-bold gap-1.5 transition-all ${
                          isCopied
                            ? "bg-emerald-600 text-white"
                            : "bg-primary text-primary-foreground hover:opacity-90"
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Copiado!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copiar Legenda</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>

        <DialogFooter className="pt-2 border-t mt-1">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto min-h-[44px] text-xs font-semibold"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
