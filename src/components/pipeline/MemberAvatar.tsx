import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { initials } from "./dealUtils";
import { memberName, type WorkspaceMember } from "./useWorkspaceMembers";

interface MemberAvatarProps {
  member: WorkspaceMember | null | undefined;
  /** Shown in the tooltip before the name, e.g. "Owner". */
  label?: string;
  className?: string;
  /** Show the tooltip (default true). */
  tooltip?: boolean;
}

/** Small initials avatar for a workspace member, with the full name in a tooltip and for screen readers. */
export function MemberAvatar({ member, label, className, tooltip = true }: MemberAvatarProps) {
  const name = member ? memberName(member) : "Unassigned";
  const text = label ? `${label}: ${name}` : name;
  const avatar = (
    <Avatar className={cn("h-6 w-6 border border-border text-[11px]", className)} aria-label={text} role="img">
      {member?.avatar_url && <AvatarImage src={member.avatar_url} alt="" />}
      <AvatarFallback className="bg-secondary text-[11px] font-medium text-muted-foreground">{member ? initials(name) : "–"}</AvatarFallback>
    </Avatar>
  );
  if (!tooltip) return avatar;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{avatar}</span>
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}
