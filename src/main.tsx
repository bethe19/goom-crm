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

createRoot(document.getElementById("root")!).render(<App />);
