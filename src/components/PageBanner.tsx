import { cn } from "@/lib/utils";

interface PageBannerProps {
  title: string;
  description?: React.ReactNode;
  /** Optional leading visual (icon tile, avatar). */
  avatar?: React.ReactNode;
  /** Page actions, right-aligned on desktop; wrap below the title on small screens. Put the one primary action last. */
  children?: React.ReactNode;
  className?: string;
}

/** Standard page header: title + one-line description on the left, actions on the right. */
export function PageBanner({ title, description, avatar, children, className }: PageBannerProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex min-w-0 items-center gap-3">
        {avatar && <div className="shrink-0">{avatar}</div>}
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground [overflow-wrap:anywhere]">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {children && (
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">{children}</div>
      )}
    </header>
  );
}
