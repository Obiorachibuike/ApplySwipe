"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Bookmark,
  Zap,
  Briefcase,
  FileText,
  Send,
  ChevronDown,
  Building,
  Target,
} from "lucide-react";
import { Header } from "@/components/landing/Header";
import { Footer } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export default function LandingPage() {
  const [demoIndex, setDemoIndex] = useState(0);
  const [demoAction, setDemoAction] = useState<string | null>(null);

  const sampleDemoJobs = [
    {
      title: "Senior Full Stack Engineer",
      company: "Linear",
      location: "San Francisco, CA • Remote",
      salary: "$165k – $215k",
      match: 94,
      skills: ["React", "TypeScript", "Node.js", "GraphQL"],
      reasons: ["React mastery (6+ yrs)", "TypeScript proficiency", "App Router experience"],
    },
    {
      title: "Staff Frontend Architect",
      company: "Vercel",
      location: "Remote (Global)",
      salary: "$195k – $255k",
      match: 91,
      skills: ["Next.js", "React", "TypeScript", "Web Performance"],
      reasons: ["Next.js core expertise", "Performance optimization record", "Distributed systems"],
    },
    {
      title: "AI Systems Engineer",
      company: "Anthropic",
      location: "San Francisco, CA • Hybrid",
      salary: "$220k – $290k",
      match: 88,
      skills: ["Python", "FastAPI", "React", "LangChain"],
      reasons: ["Python & FastAPI backend", "LLM prompt testing experience", "Docker & Cloud"],
    },
  ];

  const handleDemoSwipe = (action: "pass" | "save" | "apply") => {
    setDemoAction(action);
    setTimeout(() => {
      setDemoAction(null);
      setDemoIndex((prev) => (prev + 1) % sampleDemoJobs.length);
    }, 600);
  };

  const currentJob = sampleDemoJobs[demoIndex];
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: "Does ApplySwipe ever hallucinate or invent qualifications on my resume?",
      a: "Never. Grounding is our primary architectural constraint. ApplySwipe only reorders, highlights, and articulates facts contained in your verified career profile. If a job requires a skill you do not have, our AI flags it as a missing skill rather than fabricating it.",
    },
    {
      q: "How does the swipe gesture work on desktop and mobile?",
      a: "On mobile devices, you can flick cards left (Pass), right (Apply), or up (Save). On desktop, you can use the interactive buttons or intuitive keyboard arrow shortcuts: ← Left Arrow to pass, → Right Arrow to apply, and ↑ Up Arrow to bookmark for later.",
    },
    {
      q: "Does ApplySwipe submit applications without my permission?",
      a: "You have complete control. In default 'Review Everything' mode, every tailored resume, cover letter, and answer requires your review before submission. In 'Smart Apply' or 'Autopilot' modes, applications only submit when a job exceeds your minimum AI match score and satisfies your salary and location parameters.",
    },
    {
      q: "What job sources and ATS platforms are supported?",
      a: "We integrate directly with official Greenhouse and Lever API feeds, permitted employer endpoints, and licensed job aggregators. We never bypass CAPTCHA, evade anti-bot controls, or scrape non-public websites.",
    },
    {
      q: "Is my personal data and resume used to train public AI models?",
      a: "No. Your career history, contact details, and resume documents are strictly encrypted and never used for foundational model training or shared with third parties without your explicit consent.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <Header />

      {/* 1. HERO SECTION */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-gradient-to-tr from-primary/20 via-secondary/15 to-accent/10 blur-[120px] pointer-events-none rounded-full" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6 shadow-glow"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Next-Generation Career Application Engine</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-4xl mx-auto leading-[1.1]"
          >
            Your AI-powered <br />
            <span className="bg-gradient-to-r from-primary via-indigo-300 to-secondary bg-clip-text text-transparent">
              job application engine.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed"
          >
            Create your career profile once. Swipe through jobs. Let AI tailor your resume and prepare every application for you.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/register" className="w-full sm:w-auto">
              <Button size="lg" variant="primary" className="w-full sm:w-auto gap-2.5 px-8 shadow-glow">
                <span>Start Applying</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto gap-2">
                <span>Explore Jobs (Demo)</span>
              </Button>
            </Link>
          </motion.div>

          {/* Workflow Diagram Banner */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-16 max-w-4xl mx-auto"
          >
            <div className="p-4 sm:p-6 rounded-2xl border border-white/10 bg-surface-card/80 backdrop-blur-md shadow-card">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
                The ApplySwipe Flow
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 items-center text-xs">
                <div className="flex flex-col items-center p-3 rounded-xl bg-surface-elevated border border-border hover:border-white/20 transition-all hover:-translate-y-0.5">
                  <div className="h-8 w-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center mb-2">
                    <FileText className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-foreground">Career Profile</span>
                  <span className="text-[10px] text-muted">Single source of truth</span>
                </div>

                <div className="hidden sm:flex justify-center text-muted">
                  <ArrowRight className="h-4 w-4" />
                </div>

                <div className="flex flex-col items-center p-3 rounded-xl bg-surface-elevated border border-border hover:border-white/20 transition-all hover:-translate-y-0.5">
                  <div className="h-8 w-8 rounded-lg bg-secondary/20 text-secondary flex items-center justify-center mb-2">
                    <Target className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-foreground">AI Match (90%+)</span>
                  <span className="text-[10px] text-muted">Grounded evaluation</span>
                </div>

                <div className="hidden sm:flex justify-center text-muted">
                  <ArrowRight className="h-4 w-4" />
                </div>

                <div className="flex flex-col items-center p-3 rounded-xl bg-surface-elevated border border-border hover:border-white/20 transition-all hover:-translate-y-0.5">
                  <div className="h-8 w-8 rounded-lg bg-accent/20 text-accent flex items-center justify-center mb-2">
                    <Zap className="h-4 w-4" />
                  </div>
                  <span className="font-semibold text-foreground">Swipe Right</span>
                  <span className="text-[10px] text-muted">Tailor & Apply</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 2. INTERACTIVE SWIPE PREVIEW SECTION */}
      <section id="swipe" className="py-20 border-t border-border/60 bg-surface/40 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <Badge variant="primary" className="mb-3">
              Tinder-Style Job Discovery
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Swipe your way to your next role.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-muted">
              Pass, save, or apply in milliseconds. Desktop arrows or mobile touch gestures.
            </p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="relative min-h-[460px] flex items-center justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentJob.company + demoIndex}
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{
                    scale: 1,
                    opacity: 1,
                    y: 0,
                    x: demoAction === "apply" ? 300 : demoAction === "pass" ? -300 : 0,
                    rotate: demoAction === "apply" ? 15 : demoAction === "pass" ? -15 : 0,
                  }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="w-full"
                >
                  <Card ai className="p-6 border-white/15 bg-surface-card shadow-2xl relative overflow-hidden">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-primary" />
                          <span className="text-xs font-bold tracking-wider uppercase text-muted">
                            {currentJob.company}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white mt-1">
                          {currentJob.title}
                        </h3>
                        <p className="text-xs text-muted mt-0.5">{currentJob.location}</p>
                      </div>

                      <div className="flex flex-col items-end">
                        <div className="px-3 py-1.5 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-sm flex items-center gap-1.5 shadow-glow-accent">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>{currentJob.match}% AI MATCH</span>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-400 mt-1">
                          {currentJob.salary}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 my-4">
                      {currentJob.skills.map((skill) => (
                        <span
                          key={skill}
                          className="px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 border border-white/10 text-slate-200"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="p-3.5 rounded-xl bg-surface-elevated border border-border/80 my-4 space-y-1.5 text-xs">
                      <span className="font-semibold text-slate-300 block mb-1">
                        Why your profile matches:
                      </span>
                      {currentJob.reasons.map((r) => (
                        <div key={r} className="flex items-center gap-2 text-slate-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-6 pt-4 border-t border-border/50">
                      <Button
                        variant="pass"
                        size="md"
                        onClick={() => handleDemoSwipe("pass")}
                        className="gap-1"
                      >
                        <XCircle className="h-4 w-4" />
                        <span>Pass</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="md"
                        onClick={() => handleDemoSwipe("save")}
                        className="gap-1 group"
                      >
                        <Bookmark className="h-4 w-4 text-amber-400 transition-transform group-hover:scale-110" />
                        <span>Save</span>
                      </Button>

                      <Button
                        variant="apply"
                        size="md"
                        onClick={() => handleDemoSwipe("apply")}
                        className="gap-1 shadow-glow"
                      >
                        <Send className="h-4 w-4 text-white" />
                        <span>Apply</span>
                      </Button>
                    </div>

                    <div className="text-center text-[10px] text-muted mt-3">
                      Try clicking buttons or navigate to live app for keyboard shortcuts (← Pass, → Apply, ↑ Save)
                    </div>
                  </Card>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS */}
      <section id="how-it-works" className="py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-3">
              Frictionless Pipeline
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              How ApplySwipe works
            </h2>
            <p className="mt-3 text-base text-muted">
              Three streamlined steps from profile upload to accepted interview invitation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card interactive className="p-8 border-white/10 bg-surface-card">
              <div className="h-12 w-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center font-bold text-lg mb-6 border border-primary/25">
                01
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Build Career Profile Once</h3>
              <p className="text-sm text-muted leading-relaxed">
                Upload your resume or fill your verified history. Our parser indexes your achievements, skills, and projects into a structured single source of truth.
              </p>
            </Card>

            <Card interactive className="p-8 border-white/10 bg-surface-card">
              <div className="h-12 w-12 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center font-bold text-lg mb-6 border border-secondary/25">
                02
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Swipe Through Matched Jobs</h3>
              <p className="text-sm text-muted leading-relaxed">
                Discover jobs ranked by AI Match scores based on genuine evidence. See transparent matching skills, missing skills, and compensation brackets before swiping.
              </p>
            </Card>

            <Card interactive className="p-8 border-white/10 bg-surface-card">
              <div className="h-12 w-12 rounded-xl bg-accent/15 text-accent flex items-center justify-center font-bold text-lg mb-6 border border-accent/25">
                03
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Automated Grounded Applications</h3>
              <p className="text-sm text-muted leading-relaxed">
                When you swipe right, our AI crafts an ATS-aligned tailored resume, bespoke cover letter, and precise question answers — validated strictly against your real facts.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* 4. AI RESUME TAILORING (BEFORE & AFTER COMPARISON) */}
      <section id="tailoring" className="py-24 border-t border-border bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="accent" className="mb-3">
              Zero Hallucinations Guarantee
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              AI Tailoring Grounded in Truth
            </h2>
            <p className="mt-3 text-base text-muted">
              We never fabricate jobs, degrees, or metrics. We reorganize and emphasize your real achievements to match each employer's specific technical lexicon.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
            {/* Master Resume */}
            <Card interactive className="p-6 border-white/10 bg-surface-card flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                  <div>
                    <span className="text-xs font-semibold text-muted uppercase">Source Profile</span>
                    <h4 className="text-base font-bold text-white">Master Resume</h4>
                  </div>
                  <Badge variant="outline">Unmodified</Badge>
                </div>
                <div className="font-mono text-xs text-muted space-y-3 leading-relaxed">
                  <p className="text-slate-200 font-semibold">ALEX CHEN — Senior Software Engineer</p>
                  <p>EXPERIENCE: TechVanguard (2022–Present)</p>
                  <p>- Built core web frontend features with modern JavaScript frameworks.</p>
                  <p>- Handled database queries with PostgreSQL and backend API endpoints.</p>
                  <p>- Mentored junior software developers on team best practices.</p>
                  <div className="pt-2 text-slate-400">
                    <span className="font-semibold text-slate-300">Skills: </span>
                    React, Node.js, Python, PostgreSQL, AWS, Docker, TypeScript
                  </div>
                </div>
              </div>
              <div className="mt-6 p-3 rounded-lg bg-surface-elevated text-[11px] text-muted border border-border">
                Generic master copy stored safely in your vault.
              </div>
            </Card>

            {/* Tailored Resume */}
            <Card ai className="p-6 border-primary/30 bg-surface-card shadow-glow flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-2xl rounded-full pointer-events-none" />
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
                  <div>
                    <span className="text-xs font-semibold text-primary uppercase">Grounded AI Tailored</span>
                    <h4 className="text-base font-bold text-white">Tailored for Linear</h4>
                  </div>
                  <Badge variant="primary">94% ATS Match</Badge>
                </div>
                <div className="font-mono text-xs text-muted space-y-3 leading-relaxed">
                  <p className="text-slate-200 font-semibold">ALEX CHEN — Senior Full Stack Engineer</p>
                  <p>TARGETED EXPERIENCE: TechVanguard (2022–Present)</p>
                  <p className="text-slate-200">
                    <span className="text-emerald-400">✓</span> Architected Next.js App Router migration reducing LCP interaction latency by 42%.
                  </p>
                  <p className="text-slate-200">
                    <span className="text-emerald-400">✓</span> Engineered scalable GraphQL & REST microservices backed by high-concurrency PostgreSQL.
                  </p>
                  <p className="text-slate-200">
                    <span className="text-emerald-400">✓</span> Designed accessible, keyboard-first UI component primitives with zero dropped frames.
                  </p>
                  <div className="pt-2 text-slate-300">
                    <span className="font-semibold text-primary">Prioritized Skills: </span>
                    React • TypeScript • Next.js • GraphQL • PostgreSQL • Performance
                  </div>
                </div>
              </div>
              <div className="mt-6 p-3 rounded-lg bg-primary/10 text-[11px] text-indigo-300 border border-primary/20 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
                <span>Anti-hallucination verification confirmed: 100% grounded in verified candidate history.</span>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 5. APPLICATION TRACKER & KANBAN PREVIEW */}
      <section className="py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="secondary" className="mb-3">
              Full Lifecycle Tracking
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Real Kanban Application Tracker
            </h2>
            <p className="mt-3 text-base text-muted">
              Never wonder where an application stands. Clear separation between prepared materials, submitted documents, and scheduled interviews.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-border bg-surface-card hover:border-white/20 transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-muted uppercase">Ready for Review</span>
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-foreground">1</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated border border-border space-y-1">
                <div className="text-xs font-semibold text-white">Stripe</div>
                <div className="text-[11px] text-muted">Senior Platform Engineer</div>
                <div className="text-[10px] text-amber-400 font-mono">Needs Confirmation</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface-card hover:border-white/20 transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-muted uppercase">Submitted</span>
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-foreground">1</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated border border-border space-y-1">
                <div className="text-xs font-semibold text-white">Vercel</div>
                <div className="text-[11px] text-muted">Staff Frontend Architect</div>
                <div className="text-[10px] text-indigo-400 font-mono">API Verified #vcl-2041</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-accent/30 bg-surface-card shadow-glow-accent hover:border-accent transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-accent uppercase">Interview Scheduled</span>
                <span className="text-xs font-mono bg-accent/20 text-accent px-2 py-0.5 rounded">1</span>
              </div>
              <div className="p-3 rounded-lg bg-accent/10 border border-accent/30 space-y-1">
                <div className="text-xs font-semibold text-white">Linear</div>
                <div className="text-[11px] text-slate-300">Senior Full Stack</div>
                <div className="text-[10px] text-emerald-400 font-mono">Tech Screen: Tue 2 PM</div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-border bg-surface-card hover:border-white/20 transition-all hover:-translate-y-0.5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-muted uppercase">Saved</span>
                <span className="text-xs font-mono bg-white/10 px-2 py-0.5 rounded text-foreground">2</span>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated border border-border space-y-1">
                <div className="text-xs font-semibold text-white">ACME Corp</div>
                <div className="text-[11px] text-muted">Product Engineer</div>
                <div className="text-[10px] text-slate-400 font-mono">Bookmarked</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. AUTOPILOT SECTION */}
      <section id="autopilot" className="py-24 border-t border-border bg-surface/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="primary" className="mb-3">
                Autonomous Job Search
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                AI Autopilot working for you while you sleep.
              </h2>
              <p className="mt-4 text-base text-muted leading-relaxed">
                Set your parameters: target titles, minimum salary, remote preferences, and daily application limits. Autopilot scans new postings, matches your profile, and queues or submits applications adhering strictly to your thresholds.
              </p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <span>Strict daily application limits (e.g., max 10/day)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <span>Minimum AI match score filter (e.g., 85%+)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <span>Excluded company blocklist (never apply to competitors or current firm)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                  <span>Full audit log with exact reasons for skipped jobs</span>
                </li>
              </ul>
            </div>

            <Card ai className="p-6 border-white/15 bg-surface-card shadow-2xl">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-accent animate-pulse" />
                  <span className="font-bold text-sm text-white">AUTOPILOT ENGINE ACTIVE</span>
                </div>
                <Badge variant="accent">Smart Apply</Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 my-4 text-xs font-mono">
                <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                  <span className="text-muted block text-[10px]">MIN MATCH</span>
                  <span className="text-foreground font-bold text-sm">85%</span>
                </div>
                <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                  <span className="text-muted block text-[10px]">DAILY LIMIT</span>
                  <span className="text-foreground font-bold text-sm">10 Applications</span>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-elevated border border-border space-y-2 text-xs">
                <span className="font-semibold text-slate-300 block">Today's Autonomous Activity:</span>
                <div className="flex justify-between text-muted">
                  <span>Jobs scanned</span>
                  <span className="font-bold text-foreground">42</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>High matches identified</span>
                  <span className="font-bold text-foreground">13</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Applications submitted via ATS API</span>
                  <span className="font-bold text-accent">7</span>
                </div>
                <div className="flex justify-between text-muted">
                  <span>Queued for user review</span>
                  <span className="font-bold text-amber-400">2</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 7. PRICING */}
      <section id="pricing" className="py-24 border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge variant="primary" className="mb-3">
              Simple Transparent Pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Invest in your career trajectory
            </h2>
            <p className="mt-3 text-base text-muted">
              Start free. Upgrade for unlimited AI tailoring and autopilot capabilities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            {/* Free */}
            <Card interactive className="p-8 border-white/10 bg-surface-card flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Starter</h3>
                <p className="text-xs text-muted mt-1">For exploratory job seekers</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-extrabold text-white">$0</span>
                  <span className="text-muted text-xs"> / forever</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Swipe through 50 jobs / day</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>5 AI resume tailorings / month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Basic Kanban tracker</span>
                  </li>
                </ul>
              </div>
              <Link href="/register" className="mt-8">
                <Button variant="outline" className="w-full">
                  Get Started Free
                </Button>
              </Link>
            </Card>

            {/* Pro */}
            <Card ai className="p-8 border-primary/50 bg-surface-card shadow-glow relative flex flex-col justify-between">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-[10px] font-bold text-white uppercase tracking-wider">
                Most Popular
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Pro Career Engine</h3>
                <p className="text-xs text-muted mt-1">For active engineers seeking top compensation</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-extrabold text-white">$29</span>
                  <span className="text-muted text-xs"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Unlimited job swiping & discovery</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Unlimited AI resume tailorings</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>AI Cover Letter & QA answering</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Autopilot (up to 20 applications/day)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Greenhouse & Lever direct API sync</span>
                  </li>
                </ul>
              </div>
              <Link href="/register" className="mt-8">
                <Button variant="primary" className="w-full shadow-glow">
                  Start Pro Trial
                </Button>
              </Link>
            </Card>

            {/* Enterprise */}
            <Card interactive className="p-8 border-white/10 bg-surface-card flex flex-col justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Executive</h3>
                <p className="text-xs text-muted mt-1">For high-tier leadership & bespoke search</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-extrabold text-white">$79</span>
                  <span className="text-muted text-xs"> / month</span>
                </div>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Everything in Pro</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Executive career agent review</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Highest priority ATS queue</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-accent" />
                    <span>Custom compensation negotiation AI</span>
                  </li>
                </ul>
              </div>
              <Link href="/register" className="mt-8">
                <Button variant="outline" className="w-full">
                  Upgrade to Executive
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* 8. FAQ */}
      <section id="faq" className="py-24 border-t border-border bg-surface/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-3">
              Frequently Asked Questions
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Everything you need to know
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border bg-surface-card overflow-hidden hover:border-white/20 transition-all duration-200"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full text-left p-5 flex items-center justify-between text-sm sm:text-base font-semibold text-foreground hover:text-primary transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted transition-transform duration-200 ${
                      openFaq === idx ? "rotate-180 text-primary" : ""
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-xs sm:text-sm text-muted leading-relaxed border-t border-border/40 pt-4 animate-in fade-in">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. FINAL CTA */}
      <section className="py-24 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <Badge variant="accent" className="mb-4">
            Get Hired Faster
          </Badge>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
            Stop filling repetitive forms. <br />
            <span className="text-primary">Start swiping your future.</span>
          </h2>
          <p className="mt-4 text-base text-muted max-w-xl mx-auto">
            Join thousands of modern developers who discover top remote jobs and prepare tailored applications in seconds.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" variant="primary" className="px-8 shadow-glow gap-2">
                <span>Start Applying Free</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="secondary">
                Candidate Log In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
