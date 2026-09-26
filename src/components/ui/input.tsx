import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared field styling: 36px tall, visible border, clear focus (border + soft halo),
 * red border/halo when `aria-invalid`. 16px text on phones (prevents iOS zoom), 14px from md up.
 */
export const fieldClasses =
  "w-full rounded-lg border border-input bg-card px-3 text-base shadow-xs ring-offset-background transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted-foreground/80 focus-visible:border-ring/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20 md:text-sm";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldClasses,
          "flex h-9 py-1.5 file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
