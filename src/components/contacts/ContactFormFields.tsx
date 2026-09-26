import { Controller, type UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CompanyPicker } from "@/components/companies/CompanyPicker";
import type { ContactFormValues } from "@/components/contacts/contactForm";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-xs text-destructive">
      {message}
    </p>
  );
}

/** The contact fields shared by the create dialog and the detail sheet's edit form. */
export function ContactFormFields({ form, idPrefix, autoFocus }: { form: UseFormReturn<ContactFormValues>; idPrefix: string; autoFocus?: boolean }) {
  const { register, control, formState } = form;
  const e = formState.errors;
  const fid = (name: string) => `${idPrefix}-${name}`;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={fid("first_name")}>
            First name <span className="text-destructive">*</span>
          </Label>
          <Input
            id={fid("first_name")}
            autoFocus={autoFocus}
            autoComplete="off"
            aria-invalid={!!e.first_name}
            aria-describedby={e.first_name ? fid("first_name-error") : undefined}
            {...register("first_name")}
          />
          <FieldError id={fid("first_name-error")} message={e.first_name?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fid("last_name")}>Last name</Label>
          <Input id={fid("last_name")} autoComplete="off" aria-invalid={!!e.last_name} {...register("last_name")} />
          <FieldError id={fid("last_name-error")} message={e.last_name?.message} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={fid("email")}>Email</Label>
          <Input
            id={fid("email")}
            type="email"
            autoComplete="off"
            aria-invalid={!!e.email}
            aria-describedby={e.email ? fid("email-error") : undefined}
            {...register("email")}
          />
          <FieldError id={fid("email-error")} message={e.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fid("phone")}>Phone</Label>
          <Input id={fid("phone")} type="tel" autoComplete="off" aria-invalid={!!e.phone} {...register("phone")} />
          <FieldError id={fid("phone-error")} message={e.phone?.message} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={fid("position")}>Job title</Label>
          <Input id={fid("position")} placeholder="e.g. Head of Operations" aria-invalid={!!e.position} {...register("position")} />
          <FieldError id={fid("position-error")} message={e.position?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fid("company")}>Company</Label>
          <Controller
            control={control}
            name="company"
            render={({ field }) => <CompanyPicker id={fid("company")} value={field.value} onChange={field.onChange} />}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={fid("tags")}>Tags</Label>
        <Input id={fid("tags")} placeholder="e.g. decision-maker, partner" aria-describedby={fid("tags-hint")} {...register("tags")} />
        <p id={fid("tags-hint")} className="text-xs text-muted-foreground">
          Separate tags with commas.
        </p>
      </div>
    </div>
  );
}
