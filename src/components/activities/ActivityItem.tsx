import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useDeleteActivity, type Activity } from "@/hooks/useActivities";
import { formatRelativeDate } from "@/lib/formatters";
import { errorMessage } from "@/components/settings/validation";
import { Button } from "@/components/ui/button";
import { MarkdownView } from "@/components/ui/rich-text-editor";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRecordPermissions } from "@/hooks/useRecordPermissions";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { memberName, useWorkspaceMembers } from "@/components/pipeline/useWorkspaceMembers";
import { activityMeta } from "./activityUtils";

interface ActivityItemProps {
  activity: Activity;
  /** Opens the activity (edit dialog). Defaults to navigating to `/activities?open=<id>`. */
  onOpen?: (activity: Activity) => void;
  highlighted?: boolean;
  /** Hide the deal link (e.g. inside the deal's own sheet). */
  hideDeal?: boolean;
  hideContact?: boolean;
  className?: string;
}

export function ActivityItem({ activity, onOpen, highlighted, hideDeal, hideContact, className }: ActivityItemProps) {
  const meta = activityMeta(activity.type);
  const Icon = meta.icon;
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { toast } = useToast();
  const deleteActivity = useDeleteActivity();
  const { canDelete } = useRecordPermissions();
  const deletable = canDelete({ user_id: activity.user_id });
  const { byId } = useWorkspaceMembers();
  const author = activity.user_id ? byId.get(activity.user_id) : undefined;

  const open = () => (onOpen ? onOpen(activity) : navigate(`/activities?open=${activity.id}`));

  const handleDelete = async () => {
    if (!(await confirm({ title: "Delete this activity?", description: `“${activity.title}” will be permanently deleted.`, confirmLabel: "Delete" }))) return;
    deleteActivity.mutate(activity.id, {
      onSuccess: () => toast({ title: "Activity deleted", variant: "success" }),
      onError: (err) => toast({ title: "Couldn't delete activity", description: errorMessage(err), variant: "destructive" }),
    });
  };

  return (
    <article
      id={`activity-${activity.id}`}
      className={cn(
        "group relative flex gap-3 rounded-xl border bg-card p-3.5 transition-colors duration-150 hover:border-foreground/20",
        highlighted && "ring-2 ring-ring ring-offset-2 ring-offset-background",
        deleteActivity.isPending && "opacity-50",
        className,
      )}
    >
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.chip)} aria-hidden>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={open}
            className="min-w-0 text-left text-sm font-medium text-foreground after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            <span className="sr-only">{meta.label}: </span>
            <span className="break-words">{activity.title}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 -mr-1 -mt-1 h-7 w-7 shrink-0 rounded-md text-muted-foreground sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 data-[state=open]:opacity-100"
                aria-label={`Actions for ${activity.title}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={open}>
                <Pencil className="mr-2 h-4 w-4" aria-hidden /> Edit
              </DropdownMenuItem>
              {deletable && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleDelete} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" aria-hidden /> Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {activity.description && (
          <MarkdownView value={activity.description} className="mt-1 line-clamp-3 break-words text-sm text-muted-foreground" />
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span>{meta.label}</span>
          {!hideDeal && activity.deals && (
            <>
              <span aria-hidden>·</span>
              <Link to={`/pipeline?open=${activity.deals.id}`} className="relative z-10 truncate hover:text-foreground hover:underline">
                {activity.deals.title}
              </Link>
            </>
          )}
          {!hideContact && activity.contacts && (
            <>
              <span aria-hidden>·</span>
              <Link to={`/contacts?open=${activity.contacts.id}`} className="relative z-10 truncate hover:text-foreground hover:underline">
                {activity.contacts.first_name} {activity.contacts.last_name}
              </Link>
            </>
          )}
          {author && (
            <>
              <span aria-hidden>·</span>
              <span>{memberName(author)}</span>
            </>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <time dateTime={activity.created_at} className="relative z-10 ml-auto whitespace-nowrap tabular-nums">
                {formatRelativeDate(activity.created_at)}
              </time>
            </TooltipTrigger>
            <TooltipContent>{format(new Date(activity.created_at), "PPpp")}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </article>
  );
}
