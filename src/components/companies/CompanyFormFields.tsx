import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useIndustries } from "@/hooks/useCompanies";
import type { CompanyFormValues } from "@/components/companies/companyForm";

export function CompanyFormFields({ form, idPrefix, autoFocus }: { form: UseFormReturn<CompanyFormValues>; idPrefix: string; autoFocus?: boolean }) {
  const { register, formState } = form;
  const e = formState.errors;
  const { data: industries = [] } = useIndustries();
  const fid = (n: string) => `${idPrefix}-${n}`;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={fid("name")}>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id={fid("name")}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-invalid={!!e.name}
          aria-describedby={e.name ? fid("name-error") : undefined}
          {...register("name")}
        />
        {e.name && (
          <p id={fid("name-error")} className="text-xs text-destructive">
            {e.name.message}
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={fid("industry")}>Industry</Label>
          <Input id={fid("industry")} list={fid("industries")} autoComplete="off" placeholder="e.g. Software" aria-invalid={!!e.industry} {...register("industry")} />
          <datalist id={fid("industries")}>
            {industries.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
          {e.industry && <p className="text-xs text-destructive">{e.industry.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={fid("website")}>Website</Label>
          <Input
            id={fid("website")}
            inputMode="url"
            autoComplete="off"
            placeholder="example.com"
            aria-invalid={!!e.website}
            aria-describedby={e.website ? fid("website-error") : undefined}
            {...register("website")}
          />
          {e.website && (
            <p id={fid("website-error")} className="text-xs text-destructive">
              {e.website.message}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
