import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva } from "class-variance-authority";
import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline:
          "border border-input shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Çift-tıklama / çift-submit koruması:
 * - onClick handler bir Promise döndürürse (async fonksiyon), buton otomatik disable olur + spinner gösterir
 * - Promise tamamlanana kadar yeni tıklama görmezden gelinir (useRef guard — React render'dan bağımsız)
 * - Sync handler'lar (örn. setOpen(true)) etkilenmez, önceki davranış aynen korunur
 * - asChild=true durumunda spinner gösterilmez (Slot çocuk düzenini bozmamak için), ama re-entry guard yine aktif
 */
const Button = React.forwardRef(({ className, variant, size, asChild = false, onClick, disabled, children, ...props }, ref) => {
  const [pending, setPending] = React.useState(false);
  const inFlightRef = React.useRef(false);

  const handleClick = React.useCallback((e) => {
    if (!onClick) return;
    // Re-entry guard: süregelen async işlem varken yeni tıklamayı yut
    if (inFlightRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    let result;
    try {
      result = onClick(e);
    } catch (err) {
      throw err;
    }
    // Promise döndüyse pending state'i aç
    if (result && typeof result.then === "function") {
      inFlightRef.current = true;
      setPending(true);
      Promise.resolve(result).finally(() => {
        inFlightRef.current = false;
        setPending(false);
      });
    }
  }, [onClick]);

  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      onClick={onClick ? handleClick : undefined}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}>
      {pending && !asChild && (
        <Loader2 className="animate-spin h-4 w-4" />
      )}
      {children}
    </Comp>
  );
})
Button.displayName = "Button"

export { Button, buttonVariants }
