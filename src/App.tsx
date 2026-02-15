import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Roles from "./pages/Roles";
import RoleDetail from "./pages/RoleDetail";
import CandidateImport from "./pages/CandidateImport";
import Screens from "./pages/Screens";
import ScreenDetail from "./pages/ScreenDetail";
import Settings from "./pages/Settings";
import DemoLogin from "./pages/DemoLogin";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

// In demo mode, no protection needed
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Index />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/roles" element={<ProtectedRoute><Roles /></ProtectedRoute>} />
      <Route path="/roles/:id" element={<ProtectedRoute><RoleDetail /></ProtectedRoute>} />
      <Route path="/candidates/import" element={<ProtectedRoute><CandidateImport /></ProtectedRoute>} />
      <Route path="/screens" element={<ProtectedRoute><Screens /></ProtectedRoute>} />
      <Route path="/screens/:id" element={<ProtectedRoute><ScreenDetail /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
