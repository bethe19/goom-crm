import { useCallback, useRef, useState } from "react";
import type { CaptchaHandle } from "@/components/common/Captcha";
import { captchaEnabled } from "@/lib/captcha";

export const CAPTCHA_MISSING_MESSAGE = "Complete the security check first.";

/**
 * Token state for one <Captcha />: spread `widgetProps` onto it, refuse to submit while `missing`,
 * pass `token` as `captchaToken`, and call `reset()` after every request (tokens are single-use).
 */
export function useCaptcha() {
  const ref = useRef<CaptchaHandle>(null);
  const [token, setToken] = useState<string | null>(null);
  const reset = useCallback(() => ref.current?.reset(), []);
  return {
    token: token ?? undefined,
    missing: captchaEnabled && !token,
    reset,
    widgetProps: { ref, onToken: setToken },
  };
}
