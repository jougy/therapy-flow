import type { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersonalSection } from "./selecionarClinicaTypes";

export interface NavSectionItem {
  icon: typeof Building2;
  label: string;
  value: PersonalSection;
}

export interface PersonalDesktopNavProps {
  visibleSectionItems: NavSectionItem[];
  activeSection: PersonalSection;
  setActiveSection: (section: PersonalSection) => void;
}

export function PersonalDesktopNav({
  visibleSectionItems,
  activeSection,
  setActiveSection,
}: PersonalDesktopNavProps) {
  return (
    <nav className="grid w-full min-w-0 max-w-full gap-2">
      {visibleSectionItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.value;

        return (
          <button
            key={item.value}
            type="button"
            className={cn(
              "group flex h-12 w-full min-w-0 items-center gap-2 rounded-xl border px-3 text-left text-sm font-medium shadow-sm transition-[border-color,background-color,box-shadow,color,transform] duration-200 ease-out active:translate-y-px",
              isActive
                ? "border-primary/55 bg-card text-primary shadow-[0_0_28px_hsl(198_93%_60%/0.16)]"
                : "border-border/80 bg-card/92 text-muted-foreground hover:border-primary/35 hover:text-foreground hover:shadow-[0_0_22px_hsl(198_93%_60%/0.1)]"
            )}
            onClick={() => setActiveSection(item.value)}
          >
            <span
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors duration-200",
                isActive ? "bg-primary/14 text-primary" : "bg-muted/70 text-foreground group-hover:bg-primary/10 group-hover:text-primary"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1 truncate leading-tight">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
