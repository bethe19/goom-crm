import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Briefcase, CalendarPlus, CheckSquare, Loader2, Mail, MessageSquarePlus, Pencil, Phone, Plus, Trash2, UserX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRecordPermissions } from "@/hooks/useRecordPermissions";
import {
  useContact,
  useContactActivities,
  useContactDeals,
  useContactTasks,
  useDeleteContact,
  useDuplicateContactEmail,
  useUpdateContact,
  type Contact,
} from "@/hooks/useContacts";
import { useDebounce } from "@/hooks/useDebounce";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/common/States";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { TaskItem } from "@/components/tasks/TaskItem";
import { CreateTaskDialog } from "@/components/tasks/CreateTaskDialog";
import { LogActivityDialog } from "@/components/activities/LogActivityDialog";
import { CreateDealDialog } from "@/components/pipeline/CreateDealDialog";
import { ActivityTimeline, RelatedDealsList, SectionHeader } from "@/components/contacts/RelatedSections";
import { CopyButton, RecordAvatar } from "@/components/contacts/list-parts";
import { ContactFormFields } from "@/components/contacts/ContactFormFields";
import {
  contactFormSchema,
  contactToForm,
  emptyContactForm,
  resolveCompanyChoice,
  toContactPayload,
  type ContactFormValues,
} from "@/components/contacts/contactForm";
import { sanitizeHref } from "@/lib/sanitize";
import { errorMessage } from "@/components/settings/validation";
import { formatFriendlyDate } from "@/lib/formatters";

