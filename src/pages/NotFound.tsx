import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/contexts/AuthContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session } = useAuth();
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <main className="flex min-h-screen flex-col bg-background px-4">
      <div className="mx-auto flex w-full max-w-5xl items-center py-5">
        <Link to="/" aria-label="Goom home" className="rounded-md">
          <Brand size="sm" />
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center pb-24">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold text-muted-foreground tabular-nums">404</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We couldn't find <code className="rounded bg-muted px-1.5 py-0.5 text-xs [overflow-wrap:anywhere]">{location.pathname}</code>.
            It may have been moved, or the link may be wrong.
          </p>
          <div className="mt-6 flex flex-col-reverse items-stretch justify-center gap-2 sm:flex-row sm:items-center">
            {canGoBack && (
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ArrowLeft /> Go back
              </Button>
            )}
            <Button asChild variant="outline">
              <Link to="/">Home</Link>
            </Button>
            <Button asChild>
              <Link to={session ? "/dashboard" : "/auth"}>{session ? "Go to dashboard" : "Sign in"}</Link>
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default NotFound;
