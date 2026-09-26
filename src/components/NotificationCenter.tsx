import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Bell, BellOff, CheckCheck, Trash2, X } from "lucide-react";
import {
  notificationHref,
  useClearNotifications,
  useDeleteNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  type Notification,
} from "@/hooks/useNotifications";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useConfirm } from "@/components/common/ConfirmDialog";
import { toast } from "sonner";
import { sanitizeErrorMessage } from "@/lib/sanitize";
import { cn } from "@/lib/utils";

function relativeTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  if (Date.now() - date.getTime() < 60_000) return "Just now";
  return formatDistanceToNowStrict(date, { addSuffix: true });
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [], isLoading, isError, refetch } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();
  const clear = useClearNotifications();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const unreadCount = notifications.filter((n) => !n.read).length;
  const badge = unreadCount > 9 ? "9+" : String(unreadCount);

  const onError = (err: unknown) => toast.error(sanitizeErrorMessage((err as Error)?.message));

  const handleOpenItem = (n: Notification) => {
    if (!n.read) markRead.mutate(n.id, { onError });
    const href = notificationHref(n);
    if (href) {
      setOpen(false);
      navigate(href);
    }
  };

  const handleClear = async () => {
    const ok = await confirm({
      title: "Clear all notifications?",
      description: "This removes every notification in your inbox. It can't be undone.",
      confirmLabel: "Clear all",
      destructive: true,
    });
    if (!ok) return;
    clear.mutate(undefined, { onError, onSuccess: () => toast.success("Notifications cleared") });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
              aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
              data-tour="notifications"
            >
              <Bell />
              {unreadCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-semibold leading-none text-destructive-foreground tabular-nums ring-2 ring-background"
                >
                  {badge}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifications</TooltipContent>
      </Tooltip>

      <PopoverContent className="w-[min(24rem,calc(100vw-1rem))] p-0" align="end" collisionPadding={8}>
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold">Notifications</h2>
            {unreadCount > 0 && <span className="text-xs text-muted-foreground tabular-nums">{unreadCount} unread</span>}
          </div>
          <div className="flex items-center gap-0.5">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => markAllRead.mutate(undefined, { onError })}
                disabled={markAllRead.isPending}
              >
                <CheckCheck className="!size-3.5" /> Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={handleClear}
                    disabled={clear.isPending}
                    aria-label="Clear all notifications"
                  >
                    <Trash2 className="!size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear all</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <div className="max-h-[min(26rem,70vh)] overflow-y-auto overscroll-contain">
          {isLoading ? (
            <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading notifications">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm font-medium">Couldn't load notifications</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
                Try again
              </Button>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <BellOff className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium">You're all caught up</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Deal updates, task reminders and mentions will show up here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {notifications.map((n) => (
                <li key={n.id} className="group relative">
                  <button
                    type="button"
                    className={cn(
                      "flex w-full gap-3 px-4 py-3 pr-11 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none",
                      !n.read && "bg-muted/30",
                    )}
                    onClick={() => handleOpenItem(n)}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-info")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-sm leading-snug", n.read ? "text-foreground/80" : "font-medium")}>
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      {n.message && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.message}</span>
                      )}
                      <time dateTime={n.created_at} className="mt-1 block text-xs text-muted-foreground">
                        {relativeTime(n.created_at)}
                      </time>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-2 top-2.5 h-7 w-7 text-muted-foreground opacity-100 hover:text-foreground focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    onClick={() => remove.mutate(n.id, { onError })}
                    aria-label={`Dismiss notification: ${n.title}`}
                  >
                    <X className="!size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