interface ContactDetailSheetProps {
  contactId: string | null;
  /** Row data already on screen, shown instantly while the record is fetched. */
  initialContact?: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContactDetailSheet({ contactId, initialContact, open, onOpenChange }: ContactDetailSheetProps) {
  const { data: contact, isLoading, error, refetch } = useContact(open ? contactId : null, initialContact);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {isLoading && !contact ? (
          <div className="space-y-4 p-6" aria-busy="true">
            <SheetTitle className="sr-only">Loading contact</SheetTitle>
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-3.5 w-1/3" />
              </div>
            </div>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error ? (
          <div className="p-6">
            <SheetTitle className="sr-only">Contact</SheetTitle>
            <ErrorState error={error} onRetry={() => refetch()} compact />
          </div>
        ) : !contact ? (
          <div className="p-6">
            <SheetTitle className="sr-only">Contact not found</SheetTitle>
            <EmptyState compact icon={UserX} title="Contact not found" description="It may have been deleted, or you don't have access to it." />
          </div>
        ) : (
          <ContactDetail contact={contact} editing={editing} setEditing={setEditing} onClose={() => onOpenChange(false)} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ContactDetail({
  contact,
  editing,
  setEditing,
  onClose,
}: {
  contact: Contact;
  editing: boolean;
  setEditing: (v: boolean) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const deleteContact = useDeleteContact();
  const { canDelete } = useRecordPermissions();
  const deletable = canDelete({ created_by: contact.created_by });
  const deals = useContactDeals(contact.id);
  const activities = useContactActivities(contact.id);
  const tasks = useContactTasks(contact.id);
  const [taskOpen, setTaskOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);

  const fullName = `${contact.first_name} ${contact.last_name}`.trim();
  const telHref = contact.phone ? sanitizeHref(`tel:${contact.phone.replace(/[^\d+]/g, "")}`) : "#";
  const mailHref = contact.email ? sanitizeHref(`mailto:${contact.email}`) : "#";

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${fullName}?`,
      description: "Linked deals, activities and tasks are kept but will no longer reference this contact. This can't be undone.",
      confirmLabel: "Delete contact",
    });
    if (!ok) return;
    try {
      await deleteContact.mutateAsync(contact.id);
      toast.success("Contact deleted");
      onClose();
    } catch (err) {
      toast.error("Couldn't delete contact", { description: errorMessage(err) });
    }
  };

  return (
    <>
      <div className="border-b border-border px-6 pb-4 pt-6">
        <div className="flex items-start gap-3 pr-8">
          <RecordAvatar name={fullName} className="h-12 w-12 text-sm" />
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-lg font-semibold tracking-tight">{fullName}</SheetTitle>
            <SheetDescription className="truncate text-sm">
              {contact.position || "No job title"}
              {contact.companies && (
                <>
                  {" at "}
                  <button
                    type="button"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                    onClick={() => navigate(`/companies?open=${contact.companies!.id}`)}
                  >
                    {contact.companies.name}
                  </button>
                </>
              )}
            </SheetDescription>
            {contact.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {contact.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="font-normal">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {contact.email && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={mailHref}>
                <Mail className="h-4 w-4" aria-hidden /> Email
              </a>
            </Button>
          )}
          {contact.phone && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={telHref}>
                <Phone className="h-4 w-4" aria-hidden /> Call
              </a>
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActivityOpen(true)}>
            <MessageSquarePlus className="h-4 w-4" aria-hidden /> Log activity
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setDealOpen(true)}>
            <Briefcase className="h-4 w-4" aria-hidden /> Add deal
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTaskOpen(true)}>
            <CalendarPlus className="h-4 w-4" aria-hidden /> Add task
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-6 px-6 py-5">
        <section aria-labelledby="contact-details-heading">
          <div className="mb-2 flex items-center justify-between">
            <h3 id="contact-details-heading" className="text-sm font-semibold">
              Details
            </h3>
            {!editing && (
              <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
              </Button>
            )}
          </div>
          {editing ? (
            <ContactEditForm contact={contact} onDone={() => setEditing(false)} />
          ) : (
            <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="flex min-w-0 items-center gap-1">
                {contact.email ? (
                  <>
                    <a href={mailHref} className="truncate hover:underline">
                      {contact.email}
                    </a>
                    <CopyButton value={contact.email} label="Email" />
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="flex min-w-0 items-center gap-1">
                {contact.phone ? (
                  <>
                    <a href={telHref} className="truncate tabular-nums hover:underline">
                      {contact.phone}
                    </a>
                    <CopyButton value={contact.phone} label="Phone" />
                  </>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Job title</dt>
              <dd className="truncate">{contact.position || <span className="text-muted-foreground">—</span>}</dd>
              <dt className="text-muted-foreground">Company</dt>
              <dd className="truncate">
                {contact.companies ? (
                  <button type="button" className="hover:underline" onClick={() => navigate(`/companies?open=${contact.companies!.id}`)}>
                    {contact.companies.name}
                  </button>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </dd>
              <dt className="text-muted-foreground">Added</dt>
              <dd className="text-muted-foreground">{formatFriendlyDate(contact.created_at)}</dd>
            </dl>
          )}
        </section>

        <Separator />

        <section>
          <SectionHeader
            title="Deals"
            count={deals.data?.length}
            action={
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setDealOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add
              </Button>
            }
          />
          <RelatedDealsList query={deals} emptyText="No deals with this contact yet." />
        </section>

        <Separator />

        <section>
          <SectionHeader
            title="Tasks"
            count={tasks.data?.filter((t) => !t.completed).length}
            action={
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setTaskOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Add
              </Button>
            }
          />
          {tasks.isLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : tasks.error ? (
            <ErrorState compact error={tasks.error} onRetry={() => tasks.refetch()} />
          ) : !tasks.data?.length ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckSquare className="h-4 w-4" aria-hidden /> No tasks for this contact.
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.data.map((t) => (
                <TaskItem key={t.id} task={t} />
              ))}
            </div>
          )}
        </section>

        <Separator />

        <section>
          <SectionHeader
            title="Activity"
            action={
              <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setActivityOpen(true)}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Log
              </Button>
            }
          />
          <ActivityTimeline query={activities} emptyText="No calls, emails, meetings or notes logged yet." />
        </section>

        <Separator />

        <div className="flex justify-end pb-2">
          {deletable ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteContact.isPending}
            >
              {deleteContact.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
              {deleteContact.isPending ? "Deleting…" : "Delete contact"}
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">Only the person who added this contact, a manager or an admin can delete it.</p>
          )}
        </div>
      </div>

      <CreateTaskDialog open={taskOpen} onOpenChange={setTaskOpen} defaultContactId={contact.id} />
      <LogActivityDialog open={activityOpen} onOpenChange={setActivityOpen} defaultContactId={contact.id} />
      <CreateDealDialog
        open={dealOpen}
        onOpenChange={setDealOpen}
        defaultContactId={contact.id}
        defaultCompanyId={contact.companies?.id ?? null}
      />
    </>
  );
}

function ContactEditForm({ contact, onDone }: { contact: Contact; onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const update = useUpdateContact();
  const form = useForm<ContactFormValues>({ resolver: zodResolver(contactFormSchema), defaultValues: emptyContactForm });
  const { handleSubmit, reset, watch, formState } = form;

  useEffect(() => {
    reset(contactToForm(contact));
    // Only reset when switching records, so a background refetch doesn't wipe edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact.id]);

  const email = useDebounce(watch("email") ?? "", 400);
  const changedEmail = email.trim().toLowerCase() !== (contact.email ?? "").toLowerCase() ? email : "";
  const { data: duplicate } = useDuplicateContactEmail(changedEmail, contact.id);

  const onSubmit = async (values: ContactFormValues) => {
    try {
      const company_id = await resolveCompanyChoice(values.company, user?.id);
      await update.mutateAsync({ id: contact.id, ...toContactPayload(values), company_id });
      toast.success("Contact updated");
      onDone();
    } catch (err) {
      toast.error("Couldn't save changes", { description: errorMessage(err) });
    }
  };

  const pending = formState.isSubmitting;

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-xl border border-border bg-card p-4"
      noValidate
    >
      <ContactFormFields form={form} idPrefix={`edit-contact-${contact.id}`} autoFocus />
      {duplicate && (
        <p role="status" className="text-xs text-warning">
          {duplicate.first_name} {duplicate.last_name} already uses this email.{" "}
          <button type="button" className="underline" onClick={() => navigate(`/contacts?open=${duplicate.id}`)}>
            Open it
          </button>
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={pending || !formState.isDirty}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
