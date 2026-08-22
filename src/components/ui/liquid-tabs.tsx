import React, { useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface LiquidTabItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  buttonClass?: string;
  labelClass?: string;
  iconClass?: string;
  dataTutorial?: string;
}

export interface LiquidTabsProps {
  tabs: LiquidTabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
  tabClassName?: string;
}

export function LiquidTabs({ tabs, activeTab, onChange, className, tabClassName }: LiquidTabsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0, opacity: 0 });
  const [isChangingTab, setIsChangingTab] = useState(false);
  const prevTabRef = useRef(activeTab);

  if (prevTabRef.current !== activeTab) {
    prevTabRef.current = activeTab;
    setIsChangingTab(true);
    // A animação liquid dura cerca de 500-600ms
    setTimeout(() => setIsChangingTab(false), 600);
  }

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeEl = container.querySelector('[data-active="true"]') as HTMLElement;
    if (!activeEl) return;

    const update = () => {
      // O filtro gooey "engole" as bordas da forma em cerca de 8-12px.
      // Adicionamos margem ao indicador para compensar e envolver o texto completamente.
      setIndicatorStyle({
        left: activeEl.offsetLeft - 6,
        width: activeEl.offsetWidth + 12,
        opacity: 1
      });
    };

    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    // Observa todos os botões, pois se um botão inativo crescer no hover, 
    // ele empurra o ativo (muda o offsetLeft), e precisamos recalcular.
    Array.from(container.children).forEach(child => {
      if (child.tagName === 'BUTTON') {
        observer.observe(child);
      }
    });
    
    return () => observer.disconnect();
  }, [activeTab]);

  return (
    <div className={cn("relative inline-flex flex-wrap rounded-2xl border bg-muted/30 p-1 shadow-sm", className)}>
      {/* Filtro SVG para o efeito Gooey real */}
      <svg className="pointer-events-none absolute h-0 w-0">
        <defs>
          <filter id="liquid-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div ref={containerRef} className="relative z-10 flex w-full flex-wrap gap-2">
        {/* Camada Gooey de Fundo (Atrás dos Textos) */}
        <div 
          className="absolute inset-0 z-[-1] pointer-events-none" 
          style={{ filter: "url('#liquid-goo')" }}
        >
          {/* Gota Principal */}
          <motion.div
            className="absolute -bottom-1 left-0 -top-1 rounded-xl bg-primary"
            initial={false}
            animate={{
              x: indicatorStyle.left,
              width: indicatorStyle.width,
              opacity: indicatorStyle.opacity
            }}
            transition={
              isChangingTab 
                ? { type: "spring", stiffness: 260, damping: 20, mass: 1 }
                : { type: "tween", duration: 0 }
            }
          />
          {/* Gota de Rastro 1 (Causa o efeito de desprendimento) */}
          <motion.div
            className="absolute -bottom-1 left-0 -top-1 rounded-xl bg-primary"
            initial={false}
            animate={{
              x: indicatorStyle.left + (indicatorStyle.width * 0.1),
              width: indicatorStyle.width * 0.8,
              opacity: indicatorStyle.opacity
            }}
            transition={
              isChangingTab 
                ? { type: "spring", stiffness: 220, damping: 24, mass: 1.2 }
                : { type: "tween", duration: 0 }
            }
          />
          {/* Gota de Rastro 2 (Miolo líquido) */}
          <motion.div
            className="absolute bottom-0 left-0 top-0 rounded-full bg-primary"
            initial={false}
            animate={{
              x: indicatorStyle.left + (indicatorStyle.width * 0.25),
              width: indicatorStyle.width * 0.5,
              opacity: indicatorStyle.opacity
            }}
            transition={
              isChangingTab 
                ? { type: "spring", stiffness: 180, damping: 28, mass: 1.5 }
                : { type: "tween", duration: 0 }
            }
          />
        </div>

        {/* Botões Reais e Textos (Ficam nítidos, fora do filtro) */}
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              data-active={isActive}
              {...(tab.dataTutorial ? { "data-tutorial": tab.dataTutorial } : {})}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative flex items-center justify-center py-1.5 text-sm font-medium transition-colors duration-300 rounded-xl",
                !tab.buttonClass && "px-4",
                isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
                tabClassName,
                tab.buttonClass
              )}
            >
              <span className="relative z-10 flex items-center gap-2">
                {Icon && <Icon className={cn("h-4 w-4 shrink-0", tab.iconClass)} />}
                <span className={cn(tab.labelClass)}>{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
