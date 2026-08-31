import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BulkActionBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  deleting?: boolean;
  children?: React.ReactNode;
}

export function BulkActionBar({ count, onDelete, onClear, deleting, children }: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (count === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-50 flex flex-wrap items-center gap-2 sm:gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
        <span className="text-sm font-medium">{count} selected</span>
        <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)} disabled={deleting}>
          <Trash2 className="h-4 w-4 mr-1" /> Delete
        </Button>
        {children}
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X className="h-4 w-4 mr-1" /> Clear
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {count} record{count !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The selected {count} item{count !== 1 ? "s" : ""} will be permanently deleted from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmOpen(false);
                onDelete();
              }}
            >
              Delete {count} record{count !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

