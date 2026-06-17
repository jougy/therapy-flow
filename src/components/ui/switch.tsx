import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";

import { cn } from "@/lib/utils";

const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, onCheckedChange, ...props }, ref) => {
  const [hasInteracted, setHasInteracted] = React.useState(false);

  const handleCheckedChange = React.useCallback(
    (checked: boolean) => {
      setHasInteracted(true);
      onCheckedChange?.(checked);
    },
    [onCheckedChange],
  );

  return (
    <SwitchPrimitives.Root
      className={cn(
        "peer group/pluri-switch relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center overflow-hidden rounded-full border border-primary/25 bg-background/80 shadow-[inset_0_0_0_1px_hsl(var(--background)/0.52)] transition-[background-color,border-color,box-shadow] duration-700 ease-in-out data-[state=checked]:border-primary/70 data-[state=checked]:bg-background/80 data-[state=checked]:shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08),0_0_16px_hsl(var(--primary)/0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
      ref={ref}
      onCheckedChange={handleCheckedChange}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pluri-liquid-switch-fill pointer-events-none absolute inset-y-0 left-0 w-full origin-left rounded-full bg-primary opacity-0 transition-[opacity,filter] duration-700 ease-in-out",
          hasInteracted && "group-data-[state=checked]/pluri-switch:animate-[pluri-switch-fill-in_0.9s_ease-in-out] group-data-[state=unchecked]/pluri-switch:animate-[pluri-switch-fill-out_0.9s_ease-in-out]",
        )}
      />
      <span
        aria-hidden="true"
        className="pluri-liquid-switch-dot pointer-events-none absolute left-2 h-2.5 w-2.5 rounded-full bg-muted-foreground/35 shadow-[0_0_10px_hsl(var(--muted-foreground)/0.14)] transition-[opacity,transform,background-color] duration-700 ease-in-out group-data-[state=checked]/pluri-switch:scale-75 group-data-[state=checked]/pluri-switch:opacity-30"
      />
      <span
        aria-hidden="true"
        className="pluri-liquid-switch-dot pointer-events-none absolute right-2 h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.34)] transition-[opacity,transform,background-color] duration-700 ease-in-out group-data-[state=checked]/pluri-switch:scale-110 group-data-[state=checked]/pluri-switch:opacity-95 group-data-[state=unchecked]/pluri-switch:scale-75 group-data-[state=unchecked]/pluri-switch:opacity-55"
      />
      <span
        aria-hidden="true"
        className={cn(
          "pluri-liquid-switch-glow pointer-events-none absolute left-1 top-1 h-4 w-5 rounded-full bg-primary/25 opacity-0 blur-[4px] transition-[opacity,transform,width] duration-700 ease-in-out group-data-[state=checked]/pluri-switch:translate-x-5 group-data-[state=checked]/pluri-switch:opacity-70 group-data-[state=checked]/pluri-switch:[--pluri-switch-x:1.25rem] group-data-[state=unchecked]/pluri-switch:translate-x-0 group-data-[state=unchecked]/pluri-switch:[--pluri-switch-x:0rem]",
          hasInteracted && "group-data-[state=checked]/pluri-switch:animate-[pluri-switch-glow_0.9s_ease-in-out] group-data-[state=unchecked]/pluri-switch:animate-[pluri-switch-glow_0.9s_ease-in-out]",
        )}
      />
      <SwitchPrimitives.Thumb
        className={cn(
          "pluri-liquid-switch-thumb pointer-events-none relative z-10 block h-5 w-5 rounded-full bg-muted-foreground/55 shadow-[0_3px_10px_hsl(var(--foreground)/0.18)] ring-0 transition-[background-color,box-shadow] duration-700 ease-in-out data-[state=checked]:bg-primary data-[state=checked]:shadow-[0_4px_14px_hsl(var(--primary)/0.38)]",
          hasInteracted
            ? "data-[state=checked]:animate-[pluri-switch-liquid-checked_0.9s_ease-in-out_forwards] data-[state=unchecked]:animate-[pluri-switch-liquid-unchecked_0.9s_ease-in-out_forwards]"
            : "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0",
        )}
      />
    </SwitchPrimitives.Root>
  );
});
Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
