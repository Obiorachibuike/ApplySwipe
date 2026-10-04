import React from "react";
import Link from "next/link";
import { Sparkles, Shield } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background pt-16 pb-12 text-sm text-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2.5 group inline-flex">
              <div className="h-8 w-8 rounded-xl brand-gradient-premium flex items-center justify-center shadow-glow transition-all duration-200 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]">
                <Sparkles className="h-4 w-4 text-white transition-transform group-hover:rotate-12" />
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight transition-colors group-hover:brightness-110">
                Apply<span className="brand-gradient-text ml-0.5">Swipe</span>
              </span>
            </Link>
            <p className="text-xs text-muted max-w-sm leading-relaxed">
              The modern AI-powered job application engine. Swipe jobs, tailor resumes without hallucinations, and track every application with zero manual repetition.
            </p>
            <div className="flex items-center gap-2 text-xs text-like font-medium">
              <Shield className="h-3.5 w-3.5" />
              <span>Grounded Fact Guarantee • Anti-hallucination Engine</span>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/dashboard/discover" className="link-animated-underline">Swipe Discover</Link></li>
              <li><Link href="#matching" className="link-animated-underline">AI Job Matching</Link></li>
              <li><Link href="#tailoring" className="link-animated-underline">Resume Tailoring</Link></li>
              <li><Link href="/dashboard/applications" className="link-animated-underline">Application Tracker</Link></li>
              <li><Link href="/dashboard/autopilot" className="link-animated-underline">Autopilot Engine</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="#how-it-works" className="link-animated-underline">How It Works</Link></li>
              <li><Link href="#pricing" className="link-animated-underline">Pricing</Link></li>
              <li><Link href="#faq" className="link-animated-underline">FAQ</Link></li>
              <li><Link href="/login" className="link-animated-underline">Candidate Sign In</Link></li>
              <li><Link href="/admin" className="link-animated-underline">Admin Console</Link></li>
            </ul>
          </div>

          {/* Trust & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Privacy & Trust</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-foreground cursor-pointer transition-colors">Strict Data Privacy</span></li>
              <li><span className="hover:text-foreground cursor-pointer transition-colors">No AI Model Training</span></li>
              <li><span className="hover:text-foreground cursor-pointer transition-colors">ATS Compliance</span></li>
              <li><span className="hover:text-foreground cursor-pointer transition-colors">Terms of Service</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© 2026 ApplySwipe. All rights reserved. Zero hallucinations policy enforced.</p>
          <div className="flex items-center gap-4 text-muted">
            <span className="hover:text-foreground cursor-pointer transition-colors">Security</span>
            <span>•</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Terms</span>
            <span>•</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Privacy</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
