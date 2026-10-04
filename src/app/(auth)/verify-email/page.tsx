import React from "react";
import Link from "next/link";
import { CheckCircle2, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-glow">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">
            Apply<span className="text-primary">Swipe</span>
          </span>
        </Link>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <Card className="p-8 border-white/10 bg-surface-card shadow-2xl text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-accent/20 text-accent flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Email Verified!</h2>
          <p className="text-xs sm:text-sm text-muted">
            Your email has been successfully confirmed. You&apos;re ready to proceed to your career profile and job discovery queue.
          </p>
          <div className="pt-4">
            <Link href="/dashboard/discover">
              <Button variant="primary" size="lg" className="w-full gap-2 shadow-glow">
                <span>Go to Dashboard</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
