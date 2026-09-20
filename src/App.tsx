import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { useMemo } from "react";
import { RequireRole } from "@/components/RequireRole";

import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Landing from "./pages/Landing";
import Product from "./pages/Product";
import Solutions from "./pages/Solutions";
import Customers from "./pages/Customers";
import Pricing from "./pages/Pricing";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";

import Index from "./pages/Index";
import Pipeline from "./pages/Pipeline";
import Contacts from "./pages/Contacts";
import Companies from "./pages/Companies";
import Activities from "./pages/Activities";
import Forecast from "./pages/Forecast";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import DataImportExport from "./pages/DataImportExport";
import Tasks from "./pages/Tasks";
import CalendarView from "./pages/CalendarView";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";

const App = () => {
  const queryClient = useMemo(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: 1 },
    },
  }), []);

  return (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Pages */}
              <Route path="/" element={<Landing />} />
              <Route path="/product" element={<Product />} />
              <Route path="/solutions" element={<Solutions />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/auth" element={<Auth />} />

              {/* Authenticated Workspace Pages */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Index />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/companies" element={<Companies />} />
                <Route path="/activities" element={<Activities />} />
                <Route path="/forecast" element={<Forecast />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/data" element={<DataImportExport />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/admin" element={<RequireRole role="admin"><Admin /></RequireRole>} />
              </Route>

              {/* 404 Not Found */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;
