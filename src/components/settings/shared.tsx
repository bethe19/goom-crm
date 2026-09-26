import { forwardRef, useState } from "react";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** Card wrapper used by every settings section. */
export function SettingsSection({
  title,
  description,
  children,
  footer,
  className,
  tone = "default",
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  tone?: "default" | "danger";
}) {
  return (
    <section
      className={cn(
        "rounded-xl border bg-card",
        tone === "danger" ? "border-destructive/40" : "border-border",
        className,
      )}
    >
      <div className="space-y-1 px-5 pt-5 sm:px-6">
        <h2 className={cn("text-sm font-semibold", tone === "danger" && "text-destructive")}>{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="px-5 py-5 sm:px-6">{children}</div>}
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
          {footer}
        </div>
      )}
    </section>
  );
}

/** Inline validation message shown under a field. */
export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  );
}

/** Password input with a show/hide toggle. */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<React.ComponentProps<"input">, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-10", className)} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

/** Copies text to the clipboard with brief "Copied" feedback. */
export function CopyButton({
  value,
  label = "Copy link",
  iconOnly = false,
  className,
}: {
  value: string;
  label?: string;
  iconOnly?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the text and copy it manually.");
    }
  };

  const icon = copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />;

  if (iconOnly) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className={cn("h-8 w-8", className)} onClick={copy} aria-label={label}>
            {icon}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied" : label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" className={cn("gap-1.5", className)} onClick={copy}>
      {icon}
      {copied ? "Copied" : label}
    </Button>
  );
}

/** Live checklist of password rules shown under "new password" fields. */
export function PasswordChecklist({ checks }: { checks: { label: string; ok: boolean }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Password requirements">
      {checks.map((c) => (
        <li key={c.label} className={cn("inline-flex items-center gap-1", c.ok ? "text-foreground" : "text-muted-foreground")}>
          <Check className={cn("h-3 w-3", c.ok ? "opacity-100" : "opacity-30")} aria-hidden />
          <span>{c.label}</span>
          <span className="sr-only">{c.ok ? "(met)" : "(not met)"}</span>
        </li>
      ))}
    </ul>
  );
}
