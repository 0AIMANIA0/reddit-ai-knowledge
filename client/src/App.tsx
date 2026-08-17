import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardPage from "./pages/DashboardPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import KnowledgeDetailPage from "./pages/KnowledgeDetailPage";
import NotFound from "./pages/NotFound";
import RuleSettingsPage from "./pages/RuleSettingsPage";

function Router() {
  return <DashboardLayout><Switch><Route path="/" component={DashboardPage} /><Route path="/knowledge" component={KnowledgeBasePage} /><Route path="/knowledge/:id" component={KnowledgeDetailPage} /><Route path="/rules" component={RuleSettingsPage} /><Route component={NotFound} /></Switch></DashboardLayout>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster richColors position="top-right" /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
