"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setUser(data.user))
      .catch(() => {});

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled
          ? "bg-background/85 backdrop-blur-md border-b border-border py-3 shadow-sm"
          : "bg-transparent py-5"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Logo: scale(1.05) on hover with subtle glow & Brand Gradient */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="h-9 w-9 rounded-xl brand-gradient-premium flex items-center justify-center shadow-glow transition-all duration-200 group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(99,102,241,0.45)]">
            <Sparkles className="h-5 w-5 text-white transition-transform duration-200 group-hover:rotate-12" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground transition-colors duration-200 group-hover:brightness-110 flex items-center">
            Apply<span className="brand-gradient-text ml-0.5">Swipe</span>
          </span>
        </Link>

        {/* Desktop Navigation Links with subtle animated underline */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <Link href="#how-it-works" className="link-animated-underline">
            How It Works
          </Link>
          <Link href="#matching" className="link-animated-underline">
            AI Matching
          </Link>
          <Link href="#tailoring" className="link-animated-underline">
            Resume Tailoring
          </Link>
          <Link href="#autopilot" className="link-animated-underline">
            Autopilot
          </Link>
          <Link href="#pricing" className="link-animated-underline">
            Pricing
          </Link>
          <Link href="#faq" className="link-animated-underline">
            FAQ
          </Link>
        </nav>

        {/* Action CTAs & Theme Toggle */}
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle />

          {user ? (
            <Link href="/dashboard/discover">
              <Button size="sm" variant="primary" className="gap-2 shadow-glow">
                <span>Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="ghost">
                  Log In
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" variant="primary" className="gap-2 shadow-glow">
                  <span>Start Applying</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Hamburger */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-muted hover:text-foreground hover:scale-105 active:scale-95 transition-all rounded-lg"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-surface-card p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
          <Link
            href="#how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-muted hover:text-foreground py-2"
          >
            How It Works
          </Link>
          <Link
            href="#matching"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-muted hover:text-foreground py-2"
          >
            AI Matching
          </Link>
          <Link
            href="#tailoring"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-muted hover:text-foreground py-2"
          >
            Resume Tailoring
          </Link>
          <Link
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm font-medium text-muted hover:text-foreground py-2"
          >
            Pricing
          </Link>
          <div className="pt-2 flex flex-col gap-2">
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" variant="outline" className="w-full">
                Log In
              </Button>
            </Link>
            <Link href="/register" onClick={() => setMobileMenuOpen(false)}>
              <Button size="sm" variant="primary" className="w-full">
                Start Applying Free
              </Button>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
