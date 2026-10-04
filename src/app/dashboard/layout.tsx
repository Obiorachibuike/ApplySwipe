"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  Compass,
  FileCheck2,
  FileText,
  User,
  Sliders,
  BarChart3,
  Bell,
  LogOut,
  Shield,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push("/login");
        } else {
          setUser(data.user);
        }
      })
      .catch(() => router.push("/login"));

    loadNotifications();
  }, [router]);

  const loadNotifications = () => {
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (data.notifications) {
          setNotifications(data.notifications);
          setUnreadCount(data.notifications.filter((n: any) => !n.isRead).length);
        }
      })
      .catch(() => {});
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setUnreadCount(0);
    loadNotifications();
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const navItems = [
    { label: "Discover", href: "/dashboard/discover", icon: Compass },
    { label: "Applications", href: "/dashboard/applications", icon: FileCheck2 },
    { label: "Career Profile", href: "/dashboard/profile", icon: User },
    { label: "Resumes", href: "/dashboard/resumes", icon: FileText },
    { label: "Autopilot", href: "/dashboard/autopilot", icon: Sliders },
    { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row pb-16 md:pb-0">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-surface shrink-0 p-4 justify-between h-screen sticky top-0">
        <div className="space-y-6">
          {/* Brand: scale(1.05) on hover with subtle glow & Brand Gradient */}
          <Link href="/dashboard/discover" className="flex items-center gap-2.5 px-2 group">
            <div className="h-9 w-9 rounded-xl brand-gradient-premium flex items-center justify-center shadow-glow transition-all duration-200 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
              <Sparkles className="h-5 w-5 text-white transition-transform duration-200 group-hover:rotate-12" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-foreground block leading-none transition-colors group-hover:brightness-110">
                Apply<span className="brand-gradient-text ml-0.5">Swipe</span>
              </span>
              <span className="text-[10px] text-muted block mt-0.5">AI Application Suite</span>
            </div>
          </Link>

          {/* Navigation Links: nav-item-interactive with subtle translateX(2px) */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item-interactive flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    isActive
                      ? "bg-primary/15 text-primary border border-primary/25 font-semibold shadow-sm"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 transition-colors ${
                      isActive ? "text-primary" : "text-muted group-hover:text-foreground"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile Section */}
        <div className="pt-4 border-t border-border space-y-2">
          {user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-amber-500 bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 hover:-translate-y-[1px] transition-all"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Admin Console</span>
            </Link>
          )}

          <div className="flex items-center justify-between p-2 rounded-xl bg-surface-elevated border border-border">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full brand-gradient flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                {user?.name?.[0]?.toUpperCase() || "A"}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground truncate">{user?.name}</div>
                <div className="text-[10px] text-muted truncate">{user?.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <ThemeToggle className="p-1.5" />
              <button
                onClick={handleLogout}
                title="Log out"
                className="text-muted hover:text-danger hover:scale-110 active:scale-95 p-1.5 rounded-lg transition-transform"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 border-b border-border bg-surface/80 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="md:hidden flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg brand-gradient-premium flex items-center justify-center shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-base text-foreground">ApplySwipe</span>
          </div>

          <div className="hidden md:block">
            <span className="text-xs text-muted font-medium">
              Grounded AI Engine • Zero Hallucinations Policy Active
            </span>
          </div>

          {/* Right actions: theme toggle + notifications */}
          <div className="flex items-center gap-2 relative">
            <ThemeToggle />

            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-xl text-muted hover:text-foreground hover:bg-surface-hover hover:scale-105 active:scale-95 transition-all"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-like text-[10px] font-bold text-white flex items-center justify-center shadow-glow-accent">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl border border-border bg-surface-card shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Notifications
                  </span>
                  <div className="flex items-center gap-2">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-muted hover:text-foreground hover:scale-110 active:scale-95 p-1 transition-transform"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-border/40 max-h-80 overflow-y-auto mt-2">
                  {notifications.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((notif: any) => (
                      <div
                        key={notif.id}
                        className={`p-3 space-y-1 text-xs hover:bg-surface-hover rounded-xl transition-colors ${
                          !notif.isRead ? "bg-primary/5" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-foreground">{notif.title}</span>
                          <span className="text-[10px] text-muted">
                            {new Date(notif.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-muted text-[11px] leading-relaxed">{notif.message}</p>
                        {notif.link && (
                          <Link
                            href={notif.link}
                            onClick={() => setShowNotifications(false)}
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline pt-1"
                          >
                            <span>View application</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Child views */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-md border-t border-border flex items-center justify-around py-2 px-1">
        <Link
          href="/dashboard/discover"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium active:scale-95 transition-all ${
            pathname === "/dashboard/discover" ? "text-primary font-bold" : "text-muted"
          }`}
        >
          <Compass className="h-5 w-5" />
          <span>Discover</span>
        </Link>

        <Link
          href="/dashboard/applications"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium active:scale-95 transition-all ${
            pathname === "/dashboard/applications" ? "text-primary font-bold" : "text-muted"
          }`}
        >
          <FileCheck2 className="h-5 w-5" />
          <span>Applications</span>
        </Link>

        <Link
          href="/dashboard/autopilot"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium active:scale-95 transition-all ${
            pathname === "/dashboard/autopilot" ? "text-primary font-bold" : "text-muted"
          }`}
        >
          <Sliders className="h-5 w-5" />
          <span>Autopilot</span>
        </Link>

        <Link
          href="/dashboard/profile"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-[10px] font-medium active:scale-95 transition-all ${
            pathname === "/dashboard/profile" ? "text-primary font-bold" : "text-muted"
          }`}
        >
          <User className="h-5 w-5" />
          <span>Profile</span>
        </Link>
      </nav>
    </div>
  );
}
