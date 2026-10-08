import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  KanbanSquare,
  ListChecks,
  Loader2,
  MailCheck,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INVITE_TOKEN_KEY, useAuth, type AppRole } from "@/contexts/AuthContext";
import { PLANS, TRIAL_DAYS, type PlanId } from "@/lib/plans";
import { Badge } from "@/components/ui/badge";
import { readSelectedPlan, storeSelectedPlan } from "@/components/onboarding/selectedPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Brand } from "@/components/Brand";
import { FieldError, PasswordChecklist, PasswordInput } from "@/components/settings/shared";
import { Captcha } from "@/components/common/Captcha";
import { CAPTCHA_MISSING_MESSAGE, useCaptcha } from "@/hooks/useCaptcha";
import {
  emailSchema,
  errorMessage,
  fullNameSchema,
  passwordChecks,
  passwordSchema,
  roleLabel,
} from "@/components/settings/validation";

type View = "signin" | "signup" | "forgot" | "forgot-sent" | "check-inbox" | "reset";

interface InvitePreview {
  organization_name: string;
  email: string;
  role: AppRole;
  expired: boolean;
  accepted: boolean;
}

type InviteStatus = "none" | "loading" | "error" | "invalid" | "expired" | "accepted" | "valid";

function forgetInviteToken() {
  try {
    sessionStorage.removeItem(INVITE_TOKEN_KEY);
  } catch {
    // storage blocked
  }
}

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password"),
});

const signUpSchema = z.object({
  fullName: fullNameSchema,
  company: z.string().trim().max(100, "Keep it under 100 characters").optional(),
  email: emailSchema,
  password: passwordSchema,
});

const forgotSchema = z.object({ email: emailSchema });

const resetSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

/** Only same-app, non-auth paths are allowed as post-login redirects. */
function safeRedirect(from: unknown): string {
  let path: string | null = null;
  if (typeof from === "string") path = from;
  else if (from && typeof from === "object" && "pathname" in from) {
    const loc = from as { pathname?: string; search?: string; hash?: string };
    path = `${loc.pathname ?? ""}${loc.search ?? ""}${loc.hash ?? ""}`;
  }
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/dashboard";
  if (path === "/" || path.startsWith("/auth") || path.startsWith("/invite")) return "/dashboard";
  return path;
}

function oauthErrorMessage(err: unknown): string {
  const message = (err as { message?: string } | null)?.message?.toLowerCase() ?? "";
  if (message.includes("provider is not enabled") || message.includes("unsupported provider")) {
    return "Google sign-in isn't enabled yet. Use your email and password instead.";
  }
  return errorMessage(err);
}

