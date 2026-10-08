/**
 * Cloudflare Turnstile for Supabase Auth CAPTCHA protection.
 *
 * Set VITE_TURNSTILE_SITE_KEY (public) to show the widget on sign-up, sign-in, password reset and
 * "resend confirmation", and pass its token to Supabase. Turn CAPTCHA on in the Supabase dashboard
 * (Authentication → Attack Protection, provider Turnstile, with the secret key) only after a build
 * with the site key is live: once it's on, every password sign-in without a token is refused.
 */
export const CAPTCHA_SITE_KEY: string | null = (import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "").trim() || null;

export const captchaEnabled = CAPTCHA_SITE_KEY !== null;

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

export interface TurnstileOptions {
  sitekey: string;
  action?: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "expired-callback"?: () => void;
  "error-callback"?: () => void;
  "refresh-expired"?: "auto" | "manual" | "never";
}

export interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileOptions): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** Loads the Turnstile script once; a failed load can be retried by calling again. */
export function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) {
    loading = new Promise<TurnstileApi>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not initialise")));
      script.onerror = () => {
        loading = null;
        script.remove();
        reject(new Error("Couldn't load the security check"));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}
