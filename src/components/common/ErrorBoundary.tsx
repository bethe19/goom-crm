import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** When this value changes the boundary resets (pass location.pathname to recover on navigation). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/** Catches render errors so one broken view can't blank the whole app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    // A route chunk from an older deploy: retrying the same import can't work, a reload can.
    const stale = /dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(
      this.state.error.message,
    );
    return (
      <div role="alert" className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">{stale ? "A new version is available" : "Something went wrong on this page"}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {stale
            ? "Goom was updated while this tab was open. Reload to continue."
            : "Try again — if it keeps happening, let us know via Feedback."}
        </p>
        <div className="mt-6 flex gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => (stale ? window.location.reload() : this.setState({ error: null }))}
          >
            <RotateCw className="h-4 w-4" /> {stale ? "Reload" : "Try again"}
          </Button>
          <Button className="gap-1.5" onClick={() => (window.location.href = "/dashboard")}>
            <Home className="h-4 w-4" /> Go to dashboard
          </Button>
        </div>
      </div>
    );
  }
}
