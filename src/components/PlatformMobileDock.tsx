import React from "react";
import { motion } from "framer-motion";
import {
  UsersRound,
  MessageSquareHeart,
  Sparkles,
  Tags,
  SlidersHorizontal,
  ShieldAlert,
  CreditCard,
  LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface BackofficeDockTabItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

export const BACKOFFICE_DOCK_TABS: BackofficeDockTabItem[] = [
  {
    id: "directory",
    label: "Diretório Mestre",
    shortLabel: "Diretório",
    icon: UsersRound,
  },
  {
    id: "feedbacks",
    label: "Feedbacks & Avaliações",
    shortLabel: "Feedbacks",
    icon: MessageSquareHeart,
  },
  {
    id: "news",
    label: "Notas de Novidades",
    shortLabel: "Novidades",
    icon: Sparkles,
  },
  {
    id: "tags",
    label: "Gestão de Tags",
    shortLabel: "Tags",
    icon: Tags,
  },
  {
    id: "flags",
    label: "Feature Flags",
    shortLabel: "Flags",
    icon: SlidersHorizontal,
  },
  {
    id: "governance",
    label: "Governança & Segurança",
    shortLabel: "Governança",
    icon: ShieldAlert,
  },
  {
    id: "billing",
    label: "Faturamento & Webhooks",
    shortLabel: "Faturamento",
    icon: CreditCard,
  },
];

interface PlatformMobileDockProps {
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export const PlatformMobileDock: React.FC<PlatformMobileDockProps> = ({
  activeTab,
  onChange,
  className,
}) => {
  return (
    <div
      className={cn(
        "fixed bottom-3 inset-x-3 z-50 rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-background/90 backdrop-blur-lg supports-[backdrop-filter]:bg-background/80 shadow-2xl lg:hidden p-1.5 transition-all duration-300",
        className
      )}
    >
      <nav className="flex items-center justify-around w-full relative">
        {BACKOFFICE_DOCK_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <motion.button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              whileTap={{ scale: 0.90 }}
              onClick={() => onChange(tab.id)}
              className={cn(
                "relative flex flex-col items-center justify-center py-2 px-2.5 rounded-xl transition-all duration-200 min-w-[56px] flex-1 text-center select-none",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {/* Active Indicator Backdrop Spring Pill */}
              {isActive && (
                <motion.div
                  layoutId="activeBackofficeDockPill"
                  className="absolute inset-0 rounded-xl bg-primary/10 dark:bg-primary/20 border border-primary/20"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}

              {/* Icon & Label */}
              <div className="relative z-10 flex flex-col items-center gap-1">
                <Icon
                  className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    isActive ? "scale-110 text-primary" : "scale-100"
                  )}
                />
                <span className="text-[10px] leading-none font-medium truncate max-w-[62px]">
                  {tab.shortLabel}
                </span>
              </div>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};
