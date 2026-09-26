import { z } from "zod";
import type { Company } from "@/hooks/useCompanies";
import { normalizeWebsite } from "@/lib/dataTransfer";

export const companyFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200, "Keep it under 200 characters"),
  industry: z.string().trim().max(100, "Keep it under 100 characters"),
  website: z
    .string()
    .trim()
    .max(500, "Keep it under 500 characters")
    .refine((v) => normalizeWebsite(v).ok, "Enter a valid website, e.g. example.com"),
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;

export const emptyCompanyForm: CompanyFormValues = { name: "", industry: "", website: "" };

export function companyToForm(c: Company): CompanyFormValues {
  return { name: c.name, industry: c.industry ?? "", website: c.website ?? "" };
}

export function toCompanyPayload(v: CompanyFormValues) {
  const site = normalizeWebsite(v.website);
  return {
    name: v.name.trim(),
    industry: v.industry.trim() || null,
    website: site.ok ? site.value : null,
  };
}
