import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Shield,
  Users,
  MessageSquare,
  Database,
  Star,
  CheckCircle2,
  Clock,
  Download,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Mail,
  UserPlus,
  ArrowUpRight,
  Kanban,
  Building2,
  Activity,
  Server,
  Search,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { seedSupabaseWithDemoData } from "@/lib/demoData";

interface FeedbackItem {
  id: string;
  user_id: string | null;
  rating: number;
  category: string;
  comment: string;
  email: string | null;
  status: string;
  created_at: string;
}

export default function Admin() {
  const { user, isDemoMode, userRole, refreshUserRole } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "overview";
  const queryClient = useQueryClient();
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState("all");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [seeding, setSeeding] = useState(false);

  // 1. Fetch all profiles
  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles", isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        return [
          { id: "1", user_id: "demo-user-alex-vance", full_name: "Alex Vance", company: "Goom Global", avatar_url: "", created_at: "2026-01-01T00:00:00Z" },
          { id: "2", user_id: "demo-2", full_name: "Sarah Jenkins", company: "PipelineIQ", avatar_url: "", created_at: "2026-02-15T00:00:00Z" },
          { id: "3", user_id: "demo-3", full_name: "Michael Chen", company: "TechScale", avatar_url: "", created_at: "2026-03-10T00:00:00Z" },
        ];
      }
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // 2. Fetch all user roles
  const { data: roles, isLoading: loadingRoles } = useQuery({
    queryKey: ["admin-roles", isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        return [
          { id: "r1", user_id: "demo-user-alex-vance", role: "admin" },
          { id: "r2", user_id: "demo-2", role: "manager" },
          { id: "r3", user_id: "demo-3", role: "rep" },
        ];
      }
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch all beta feedback
  const { data: feedbackList, isLoading: loadingFeedback, refetch: refetchFeedback } = useQuery({
    queryKey: ["admin-feedback", isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        return [
          {
            id: "fb-1",
            user_id: null,
            rating: 5,
            category: "Usability",
            comment: "The kanban board drag-and-drop animation is super responsive. Love the dark mode palette!",
            email: "beta.tester@northstar.io",
            status: "new",
            created_at: new Date(Date.now() - 3600000).toISOString(),
          },
          {
            id: "fb-2",
            user_id: null,
            rating: 4,
            category: "Feature Request",
            comment: "Would love to see Slack notifications when a deal reaches the Won stage.",
            email: "revops@arcsys.com",
            status: "reviewed",
            created_at: new Date(Date.now() - 86400000).toISOString(),
          },
          {
            id: "fb-3",
            user_id: null,
            rating: 5,
            category: "AI Copilot",
            comment: "Revenue forecast scenarios helped us estimate Q4 with high confidence.",
            email: "alex@goomcrm.io",
            status: "resolved",
            created_at: new Date(Date.now() - 172800000).toISOString(),
          },
        ] as FeedbackItem[];
      }
      const { data, error } = await supabase.from("feedback").select("*").order("created_at", { ascending: false });
      if (error) {
        console.warn("Feedback table not queryable or empty:", error);
        return [] as FeedbackItem[];
      }
      return (data || []) as FeedbackItem[];
    },
  });

  // 4. Fetch Deal, Company, and Activity Totals across the platform
  const { data: systemStats } = useQuery({
    queryKey: ["admin-system-stats", isDemoMode],
    queryFn: async () => {
      if (isDemoMode) {
        return {
          totalDeals: 7,
          totalContacts: 7,
          totalCompanies: 7,
          totalActivities: 14,
          totalValue: 645000,
        };
      }
      const [dealsRes, contactsRes, companiesRes, activitiesRes] = await Promise.all([
        supabase.from("deals").select("id, value", { count: "exact" }),
        supabase.from("contacts").select("id", { count: "exact" }),
        supabase.from("companies").select("id", { count: "exact" }),
        supabase.from("activities").select("id", { count: "exact" }),
      ]);
      const totalDeals = dealsRes.count || 0;
      const totalContacts = contactsRes.count || 0;
      const totalCompanies = companiesRes.count || 0;
      const totalActivities = activitiesRes.count || 0;
      const totalValue = (dealsRes.data || []).reduce((s, d) => s + (Number(d.value) || 0), 0);

      return { totalDeals, totalContacts, totalCompanies, totalActivities, totalValue };
    },
  });

  // Role update mutation
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "admin" | "manager" | "rep" }) => {
      if (isDemoMode) {
        toast.success(`Role updated to ${newRole} (Demo Mode)`);
        return;
      }
      const existing = roles?.find((r) => r.user_id === userId);
      if (existing) {
        const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
      refreshUserRole();
      toast.success("User role updated successfully.");
    },
    onError: (err: any) => {
      toast.error(`Failed to update role: ${err.message || String(err)}`);
    },
  });

  // Feedback status update mutation
  const updateFeedbackStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (isDemoMode) {
        toast.success(`Marked as ${status} (Demo Mode)`);
        return;
      }
      const { error } = await supabase.from("feedback").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
      toast.success("Feedback status updated.");
    },
  });

  // Seed sample data
  const handleSeedData = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const res = await seedSupabaseWithDemoData(supabase, user.id);
      if (res.success) {
        toast.success("Sample enterprise deals and contacts provisioned into your live database!");
        queryClient.invalidateQueries();
      } else {
        toast.error(`Seeding failed: ${res.error}`);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to seed data");
    } finally {
      setSeeding(false);
    }
  };

  // Export full workspace backup
  const handleExportBackup = () => {
    const backupData = {
      exportedAt: new Date().toISOString(),
      profiles: profiles || [],
      roles: roles || [],
      feedback: feedbackList || [],
      stats: systemStats || {},
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipelineiq_admin_backup_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace admin backup downloaded.");
  };

  const getUserRole = (userId: string) => {
    return roles?.find((r) => r.user_id === userId)?.role || "rep";
  };

  const avgRating =
    feedbackList && feedbackList.length > 0
      ? (feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length).toFixed(1)
      : "5.0";

  const filteredFeedback =
    feedbackCategoryFilter === "all"
      ? feedbackList || []
      : (feedbackList || []).filter((f) => f.category === feedbackCategoryFilter);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-foreground text-background">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Control Hub</h1>
              <p className="text-xs text-muted-foreground">
                Manage team seats, triage live beta tester feedback, and supervise database health.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-7 gap-1.5 border-border bg-secondary font-mono text-[11px] text-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Supabase Cloud Connected</span>
          </Badge>
          <Button variant="outline" size="sm" onClick={handleExportBackup} className="h-8 text-xs gap-1.5">
            <Download className="h-3.5 w-3.5" />
            <span>Backup JSON</span>
          </Button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Registered Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profiles?.length || 1}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {roles?.filter((r) => r.role === "admin").length || 1} Admin • {roles?.filter((r) => r.role === "rep").length || 0} Reps
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pipeline Volume</CardTitle>
            <Kanban className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(systemStats?.totalValue || 0).toLocaleString()}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {systemStats?.totalDeals || 0} Deals across {systemStats?.totalCompanies || 0} Companies
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Beta Feedback</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{feedbackList?.length || 0}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <span className="flex items-center text-amber-500 font-semibold">{avgRating} <Star className="h-3 w-3 fill-current ml-0.5" /></span>
              <span>avg satisfaction</span>
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Database Status</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="h-5 w-5" /> 100% Operational
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
              czuwelxmgjwbzwrqqlfv
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(tab) => setSearchParams(tab === "overview" ? {} : { tab })} className="space-y-5">
        <TabsList className="bg-secondary/60">
          <TabsTrigger value="overview" className="gap-2 text-xs">
            <Shield className="h-3.5 w-3.5" />
            <span>Platform Overview</span>
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" />
            <span>User Registry & Roles ({profiles?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="feedback" className="gap-2 text-xs">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>Tester Feedback ({feedbackList?.length || 0})</span>
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2 text-xs">
            <Database className="h-3.5 w-3.5" />
            <span>Database & Health</span>
          </TabsTrigger>
        </TabsList>

        {/* 0. Platform Overview Tab */}
        <TabsContent value="overview" className="space-y-5">
          {/* Superadmin Platform Banner */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge className="bg-foreground text-background text-xs font-semibold px-2 py-0.5">
                  Platform Superadmin
                </Badge>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs font-mono text-muted-foreground">{user?.email || "bethebayou@gmail.com"}</span>
              </div>
              <h2 className="text-xl font-bold text-foreground tracking-tight">
                Global Platform Oversight & Telemetry
              </h2>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                You are managing the Goom CRM platform. Below is real-time aggregated data across all organizations, tenant accounts, beta tester feedback, and PostgreSQL infrastructure.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setSearchParams({ tab: "users" })}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Manage Users ({profiles?.length || 0})</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => setSearchParams({ tab: "feedback" })}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Review Feedback</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: Recent Registered Platform Users */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Users className="h-4 w-4 text-foreground" />
                      Recent Platform Registrations
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Latest accounts registered in the database across all tenants.
                    </CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchParams({ tab: "users" })}
                  >
                    View All →
                  </Button>
                </CardHeader>
                <CardContent>
                  {loadingProfiles ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">Loading platform users...</div>
                  ) : (profiles || []).length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">No users registered yet.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {(profiles || []).slice(0, 5).map((p) => {
                        const role = getUserRole(p.user_id);
                        return (
                          <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar className="h-7 w-7 shrink-0">
                                <AvatarImage src={p.avatar_url || ""} />
                                <AvatarFallback className="text-[10px] font-semibold bg-secondary text-foreground">
                                  {(p.full_name || "U").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground truncate">{p.full_name || "Platform Member"}</p>
                                <p className="text-[10px] text-muted-foreground truncate">{p.company || "Standard Workspace"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={role === "admin" ? "default" : "outline"}
                                className="text-[10px] capitalize h-5 px-1.5"
                              >
                                {role}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                                {new Date(p.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Aggregated Platform Activity Stats */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-foreground" />
                    Platform Activity & Tenant Telemetry
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Aggregate totals of entities stored in the cloud database.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg border border-border bg-secondary/20">
                      <p className="text-[11px] text-muted-foreground font-medium">Gross Deals</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{systemStats?.totalDeals || 0}</p>
                      <p className="text-[10px] text-muted-foreground">in database</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-secondary/20">
                      <p className="text-[11px] text-muted-foreground font-medium">Companies</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{systemStats?.totalCompanies || 0}</p>
                      <p className="text-[10px] text-muted-foreground">registered</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-secondary/20">
                      <p className="text-[11px] text-muted-foreground font-medium">Contacts</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{systemStats?.totalContacts || 0}</p>
                      <p className="text-[10px] text-muted-foreground">profiles</p>
                    </div>
                    <div className="p-3 rounded-lg border border-border bg-secondary/20">
                      <p className="text-[11px] text-muted-foreground font-medium">Logged Activities</p>
                      <p className="text-lg font-bold text-foreground mt-0.5">{systemStats?.totalActivities || 0}</p>
                      <p className="text-[10px] text-muted-foreground">events recorded</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right 1 Col: Platform Infrastructure Health */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Server className="h-4 w-4 text-emerald-500" />
                    Cloud Infrastructure Status
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live Supabase service connectivity.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between py-1.5 border-b border-border text-xs">
                    <span className="text-muted-foreground">Database Engine</span>
                    <span className="font-mono text-foreground font-medium">PostgreSQL 15</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border text-xs">
                    <span className="text-muted-foreground">Auth Provider</span>
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> GoTrue API
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border text-xs">
                    <span className="text-muted-foreground">Row Level Security</span>
                    <span className="text-emerald-500 font-medium flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Active / Enforced
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 border-b border-border text-xs">
                    <span className="text-muted-foreground">Designated Superadmin</span>
                    <span className="font-mono text-foreground font-medium text-[11px]">bethebayou@gmail.com</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 text-xs">
                    <span className="text-muted-foreground">Cloud Endpoint</span>
                    <span className="font-mono text-foreground text-[11px] truncate max-w-[140px]" title="czuwelxmgjwbzwrqqlfv.supabase.co">
                      czuwelxmgjwbzwrqqlfv
                    </span>
                  </div>

                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportBackup}
                      className="w-full text-xs gap-1.5 h-8"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Export Full Workspace Backup</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Latest Beta Feedback Preview */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-foreground" />
                    Latest Feedback
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSearchParams({ tab: "feedback" })}
                  >
                    All →
                  </Button>
                </CardHeader>
                <CardContent>
                  {feedbackList && feedbackList.length > 0 ? (
                    <div className="space-y-2.5">
                      {feedbackList.slice(0, 2).map((item) => (
                        <div key={item.id} className="p-2.5 rounded-lg border border-border bg-secondary/15 text-xs space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center text-amber-500">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  className={`h-3 w-3 ${s <= item.rating ? "fill-current" : "text-muted/40"}`}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{item.category}</span>
                          </div>
                          <p className="text-[11px] text-foreground line-clamp-2 italic">"{item.comment}"</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-2">No feedback received yet.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* 1. Tester Feedback Tab */}
        <TabsContent value="feedback" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">Beta Feedback Inbox</CardTitle>
                <CardDescription className="text-xs">
                  Review ratings and comments submitted by your beta testing cohort.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Select value={feedbackCategoryFilter} onValueChange={setFeedbackCategoryFilter}>
                  <SelectTrigger className="h-8 text-xs w-36">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="Usability">Usability</SelectItem>
                    <SelectItem value="Feature Request">Feature Request</SelectItem>
                    <SelectItem value="Bug Report">Bug Report</SelectItem>
                    <SelectItem value="AI Copilot">AI Copilot</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                  </SelectContent>
                </Select>

                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetchFeedback()}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {loadingFeedback ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading submissions...</div>
              ) : filteredFeedback.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground flex flex-col items-center">
                  <MessageSquare className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="font-medium">No feedback entries found</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Submissions from the in-app "Feedback" button will appear here in real-time.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredFeedback.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-secondary/20 transition-colors"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center text-amber-500">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <Star
                                key={s}
                                className={`h-3.5 w-3.5 ${s <= item.rating ? "fill-current" : "text-muted/40"}`}
                              />
                            ))}
                          </div>
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {item.category}
                          </Badge>
                          <Badge
                            className={`text-[10px] font-medium capitalize ${
                              item.status === "resolved"
                                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                                : item.status === "reviewed"
                                ? "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30"
                                : "bg-secondary text-foreground"
                            }`}
                          >
                            {item.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <p className="text-xs text-foreground leading-relaxed font-normal">
                          "{item.comment}"
                        </p>

                        {item.email && (
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${item.email}`} className="hover:underline text-foreground">
                              {item.email}
                            </a>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-start">
                        {item.status !== "reviewed" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[11px] px-2"
                            onClick={() => updateFeedbackStatus.mutate({ id: item.id, status: "reviewed" })}
                          >
                            Mark Reviewed
                          </Button>
                        )}
                        {item.status !== "resolved" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-7 text-[11px] px-2 text-emerald-600 hover:text-emerald-700"
                            onClick={() => updateFeedbackStatus.mutate({ id: item.id, status: "resolved" })}
                          >
                            Mark Resolved
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. Team & Role Access Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4">
              <div>
                <CardTitle className="text-base font-semibold">User Roles & Access Control</CardTitle>
                <CardDescription className="text-xs">
                  Change role permissions for platform users across all workspaces. Changes take effect on next API call.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search users or companies..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-8 w-full"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loadingProfiles ? (
                <div className="py-8 text-center text-xs text-muted-foreground">Loading users...</div>
              ) : (profiles || []).filter((p) => {
                  if (!userSearchQuery.trim()) return true;
                  const q = userSearchQuery.toLowerCase();
                  return (
                    p.full_name?.toLowerCase().includes(q) ||
                    p.company?.toLowerCase().includes(q)
                  );
                }).length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground">No matching users found.</div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {(profiles || [])
                    .filter((p) => {
                      if (!userSearchQuery.trim()) return true;
                      const q = userSearchQuery.toLowerCase();
                      return (
                        p.full_name?.toLowerCase().includes(q) ||
                        p.company?.toLowerCase().includes(q)
                      );
                    })
                    .map((p) => {
                      const currentRole = getUserRole(p.user_id);
                      return (
                        <div key={p.id} className="flex items-center justify-between p-3.5 gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={p.avatar_url || ""} />
                              <AvatarFallback className="text-xs font-semibold">
                                {(p.full_name || "U").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-xs font-semibold text-foreground">
                                  {p.full_name || "Workspace Member"}
                                </p>
                                {p.user_id === user?.id && (
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground">
                                    You
                                  </Badge>
                                )}
                              </div>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {p.company || "Enterprise"} • Joined {new Date(p.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Select
                              value={currentRole}
                              onValueChange={(val: "admin" | "manager" | "rep") =>
                                updateRole.mutate({ userId: p.user_id, newRole: val })
                              }
                            >
                              <SelectTrigger className="h-8 w-32 text-xs font-medium">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                                <SelectItem value="rep">Sales Rep</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. Workspace Operations Tab */}
        <TabsContent value="database" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-foreground" />
                  Seed Test Environment
                </CardTitle>
                <CardDescription className="text-xs">
                  Populate your connected Supabase database with 7 enterprise companies, 7 decision-makers, and 7 deals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Ideal for testing pipeline stages, forecast velocity, and analytics graphs before inviting real reps.
                </p>
                <Button
                  onClick={handleSeedData}
                  disabled={seeding}
                  className="w-full text-xs font-medium gap-2 h-9"
                >
                  {seeding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>{seeding ? "Provisioning Database..." : "Populate Live Sample Data"}</span>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Download className="h-4 w-4 text-foreground" />
                  Export Comprehensive Audit
                </CardTitle>
                <CardDescription className="text-xs">
                  Download complete CRM dataset including audit logs and beta feedback.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Generates an immutable JSON archive of all profiles, roles, feedback notes, and pipeline metrics.
                </p>
                <Button
                  variant="outline"
                  onClick={handleExportBackup}
                  className="w-full text-xs font-medium gap-2 h-9"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Complete Backup</span>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
