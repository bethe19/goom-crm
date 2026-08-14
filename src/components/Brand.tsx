import React from "react";
import { cn } from "@/lib/utils";

interface BrandProps {
  inverse?: boolean;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

export function Brand({
  inverse = false,
  size = "md",
  showText = true,
  className,
}: BrandProps) {
  const iconSizeClasses = {
    sm: "h-6 w-6",
    md: "h-8 w-8",
    lg: "h-10 w-10",
  }[size];

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-2xl",
  }[size];

  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)} aria-label="Goom">
      <div
        className={cn(
          "relative shrink-0 flex items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 shadow-xs",
          iconSizeClasses
        )}
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Black squircle on light, white on dark/inverse */}
          <rect
            width="100"
            height="100"
            rx="24"
            fill={inverse ? "#FFFFFF" : "#09090b"}
          />
          {/* White G icon glyph on light, black on dark/inverse */}
          <path
            d="M 74 23 A 36 36 0 1 0 87 50 L 56 50"
            stroke={inverse ? "#09090b" : "#FFFFFF"}
            strokeWidth="9.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {showText && (
        <span
          className={cn(
            "font-semibold tracking-tight font-sans transition-colors",
            textSizeClasses,
            inverse ? "text-white" : "text-foreground"
          )}
        >
          Goom
        </span>
      )}
    </div>
  );
}

export default Brand;
