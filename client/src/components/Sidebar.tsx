import { useState } from "react";
import {
  ChevronUp,
  Truck,
  FileText,
  Package,
  Users,
  Shield,
  Globe,
  Zap,
  Ship,
  User,
  HelpCircle,
  MessageCircle,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  subItems?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
  {
    id: "auto-transport",
    label: "Автоперевозки",
    icon: <Truck className="h-5 w-5" />,
    subItems: [
      {
        id: "digital-passport",
        label: "Цифровой паспорт",
        icon: <FileText className="h-4 w-4" />,
      },
      {
        id: "cargo",
        label: "Товарная партия",
        icon: <Package className="h-4 w-4" />,
      },
    ],
  },
  {
    id: "transport",
    label: "Транспорт",
    icon: <Truck className="h-5 w-5" />,
  },
  {
    id: "drivers",
    label: "Водители",
    icon: <Users className="h-5 w-5" />,
  },
  {
    id: "queue",
    label: "Встать в очередь",
    icon: <Shield className="h-5 w-5" />,
  },
  {
    id: "ai-assistant",
    label: "AI-ассистент",
    icon: <Zap className="h-5 w-5" />,
    badge: "СКОРО",
  },
  {
    id: "sea-transport",
    label: "Морские перевозки",
    icon: <Ship className="h-5 w-5" />,
    badge: "СКОРО",
  },
  {
    id: "rail-transport",
    label: "Ж/Д перевозки",
    icon: <Globe className="h-5 w-5" />,
    badge: "СКОРО",
  },
  {
    id: "aviation",
    label: "Авиаперевозки",
    icon: <Truck className="h-5 w-5" />,
    badge: "СКОРО",
  },
  {
    id: "profile",
    label: "Профиль",
    icon: <User className="h-5 w-5" />,
  },
  {
    id: "support",
    label: "Поддержка",
    icon: <HelpCircle className="h-5 w-5" />,
  },
];

interface SidebarProps {
  activeItem?: string;
  onItemClick?: (itemId: string) => void;
}

export default function Sidebar({ activeItem = "rail-transport", onItemClick }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    new Set(["auto-transport"])
  );

  const toggleExpand = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const renderItem = (item: SidebarItem, level = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const isActive = activeItem === item.id;
    const hasSubItems = item.subItems && item.subItems.length > 0;

    return (
      <div key={item.id}>
        <button
          onClick={() => {
            if (hasSubItems) {
              toggleExpand(item.id);
            }
            onItemClick?.(item.id);
          }}
          className={`w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-colors ${
            isActive
              ? "bg-primary text-primary-foreground"
              : "text-foreground hover:bg-sidebar-accent"
          } ${level > 0 ? "pl-8" : ""}`}
        >
          <div className="flex items-center gap-3">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <div className="flex items-center gap-2">
            {item.badge && (
              <Badge variant="secondary" className="bg-accent text-accent-foreground text-xs">
                {item.badge}
              </Badge>
            )}
            {hasSubItems && (
              <ChevronUp
                className={`h-4 w-4 transition-transform ${
                  isExpanded ? "" : "rotate-180"
                }`}
              />
            )}
          </div>
        </button>

        {/* Render sub-items */}
        {hasSubItems && isExpanded && (
          <div className="bg-sidebar-accent/50">
            {item.subItems?.map((subItem) => renderItem(subItem, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-80 border-r border-border bg-sidebar flex flex-col h-screen">
      {/* Navigation Items */}
      <nav className="flex-1 overflow-y-auto">
        {sidebarItems.map((item) => renderItem(item))}
      </nav>

      {/* Support Section at Bottom */}
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <HelpCircle className="h-4 w-4" />
          <span>Поддержка</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            title="Telegram support"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-2"
            title="WhatsApp support"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
