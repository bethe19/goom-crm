import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook, waitFor } from "@testing-library/react";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  delete window.turnstile;
  document.head.querySelectorAll("script[src*='challenges.cloudflare.com']").forEach((s) => s.remove());
});

describe("CAPTCHA switched off (no site key)", () => {
  it("never blocks a submit and renders nothing", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "");
    const { useCaptcha } = await import("@/hooks/useCaptcha");
    const { Captcha } = await import("@/components/common/Captcha");
    const { result } = renderHook(() => useCaptcha());
    expect(result.current.missing).toBe(false);
    expect(result.current.token).toBeUndefined();
    const { container } = render(<Captcha onToken={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    expect(document.head.querySelector("script[src*='challenges.cloudflare.com']")).toBeNull();
  });
});

describe("CAPTCHA switched on", () => {
  it("requires a token, hands it over once solved and clears it on reset", async () => {
    vi.stubEnv("VITE_TURNSTILE_SITE_KEY", "1x00000000000000000000AA");
    let solve: (token: string) => void = () => {};
    const api = {
      render: vi.fn((_el: HTMLElement, opts: { sitekey: string; callback?: (t: string) => void }) => {
        solve = (t) => opts.callback?.(t);
        return "widget-1";
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };
    window.turnstile = api;

    const { useCaptcha } = await import("@/hooks/useCaptcha");
    const { Captcha } = await import("@/components/common/Captcha");
    const { result } = renderHook(() => useCaptcha());
    expect(result.current.missing).toBe(true);

    const { unmount } = render(<Captcha {...result.current.widgetProps} action="login" />);
    await waitFor(() => expect(api.render).toHaveBeenCalledTimes(1));
    expect(api.render.mock.calls[0][1]).toMatchObject({ sitekey: "1x00000000000000000000AA", action: "login" });

    act(() => solve("token-abc"));
    expect(result.current.token).toBe("token-abc");
    expect(result.current.missing).toBe(false);

    act(() => result.current.reset());
    expect(api.reset).toHaveBeenCalledWith("widget-1");
    expect(result.current.missing).toBe(true);

    unmount();
    expect(api.remove).toHaveBeenCalledWith("widget-1");
  });
});
