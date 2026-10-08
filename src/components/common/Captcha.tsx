import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { CAPTCHA_SITE_KEY, loadTurnstile, type TurnstileApi } from "@/lib/captcha";
import { cn } from "@/lib/utils";

export interface CaptchaHandle {
  /** Clears the token and asks Turnstile for a new one (tokens are single-use). */
  reset: () => void;
}

interface CaptchaProps {
  /** A fresh token, or null when it expires, errors or is reset. */
  onToken: (token: string | null) => void;
  /** Turnstile action label shown in Cloudflare analytics, e.g. "login". */
  action?: string;
  className?: string;
}

/** Cloudflare Turnstile widget. Renders nothing unless VITE_TURNSTILE_SITE_KEY is set. */
export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha({ onToken, action, className }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const onTokenRef = useRef(onToken);
  const { resolvedTheme } = useTheme();
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useImperativeHandle(
    ref,
    () => ({
      reset: () => {
        onTokenRef.current(null);
        if (widget.current) widget.current.api.reset(widget.current.id);
      },
    }),
    [],
  );

  useEffect(() => {
    const el = container.current;
    if (!CAPTCHA_SITE_KEY || !el) return;
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        setFailed(false);
        const id = api.render(el, {
          sitekey: CAPTCHA_SITE_KEY as string,
          action,
          theme: resolvedTheme === "dark" ? "dark" : "light",
          size: "flexible",
          "refresh-expired": "auto",
          callback: (token) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(null),
          "error-callback": () => onTokenRef.current(null),
        });
        widget.current = { api, id };
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (widget.current) {
        widget.current.api.remove(widget.current.id);
        widget.current = null;
      }
      onTokenRef.current(null);
    };
  }, [action, resolvedTheme, attempt]);

  if (!CAPTCHA_SITE_KEY) return null;

  return (
    <div className={cn("space-y-1.5", className)}>
      <div ref={container} className="min-h-[65px]" />
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          Couldn't load the security check. Check your connection or content blocker, then{" "}
          <button
            type="button"
            className="rounded-sm font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setAttempt((n) => n + 1)}
          >
            try again
          </button>
          .
        </p>
      )}
    </div>
  );
});
