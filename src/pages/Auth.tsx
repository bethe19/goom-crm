import { useState, useEffect } from "react";
import { Navigate, Link, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowRight, ArrowLeft, Sparkles, KeyRound, Mail, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { Brand } from "@/components/Brand";
import { Separator } from "@/components/ui/separator";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().trim().min(1, "Full name is required").max(100, "Name must be under 100 characters"),
});

export default function Auth() {
  const { session, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialWaitlist = searchParams.get("mode") === "waitlist" || searchParams.get("mode") === "signup";

  const [isLogin, setIsLogin] = useState(!initialWaitlist);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  // Forgot password & reset password state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  // Recovery mode (user arrived from password reset email)
  const isResetMode = searchParams.get("mode") === "reset" || window.location.hash.includes("type=recovery");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Local safety fallback so auth form is never indefinitely blocked by loading
  const [authReady, setAuthReady] = useState(!loading);

  useEffect(() => {
    if (!loading) {
      setAuthReady(true);
    } else {
      const timer = setTimeout(() => setAuthReady(true), 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  if (loading && !authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-foreground" />
      </div>
    );
  }

  if (session && !isResetMode) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    const schema = isLogin ? loginSchema : signupSchema;
    const parsed = schema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.errors.forEach((err) => {
        errs[err.path[0] as string] = err.message;
      });
      setFieldErrors(errs);
      return;
    }

    // Always clear demo mode flag when user provides real credentials
    localStorage.removeItem("goom_demo_active");

    setSubmitting(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) throw error;
        navigate("/dashboard");
      } else {
        const data = parsed.data as z.infer<typeof signupSchema>;
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            data: { full_name: data.fullName },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        toast({
          title: "Account Created! 🎉",
          description: "Check your email inbox to confirm your address, or sign in now.",
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      toast({
        title: "Authentication Failed",
        description: sanitizeErrorMessage(message),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !forgotEmail.includes("@")) {
      toast({ title: "Please enter a valid work email", variant: "destructive" });
      return;
    }

    setSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });
      if (error) throw error;
      toast({
        title: "Password Reset Link Sent ✉️",
        description: `We've sent recovery instructions to ${forgotEmail}. Please check your inbox.`,
      });
      setForgotOpen(false);
      setForgotEmail("");
    } catch (error: any) {
      toast({
        title: "Could not send reset email",
        description: sanitizeErrorMessage(error.message || String(error)),
        variant: "destructive",
      });
    } finally {
      setSendingReset(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    setResettingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({
        title: "Password Updated Successfully! 🔒",
        description: "Your new password is set. Welcome to your workspace.",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Failed to update password",
        description: sanitizeErrorMessage(error.message || String(error)),
        variant: "destructive",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({
        title: "Google Sign-In",
        description: sanitizeErrorMessage(err.message || "OAuth provider not enabled yet in your Supabase project."),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased selection:bg-foreground selection:text-background">
      {/* Left showcase panel */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 border-r border-border/80 bg-secondary/35 bg-[linear-gradient(hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.35)_1px,transparent_1px)] bg-[size:40px_40px] overflow-hidden">
        <div className="relative z-10">
          <Link to="/" className="inline-flex transition-opacity hover:opacity-90">
            <Brand size="md" />
          </Link>
        </div>

        <div className="relative z-10 my-auto py-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-xs mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            CRM built for high-velocity teams
          </div>

          <h1 className="text-4xl xl:text-5xl font-semibold leading-[1.12] tracking-tight text-foreground">
            Every deal in sight.<br />
            Nothing slips.
          </h1>

          <p className="mt-4 text-base leading-relaxed text-muted-foreground max-w-md font-normal">
            The visual pipeline your sales team will actually love using. Drag, drop, and forecast revenue with clarity.
          </p>

          <div className="mt-8 max-w-md rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold tracking-tight text-foreground">Sales Pipeline</span>
                <span className="text-[10px] rounded-md bg-secondary px-1.5 py-0.5 font-medium text-muted-foreground">Live Cloud</span>
              </div>
              <span className="rounded-md bg-foreground text-background px-2 py-0.5 text-[10px] font-medium">
                Supabase Connected
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5 transition-colors hover:bg-secondary/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background font-semibold text-xs">
                    H
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">Harbor & Co.</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                      <p className="truncate text-[10px] text-muted-foreground">Sofia Miller • Qualified</p>
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-foreground">$64,000</span>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5 transition-colors hover:bg-secondary/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-foreground text-background font-semibold text-xs">
                    A
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">Atlas Works</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <p className="truncate text-[10px] text-muted-foreground">Amara Davis • Closing</p>
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold text-foreground">$51,200</span>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-muted-foreground flex items-center gap-2">
          <span>Trusted by</span>
          <span className="font-semibold text-foreground">Northstar</span>
          <span>•</span>
          <span className="font-semibold text-foreground">Arc</span>
          <span>•</span>
          <span className="font-semibold text-foreground">Harbor</span>
          <span>•</span>
          <span className="font-semibold text-foreground">Atlas</span>
        </div>
      </div>

      {/* Right panel — Form experience */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-12 bg-background">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="lg:hidden">
              <Link to="/">
                <Brand size="sm" />
              </Link>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ml-auto"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
          </div>

          {/* Recovery / Reset Mode */}
          {isResetMode ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Reset your password
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Enter your new password below to regain access to your account.
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs font-medium text-foreground">
                    New password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                    className="text-xs h-10"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-medium text-foreground">
                    Confirm new password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    required
                    minLength={8}
                    className="text-xs h-10"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={resettingPassword}
                  className="w-full h-10 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 gap-2"
                >
                  {resettingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save New Password"}
                </Button>
              </form>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight mb-1 text-foreground">
                {isLogin ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-xs text-muted-foreground mb-5 font-normal">
                {isLogin ? "Sign in to access your sales pipeline" : "Start closing deals with Goom in minutes"}
              </p>

              {/* Public Beta Real Account Access */}
              <div className="mb-6 rounded-xl border border-border bg-card p-3.5 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="h-3.5 w-3.5 text-foreground" />
                    15-Day Free Trial
                  </span>
                  <span className="text-[10px] font-medium rounded-full bg-secondary text-foreground px-2 py-0.5 border border-border">
                    No Card Required
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-3">
                  Get full access to your cloud workspace, unlimited deals, AI Copilot, and live analytics — free for 15 days.
                </p>
                <Button
                  type="button"
                  variant={!isLogin ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsLogin(false)}
                  className="w-full h-8 text-xs font-medium"
                >
                  Create Free Account
                </Button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-medium text-foreground">
                      Full name
                    </Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jane Smith"
                      required
                      maxLength={100}
                      className="rounded-lg border-border bg-background focus-visible:ring-foreground/20 text-xs h-10 shadow-xs"
                    />
                    {fieldErrors.fullName && <p className="text-xs text-destructive font-medium">{fieldErrors.fullName}</p>}
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-medium text-foreground">
                    Work email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@company.com"
                    required
                    maxLength={255}
                    className="rounded-lg border-border bg-background focus-visible:ring-foreground/20 text-xs h-10 shadow-xs"
                  />
                  {fieldErrors.email && <p className="text-xs text-destructive font-medium">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-xs font-medium text-foreground">
                      Password
                    </Label>
                    {isLogin && (
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(email);
                          setForgotOpen(true);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    maxLength={128}
                    className="rounded-lg border-border bg-background focus-visible:ring-foreground/20 text-xs h-10 shadow-xs"
                  />
                  {fieldErrors.password && <p className="text-xs text-destructive font-medium">{fieldErrors.password}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full h-10 rounded-lg bg-foreground text-background font-medium hover:bg-foreground/90 transition-all shadow-xs flex items-center justify-center gap-2 mt-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      {isLogin ? "Sign in" : "Create account"}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              <div className="relative my-6">
                <Separator className="bg-border" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2.5 text-[11px] font-medium text-muted-foreground">
                  or continue with
                </span>
              </div>

              <Button
                variant="outline"
                className="w-full h-10 rounded-lg border border-border bg-background hover:bg-secondary/60 font-medium transition-all shadow-xs flex items-center justify-center gap-2.5 text-xs text-foreground"
                onClick={handleGoogleSignIn}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </Button>

              <div className="mt-7 text-center text-xs">
                <span className="text-muted-foreground">
                  {isLogin ? "Don't have an account?" : "Already have an account?"}
                </span>{" "}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setFieldErrors({});
                  }}
                  className="font-semibold text-foreground hover:underline ml-1 transition-all"
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary mb-1">
              <KeyRound className="h-4 w-4" />
            </div>
            <DialogTitle className="text-base font-semibold">Forgot your password?</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendResetEmail} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-medium">Work Email</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="colleague@company.com"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="text-xs h-9"
                autoFocus
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setForgotOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={sendingReset}
                className="text-xs font-medium gap-1.5"
              >
                {sendingReset ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                <span>Send Reset Link</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
