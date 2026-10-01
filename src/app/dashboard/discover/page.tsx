"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, useMotionValue, useTransform, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  X,
  CheckCircle2,
  XCircle,
  Bookmark,
  Send,
  Building,
  MapPin,
  DollarSign,
  Briefcase,
  Sliders,
  ExternalLink,
  ChevronDown,
  Info,
  Layers,
  FileText,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import confetti from "canvas-confetti";

export default function DiscoverPage() {
  const { success, error: toastError, info: toastInfo } = useToast();
  const [jobs, setJobs] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<any | null>(null);

  // Application Pipeline Modal state (Rule 39)
  const [applyingModalOpen, setApplyingModalOpen] = useState(false);
  const [applicationStep, setApplicationStep] = useState(0);
  const [applicationResult, setApplicationResult] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter state
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minMatchFilter, setMinMatchFilter] = useState(0);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/jobs?limit=50";
      if (remoteOnly) url += "&remote=true";
      if (minMatchFilter > 0) url += `&minMatch=${minMatchFilter}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
        setCurrentIndex(0);
      }
    } catch (e) {
      toastError("Failed to fetch jobs");
    } finally {
      setLoading(false);
    }
  }, [remoteOnly, minMatchFilter, toastError]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const currentJob = jobs[currentIndex];

  // Motion values for swipe gestures
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);
  const opacityPass = useTransform(x, [-150, -40], [1, 0]);
  const opacityApply = useTransform(x, [40, 150], [0, 1]);
  const opacitySave = useTransform(y, [-150, -40], [1, 0]);

  // Handle Pass (Swipe Left)
  const handlePass = useCallback(async () => {
    if (!currentJob) return;
    const jobToPass = currentJob;
    setCurrentIndex((prev) => prev + 1);

    fetch(`/api/jobs/${jobToPass.id}/pass`, { method: "POST" }).catch(() => {});
    toastInfo("Passed", `Passed on ${jobToPass.company}`);
  }, [currentJob, toastInfo]);

  // Handle Save (Swipe Up)
  const handleSave = useCallback(async () => {
    if (!currentJob) return;
    const jobToSave = currentJob;
    setCurrentIndex((prev) => prev + 1);

    fetch(`/api/jobs/${jobToSave.id}/save`, { method: "POST" }).catch(() => {});
    success("Saved Job", `${jobToSave.title} at ${jobToSave.company} bookmarked.`);
  }, [currentJob, success]);

  // Handle Apply (Swipe Right) — Launches AI Application Workflow (Rule 39)
  const handleApply = useCallback(async () => {
    if (!currentJob) return;
    const targetJob = currentJob;
    setApplyingModalOpen(true);
    setApplicationStep(1); // Step 1: Analyzing
    setIsSubmitting(true);

    try {
      // Step 1: Analyzing ATS requirements
      setTimeout(() => setApplicationStep(2), 700); // Step 2: Tailoring resume
      setTimeout(() => setApplicationStep(3), 1600); // Step 3: Cover letter & answers

      const res = await fetch(`/api/jobs/${targetJob.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "REVIEW_EVERYTHING" }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to process application");
      }

      setApplicationResult(data);
      setApplicationStep(4); // Step 4: Finished

      if (data.status === "SUBMITTED") {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      // Advance job card in background
      setCurrentIndex((prev) => prev + 1);
    } catch (err: any) {
      toastError("Application Preparation Failed", err.message);
      setApplyingModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentJob, toastError]);

  // Keyboard navigation shortcuts (Rule 7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (applyingModalOpen || selectedJobForDetail) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePass();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleApply();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePass, handleApply, handleSave, applyingModalOpen, selectedJobForDetail]);

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 100;
    if (info.offset.x > swipeThreshold) {
      handleApply();
    } else if (info.offset.x < -swipeThreshold) {
      handlePass();
    } else if (info.offset.y < -swipeThreshold) {
      handleSave();
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface-card">
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            <span>Discovering Jobs</span>
          </Badge>
          <span className="text-xs text-muted">
            {jobs.length > 0 ? `${currentIndex + 1} of ${jobs.length} loaded` : "Loading jobs..."}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-foreground">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="rounded border-border bg-surface-elevated text-primary focus:ring-0"
            />
            <span>Remote Only</span>
          </label>

          <select
            value={minMatchFilter}
            onChange={(e) => setMinMatchFilter(Number(e.target.value))}
            className="h-8 px-2.5 rounded-lg border border-border bg-surface-elevated text-xs text-foreground focus:outline-none"
          >
            <option value={0}>All AI Matches</option>
            <option value={80}>Match ≥ 80%</option>
            <option value={85}>Match ≥ 85%</option>
            <option value={90}>Match ≥ 90%</option>
          </select>
        </div>
      </div>

      {/* Main Swipe Container */}
      <div className="relative min-h-[580px] flex items-center justify-center">
        {loading ? (
          <div className="text-center py-16 space-y-3">
            <div className="h-10 w-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-muted">Analyzing jobs against your verified profile...</p>
          </div>
        ) : !currentJob ? (
          <Card className="p-10 text-center max-w-md mx-auto space-y-4 border-dashed border-white/20">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-bold text-white">Queue Complete!</h3>
            <p className="text-xs text-muted leading-relaxed">
              You've swiped through all available matching jobs for now. Check back soon or adjust your filters.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCurrentIndex(0);
                  fetchJobs();
                }}
                className="gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Restart Queue</span>
              </Button>
              <Link href="/dashboard/applications">
                <Button variant="primary" size="sm">
                  View Applications
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="relative w-full max-w-lg">
            {/* Background stack shadow card */}
            {jobs[currentIndex + 1] && (
              <div className="absolute inset-0 top-3 scale-[0.96] rounded-2xl border border-white/5 bg-surface-card/60 -z-10 pointer-events-none" />
            )}

            {/* Draggable Active Card */}
            <motion.div
              style={{ x, y, rotate }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.9}
              onDragEnd={handleDragEnd}
              whileTap={{ cursor: "grabbing" }}
              className="cursor-grab select-none w-full"
            >
              <Card className="p-6 sm:p-7 border-white/15 bg-surface-card shadow-2xl relative overflow-hidden backdrop-blur-md">
                {/* Swipe Stamp Indicators */}
                <motion.div
                  style={{ opacity: opacityApply }}
                  className="absolute top-6 right-6 z-20 pointer-events-none border-2 border-accent text-accent px-4 py-1.5 rounded-xl font-bold uppercase tracking-wider text-sm -rotate-12 bg-accent/10"
                >
                  APPLY
                </motion.div>

                <motion.div
                  style={{ opacity: opacityPass }}
                  className="absolute top-6 left-6 z-20 pointer-events-none border-2 border-danger text-danger px-4 py-1.5 rounded-xl font-bold uppercase tracking-wider text-sm rotate-12 bg-danger/10"
                >
                  PASS
                </motion.div>

                <motion.div
                  style={{ opacity: opacitySave }}
                  className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none border-2 border-amber-400 text-amber-400 px-4 py-1.5 rounded-xl font-bold uppercase tracking-wider text-sm bg-amber-400/10"
                >
                  SAVE
                </motion.div>

                {/* Company & Title Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-primary" />
                      <span className="text-xs font-bold tracking-wider uppercase text-muted">
                        {currentJob.company}
                      </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                      {currentJob.title}
                    </h2>
                  </div>

                  {/* AI Match percentage badge */}
                  <div className="flex flex-col items-end">
                    <div className="px-3.5 py-1.5 rounded-xl bg-accent/15 border border-accent/30 text-accent font-bold text-sm flex items-center gap-1.5 shadow-glow-accent">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{currentJob.matchScore || 85}% AI MATCH</span>
                    </div>
                    <span className="text-[10px] text-muted mt-1">Estimated Grounded Match</span>
                  </div>
                </div>

                {/* Job Metadata Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-4">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{currentJob.location}</span>
                  </div>
                  {currentJob.remote && <Badge variant="accent">Remote</Badge>}
                  {currentJob.salaryMax && (
                    <div className="flex items-center gap-1 font-semibold text-emerald-400">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>
                        ${Math.round(currentJob.salaryMin / 1000)}k – ${Math.round(currentJob.salaryMax / 1000)}k
                      </span>
                    </div>
                  )}
                  <Badge variant="outline">{currentJob.employmentType}</Badge>
                </div>

                {/* Skills Tags */}
                <div className="my-3">
                  <span className="text-[11px] font-semibold text-muted block mb-1.5">
                    Required / Preferred Skills:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(currentJob.skills || []).map((skill: string) => {
                      const isMatching = currentJob.matchAnalysis?.matchingSkills?.includes(skill);
                      return (
                        <span
                          key={skill}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium border ${
                            isMatching
                              ? "bg-primary/15 border-primary/30 text-indigo-300"
                              : "bg-white/5 border-white/10 text-slate-300"
                          }`}
                        >
                          {skill}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Why You Match Section (Rule 7 & 8) */}
                <div className="p-3.5 rounded-xl bg-surface-elevated border border-border my-4 space-y-2 text-xs">
                  <span className="font-semibold text-slate-200 block">Why you match:</span>
                  <p className="text-muted leading-relaxed">
                    {currentJob.matchAnalysis?.explanation ||
                      `Direct alignment with your experience in React, TypeScript, and high-throughput systems.`}
                  </p>

                  {/* Matching skills checks */}
                  {currentJob.matchAnalysis?.matchingSkills && (
                    <div className="pt-1 flex flex-wrap gap-2 text-[11px] text-emerald-400">
                      {currentJob.matchAnalysis.matchingSkills.slice(0, 4).map((ms: string) => (
                        <span key={ms} className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>{ms}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Job Description Excerpt with expand button */}
                <div className="text-xs text-muted line-clamp-3 leading-relaxed mb-4">
                  {currentJob.description}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedJobForDetail(currentJob)}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 mb-6"
                >
                  <span>Read full job description & ATS details</span>
                  <ExternalLink className="h-3 w-3" />
                </button>

                {/* Swiping Action Buttons */}
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border">
                  <Button
                    variant="outline"
                    size="md"
                    onClick={handlePass}
                    className="border-red-500/30 text-red-400 hover:bg-red-500/10 gap-1.5"
                  >
                    <XCircle className="h-4 w-4" />
                    <span>Pass</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleSave}
                    className="gap-1.5"
                  >
                    <Bookmark className="h-4 w-4 text-amber-400" />
                    <span>Save</span>
                  </Button>

                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleApply}
                    className="gap-1.5 shadow-glow"
                  >
                    <Send className="h-4 w-4" />
                    <span>Apply</span>
                  </Button>
                </div>

                {/* Keyboard Shortcuts Guide */}
                <div className="flex items-center justify-center gap-4 text-[10px] text-muted pt-3">
                  <span>← Pass</span>
                  <span>↑ Save</span>
                  <span>→ Apply</span>
                </div>
              </Card>
            </motion.div>
          </div>
        )}
      </div>

      {/* FULL JOB DETAILS DIALOG */}
      {selectedJobForDetail && (
        <Dialog
          isOpen={!!selectedJobForDetail}
          onClose={() => setSelectedJobForDetail(null)}
          title={selectedJobForDetail.title}
          description={`${selectedJobForDetail.company} • ${selectedJobForDetail.location}`}
        >
          <div className="space-y-4 text-xs sm:text-sm">
            <div className="flex flex-wrap gap-2 pb-2">
              <Badge variant="primary">{selectedJobForDetail.matchScore}% AI Match</Badge>
              {selectedJobForDetail.remote && <Badge variant="accent">Remote</Badge>}
              <Badge variant="outline">{selectedJobForDetail.applicationType}</Badge>
              <Badge variant="outline">ATS: {selectedJobForDetail.atsProvider}</Badge>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-1">Job Description</h4>
              <p className="text-muted leading-relaxed whitespace-pre-line">
                {selectedJobForDetail.description}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-white text-sm mb-2">Required Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {(selectedJobForDetail.skills || []).map((s: string) => (
                  <span
                    key={s}
                    className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs text-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-border">
              <Button variant="ghost" onClick={() => setSelectedJobForDetail(null)}>
                Close
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setSelectedJobForDetail(null);
                  handleApply();
                }}
              >
                Apply to this Job
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* LIVE APPLYING PROGRESS MODAL (Rule 39 UX Details) */}
      <Dialog
        isOpen={applyingModalOpen}
        onClose={() => {
          if (!isSubmitting) setApplyingModalOpen(false);
        }}
        title="AI Application Preparation"
        description="Grounded AI is tailoring materials specifically for this employer."
      >
        <div className="space-y-6 py-2">
          {/* Step 1 */}
          <div className="flex items-center gap-3">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                applicationStep > 1
                  ? "bg-accent text-black"
                  : applicationStep === 1
                  ? "bg-primary text-white animate-pulse"
                  : "bg-white/10 text-muted"
              }`}
            >
              {applicationStep > 1 ? <CheckCircle2 className="h-4 w-4" /> : "1"}
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                Analyzing Job & ATS Specifications
              </div>
              <div className="text-[11px] text-muted">
                Extracting core technologies, seniority level, and key responsibilities
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                applicationStep > 2
                  ? "bg-accent text-black"
                  : applicationStep === 2
                  ? "bg-primary text-white animate-pulse"
                  : "bg-white/10 text-muted"
              }`}
            >
              {applicationStep > 2 ? <CheckCircle2 className="h-4 w-4" /> : "2"}
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                Tailoring Verified Resume Bullets
              </div>
              <div className="text-[11px] text-muted">
                Reordering skills and aligning bullet points with zero hallucination enforcement
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                applicationStep > 3
                  ? "bg-accent text-black"
                  : applicationStep === 3
                  ? "bg-primary text-white animate-pulse"
                  : "bg-white/10 text-muted"
              }`}
            >
              {applicationStep > 3 ? <CheckCircle2 className="h-4 w-4" /> : "3"}
            </div>
            <div>
              <div className="text-xs font-semibold text-foreground">
                Crafting Cover Letter & Answers
              </div>
              <div className="text-[11px] text-muted">
                Answering standard application questions directly from your project facts
              </div>
            </div>
          </div>

          {/* Final Step 4: Outcome banner */}
          {applicationStep === 4 && applicationResult && (
            <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-accent font-bold text-sm">
                <CheckCircle2 className="h-5 w-5" />
                <span>
                  {applicationResult.status === "SUBMITTED"
                    ? "Application Submitted Successfully!"
                    : "Application Prepared & Ready for Review"}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                {applicationResult.message}
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Link href="/dashboard/applications" className="flex-1">
                  <Button variant="primary" size="sm" className="w-full">
                    View in Application Tracker
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setApplyingModalOpen(false)}
                >
                  Continue Swiping
                </Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