function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default function Auth() {
  const { session, user, loading, refreshUserRole, signOut } = useAuth();
  const { token } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const redirectTo = safeRedirect((location.state as { from?: unknown } | null)?.from);
  const modeParam = searchParams.get("mode");
  // Plan picked on the pricing page; applied in onboarding once the workspace exists.
  const [selectedPlan] = useState<PlanId | null>(() =>
    token ? null : storeSelectedPlan(searchParams.get("plan")) ?? readSelectedPlan(),
  );
  const isRecoveryLink = modeParam === "reset" || window.location.hash.includes("type=recovery");

  const [view, setView] = useState<View>(() => {
    if (isRecoveryLink) return "reset";
    if (token || modeParam === "signup" || modeParam === "waitlist") return "signup";
    return "signin";
  });
  const [pendingEmail, setPendingEmail] = useState("");

  // Supabase emits PASSWORD_RECOVERY when a recovery link is opened.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setView("reset");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // ---- Invitations -------------------------------------------------------------------------
  // Signed-out visitors: keep the token so AuthContext accepts it right after sign-in (also survives
  // the Google OAuth round trip, which returns to this tab). Signed-in visitors join explicitly below.
  useEffect(() => {
    if (!token || loading || session) return;
    try {
      sessionStorage.setItem(INVITE_TOKEN_KEY, token);
    } catch {
      // storage blocked: the invitee can open the link again after signing in
    }
  }, [token, loading, session]);

  const previewQuery = useQuery({
    queryKey: ["invite-preview", token],
    enabled: !!token,
    retry: 2,
    staleTime: Infinity,
    queryFn: async (): Promise<InvitePreview | null> => {
      const { data, error } = await supabase.rpc("get_invitation_preview", { p_token: token! });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as unknown as InvitePreview | null | undefined;
      return row ?? null;
    },
  });
  const invite = previewQuery.data ?? null;

  const inviteStatus: InviteStatus = !token
    ? "none"
    : previewQuery.isLoading
      ? "loading"
      : previewQuery.isError
        ? "error"
        : !invite
          ? "invalid"
        : invite.accepted
          ? "accepted"
          : invite.expired
            ? "expired"
            : "valid";

  // A dead invite must not be accepted later by AuthContext.
  useEffect(() => {
    if (inviteStatus === "invalid" || inviteStatus === "expired" || inviteStatus === "accepted") forgetInviteToken();
  }, [inviteStatus]);

  const emailMismatch =
    !!user?.email && !!invite?.email && user.email.toLowerCase() !== invite.email.toLowerCase();
  // Signed in as the invitee: join a valid invite, or (if AuthContext already accepted it during sign-in) just continue.
  const canJoin = !!session && !emailMismatch && (inviteStatus === "valid" || inviteStatus === "accepted");

  // Already signed in and opening a valid invite: join right away.
  const joining = useRef(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  useEffect(() => {
    if (loading || !token || !canJoin || joining.current) return;
    joining.current = true;
    const workspace = invite?.organization_name ?? "the workspace";
    const alreadyAccepted = inviteStatus === "accepted";
    (async () => {
      // AuthContext may already have accepted it during sign-in; don't let it retry in parallel.
      forgetInviteToken();
      // For an invitation the user already accepted this switches them back to that workspace.
      const { error } = await supabase.rpc("accept_invitation", { p_token: token });
      if (error) {
        setJoinError(errorMessage(error));
        return;
      }
      await refreshUserRole();
      toast.success(alreadyAccepted ? `You're in ${workspace}` : `You joined ${workspace}`);
      navigate("/dashboard", { replace: true });
    })().catch((err) => setJoinError(errorMessage(err)));
  }, [loading, token, canJoin, inviteStatus, invite?.organization_name, refreshUserRole, navigate]);

  // ---- Routing guards ------------------------------------------------------------------------
  if (loading && !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" aria-busy="true" aria-label="Loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session && !token && view !== "reset") return <Navigate to={redirectTo} replace />;

  // ---- Content -----------------------------------------------------------------------------
  let content: React.ReactNode;

  if (token && inviteStatus === "loading") {
    content = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking your invitation…
      </div>
    );
  } else if (token && inviteStatus === "error") {
    content = (
      <div className="space-y-4">
        <Header
          title="We couldn't check your invitation"
          description="Check your connection and try again. Your invitation hasn't been used."
        />
        <Button onClick={() => void previewQuery.refetch()} loading={previewQuery.isFetching}>
          Try again
        </Button>
      </div>
    );
  } else if (token && inviteStatus !== "valid" && !canJoin) {
    content = <InviteProblem status={inviteStatus} workspace={invite?.organization_name} signedIn={!!session} />;
  } else if (token && session) {
    content = emailMismatch ? (
      <div className="space-y-4">
        <Header
          title="This invitation is for another email"
          description={
            <>
              It was sent to <strong className="text-foreground">{invite?.email}</strong>, but you're signed in as{" "}
              <strong className="text-foreground">{user?.email}</strong>. Sign out, then open the link again.
            </>
          }
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => signOut()}>Sign out</Button>
          <Button variant="outline" asChild>
            <Link to="/dashboard">Go to my workspace</Link>
          </Button>
        </div>
      </div>
    ) : joinError ? (
      <div className="space-y-4">
        <Header title="We couldn't add you to the workspace" description={joinError} />
        <Button variant="outline" asChild>
          <Link to="/dashboard">Go to my workspace</Link>
        </Button>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-busy="true">
        <Loader2 className="h-4 w-4 animate-spin" /> Joining {invite?.organization_name}…
      </div>
    );
  } else if (view === "reset") {
    content = session ? (
      <ResetPasswordForm onDone={() => navigate("/dashboard", { replace: true })} />
    ) : (
      <div className="space-y-4">
        <Header
          title="This reset link has expired"
          description="Password reset links work once and expire after a short time. Request a new one below."
        />
        <Button onClick={() => setView("forgot")}>Send a new link</Button>
      </div>
    );
  } else if (view === "forgot") {
    content = (
      <ForgotPasswordForm
        defaultEmail={pendingEmail}
        onBack={() => setView("signin")}
        onSent={(email) => {
          setPendingEmail(email);
          setView("forgot-sent");
        }}
      />
    );
  } else if (view === "forgot-sent") {
    content = (
      <InboxNotice
        title="Check your inbox"
        description={
          <>
            If an account exists for <strong className="text-foreground">{pendingEmail}</strong>, you'll get a link to reset your
            password in a minute or two.
          </>
        }
        onBack={() => setView("signin")}
      />
    );
  } else if (view === "check-inbox") {
    content = (
      <InboxNotice
        title="Confirm your email"
        description={
          <>
            We sent a confirmation link to <strong className="text-foreground">{pendingEmail}</strong>. Open it to finish setting up
            your account.
          </>
        }
        resendEmail={pendingEmail}
        emailRedirectTo={token ? `${window.location.origin}/invite/${token}` : `${window.location.origin}/dashboard`}
        onBack={() => setView("signin")}
      />
    );
  } else {
    const lockedEmail = invite?.email;
    content = (
      <div className="space-y-6">
        {view === "signin" ? (
          <>
            <Header
              title={invite ? `Sign in to join ${invite.organization_name}` : "Welcome back"}
              description={invite ? `You've been invited as ${roleLabel(invite.role).toLowerCase()}.` : "Sign in to your workspace."}
            />
            <SignInForm
              lockedEmail={lockedEmail}
              onForgot={(email) => {
                setPendingEmail(email);
                setView("forgot");
              }}
              onNeedsConfirmation={(email) => {
                setPendingEmail(email);
                setView("check-inbox");
              }}
            />
          </>
        ) : (
          <>
            <Header
              title={invite ? `Join ${invite.organization_name}` : "Create your account"}
              description={
                invite
                  ? `You've been invited as ${roleLabel(invite.role).toLowerCase()}. Create an account to accept.`
                  : "Set up a workspace for your team in a minute."
              }
            />
            {!invite && selectedPlan && (
              <p className="-mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary">Selected plan: {PLANS[selectedPlan].name}</Badge>
                <span className="text-xs">Free for {TRIAL_DAYS} days, no card required. You can switch plans during the trial.</span>
              </p>
            )}
            <SignUpForm
              token={token}
              lockedEmail={lockedEmail}
              redirectTo={redirectTo}
              onNeedsConfirmation={(email) => {
                setPendingEmail(email);
                setView("check-inbox");
              }}
            />
          </>
        )}

        <GoogleButton returnPath={token ? `/invite/${token}` : redirectTo} />

        <p className="text-center text-sm text-muted-foreground">
          {view === "signin" ? "New to Goom?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => setView(view === "signin" ? "signup" : "signin")}
            className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {view === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased">
      <SidePanel workspace={inviteStatus === "valid" ? invite?.organization_name : undefined} />

      <main className="flex flex-1 flex-col px-4 py-6 sm:px-10 sm:py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="lg:invisible" aria-label="Goom home">
            <Brand size="sm" />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Home
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{content}</div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/terms" className="underline underline-offset-4 hover:text-foreground">Terms</Link> and{" "}
          <Link to="/privacy" className="underline underline-offset-4 hover:text-foreground">Privacy Policy</Link>.
        </p>
      </main>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------

function Header({ title, description }: { title: string; description?: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function SidePanel({ workspace }: { workspace?: string }) {
  const points = [
    { icon: KanbanSquare, title: "A pipeline you can see", text: "Drag deals between stages and know what's closing this month." },
    { icon: ListChecks, title: "Follow-ups that happen", text: "Tasks, calls and meetings tied to every deal and contact." },
    { icon: BarChart3, title: "Forecasts from real data", text: "Weighted pipeline and win rates computed from your deals." },
    { icon: Users, title: "Built for teams", text: "Invite teammates, set roles, and work from one shared workspace." },
  ];
  return (
    <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between border-r border-border bg-secondary/40 p-10 lg:flex xl:p-12">
      <Link to="/" className="inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Goom home">
        <Brand size="md" />
      </Link>
      <div className="space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            {workspace ? `Your team at ${workspace} is waiting.` : "Every deal in sight. Nothing slips."}
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Goom is a focused CRM for small sales teams — pipeline, contacts, tasks and forecasting in one place.
          </p>
        </div>
        <ul className="space-y-4">
          {points.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-sm text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Goom</p>
    </aside>
  );
}

function InviteProblem({ status, workspace, signedIn }: { status: InviteStatus; workspace?: string; signedIn: boolean }) {
  const copy =
    status === "expired"
      ? {
          title: "This invitation has expired",
          description: `Ask ${workspace ? `an admin of ${workspace}` : "the person who invited you"} to send a new invitation.`,
        }
      : status === "accepted"
        ? {
            title: "This invitation was already used",
            description: "If it was you, sign in to reach the workspace. Otherwise ask for a new invitation.",
          }
        : {
            title: "This invitation link isn't valid",
            description: "It may have been revoked, or the link was copied incompletely. Ask for a new invitation.",
          };
  return (
    <div className="space-y-5">
      <Header title={copy.title} description={copy.description} />
      <div className="flex flex-col gap-2 sm:flex-row">
        {signedIn ? (
          <Button asChild>
            <Link to="/dashboard">Go to my workspace</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        )}
        <Button variant="outline" asChild>
          <Link to="/">Back to home</Link>
        </Button>
      </div>
    </div>
  );
}

function SignInForm({
  lockedEmail,
  onForgot,
  onNeedsConfirmation,
}: {
  lockedEmail?: string;
  onForgot: (email: string) => void;
  onNeedsConfirmation: (email: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: lockedEmail ?? "", password: "" },
  });
  const { register, handleSubmit, formState, getValues } = form;
  const captcha = useCaptcha();

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setUnconfirmed(false);
    if (captcha.missing) {
      setFormError(CAPTCHA_MISSING_MESSAGE);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
      options: { captchaToken: captcha.token },
    });
    captcha.reset();
    if (error) {
      if (error.message.toLowerCase().includes("not confirmed")) setUnconfirmed(true);
      setFormError(errorMessage(error));
    }
    // On success AuthContext picks up the session and the page redirects.
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      {unconfirmed && (
        <Button type="button" variant="outline" size="sm" onClick={() => onNeedsConfirmation(getValues("email"))}>
          Resend confirmation email
        </Button>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          autoComplete="email"
          autoFocus={!lockedEmail}
          readOnly={!!lockedEmail}
          aria-invalid={!!formState.errors.email}
          aria-describedby="signin-email-error"
          placeholder="you@company.com"
          {...register("email")}
        />
        <FieldError id="signin-email-error" message={formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="signin-password">Password</Label>
          <button
            type="button"
            onClick={() => onForgot(getValues("email"))}
            className="rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Forgot password?
          </button>
        </div>
        <PasswordInput
          id="signin-password"
          autoComplete="current-password"
          autoFocus={!!lockedEmail}
          aria-invalid={!!formState.errors.password}
          aria-describedby="signin-password-error"
          {...register("password")}
        />
        <FieldError id="signin-password-error" message={formState.errors.password?.message} />
      </div>
      <Captcha {...captcha.widgetProps} action="login" />
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>
    </form>
  );
}

function SignUpForm({
  token,
  lockedEmail,
  redirectTo,
  onNeedsConfirmation,
}: {
  token?: string;
  lockedEmail?: string;
  redirectTo: string;
  onNeedsConfirmation: (email: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", company: "", email: lockedEmail ?? "", password: "" },
  });
  const { register, handleSubmit, formState, watch } = form;
  const password = watch("password");
  const checks = useMemo(() => passwordChecks(password ?? ""), [password]);
  const captcha = useCaptcha();

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (captcha.missing) {
      setFormError(CAPTCHA_MISSING_MESSAGE);
      return;
    }
    const metadata: Record<string, string> = { full_name: values.fullName.trim() };
    if (token) metadata.invite_token = token;
    else {
      if (values.company?.trim()) metadata.company = values.company.trim();
      // The confirmation email opens a new tab without this tab's sessionStorage.
      const plan = readSelectedPlan();
      if (plan) metadata.selected_plan = plan;
    }

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: metadata,
        emailRedirectTo: token
          ? `${window.location.origin}/invite/${token}`
          : `${window.location.origin}${redirectTo}`,
        captchaToken: captcha.token,
      },
    });
    captcha.reset();
    if (error) {
      setFormError(errorMessage(error));
      return;
    }
    // With email confirmation on, an existing address comes back as a user without identities.
    if (data.user && data.user.identities?.length === 0) {
      setFormError("An account with this email already exists. Try signing in instead.");
      return;
    }
    if (!data.session) onNeedsConfirmation(values.email);
    // With a session, AuthContext loads the workspace (and accepts the invite) and the page redirects.
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <FormAlert message={formError} />
      <div className="space-y-1.5">
        <Label htmlFor="signup-name">
          Full name <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <Input
          id="signup-name"
          autoComplete="name"
          autoFocus
          placeholder="Jane Smith"
          aria-invalid={!!formState.errors.fullName}
          aria-describedby="signup-name-error"
          {...register("fullName")}
        />
        <FieldError id="signup-name-error" message={formState.errors.fullName?.message} />
      </div>
      {!token && (
        <div className="space-y-1.5">
          <Label htmlFor="signup-company">Company</Label>
          <Input
            id="signup-company"
            autoComplete="organization"
            placeholder="Acme Inc. (becomes your workspace name)"
            aria-invalid={!!formState.errors.company}
            aria-describedby="signup-company-error"
            {...register("company")}
          />
          <FieldError id="signup-company-error" message={formState.errors.company?.message} />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="signup-email">
          Work email <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <Input
          id="signup-email"
          type="email"
          autoComplete="email"
          readOnly={!!lockedEmail}
          placeholder="you@company.com"
          aria-invalid={!!formState.errors.email}
          aria-describedby="signup-email-error"
          {...register("email")}
        />
        {lockedEmail && <p className="text-xs text-muted-foreground">Invitations are tied to the address they were sent to.</p>}
        <FieldError id="signup-email-error" message={formState.errors.email?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="signup-password">
          Password <span className="text-destructive" aria-hidden>*</span>
        </Label>
        <PasswordInput
          id="signup-password"
          autoComplete="new-password"
          aria-invalid={!!formState.errors.password}
          aria-describedby="signup-password-error signup-password-rules"
          {...register("password")}
        />
        <div id="signup-password-rules">
          <PasswordChecklist checks={checks} />
        </div>
        <FieldError id="signup-password-error" message={formState.errors.password?.message} />
      </div>
      <Captcha {...captcha.widgetProps} action="signup" />
      <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
        {formState.isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Creating account…
          </>
        ) : token ? (
          "Create account and join"
        ) : (
          "Create account"
        )}
      </Button>
    </form>
  );
}

function GoogleButton({ returnPath }: { returnPath: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = async () => {
    setPending(true);
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${returnPath}` },
    });
    if (oauthError) {
      setError(oauthErrorMessage(oauthError));
      setPending(false);
    }
    // On success the browser navigates to Google.
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground">
          or
        </span>
      </div>
      <Button type="button" variant="outline" className="w-full gap-2" onClick={signIn} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Button>
      <FormAlert message={error} />
    </div>
  );
}

function ForgotPasswordForm({
  defaultEmail,
  onBack,
  onSent,
}: {
  defaultEmail: string;
  onBack: () => void;
  onSent: (email: string) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: defaultEmail },
  });
  const captcha = useCaptcha();

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    if (captcha.missing) {
      setFormError(CAPTCHA_MISSING_MESSAGE);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
      captchaToken: captcha.token,
    });
    captcha.reset();
    if (error) setFormError(errorMessage(error));
    else onSent(email);
  });

  return (
    <div className="space-y-6">
      <Header title="Reset your password" description="Enter your account email and we'll send you a reset link." />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            aria-invalid={!!formState.errors.email}
            aria-describedby="forgot-email-error"
            {...register("email")}
          />
          <FieldError id="forgot-email-error" message={formState.errors.email?.message} />
        </div>
        <Captcha {...captcha.widgetProps} action="recover" />
        <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
        <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
          Back to sign in
        </Button>
      </form>
    </div>
  );
}

function ResetPasswordForm({ onDone }: { onDone: () => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState, watch } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const password = watch("password");

  const onSubmit = handleSubmit(async ({ password: newPassword }) => {
    setFormError(null);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setFormError(errorMessage(error));
      return;
    }
    toast.success("Password updated");
    onDone();
  });

  return (
    <div className="space-y-6">
      <Header title="Choose a new password" description="You'll use it the next time you sign in." />
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <FormAlert message={formError} />
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            autoFocus
            aria-invalid={!!formState.errors.password}
            aria-describedby="reset-password-error"
            {...register("password")}
          />
          <PasswordChecklist checks={passwordChecks(password ?? "")} />
          <FieldError id="reset-password-error" message={formState.errors.password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm">Confirm new password</Label>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            aria-invalid={!!formState.errors.confirm}
            aria-describedby="reset-confirm-error"
            {...register("confirm")}
          />
          <FieldError id="reset-confirm-error" message={formState.errors.confirm?.message} />
        </div>
        <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : (
            "Save password"
          )}
        </Button>
      </form>
    </div>
  );
}

function InboxNotice({
  title,
  description,
  resendEmail,
  emailRedirectTo,
  onBack,
}: {
  title: string;
  description: React.ReactNode;
  resendEmail?: string;
  emailRedirectTo?: string;
  onBack: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sentAgain, setSentAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const resend = async () => {
    if (!resendEmail) return;
    setError(null);
    if (captcha.missing) {
      setError(CAPTCHA_MISSING_MESSAGE);
      return;
    }
    setSending(true);
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email: resendEmail,
      options: { emailRedirectTo, captchaToken: captcha.token },
    });
    captcha.reset();
    setSending(false);
    if (resendError) {
      setError(errorMessage(resendError));
    } else {
      setSentAgain(true);
      setCooldown(30);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary">
        <MailCheck className="h-5 w-5" aria-hidden />
      </div>
      <Header title={title} description={description} />
      <p className="text-sm text-muted-foreground">Can't find it? Check your spam folder, or make sure the address is correct.</p>
      <FormAlert message={error} />
      {sentAgain && (
        <p className="flex items-center gap-1.5 text-sm text-foreground" role="status">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Sent again.
        </p>
      )}
      {resendEmail && <Captcha {...captcha.widgetProps} action="resend" />}
      <div className="flex flex-col gap-2">
        {resendEmail && (
          <Button variant="outline" onClick={resend} disabled={sending || cooldown > 0}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : cooldown > 0 ? (
              `Resend in ${cooldown}s`
            ) : (
              "Resend email"
            )}
          </Button>
        )}
        <Button variant="ghost" onClick={onBack}>
          Back to sign in
        </Button>
      </div>
    </div>
  );
}
