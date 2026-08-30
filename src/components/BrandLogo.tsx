import React from "react";
import { cn } from "@/lib/utils";

export type BrandLogoVariant = "gradient" | "neon" | "monochrome" | "white" | "black";
export type BrandLogoType = "full" | "icon" | "horizontal" | "mark";

export interface BrandLogoProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BrandLogoVariant;
  type?: BrandLogoType;
  showText?: boolean;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
  imgClassName?: string;
  alt?: string;
}

const sizeMap = {
  xs: { icon: "h-5 w-5", full: "h-6", text: "text-sm" },
  sm: { icon: "h-7 w-7", full: "h-8", text: "text-base" },
  md: { icon: "h-9 w-9", full: "h-10", text: "text-lg" },
  lg: { icon: "h-12 w-12", full: "h-14", text: "text-xl" },
  xl: { icon: "h-16 w-16", full: "h-20", text: "text-2xl" },
  "2xl": { icon: "h-24 w-24", full: "h-28", text: "text-3xl" },
};

/**
 * Universal Brand Logo Component for Pluri-Health
 * Automatically adapts to light/dark themes and provides sharp SVG assets
 */
export function BrandLogo({
  variant = "gradient",
  type = "horizontal",
  showText = true,
  size = "md",
  className,
  imgClassName,
  alt = "Pluri-Health Logo",
  ...props
}: BrandLogoProps) {
  const sizeConfig = sizeMap[size] || sizeMap.md;

  // Icon only rendering
  if (type === "icon" || type === "mark") {
    if (variant === "monochrome") {
      return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
          {/* Light theme: dark icon */}
          <img
            src="/branding/logo/pluri_health_icon_black.svg"
            alt={alt}
            className={cn(sizeConfig.icon, "object-contain dark:hidden", imgClassName)}
          />
          {/* Dark theme: white icon */}
          <img
            src="/branding/logo/pluri_health_icon_white.svg"
            alt={alt}
            className={cn(sizeConfig.icon, "object-contain hidden dark:block", imgClassName)}
          />
        </div>
      );
    }

    if (variant === "white") {
      return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
          <img
            src="/branding/logo/pluri_health_icon_white.svg"
            alt={alt}
            className={cn(sizeConfig.icon, "object-contain", imgClassName)}
          />
        </div>
      );
    }

    if (variant === "black") {
      return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
          <img
            src="/branding/logo/pluri_health_icon_black.svg"
            alt={alt}
            className={cn(sizeConfig.icon, "object-contain", imgClassName)}
          />
        </div>
      );
    }

    // Default gradient icon
    return (
      <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
        <img
          src="/branding/logo/pluri_health_icon_gradient.svg"
          alt={alt}
          className={cn(sizeConfig.icon, "object-contain drop-shadow-xs", imgClassName)}
        />
      </div>
    );
  }

  // Full lockup (stacked with built-in text in SVG)
  if (type === "full") {
    if (variant === "monochrome") {
      return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
          <img
            src="/branding/logo/pluri_health_logo_black.svg"
            alt={alt}
            className={cn(sizeConfig.full, "w-auto object-contain dark:hidden", imgClassName)}
          />
          <img
            src="/branding/logo/pluri_health_logo_white.svg"
            alt={alt}
            className={cn(sizeConfig.full, "w-auto object-contain hidden dark:block", imgClassName)}
          />
        </div>
      );
    }

    if (variant === "neon") {
      return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
          <img
            src="/branding/logo/pluri_health_logo_neon.svg"
            alt={alt}
            className={cn(sizeConfig.full, "w-auto object-contain drop-shadow-md", imgClassName)}
          />
        </div>
      );
    }

    if (variant === "white") {
      return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
          <img
            src="/branding/logo/pluri_health_logo_white.svg"
            alt={alt}
            className={cn(sizeConfig.full, "w-auto object-contain", imgClassName)}
          />
        </div>
      );
    }

    if (variant === "black") {
      return (
        <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
          <img
            src="/branding/logo/pluri_health_logo_black.svg"
            alt={alt}
            className={cn(sizeConfig.full, "w-auto object-contain", imgClassName)}
          />
        </div>
      );
    }

    return (
      <div className={cn("inline-flex items-center justify-center shrink-0", className)} {...props}>
        <img
          src="/branding/logo/pluri_health_logo_gradient.svg"
          alt={alt}
          className={cn(sizeConfig.full, "w-auto object-contain drop-shadow-sm", imgClassName)}
        />
      </div>
    );
  }

  // Horizontal lockup (Icon + Typography text styled with theme)
  return (
    <div className={cn("inline-flex items-center gap-2.5 shrink-0 select-none", className)} {...props}>
      <img
        src="/branding/logo/pluri_health_icon_gradient.svg"
        alt=""
        aria-hidden="true"
        className={cn(sizeConfig.icon, "object-contain drop-shadow-xs", imgClassName)}
      />
      {showText && (
        <span className={cn("font-bold tracking-tight text-foreground whitespace-nowrap", sizeConfig.text)}>
          Pluri<span className="text-primary font-semibold">-Health</span>
        </span>
      )}
    </div>
  );
}
