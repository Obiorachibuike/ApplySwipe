"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export default function RegisterPage() {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to create account.");
        toastError("Registration Failed", data.error);
        setLoading(false);
        return;
      }

      toastSuccess("Account Created!", "Let's set up your career profile.");
      // Redirect straight into 10-step onboarding
      router.push("/onboarding");
    } catch (err: any) {
      setFormError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-secondary/15 blur-[100px] pointer-events-none rounded-full" />

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
          Create your account
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-muted">
          Only essential information required. Complete your profile next.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 px-4 sm:px-0">
        <Card className="p-8 border-white/10 bg-surface-card shadow-2xl backdrop-blur-md">
          <form onSubmit={handleRegister} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger">
                {formError}
              </div>
            )}

            <div>
              <Input
                label="Full Name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>

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
              <Input
                label="Password (min. 6 characters)"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <div className="p-3 rounded-lg bg-surface-elevated border border-border text-[11px] text-muted flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <span>We never sell your data or use your resume for public model training.</span>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2 shadow-glow"
              isLoading={loading}
            >
              Continue to Onboarding
            </Button>
          </form>

          <div className="mt-6 text-center text-xs text-muted">
            Already have an account?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Log in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
