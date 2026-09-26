import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  ChevronsUpDown,
  Compass,
  FileSpreadsheet,
  Kanban,
  Keyboard,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Palette,
  Settings,
  Shield,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ROLE_LABELS } from "@/lib/permissions";
import { useMyProfile } from "@/hooks/useMyProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { GMark } from "@/components/GMark";
import { THEME_OPTIONS } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  icon: LucideIcon;
  to: string;
  badge?: "overdue-tasks";
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
      { title: "Pipeline", icon: Kanban, to: "/pipeline" },
      { title: "Contacts", icon: Users, to: "/contacts" },
      { title: "Companies", icon: Building2, to: "/companies" },
    ],
  },
  {
    label: "Work",
    items: [
      { title: "Tasks", icon: CheckSquare, to: "/tasks", badge: "overdue-tasks" },
      { title: "Activities", icon: Activity, to: "/activities" },
      { title: "Calendar", icon: CalendarDays, to: "/calendar" },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Forecast", icon: TrendingUp, to: "/forecast" },
      { title: "Reports", icon: BarChart3, to: "/reports" },
    ],
  },
  {
    label: "Manage",
    items: [
      { title: "Import & export", icon: FileSpreadsheet, to: "/data" },
      { title: "Settings", icon: Settings, to: "/settings" },
    ],
  },
];

function initials(name: string) {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

/** Open tasks past their due date that are assigned to or created by me. */
function useOverdueTaskCount(userId: string | undefined) {
  return useQuery({
    queryKey: ["tasks", "overdue-count", userId],
    enabled: !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("completed", false)
        .lt("due_date", new Date().toISOString())
        .or(`assigned_to.eq.${userId},user_id.eq.${userId}`);
      if (error) return 0; // badge is a nicety; never break the nav over it
      return count ?? 0;
    },
  });
}

interface AppSidebarProps {
  onOpenFeedback?: () => void;
  onOpenShortcuts?: () => void;
  onStartTour?: () => void;
}

export function AppSidebar({ onOpenFeedback, onOpenShortcuts, onStartTour }: AppSidebarProps) {
  const { signOut, user, organization, userRole, can, isPlatformAdmin } = useAuth();
  const { data: profile } = useMyProfile();
  const { data: overdue = 0 } = useOverdueTaskCount(user?.id);
  const { theme = "system", setTheme } = useTheme();
  const { isMobile, setOpenMobile } = useSidebar();
  const { pathname } = useLocation();

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  const displayName = profile?.full_name?.trim() || user?.email?.split("@")[0] || "Account";
  const roleLabel = userRole ? ROLE_LABELS[userRole] : "Member";
  const workspaceName = organization?.name || "Workspace";

  const groups: NavGroup[] = NAV.map((g) =>
    g.label === "Manage" && can("workspace.admin")
      ? { ...g, items: [...g.items, { title: "Admin", icon: Shield, to: "/admin" }] }
      : g,
  );
  // SaaS operator console: its own group so it's never mistaken for a workspace page.
  if (isPlatformAdmin) groups.push({ label: "Operator", items: [{ title: "Platform", icon: ShieldCheck, to: "/platform" }] });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={workspaceName} className="gap-2.5">
              <Link to="/dashboard" onClick={closeMobile}>
                <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <GMark className="h-5 w-5" />
                </span>
                <span className="grid min-w-0 flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold">{workspaceName}</span>
                  <span className="truncate text-xs text-muted-foreground">Goom CRM</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent data-tour="sidebar-nav" className="gap-0">
        {groups.map((group) => (
          <SidebarGroup key={group.label} className="py-1.5">
            <SidebarGroupLabel className="h-7 text-xs font-medium text-sidebar-foreground/60">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
                  const showBadge = item.badge === "overdue-tasks" && overdue > 0;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={showBadge ? `${item.title} · ${overdue} overdue` : item.title}
                        className={cn(
                          "h-8 font-normal text-sidebar-foreground/80 transition-colors duration-150",
                          "data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground",
                          "[&>svg]:text-sidebar-foreground/60 data-[active=true]:[&>svg]:text-sidebar-accent-foreground",
                        )}
                      >
                        <Link to={item.to} onClick={closeMobile} aria-current={active ? "page" : undefined}>
                          <item.icon aria-hidden="true" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      {showBadge && (
                        <SidebarMenuBadge
                          className="rounded-full bg-destructive/10 px-1.5 text-destructive peer-hover/menu-button:text-destructive peer-data-[active=true]/menu-button:text-destructive"
                          aria-label={`${overdue} overdue tasks`}
                        >
                          {overdue > 99 ? "99+" : overdue}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            {/* Non-modal so dialogs opened from menu items (shortcuts, feedback) get focus cleanly. */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  data-tour="user-menu"
                  tooltip={`${displayName} · ${roleLabel}`}
                  className="gap-2.5 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  aria-label={`Account menu for ${displayName}`}
                >
                  <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                    <AvatarImage src={profile?.avatar_url || undefined} alt="" className="object-cover" />
                    <AvatarFallback className="rounded-lg bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                      {initials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="grid min-w-0 flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-medium">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
                  </span>
                  <ChevronsUpDown className="ml-auto !size-4 text-muted-foreground" aria-hidden="true" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "top" : "right"}
                align="end"
                sideOffset={8}
                className="w-60"
              >
                <DropdownMenuLabel className="font-normal">
                  <span className="block truncate text-sm font-medium text-foreground">{displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">{user?.email}</span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {roleLabel} · {workspaceName}
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link to="/settings" onClick={closeMobile}>
                      <Settings /> Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette className="text-muted-foreground" /> Theme
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="w-36">
                        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
                          {THEME_OPTIONS.map((o) => (
                            <DropdownMenuRadioItem key={o.value} value={o.value}>
                              {o.label}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  {onOpenShortcuts && (
                    <DropdownMenuItem onSelect={onOpenShortcuts}>
                      <Keyboard /> Keyboard shortcuts
                      <DropdownMenuShortcut>?</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  )}
                  {onStartTour && (
                    <DropdownMenuItem
                      onSelect={() => {
                        closeMobile();
                        onStartTour();
                      }}
                    >
                      <Compass /> Take the tour
                    </DropdownMenuItem>
                  )}
                  {onOpenFeedback && (
                    <DropdownMenuItem onSelect={onOpenFeedback}>
                      <MessageSquarePlus /> Send feedback
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void signOut()}>
                  <LogOut /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
