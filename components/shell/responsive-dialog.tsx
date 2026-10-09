"use client";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/** A Dialog on desktop, a bottom Drawer on phones — same content either way. */
export function ResponsiveDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="paper rounded-t-2xl">
          <DrawerHeader className="px-5 pt-5 pb-2 text-left">
            <DrawerTitle className="font-display text-[24px] leading-tight font-normal tracking-tight">{title}</DrawerTitle>
            {description && <DrawerDescription className="text-[15px]">{description}</DrawerDescription>}
          </DrawerHeader>
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]", className)}>
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="paper max-h-[min(44rem,calc(100dvh-4rem))] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-rule border-b px-6 pt-6 pb-4">
          <DialogTitle className="font-display text-[24px] leading-tight font-normal tracking-tight">{title}</DialogTitle>
          {description && <DialogDescription className="text-[15px]">{description}</DialogDescription>}
        </DialogHeader>
        <div className={cn("min-h-0 overflow-y-auto px-6 py-5", className)}>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
