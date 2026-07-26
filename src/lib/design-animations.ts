export const designLabActionButtonBase = "group/design-action w-10 flex-none overflow-hidden px-0 transition-[width,padding,box-shadow,border-color,background-color,color] duration-700 ease-in-out hover:px-4 hover:shadow-[0_0_0_3px_hsl(var(--primary)/0.08),0_8px_18px_hsl(var(--primary)/0.08)] focus-visible:px-4";

export const designLabIconClass = "shrink-0 transition-transform duration-700 group-hover/design-action:scale-110";

export const designLabLabelClass = "relative z-10 ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity,margin] duration-700 ease-in-out group-hover/design-action:ml-2 group-hover/design-action:max-w-[12rem] group-hover/design-action:opacity-100 group-focus-visible/design-action:ml-2 group-focus-visible/design-action:max-w-[12rem] group-focus-visible/design-action:opacity-100";

// Função helper para aplicar a largura final
export function getDesignLabButtonClass(hoverWidthClass: string, extraClasses = "") {
  return `${designLabActionButtonBase} ${hoverWidthClass} focus-visible:${hoverWidthClass.replace('hover:', '')} ${extraClasses}`.trim();
}
