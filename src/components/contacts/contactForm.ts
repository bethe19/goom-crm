import { z } from "zod";
import type { CompanyChoice } from "@/components/companies/CompanyPicker";
import { findCompanyByName } from "@/hooks/useCompanies";
import { supabase } from "@/integrations/supabase/client";
import type { Contact } from "@/hooks/useContacts";

/** Digits plus common phone punctuation ( ) + - . / space and "x" for extensions, with at least 5 digits. */
export function isValidPhone(value: string): boolean {
  const v = value.trim();
  return /^[\d\s()+\-./xX]+$/.test(v) && (v.match(/\d/g)?.length ?? 0) >= 5;
}

export const contactFormSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100, "Keep it under 100 characters"),
  last_name: z.string().trim().max(100, "Keep it under 100 characters"),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid email address").max(255)]),
  phone: z
    .string()
    .trim()
    .max(30, "Keep it under 30 characters")
    .refine((v) => !v || isValidPhone(v), "Enter a valid phone number"),
  position: z.string().trim().max(100, "Keep it under 100 characters"),
  tags: z.string().max(500),
  company: z.custom<CompanyChoice>().nullable(),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;

export const emptyContactForm: ContactFormValues = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  position: "",
  tags: "",
  company: null,
};

export function contactToForm(c: Contact): ContactFormValues {
  return {
    first_name: c.first_name,
    last_name: c.last_name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    position: c.position ?? "",
    tags: (c.tags ?? []).join(", "),
    company: c.companies ? { id: c.companies.id, name: c.companies.name } : null,
  };
}

/** Splits "a, b; c" into unique trimmed tags. */
export function parseTagList(s: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of s.split(/[,;]/)) {
    const t = raw.trim();
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase());
      out.push(t);
    }
  }
  return out;
}

/** Returns the company id to store, creating the company if the user typed a new name (reuses an exact match). */
export async function resolveCompanyChoice(choice: CompanyChoice, userId: string | undefined): Promise<string | null> {
  if (!choice) return null;
  if (choice.id) return choice.id;
  const existing = await findCompanyByName(choice.name);
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("companies")
    .insert({ name: choice.name.trim(), ...(userId ? { created_by: userId } : {}) } as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export function toContactPayload(values: ContactFormValues) {
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    email: values.email.trim() ? values.email.trim() : null,
    phone: values.phone.trim() || null,
    position: values.position.trim() || null,
    tags: parseTagList(values.tags),
  };
}
