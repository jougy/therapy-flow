import React, { useRef, useState, useEffect } from "react";
import { Link2, ListOrdered, ChevronLeft } from "lucide-react";

export interface HeadingItem {
  id: string;
  title: string;
  level: number;
}

interface TableOfContentsProps {
  headings: HeadingItem[];
  activeId: string;
  onHeadingClick: (id: string) => void;
}

export const TableOfContents: React.FC<TableOfContentsProps> = ({
  headings,
  activeId,
  onHeadingClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollListRef = useRef<HTMLDivElement>(null);
  const isDraggingTouchRef = useRef(false);

  // Auto-scroll da caixinha interna para manter o item ativo visível quando expandido
  useEffect(() => {
    if (isExpanded && activeId && scrollListRef.current) {
      const activeEl = scrollListRef.current.querySelector<HTMLElement>(`[data-heading-id="${activeId}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [activeId, isExpanded]);

  if (!headings || headings.length === 0) return null;

  // Gestão de toque para mobile (tocar e segurar / arrastar para navegar)
  const handleTouchStart = () => {
    isDraggingTouchRef.current = true;
    setIsExpanded(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingTouchRef.current) return;
    const touch = e.touches[0];
    const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
    const itemBtn = targetEl?.closest<HTMLButtonElement>("[data-heading-id]");
    if (itemBtn) {
      const headingId = itemBtn.dataset.headingId;
      if (headingId && headingId !== activeId) {
        onHeadingClick(headingId);
      }
    }
  };

  const handleTouchEnd = () => {
    isDraggingTouchRef.current = false;
    // Pequeno delay para permitir o usuário ler antes de recolher
    setTimeout(() => {
      setIsExpanded(false);
    }, 1200);
  };

  return (
    <aside
      ref={containerRef}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      aria-label="Índice de navegação do documento"
      className="fixed right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 print:hidden select-none transition-all duration-300 ease-out flex items-center justify-end"
    >
      {/* Container Principal Retrátil / Expansível */}
      <div
        className={`relative flex items-center transition-all duration-300 rounded-2xl shadow-xl backdrop-blur-md border ${
          isExpanded
            ? "w-72 sm:w-80 bg-background/95 border-border text-foreground px-4 py-4"
            : "w-8 sm:w-9 bg-card/85 border-border/80 text-muted-foreground px-1.5 py-3 hover:bg-card hover:border-primary/40 cursor-pointer"
        }`}
      >
        {/* Modo Retrátil: Linha de bolinhas com indicador ativo colorido */}
        {!isExpanded && (
          <div className="w-full flex flex-col items-center gap-1.5 max-h-[50vh] overflow-y-auto no-scrollbar py-1">
            <ListOrdered className="h-3.5 w-3.5 text-muted-foreground/80 mb-1 shrink-0" />
            {headings.map((item) => {
              const isActive = activeId === item.id;
              const isPart = item.level === 1;

              return (
                <div
                  key={item.id}
                  title={item.title}
                  className={`transition-all duration-300 rounded-full shrink-0 ${
                    isActive
                      ? "w-2.5 h-2.5 bg-primary ring-2 ring-primary/30 scale-125"
                      : isPart
                      ? "w-2 h-2 bg-foreground/60"
                      : "w-1.5 h-1.5 bg-muted-foreground/35 hover:bg-foreground/50"
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* Modo Expandido: Caixa com lista scrollável de títulos */}
        {isExpanded && (
          <div className="w-full flex flex-col max-h-[60vh] sm:max-h-[65vh]">
            {/* Cabeçalho do Mini Índice */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/70">
              <div className="flex items-center gap-2">
                <ListOrdered className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Índice de Tópicos
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                <ChevronLeft className="h-3 w-3" />
                <span>Navegar</span>
              </span>
            </div>

            {/* Lista Scrollável de Tópicos */}
            <div
              ref={scrollListRef}
              className="flex-1 overflow-y-auto overscroll-contain pr-1.5 space-y-1 text-xs focus:outline-none"
            >
              {headings.map((item) => {
                const isActive = activeId === item.id;
                const isPartHeader = item.level === 1;

                if (isPartHeader) {
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-heading-id={item.id}
                      onClick={() => onHeadingClick(item.id)}
                      className={`w-full text-left pt-2 pb-1 font-bold tracking-tight uppercase text-[11px] transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? "text-primary font-black"
                          : "text-foreground/80 hover:text-primary"
                      }`}
                    >
                      <Link2 className="h-3 w-3 shrink-0 opacity-70" />
                      <span className="truncate">{item.title}</span>
                    </button>
                  );
                }

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-heading-id={item.id}
                    onClick={() => onHeadingClick(item.id)}
                    className={`w-full text-left py-1.5 pl-3 pr-2 rounded-lg transition-colors leading-snug flex items-center gap-2 ${
                      isActive
                        ? "bg-primary/10 text-primary font-semibold shadow-xs"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                    title={item.title}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all ${
                        isActive ? "bg-primary scale-125" : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="truncate">{item.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
