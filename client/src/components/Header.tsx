import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  userName?: string;
  userIIN?: string;
  onLogout?: () => void;
}

export default function Header({
  userName = "БАТАНОВ ДИАС РУСЛАНОВИЧ",
  userIIN = "ИИН: 04091355074З",
  onLogout,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background">
      <div className="flex h-16 items-center justify-between px-6">
        {/* Left: Logo and Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            ⚙️
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Кабинет водителя</h1>
            <p className="text-xs text-muted-foreground">Smart Cargo</p>
          </div>
        </div>

        {/* Right: User Info and Logout */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">{userIIN}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            <span>Выход</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
