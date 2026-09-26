import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, LogOut, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/components/common/ConfirmDialog";
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
import { FieldError, PasswordChecklist, PasswordInput, SettingsSection } from "./shared";
import { emailSchema, errorMessage, passwordChecks, passwordSchema } from "./validation";

export function AccountSettings() {
  return (
    <div className="space-y-6">
      <EmailSection />
      <PasswordSection />
      <SessionsSection />
      <DeleteAccountSection />
    </div>
  );
}

// ---- Email -------------------------------------------------------------------------------------

function EmailSection() {
  const { user } = useAuth();
  const current = user?.email ?? "";
  const [sentTo, setSentTo] = useState<string | null>(null);
  const schema = z.object({
    email: emailSchema.refine((v) => v.toLowerCase() !== current.toLowerCase(), "That's already your email"),
  });
  const { register, handleSubmit, formState, reset } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${window.location.origin}/settings?tab=account` },
    );
    if (error) {
      toast.error(errorMessage(error));
      return;
    }
    setSentTo(email);
    reset({ email: "" });
  });

  const pending = sentTo ?? (user as { new_email?: string } | null)?.new_email ?? null;

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title="Email address"
        description={
          <>
            You sign in with <span className="font-medium text-foreground">{current}</span>.
          </>
        }
        footer={
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Sending…
              </>
            ) : (
              "Change email"
            )}
          </Button>
        }
      >
        <div className="space-y-4">
          {pending && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-border bg-secondary/50 p-3 text-sm">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <p>
                We sent a confirmation link to <span className="font-medium">{pending}</span> (and, depending on your security
                settings, to your current address). The change takes effect once confirmed — until then, keep signing in with{" "}
                {current}.
              </p>
            </div>
          )}
          <div className="max-w-sm space-y-1.5">
            <Label htmlFor="account-new-email">New email</Label>
            <Input
              id="account-new-email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              aria-invalid={!!formState.errors.email}
              {...register("email")}
            />
            <FieldError message={formState.errors.email?.message} />
          </div>
        </div>
      </SettingsSection>
    </form>
  );
}

// ---- Password ----------------------------------------------------------------------------------

function isReauthError(err: { message?: string; code?: string } | null | undefined) {
  const text = `${err?.code ?? ""} ${err?.message ?? ""}`.toLowerCase();
  return text.includes("reauthentication") || text.includes("nonce");
}

function PasswordSection() {
  const { user } = useAuth();
  const hasPassword = !!user?.identities?.some((i) => i.provider === "email");
  const [nonceStep, setNonceStep] = useState(false);
  const [nonce, setNonce] = useState("");
  const [nonceError, setNonceError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const schema = z
    .object({
      current: hasPassword ? z.string().min(1, "Enter your current password") : z.string().optional(),
      password: passwordSchema,
      confirm: z.string(),
    })
    .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });
  type Values = z.infer<typeof schema>;

  const { register, handleSubmit, formState, watch, reset, setError, getValues } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current: "", password: "", confirm: "" },
  });
  const password = watch("password");

  const done = () => {
    toast.success(hasPassword ? "Password changed" : "Password set — you can now sign in with email and password");
    reset();
    setNonceStep(false);
    setNonce("");
  };

  const onSubmit = handleSubmit(async (values) => {
    if (hasPassword && user?.email) {
      // Re-authenticate: proves the current password and refreshes the session before a sensitive change.
      const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: values.current ?? "" });
      if (error) {
        setError("current", { message: "That password isn't correct" });
        return;
      }
    }
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (!error) return done();
    if (isReauthError(error)) {
      // "Secure password change" is on: Supabase wants a one-time code sent to the user's email.
      const { error: reauthError } = await supabase.auth.reauthenticate();
      if (reauthError) {
        toast.error(errorMessage(reauthError));
        return;
      }
      setNonceStep(true);
      return;
    }
    toast.error(errorMessage(error));
  });

  const confirmNonce = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nonce.trim()) {
      setNonceError("Enter the code from the email");
      return;
    }
    setVerifying(true);
    setNonceError(null);
    const { error } = await supabase.auth.updateUser({ password: getValues("password"), nonce: nonce.trim() });
    setVerifying(false);
    if (error) setNonceError(isReauthError(error) ? "That code is invalid or expired" : errorMessage(error));
    else done();
  };

  if (nonceStep) {
    return (
      <form onSubmit={confirmNonce} noValidate>
        <SettingsSection
          title="Confirm it's you"
          description={`We emailed a verification code to ${user?.email}. Enter it to finish changing your password.`}
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setNonceStep(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={verifying}>
                {verifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  "Confirm"
                )}
              </Button>
            </>
          }
        >
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="account-nonce">Verification code</Label>
            <Input
              id="account-nonce"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              value={nonce}
              onChange={(e) => setNonce(e.target.value)}
              aria-invalid={!!nonceError}
            />
            <FieldError message={nonceError ?? undefined} />
          </div>
        </SettingsSection>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <SettingsSection
        title={hasPassword ? "Password" : "Set a password"}
        description={
          hasPassword
            ? "Use at least 8 characters with letters and numbers."
            : "You sign in with Google. Add a password to also sign in with your email."
        }
        footer={
          <Button type="submit" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : hasPassword ? (
              "Change password"
            ) : (
              "Set password"
            )}
          </Button>
        }
      >
        <div className="grid max-w-md gap-4">
          {hasPassword && (
            <div className="space-y-1.5">
              <Label htmlFor="account-current-password">Current password</Label>
              <PasswordInput
                id="account-current-password"
                autoComplete="current-password"
                aria-invalid={!!formState.errors.current}
                {...register("current")}
              />
              <FieldError message={formState.errors.current?.message} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="account-new-password">New password</Label>
            <PasswordInput
              id="account-new-password"
              autoComplete="new-password"
              aria-invalid={!!formState.errors.password}
              {...register("password")}
            />
            <PasswordChecklist checks={passwordChecks(password ?? "")} />
            <FieldError message={formState.errors.password?.message} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-confirm-password">Confirm new password</Label>
            <PasswordInput
              id="account-confirm-password"
              autoComplete="new-password"
              aria-invalid={!!formState.errors.confirm}
              {...register("confirm")}
            />
            <FieldError message={formState.errors.confirm?.message} />
          </div>
        </div>
      </SettingsSection>
    </form>
  );
}

// ---- Sessions ----------------------------------------------------------------------------------

function SessionsSection() {
  const confirm = useConfirm();
  const [pending, setPending] = useState(false);

  const signOutOthers = async () => {
    const ok = await confirm({
      title: "Sign out of all other devices?",
      description: "Any other browsers or devices signed in to your account will need to sign in again. This device stays signed in.",
      confirmLabel: "Sign out others",
      destructive: false,
    });
    if (!ok) return;
    setPending(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setPending(false);
    if (error) toast.error(errorMessage(error));
    else toast.success("Signed out of other devices");
  };

  return (
    <SettingsSection
      title="Sessions"
      description="Signed in somewhere you don't recognize? Sign out everywhere else, then change your password."
    >
      <Button type="button" variant="outline" className="gap-1.5" onClick={signOutOthers} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {pending ? "Signing out…" : "Sign out of other devices"}
      </Button>
    </SettingsSection>
  );
}

// ---- Danger zone -------------------------------------------------------------------------------

const DELETE_PHRASE = "DELETE";

function DeleteAccountSection() {
  const { signOut, organization, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (deleting) return;
    setOpen(next);
    if (!next) {
      setTyped("");
      setError(null);
    }
  };

  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typed.trim() !== DELETE_PHRASE) return;
    setDeleting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("delete_my_account");
    if (rpcError) {
      setDeleting(false);
      setError(errorMessage(rpcError));
      return;
    }
    await signOut();
    toast.success("Your account has been deleted");
    navigate("/", { replace: true });
  };

  return (
    <SettingsSection
      tone="danger"
      title="Delete account"
      description="Permanently delete your account and personal data. Records you created stay in the workspace for your teammates, without your name attached."
    >
      <div className="space-y-3">
        {isAdmin && (
          <p className="text-sm text-muted-foreground">
            If you're the only admin of {organization?.name ?? "your workspace"} and others are still members, make someone else an
            admin first (Settings → Team).
          </p>
        )}
        <Button type="button" variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      </div>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={deleteAccount} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This can't be undone. You'll be signed out and won't be able to sign in with this account again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="delete-confirm">
                Type <span className="font-mono font-semibold">{DELETE_PHRASE}</span> to confirm
              </Label>
              <Input
                id="delete-confirm"
                autoFocus
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
              />
              <FieldError message={error ?? undefined} />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => close(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={deleting || typed.trim() !== DELETE_PHRASE}>
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                  </>
                ) : (
                  "Delete account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
