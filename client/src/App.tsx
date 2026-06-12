import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import RailTransport from "./pages/RailTransport";
import AutoTransport from "./pages/AutoTransport";
import Transport from "./pages/Transport";
import Drivers from "./pages/Drivers";
import Profile from "./pages/Profile";
import { useState } from "react";

function Router() {
  const [activeItem, setActiveItem] = useState("rail-transport");

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    // Navigate to corresponding route
    const routes: Record<string, string> = {
      "auto-transport": "/auto-transport",
      "transport": "/transport",
      "drivers": "/drivers",
      "queue": "/",
      "ai-assistant": "/",
      "sea-transport": "/",
      "rail-transport": "/rail-transport",
      "aviation": "/",
      "profile": "/profile",
      "support": "/",
      "digital-passport": "/auto-transport",
      "cargo": "/auto-transport",
    };
    window.location.hash = routes[itemId] || "/";
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeItem={activeItem} onItemClick={handleItemClick} />
        <Switch>
          <Route path="/" component={RailTransport} />
          <Route path="/rail-transport" component={RailTransport} />
          <Route path="/auto-transport" component={AutoTransport} />
          <Route path="/transport" component={Transport} />
          <Route path="/drivers" component={Drivers} />
          <Route path="/profile" component={Profile} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
