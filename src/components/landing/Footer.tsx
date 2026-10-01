import React from "react";
import Link from "next/link";
import { Sparkles, Shield, Heart, Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background pt-16 pb-12 text-sm text-muted">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Col */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-glow">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">
                Apply<span className="text-primary">Swipe</span>
              </span>
            </Link>
            <p className="text-xs text-muted max-w-sm leading-relaxed">
              The modern AI-powered job application engine. Swipe jobs, tailor resumes without hallucinations, and track every application with zero manual repetition.
            </p>
            <div className="flex items-center gap-2 text-xs text-accent">
              <Shield className="h-3.5 w-3.5" />
              <span>Grounded Fact Guarantee • Anti-hallucination Engine</span>
            </div>
          </div>

          {/* Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Product</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="/dashboard/discover" className="hover:text-foreground transition-colors">Swipe Discover</Link></li>
              <li><Link href="#matching" className="hover:text-foreground transition-colors">AI Job Matching</Link></li>
              <li><Link href="#tailoring" className="hover:text-foreground transition-colors">Resume Tailoring</Link></li>
              <li><Link href="/dashboard/applications" className="hover:text-foreground transition-colors">Application Tracker</Link></li>
              <li><Link href="/dashboard/autopilot" className="hover:text-foreground transition-colors">Autopilot Engine</Link></li>
            </ul>
          </div>

          {/* Resources */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Resources</h4>
            <ul className="space-y-2 text-xs">
              <li><Link href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</Link></li>
              <li><Link href="#pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
              <li><Link href="#faq" className="hover:text-foreground transition-colors">FAQ</Link></li>
              <li><Link href="/login" className="hover:text-foreground transition-colors">Candidate Sign In</Link></li>
              <li><Link href="/admin" className="hover:text-foreground transition-colors">Admin Console</Link></li>
            </ul>
          </div>

          {/* Trust & Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">Privacy & Trust</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="hover:text-foreground cursor-pointer">Strict Data Privacy</span></li>
              <li><span className="hover:text-foreground cursor-pointer">No AI Model Training</span></li>
              <li><span className="hover:text-foreground cursor-pointer">ATS Compliance</span></li>
              <li><span className="hover:text-foreground cursor-pointer">Terms of Service</span></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <p>© {new Date().getFullYear()} ApplySwipe Inc. All rights reserved.</p>
          <div className="flex items-center gap-4 text-muted">
            <span className="flex items-center gap-1">
              Crafted for modern engineers & job seekers
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
