"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  FolderKanban,
  Activity,
  Bot,
  FileText,
  BarChart3,
  Settings,
  Settings2,
  Cpu,
  Server,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Search,
  User as UserIcon,
  Shield,
  Layers
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  tab?: string;
  badge?: string;
}

const SIDEBAR_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    icon: LayoutDashboard,
    exact: true
  },
  {
    href: "/dashboard/projects",
    label: "Research Projects",
    icon: FolderKanban
  },
  {
    href: "/dashboard/research?tab=setup",
    label: "Project Setup",
    icon: Settings2,
    tab: "setup"
  },
  {
    href: "/dashboard/research?tab=setup",
    label: "Model Profiles",
    icon: Cpu,
    tab: "models"
  },
  {
    href: "/dashboard/research?tab=setup",
    label: "Compute Targets",
    icon: Server,
    tab: "compute"
  },
  {
    href: "/dashboard/research?tab=pipeline",
    label: "Live Pipeline",
    icon: Activity,
    tab: "pipeline",
    badge: "Live"
  },
  {
    href: "/dashboard/research?tab=chat",
    label: "Research Chat",
    icon: Bot,
    tab: "chat"
  },
  {
    href: "/dashboard/research?tab=artifacts",
    label: "Artifacts",
    icon: FileText,
    tab: "artifacts"
  },
  {
    href: "/dashboard/research?tab=runs",
    label: "Runs & Metrics",
    icon: BarChart3,
    tab: "runs"
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings
  }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [activeTabParam, setActiveTabParam] = useState<string | null>(null);

  // Read tab parameter on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleLocationChange = () => {
        const params = new URLSearchParams(window.location.search);
        setActiveTabParam(params.get("tab"));
      };
      handleLocationChange();
      window.addEventListener("popstate", handleLocationChange);
      return () => window.removeEventListener("popstate", handleLocationChange);
    }
  }, [pathname]);

  // Derive breadcrumb and title
  const getPageTitleAndBreadcrumbs = () => {
    if (pathname === "/dashboard") {
      return { title: "Research Overview", crumbs: ["Dashboard", "Overview"] };
    }
    if (pathname.startsWith("/dashboard/projects")) {
      return { title: "Research Projects", crumbs: ["Dashboard", "Projects"] };
    }
    if (pathname.startsWith("/dashboard/settings")) {
      return { title: "Operator Settings", crumbs: ["Dashboard", "Settings"] };
    }
    if (pathname.startsWith("/dashboard/research")) {
      const tabName = activeTabParam ? activeTabParam.charAt(0).toUpperCase() + activeTabParam.slice(1) : "Console";
      return { title: `Research Console (${tabName})`, crumbs: ["Dashboard", "Research Console", tabName] };
    }
    return { title: "Operator Dashboard", crumbs: ["Dashboard"] };
  };

  const { title, crumbs } = getPageTitleAndBreadcrumbs();

  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-background text-ink">
        {/* ===================== SIDEBAR (Desktop) ===================== */}
        <aside
          className={`hidden md:flex flex-col justify-between border-r border-border/80 bg-surface/90 backdrop-blur-md transition-all duration-300 ${
            isCollapsed ? "w-20 p-3" : "w-64 p-5"
          }`}
        >
          <div>
            {/* Brand Header */}
            <div className="flex items-center justify-between pb-6 border-b border-border/70">
              <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white shadow-glow">
                  <Sparkles className="h-5 w-5" />
                </div>
                {!isCollapsed ? (
                  <div className="truncate">
                    <span className="font-serif text-lg font-bold tracking-tight text-ink">Auto-Researcher</span>
                    <span className="ml-1.5 rounded-full border border-accent/20 bg-accent/10 px-1.5 py-0.2 text-[9px] font-semibold text-accent uppercase">
                      v1.0
                    </span>
                  </div>
                ) : null}
              </Link>
              <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="rounded-lg p-1.5 text-muted hover:bg-white/60 hover:text-ink transition"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* Navigation List */}
            <nav className="mt-5 space-y-1">
              {SIDEBAR_ITEMS.map((item, idx) => {
                const Icon = item.icon;
                let isActive = false;
                if (item.exact) {
                  isActive = pathname === item.href;
                } else if (item.tab) {
                  isActive = pathname.startsWith("/dashboard/research") && activeTabParam === item.tab;
                } else {
                  isActive = pathname.startsWith(item.href) && !pathname.startsWith("/dashboard/research");
                }

                return (
                  <Link
                    key={idx}
                    href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-xs font-semibold transition duration-150 ${
                      isActive
                        ? "bg-accent text-white shadow-sm"
                        : "text-muted hover:bg-white/80 hover:text-ink"
                    } ${isCollapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {!isCollapsed ? (
                      <span className="flex-1 truncate">{item.label}</span>
                    ) : null}
                    {!isCollapsed && item.badge ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wider font-bold ${
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-accent/10 text-accent border border-accent/20"
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Footer User Info */}
          <div className="border-t border-border/70 pt-4">
            {!isCollapsed ? (
              <div className="flex items-center justify-between rounded-2xl bg-white/70 p-3 border border-border/60">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/20 font-serif text-xs font-bold text-accent">
                    {user?.name ? user.name[0].toUpperCase() : "U"}
                  </div>
                  <div className="truncate">
                    <div className="truncate text-xs font-semibold text-ink">{user?.name}</div>
                    <div className="truncate text-[10px] text-muted">{user?.email}</div>
                  </div>
                </div>
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="rounded-lg p-1.5 text-muted hover:bg-rose-50 hover:text-danger transition"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex justify-center">
                <button
                  onClick={logout}
                  title="Sign Out"
                  className="rounded-xl p-2 text-muted hover:bg-rose-50 hover:text-danger transition"
                  aria-label="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ===================== MAIN WRAPPER ===================== */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/80 bg-surface/85 px-4 backdrop-blur-md md:px-8">
            {/* Left: Mobile hamburger + Breadcrumbs */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="rounded-xl p-2 text-ink md:hidden hover:bg-white/60"
                aria-label="Open sidebar menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="hidden sm:flex flex-col">
                <div className="flex items-center gap-1.5 text-[11px] text-muted">
                  {crumbs.map((crumb, idx) => (
                    <React.Fragment key={idx}>
                      {idx > 0 ? <span>/</span> : null}
                      <span className={idx === crumbs.length - 1 ? "font-semibold text-ink" : ""}>
                        {crumb}
                      </span>
                    </React.Fragment>
                  ))}
                </div>
                <h2 className="font-serif text-lg font-bold tracking-tight text-ink leading-tight">
                  {title}
                </h2>
              </div>
            </div>

            {/* Right: Quick actions, User Pill, Dropdown */}
            <div className="flex items-center gap-3">
              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2.5 rounded-full border border-border bg-white/80 p-1.5 pr-3 text-left transition hover:bg-white hover:border-accent/30 focus:outline-none"
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow-sm">
                    {user?.name ? user.name[0].toUpperCase() : "U"}
                  </div>
                  <span className="hidden md:inline text-xs font-semibold text-ink">
                    {user?.name || "Researcher"}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted" />
                </button>

                {/* Dropdown Menu */}
                {profileDropdownOpen ? (
                  <div className="glass-panel absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-panel z-50">
                    <div className="px-3 py-2 border-b border-border/60">
                      <div className="font-semibold text-xs text-ink truncate">{user?.name}</div>
                      <div className="text-[10px] text-muted truncate">{user?.email}</div>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      <Link
                        href="/dashboard/settings"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted hover:bg-white/80 hover:text-ink transition"
                      >
                        <UserIcon className="h-3.5 w-3.5" />
                        Account Settings
                      </Link>
                      <Link
                        href="/"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted hover:bg-white/80 hover:text-ink transition"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Platform Landing Page
                      </Link>
                      <button
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          void logout();
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-danger hover:bg-rose-50 transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </div>

        {/* ===================== MOBILE DRAWER ===================== */}
        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative z-10 w-72 flex flex-col justify-between border-r border-border bg-surface p-5 shadow-panel">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <span className="font-serif text-lg font-bold text-ink">Auto-Researcher</span>
                  </div>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg p-1.5 text-muted hover:bg-white/60"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <nav className="mt-4 space-y-1">
                  {SIDEBAR_ITEMS.map((item, idx) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={idx}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-xs font-semibold transition ${
                          isActive ? "bg-accent text-white" : "text-muted hover:bg-white/80 hover:text-ink"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge ? (
                          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold text-accent">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <div className="border-t border-border pt-4">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void logout();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 py-2.5 text-xs font-semibold text-danger hover:bg-rose-100 transition"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ProtectedRoute>
  );
}
