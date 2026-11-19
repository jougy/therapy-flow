import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface ResponsiveFinanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClassName?: string;
}

export const ResponsiveFinanceSheet: React.FC<ResponsiveFinanceSheetProps> = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  maxWidthClassName = "sm:max-w-lg",
}) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="flex max-h-[88dvh] flex-col overflow-hidden focus:outline-none">
          <DrawerHeader className="shrink-0 border-b px-4 pb-3 pt-2 text-left">
            <DrawerTitle className="text-base font-semibold">{title}</DrawerTitle>
            {description ? (
              <DrawerDescription className="text-xs text-muted-foreground">
                {description}
              </DrawerDescription>
            ) : null}
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {children}
          </div>

          {footer ? (
            <DrawerFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-background/95 px-4 pt-3 pb-safe backdrop-blur-xs">
              {footer}
            </DrawerFooter>
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex max-h-[88dvh] flex-col gap-0 overflow-hidden p-0",
          maxWidthClassName,
        )}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-4">
          {children}
        </div>

        {footer ? (
          <DialogFooter className="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-4 pb-safe">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
