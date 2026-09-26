import { cn } from "@/lib/utils";

interface BrandProps {
  /** Use on dark surfaces regardless of theme (white mark, white wordmark). */
  inverse?: boolean;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const ICON_SIZE = { sm: "h-6 w-6", md: "h-7 w-7", lg: "h-10 w-10" } as const;
const TEXT_SIZE = { sm: "text-base", md: "text-lg", lg: "text-2xl" } as const;

/**
 * Goom logo: a squircle "G" mark plus wordmark. By default the mark follows the theme
 * (near-black on light, near-white on dark) via `currentColor` + tokens.
 */
export function Brand({ inverse = false, size = "md", showText = true, className }: BrandProps) {
  return (
    <span className={cn("inline-flex select-none items-center gap-2", className)}>
      <span
        className={cn(
          "relative flex shrink-0 items-center justify-center",
          ICON_SIZE[size],
          inverse ? "text-white" : "text-foreground",
        )}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Goom">
          <rect width="100" height="100" rx="24" fill="currentColor" />
          <path
            d="M 74 23 A 36 36 0 1 0 87 50 L 56 50"
            className={inverse ? "stroke-neutral-950" : "stroke-background"}
            strokeWidth="9.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {showText && (
        <span
          aria-hidden="true"
          className={cn("font-semibold tracking-tight", TEXT_SIZE[size], inverse ? "text-white" : "text-foreground")}
        >
          Goom
        </span>
      )}
    </span>
  );
}

export default Brand;
