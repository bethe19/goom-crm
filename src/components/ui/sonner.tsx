import type * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/**
 * Sonner's rich colors re-pointed at our design tokens, so success/error/warning/info toasts
 * match the app palette in both themes (tokens switch with the `.dark` class).
 */
const tokenStyle = {
  "--normal-bg": "hsl(var(--popover))",
  "--normal-text": "hsl(var(--popover-foreground))",
  "--normal-border": "hsl(var(--border))",
  "--success-bg": "color-mix(in srgb, hsl(var(--success)) 10%, hsl(var(--popover)))",
  "--success-text": "hsl(var(--success))",
  "--success-border": "color-mix(in srgb, hsl(var(--success)) 28%, hsl(var(--popover)))",
  "--error-bg": "color-mix(in srgb, hsl(var(--destructive)) 9%, hsl(var(--popover)))",
  "--error-text": "hsl(var(--destructive))",
  "--error-border": "color-mix(in srgb, hsl(var(--destructive)) 28%, hsl(var(--popover)))",
  "--warning-bg": "color-mix(in srgb, hsl(var(--warning)) 10%, hsl(var(--popover)))",
  "--warning-text": "hsl(var(--warning))",
  "--warning-border": "color-mix(in srgb, hsl(var(--warning)) 30%, hsl(var(--popover)))",
  "--info-bg": "color-mix(in srgb, hsl(var(--info)) 9%, hsl(var(--popover)))",
  "--info-text": "hsl(var(--info))",
  "--info-border": "color-mix(in srgb, hsl(var(--info)) 28%, hsl(var(--popover)))",
  "--border-radius": "0.625rem",
} as React.CSSProperties;

const Toaster = ({ style, ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "light"}
      position="bottom-right"
      richColors
      closeButton
      duration={4500}
      visibleToasts={4}
      className="toaster group"
      style={{ ...tokenStyle, ...style }}
      toastOptions={{
        classNames: {
          toast: "group toast font-sans shadow-lg text-sm",
          title: "font-medium",
          description: "text-xs opacity-90",
          actionButton: "!bg-primary !text-primary-foreground !font-medium !rounded-md",
          cancelButton: "!bg-muted !text-muted-foreground !rounded-md",
          closeButton: "!bg-popover !text-muted-foreground !border-border hover:!text-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
