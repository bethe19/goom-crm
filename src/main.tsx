import { createRoot } from "react-dom/client";
import App from "./App.tsx";
// Self-hosted Poppins — only the weights the UI uses. Each file declares per-subset
// @font-face rules with unicode-range, so browsers download just the subsets they need.
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/400-italic.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./index.css";

// After a deploy, an open tab may request route chunks that no longer exist. Reload once to pick
// up the new build; if it still fails right after reloading, let the ErrorBoundary show it.
window.addEventListener("vite:preloadError", (event) => {
  const KEY = "goom:chunk-reload-at";
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0);
  } catch {
    // storage blocked
  }
  if (Date.now() - last < 10_000) return;
  try {
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage blocked
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
