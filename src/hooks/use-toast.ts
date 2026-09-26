import type * as React from "react";
import { toast as sonner, type ExternalToast } from "sonner";

/**
 * Single toast API for the whole app, backed by the Sonner <Toaster /> mounted in App.tsx.
 *
 * Keeps the shadcn-style call signature (`toast({ title, description, variant })`) so existing
 * call sites keep working, and adds semantic variants plus an optional action (e.g. "Undo").
 */
export type ToastVariant = "default" | "destructive" | "success" | "info" | "warning";

export interface ToastOptions {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: ToastVariant;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

export function toast({ title, description, variant = "default", duration, action }: ToastOptions) {
  const opts: ExternalToast = { description, duration };
  if (action) opts.action = { label: action.label, onClick: action.onClick };
  const message = title ?? description ?? "";
  if (title === undefined) opts.description = undefined;

  switch (variant) {
    case "destructive":
      return sonner.error(message, opts);
    case "success":
      return sonner.success(message, opts);
    case "info":
      return sonner.info(message, opts);
    case "warning":
      return sonner.warning(message, opts);
    default:
      return sonner(message, opts);
  }
}

export function useToast() {
  return { toast, dismiss: (id?: string | number) => sonner.dismiss(id) };
}
