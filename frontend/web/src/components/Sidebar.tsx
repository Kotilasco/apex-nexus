"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FolderOpen,
  GitBranch,
  Search,
  Shield,
  ClipboardList,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Bell,
  ShieldCheck,
  BarChart3,
  Paintbrush,
  Plug,
  Globe,
  Factory,
  Layers,
  FolderKanban,
  Mail,
  Sparkles,
  Network,
  Activity,
  Inbox,
  Bot,
  Building2,
  Telescope,
  TrendingUp,
  FolderHeart,
  Leaf
} from "lucide-react";

const navItems = [
  // Everyone sees these
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/intake", label: "Intake", icon: Inbox },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/cases", label: "Cases", icon: FolderHeart },
  { href: "/sustainability", label: "Sustainability", icon: Leaf },
  { href: "/federated", label: "Federated Search", icon: Telescope },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/workflow", label: "Workflow", icon: GitBranch },
  { href: "/predictions", label: "Predictions", icon: TrendingUp, roles: ["SYSTEM_ADMIN", "ADMIN", "DEPARTMENT_ADMIN"] },
  { href: "/vendor-portals", label: "Vendor Portals", icon: Building2, roles: ["SYSTEM_ADMIN", "ADMIN", "DEPARTMENT_ADMIN"] },
  { href: "/search", label: "Search", icon: Search },
  { href: "/apps", label: "Apps", icon: Sparkles },
  { href: "/knowledge-graph", label: "Knowledge Graph", icon: Network },
  { href: "/notifications", label: "Notifications", icon: Bell },
  // Role-gated items
  { href: "/retention", label: "Retention", icon: Shield, roles: ["SYSTEM_ADMIN", "ADMIN", "RECORDS_MANAGER"] },
  { href: "/compliance", label: "Compliance", icon: Globe, roles: ["SYSTEM_ADMIN", "ADMIN", "RECORDS_MANAGER", "DEPARTMENT_ADMIN"] },
  { href: "/workflow-designer", label: "Designer", icon: Paintbrush, roles: ["SYSTEM_ADMIN", "ADMIN", "DEPARTMENT_ADMIN"] },
  { href: "/marketplace", label: "Marketplace", icon: Plug, roles: ["SYSTEM_ADMIN", "ADMIN"] },
  { href: "/industry", label: "Industry", icon: Factory, roles: ["SYSTEM_ADMIN", "ADMIN"] },
  { href: "/sap", label: "SAP Integration", icon: Layers, roles: ["SYSTEM_ADMIN", "ADMIN"] },
  { href: "/email-ingestion", label: "Email Ingestion", icon: Mail, roles: ["SYSTEM_ADMIN", "ADMIN", "RECORDS_MANAGER"] },
  { href: "/trust-center", label: "Trust Center", icon: ShieldCheck, roles: ["SYSTEM_ADMIN", "ADMIN", "RECORDS_MANAGER", "DEPARTMENT_ADMIN"] },
  { href: "/analytics", label: "Analytics", icon: BarChart3, roles: ["SYSTEM_ADMIN", "ADMIN", "DEPARTMENT_ADMIN"] },
  { href: "/analytics/workflow-health", label: "Workflow Health", icon: Activity, roles: ["SYSTEM_ADMIN", "ADMIN", "DEPARTMENT_ADMIN"] },
  { href: "/audit", label: "Audit Log", icon: ClipboardList, roles: ["SYSTEM_ADMIN", "ADMIN"] },
  { href: "/admin/users", label: "Users", icon: Users, roles: ["SYSTEM_ADMIN", "ADMIN"] },
  { href: "/admin/settings", label: "Settings", icon: Settings, roles: ["SYSTEM_ADMIN", "ADMIN"] }
];

interface Props {
  open: boolean;
  onToggle: () => void;
  currentPath: string;
  userRoles?: string[];
}

export default function Sidebar({ open, onToggle, currentPath, userRoles = [] }: Props) {
  const normalizedRoles = userRoles.map((r) => r.replace(/^ROLE_/, "").toUpperCase());

  const visibleItems = navItems.filter((item) => {
    if (!item.roles) return true; // No role restriction
    // SYSTEM_ADMIN / ADMIN sees everything
    if (normalizedRoles.includes("SYSTEM_ADMIN") || normalizedRoles.includes("ADMIN")) return true;
    return item.roles.some((r) => normalizedRoles.includes(r));
  });
  return (
    <aside
      className={cn(
        "bg-apex-sidebar text-white flex flex-col transition-all duration-300 ease-in-out",
        open ? "w-64" : "w-16"
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-slate-700">
        <Image src="/zetdc-logo.png" alt="ZETDC" width={32} height={32} className="shrink-0" />
        {open && (
          <span className="ml-3 text-lg font-bold tracking-tight">
            ZETDC
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto scrollbar-none">
        {visibleItems.map((item) => {
          const active = currentPath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-primary-600/20 text-primary-300"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
              )}
              title={!open ? item.label : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {open && <span className="ml-3">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center h-12 border-t border-slate-700 text-slate-400 hover:text-white transition-colors"
      >
        {open ? (
          <ChevronLeft className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </button>
    </aside>
  );
}
