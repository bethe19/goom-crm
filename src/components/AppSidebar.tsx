import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity,
  BarChart3,
  Building2,
  CalendarDays,
  CheckSquare,
  Database,
  FileSpreadsheet,
  Kanban,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  MessageSquarePlus,
  Settings,
  Shield,
  SlidersHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavLink, useLocation } from "react-router-dom";
import { Brand } from "@/components/Brand";

const adminNav = [
  { title: "Platform Overview", icon: Shield, to: "/admin" },
  { title: "User & Role Access", icon: Users, to: "/admin?tab=users" },
  { title: "Beta Feedback", icon: MessageSquare, to: "/admin?tab=feedback" },
  { title: "Database & Health", icon: Database, to: "/admin?tab=database" },
  { title: "System Settings", icon: Settings, to: "/settings" },
];

const repNav = [
  { title: "Dashboard", icon: LayoutDashboard, to: "/dashboard" },
  { title: "Pipeline", icon: Kanban, to: "/pipeline" },
  { title: "Contacts", icon: Users, to: "/contacts" },
  { title: "Companies", icon: Building2, to: "/companies" },
  { title: "Activities", icon: Activity, to: "/activities" },
  { title: "Tasks", icon: CheckSquare, to: "/tasks" },
  { title: "Calendar", icon: CalendarDays, to: "/calendar" },
  { title: "Forecast", icon: TrendingUp, to: "/forecast" },
  { title: "Reports", icon: BarChart3, to: "/reports" },
  { title: "Import/Export", icon: FileSpreadsheet, to: "/data" },
  { title: "Settings", icon: Settings, to: "/settings" },
];

interface AppSidebarProps {
  onOpenFeedback?: () => void;
}

export function AppSidebar({ onOpenFeedback }: AppSidebarProps) {
  const { signOut, user, isDemoMode, isAdmin } = useAuth();
  const location = useLocation();
  const isCrmPreview = location.search.includes("view=crm");

  const { data: profile } = useQuery({
    queryKey: ["profile-sidebar", user?.id, isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        return {
          avatar_url: "",
          full_name: "Alex Vance",
        };
      }
      const { data } = await supabase.from("profiles").select("avatar_url, full_name").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Admins see platform data navigation only; reps see CRM pipeline navigation
  const activeNav = (isAdmin && !isCrmPreview) ? adminNav : repNav;

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <NavLink to={isAdmin ? "/admin" : "/dashboard"} className="flex items-center gap-2">
            <Brand size="md" />
          </NavLink>
          <Badge
            variant="outline"
            className={`text-[9px] font-mono px-1.5 py-0 ${
              isAdmin ? "bg-foreground text-background font-semibold" : "border-border bg-secondary text-foreground"
            }`}
          >
            {isAdmin ? "Admin Console" : "Beta 0.9.8"}
          </Badge>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {isAdmin && !isCrmPreview ? "Platform Superadmin" : "Sales Workspace"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1 px-2">
              {activeNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${
                          isActive && (location.search === (item.to.split("?")[1] ? `?${item.to.split("?")[1]}` : "") || (!item.to.includes("?") && !location.search))
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold shadow-2xs"
                            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        }`
                      }
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2 border-t border-sidebar-border">
        <SidebarMenu className="gap-1">
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton asChild>
                <NavLink
                  to={isCrmPreview ? "/admin" : "/dashboard?view=crm"}
                  className="text-xs text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground rounded-lg"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>{isCrmPreview ? "Return to Platform Admin" : "Preview Rep Sales CRM"}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {onOpenFeedback && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onOpenFeedback}
                className="text-xs text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground rounded-lg"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span>Beta Feedback</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={signOut}
              className="text-xs text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-destructive rounded-lg"
            >
              <LogOut className="h-4 w-4" />
              <span>{isDemoMode ? "Exit Sandbox" : "Sign out"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {user && (
          <div className="flex items-center gap-2.5 rounded-lg bg-sidebar-accent/40 p-2 border border-sidebar-border">
            <Avatar className="h-7 w-7 border border-sidebar-border shrink-0">
              <AvatarImage src={profile?.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="text-[10px] font-semibold bg-foreground text-background">
                {(profile?.full_name || user.email || "AV").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-sidebar-foreground">
                {profile?.full_name || (isDemoMode ? "Alex Vance" : user.email)}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {isDemoMode ? "Beta Director" : "Team Member"}
              </p>
            </div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
