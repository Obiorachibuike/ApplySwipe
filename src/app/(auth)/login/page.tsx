"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, Lock, Mail, CheckCircle2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export default function LoginPage() {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to log in.");
        toastError("Login Failed", data.error || "Invalid credentials");
        setLoading(false);
        return;
      }

      toastSuccess("Welcome back!", `Signed in as ${data.user.name}`);

      if (data.user.role === "ADMIN") {
        router.push("/admin");
      } else if (!data.user.onboardingCompleted) {
        router.push("/onboarding");
      } else {
        router.push("/dashboard/discover");
      }
    } catch (err: any) {
      setFormError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const fillDemoAccount = (role: "candidate" | "admin") => {
    if (role === "candidate") {
      setEmail("alex@applyswipe.io");
      setPassword("password123");
    } else {
      setEmail("admin@applyswipe.io");
      setPassword("admin123");
    }
    setFormError("");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-primary/15 blur-[100px] pointer-events-none rounded-full" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Apply<span className="text-primary">Swipe</span>
          </span>
        </Link>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Welcome back
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-muted">
          Sign in to access your swipe queue and tailored applications.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Card className="p-8 border-white/10 bg-surface-card shadow-2xl backdrop-blur-md">
          {/* Quick Demo Fill Buttons */}
          <div className="mb-6 p-3 rounded-xl bg-surface-elevated border border-border/70 space-y-2">
            <div className="text-[11px] font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-accent" />
              <span>Instant Demo Accounts</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillDemoAccount("candidate")}
                className="text-xs p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
              >
                <div className="font-semibold text-foreground">Candidate (Alex)</div>
                <div className="text-[10px] text-muted">alex@applyswipe.io</div>
              </button>
              <button
                type="button"
                onClick={() => fillDemoAccount("admin")}
                className="text-xs p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-left transition-colors"
              >
                <div className="font-semibold text-foreground">Administrator</div>
                <div className="text-[10px] text-muted">admin@applyswipe.io</div>
              </button>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger">
                {formError}
              </div>
            )}

            <div>
              <Input
                label="Email Address"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 shadow-glow"
              isLoading={loading}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-muted">
            Don&apos;t have an account yet?{" "}
            <Link href="/register" className="text-primary font-semibold hover:underline">
              Start applying free
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
