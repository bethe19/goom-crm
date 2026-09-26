import { lazy, Suspense, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { ConfirmProvider } from "@/components/common/ConfirmDialog";
import { Loader2 } from "lucide-react";

// App shell (kept out of the public pages' bundle)
const AppLayout = lazy(() => import("@/components/AppLayout").then((m) => ({ default: m.AppLayout })));
const RequirePermission = lazy(() => import("@/components/RequireRole").then((m) => ({ default: m.RequirePermission })));
const RequirePlatformAdmin = lazy(() =>
  import("@/components/RequireRole").then((m) => ({ default: m.RequirePlatformAdmin })),
);

// Public pages
const Landing = lazy(() => import("./pages/Landing"));
const Product = lazy(() => import("./pages/Product"));
const Solutions = lazy(() => import("./pages/Solutions"));
const Customers = lazy(() => import("./pages/Customers"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Contact = lazy(() => import("./pages/Contact"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Workspace pages
const Index = lazy(() => import("./pages/Index"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Companies = lazy(() => import("./pages/Companies"));
const Activities = lazy(() => import("./pages/Activities"));
const Forecast = lazy(() => import("./pages/Forecast"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const DataImportExport = lazy(() => import("./pages/DataImportExport"));
const Tasks = lazy(() => import("./pages/Tasks"));
const CalendarView = lazy(() => import("./pages/CalendarView"));
const Admin = lazy(() => import("./pages/Admin"));
const Platform = lazy(() => import("./pages/Platform"));

export function PageFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true" aria-label="Loading">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

const App = () => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider delayDuration={300}>
          <Toaster />
          <ErrorBoundary>
            <AuthProvider>
              <ConfirmProvider>
                <BrowserRouter>
                  <Suspense fallback={<PageFallback />}>
                    <Routes>
                      {/* Public pages */}
                      <Route path="/" element={<Landing />} />
                      <Route path="/product" element={<Product />} />
                      <Route path="/solutions" element={<Solutions />} />
                      <Route path="/customers" element={<Customers />} />
                      <Route path="/pricing" element={<Pricing />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/terms" element={<Terms />} />
                      <Route path="/privacy" element={<Privacy />} />
                      <Route path="/auth" element={<Auth />} />
                      {/* Invitation links: /invite/<token> → sign in / sign up, then join the workspace */}
                      <Route path="/invite/:token" element={<Auth />} />

                      {/* Authenticated workspace pages */}
                      <Route element={<AppLayout />}>
                        <Route path="/dashboard" element={<Index />} />
                        <Route path="/pipeline" element={<Pipeline />} />
                        <Route path="/contacts" element={<Contacts />} />
                        <Route path="/companies" element={<Companies />} />
                        <Route path="/activities" element={<Activities />} />
                        <Route path="/tasks" element={<Tasks />} />
                        <Route path="/calendar" element={<CalendarView />} />
                        <Route path="/forecast" element={<Forecast />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/data" element={<DataImportExport />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="/admin" element={<RequirePermission permission="workspace.admin"><Admin /></RequirePermission>} />
                        {/* SaaS operator console: platform metadata and counts only, never workspace records */}
                        <Route path="/platform" element={<RequirePlatformAdmin><Platform /></RequirePlatformAdmin>} />
                        <Route path="/app" element={<Navigate to="/dashboard" replace />} />
                      </Route>

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </Suspense>
                </BrowserRouter>
              </ConfirmProvider>
            </AuthProvider>
          </ErrorBoundary>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
