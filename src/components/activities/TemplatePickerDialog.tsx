import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { useEmailTemplates, type EmailTemplate } from "@/hooks/useEmailTemplates";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/common/States";

interface TemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: EmailTemplate) => void;
}

export function TemplatePickerDialog({ open, onOpenChange, onSelect }: TemplatePickerDialogProps) {
  const { data: templates, isLoading, error, refetch } = useEmailTemplates();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Use an email template</DialogTitle>
          <DialogDescription>Fills in the summary and details. You can edit them before saving.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : error ? (
          <ErrorState compact error={error} onRetry={() => refetch()} />
        ) : !templates?.length ? (
          <EmptyState
            compact
            icon={Mail}
            title="No templates yet"
            description="Save reusable emails in Settings."
            action={
              <Button asChild variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                <Link to="/settings">Open settings</Link>
              </Button>
            }
          />
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label="Email templates">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    onSelect(t);
                    onOpenChange(false);
                  }}
                >
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">Subject: {t.subject}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.body}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
