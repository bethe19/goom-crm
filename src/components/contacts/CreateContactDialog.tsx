import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCreateContact, useDuplicateContactEmail, type Contact } from "@/hooks/useContacts";
import { useDebounce } from "@/hooks/useDebounce";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/components/settings/validation";
import { LimitNotice } from "@/components/settings/UpgradePrompt";
import { usePlan } from "@/hooks/usePlan";
import { ContactFormFields } from "@/components/contacts/ContactFormFields";
import {
  contactFormSchema,
  emptyContactForm,
  resolveCompanyChoice,
  toContactPayload,
  type ContactFormValues,
} from "@/components/contacts/contactForm";

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selects a company (e.g. when adding from a company's detail sheet). */
  defaultCompany?: { id: string; name: string } | null;
  onCreated?: (contact: Contact) => void;
  /** Called instead of navigating when the user chooses to open an existing duplicate. */
  onOpenExisting?: (contactId: string) => void;
}

export function CreateContactDialog({ open, onOpenChange, defaultCompany, onCreated, onOpenExisting }: CreateContactDialogProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const createContact = useCreateContact();
  const { wouldExceed } = usePlan();
  const atLimit = wouldExceed("contacts");
  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: { ...emptyContactForm, company: defaultCompany ?? null },
  });
  const { handleSubmit, reset, watch, formState } = form;

  useEffect(() => {
    if (open) reset({ ...emptyContactForm, company: defaultCompany ?? null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const email = useDebounce(watch("email") ?? "", 400);
  const { data: duplicate } = useDuplicateContactEmail(open ? email : "");

  const openExisting = (id: string) => {
    onOpenChange(false);
    if (onOpenExisting) onOpenExisting(id);
    else navigate(`/contacts?open=${id}`);
  };

  const onSubmit = async (values: ContactFormValues) => {
    try {
      const company_id = await resolveCompanyChoice(values.company, user?.id);
      const contact = await createContact.mutateAsync({
        ...toContactPayload(values),
        company_id,
        ...(user ? { created_by: user.id } : {}),
      });
      toast.success("Contact created", { description: `${contact.first_name} ${contact.last_name}`.trim() });
      onCreated?.(contact);
      onOpenChange(false);
    } catch (err) {
      toast.error("Couldn't create contact", { description: errorMessage(err) });
    }
  };

  const pending = formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New contact</DialogTitle>
          <DialogDescription>Add a person you work with. Only a first name is required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <ContactFormFields form={form} idPrefix="new-contact" autoFocus />
          {duplicate && (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 flex-1">
                <p>
                  A contact with this email already exists ({duplicate.first_name} {duplicate.last_name}).
                </p>
                <Button type="button" variant="link" className="h-auto p-0 text-sm" onClick={() => openExisting(duplicate.id)}>
                  Open it
                </Button>
              </div>
            </div>
          )}
          <LimitNotice limit="contacts" action="add more contacts" />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || atLimit}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {pending ? "Creating…" : duplicate ? "Create anyway" : "Create contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
