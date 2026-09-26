import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { MarketingLayout } from "@/components/marketing/MarketingLayout";
import { SITE } from "@/components/marketing/site";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(100, "Keep it under 100 characters"),
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address").max(254, "That email is too long"),
  company: z.string().trim().max(120, "Keep it under 120 characters").optional(),
  message: z
    .string()
    .trim()
    .min(10, "Tell us a little more (at least 10 characters)")
    .max(5000, "Keep it under 5,000 characters"),
  /** Honeypot: hidden from people, often filled in by bots. */
  website: z.string().optional(),
});

type ContactValues = z.infer<typeof contactSchema>;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

export default function Contact() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", company: "", message: "", website: "" },
  });

  const onSubmit = async (values: ContactValues) => {
    setSubmitError(null);
    // Bots that fill the hidden field get a normal-looking success, but nothing is stored.
    if (values.website) {
      setSentTo(values.email);
      return;
    }
    const { error } = await supabase.from("contact_requests").insert({
      name: values.name,
      email: values.email,
      company: values.company || null,
      message: values.message,
    });
    if (error) {
      setSubmitError(sanitizeErrorMessage(error.message));
      return;
    }
    setSentTo(values.email);
    reset();
  };

  return (
    <MarketingLayout title="Contact">
      <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Contact</p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Let's talk about your sales workflow.</h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Questions about Goom, help getting your team set up, or a feature you'd like to see — send us a message and a
            person will read it.
          </p>
          <div className="mt-10 flex items-start gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="text-sm">
              <h2 className="font-semibold">Prefer email?</h2>
              <p className="mt-1 text-muted-foreground">
                Sales:{" "}
                <a href={`mailto:${SITE.salesEmail}`} className="text-foreground underline underline-offset-4">
                  {SITE.salesEmail}
                </a>
              </p>
              <p className="text-muted-foreground">
                Support:{" "}
                <a href={`mailto:${SITE.supportEmail}`} className="text-foreground underline underline-offset-4">
                  {SITE.supportEmail}
                </a>
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
          {sentTo ? (
            <div className="py-10 text-center" role="status">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-foreground text-background">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-xl font-semibold tracking-tight">Message sent</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                Thanks for getting in touch. We'll reply to <span className="font-medium text-foreground">{sentTo}</span>.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => setSentTo(null)}>
                Send another message
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">
                    Name <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="contact-name"
                    autoComplete="name"
                    autoFocus
                    aria-invalid={!!errors.name}
                    aria-describedby={errors.name ? "contact-name-error" : undefined}
                    {...register("name")}
                  />
                  <FieldError id="contact-name-error" message={errors.name?.message} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact-email">
                    Work email <span className="text-destructive" aria-hidden="true">*</span>
                  </Label>
                  <Input
                    id="contact-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "contact-email-error" : undefined}
                    {...register("email")}
                  />
                  <FieldError id="contact-email-error" message={errors.email?.message} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-company">Company</Label>
                <Input
                  id="contact-company"
                  autoComplete="organization"
                  aria-invalid={!!errors.company}
                  aria-describedby={errors.company ? "contact-company-error" : undefined}
                  {...register("company")}
                />
                <FieldError id="contact-company-error" message={errors.company?.message} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="contact-message">
                  How can we help? <span className="text-destructive" aria-hidden="true">*</span>
                </Label>
                <Textarea
                  id="contact-message"
                  rows={5}
                  placeholder="Tell us about your team, what you use today, and what you're looking for."
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "contact-message-error" : undefined}
                  {...register("message")}
                />
                <FieldError id="contact-message-error" message={errors.message?.message} />
              </div>

              {/* Honeypot — visually hidden and skipped by keyboard and screen readers. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="contact-website">Website</label>
                <input id="contact-website" type="text" tabIndex={-1} autoComplete="off" {...register("website")} />
              </div>

              {submitError && (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
                  <span>
                    Your message wasn't sent. {submitError} You can also email{" "}
                    <a href={`mailto:${SITE.supportEmail}`} className="underline underline-offset-4">
                      {SITE.supportEmail}
                    </a>
                    .
                  </span>
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Sending…
                  </>
                ) : (
                  "Send message"
                )}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                We only use these details to reply to you. See our{" "}
                <Link to="/privacy" className="underline underline-offset-4">
                  privacy policy
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </MarketingLayout>
  );
}
