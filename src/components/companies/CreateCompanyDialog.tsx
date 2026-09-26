import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateCompany, useDuplicateCompanyName, type Company } from "@/hooks/useCompanies";
import { useDebounce } from "@/hooks/useDebounce";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/components/settings/validation";
import { CompanyFormFields } from "@/components/companies/CompanyFormFields";
import { companyFormSchema, emptyCompanyForm, toCompanyPayload, type CompanyFormValues } from "@/components/companies/companyForm";

interface CreateCompanyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (company: Company) => void;
  /** Called instead of navigating when the user chooses to open an existing duplicate. */
  onOpenExisting?: (companyId: string) => void;
}

export function CreateCompanyDialog({ open, onOpenChange, onCreated, onOpenExisting }: CreateCompanyDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createCompany = useCreateCompany();
  const form = useForm<CompanyFormValues>({ resolver: zodResolver(companyFormSchema), defaultValues: emptyCompanyForm });
  const { handleSubmit, reset, watch, formState } = form;

  useEffect(() => {
    if (open) reset(emptyCompanyForm);
  }, [open, reset]);

  const name = useDebounce(watch("name") ?? "", 400);
  const { data: duplicate } = useDuplicateCompanyName(open ? name : "");

  const openExisting = (id: string) => {
    onOpenChange(false);
    if (onOpenExisting) onOpenExisting(id);
    else navigate(`/companies?open=${id}`);
  };

  const onSubmit = async (values: CompanyFormValues) => {
    try {
      const company = await createCompany.mutateAsync({ ...toCompanyPayload(values), ...(user ? { created_by: user.id } : {}) });
      toast.success("Company created", { description: company.name });
      onCreated?.(company);
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't create company", { description: errorMessage(err) });
    }
  };

  const pending = formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>Add an account you sell to or partner with.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <CompanyFormFields form={form} idPrefix="new-company" autoFocus />
          {duplicate && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <div>
                <p>A company named “{duplicate.name}” already exists.</p>
                <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => openExisting(duplicate.id)}>
                  Open it
                </Button>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Creating…" : duplicate ? "Create anyway" : "Create company"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
