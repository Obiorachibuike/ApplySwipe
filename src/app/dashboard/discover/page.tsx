"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Bookmark,
  Send,
  Building,
  MapPin,
  DollarSign,
  ExternalLink,
  RotateCcw,
  Star,
  Globe,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface FeedJob {
  id: string;
  title: string;
  company: string;
  companyLogo?: string | null;
  location: string;
  workplaceType?: string;
  remote?: boolean;
  employmentType?: string;
  seniority?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency?: string;
  salaryInterval?: string | null;
  skills: string[];
  description: string;
  postedAt: string;
  source: string;
  sourceLabel?: string;
  sourceUrl?: string;
  applicationUrl?: string;
  officialApplicationUrl?: string | null;
  matchScore?: number;
  matchReason?: string | null;
  matchedSkills?: string[];
  missingSkills?: string[];
  matchAnalysis?: {
    explanation?: string;
    matchingSkills?: string[];
    missingSkills?: string[];
  } | null;
  applicationType?: string;
  atsProvider?: string;
  isSaved?: boolean;
}

function formatSalary(job: FeedJob): string | null {
  const currency = job.salaryCurrency || "USD";
  const interval = (job.salaryInterval || "YEAR").toUpperCase();
  const div = interval === "YEAR" ? 1000 : 1;
  const suffix = interval === "YEAR" ? "k" : "";
  const symbol =
    currency === "USD" ? "$" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : `${currency} `;
  const fmt = (value: number) => `${symbol}${Math.round(value / div)}${suffix}`;

  if (job.salaryMin && job.salaryMax) return `${fmt(job.salaryMin)} – ${fmt(job.salaryMax)}`;
  if (job.salaryMax) return `Up to ${fmt(job.salaryMax)}`;
  if (job.salaryMin) return `From ${fmt(job.salaryMin)}`;
  return null;
}

function postedAgo(value?: string): string {
  if (!value) return "Recently posted";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Recently posted";
  const days = Math.floor((Date.now() - time) / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Posted today";
  if (days === 1) return "Posted 1 day ago";
  if (days < 30) return `Posted ${days} days ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? "Posted 1 month ago" : `Posted ${months} months ago`;
}

function workplaceLabel(job: FeedJob): string {
  switch ((job.workplaceType || "").toUpperCase()) {
    case "REMOTE":
      return "Remote";
    case "HYBRID":
      return "Hybrid";
    case "ONSITE":
      return "On-site";
    default:
      return job.remote ? "Remote" : "Workplace not specified";
  }
}

export default function DiscoverPage() {
  const { success, error: toastError, info: toastInfo } = useToast();
  const [jobs, setJobs] = useState<FeedJob[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedJobForDetail, setSelectedJobForDetail] = useState<FeedJob | null>(null);

  // Application Pipeline Modal state
  const [applyingModalOpen, setApplyingModalOpen] = useState(false);
  const [applicationStep, setApplicationStep] = useState(0);
  const [applicationResult, setApplicationResult] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmingApplied, setConfirmingApplied] = useState(false);

  // Filter state
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [minMatchFilter, setMinMatchFilter] = useState(0);

  // Bookmark active animation state
  const [isBookmarked, setIsBookmarked] = useState(false);

  const cursorRef = useRef<string | null>(null);

  const loadMore = useCallback(
    async (cursor: string) => {
      setLoadingMore(true);
      try {
        const res = await fetch(`/api/jobs/feed?limit=20&cursor=${encodeURIComponent(cursor)}`);
        const data = await res.json();
        if (data.jobs?.length) {
          setJobs((prev) => [...prev, ...data.jobs]);
        }
        setNextCursor(data.nextCursor || null);
        cursorRef.current = data.nextCursor || null;
      } catch {
        // Silent: the queue keeps using what it already has.
      } finally {
        setLoadingMore(false);
      }
    },
    []
  );

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/jobs/feed?limit=20";
      if (remoteOnly) url += "&remote=true";
      if (minMatchFilter > 0) url += `&minScore=${minMatchFilter}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
        setCurrentIndex(0);
        setNextCursor(data.nextCursor || null);
        cursorRef.current = data.nextCursor || null;
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

  useEffect(() => {
    if (currentJob) {
      setIsBookmarked(Boolean(currentJob.isSaved));
    }
  }, [currentJob]);

  // Prefetch the next page shortly before the queue runs dry.
  useEffect(() => {
    if (!loading && !loadingMore && nextCursor && currentIndex >= jobs.length - 3) {
      loadMore(nextCursor);
    }
  }, [currentIndex, jobs.length, nextCursor, loading, loadingMore, loadMore]);

  // Framer Motion gesture values
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotate = useTransform(x, [-250, 250], [-18, 18]);
  const opacityApply = useTransform(x, [0, 40, 100, 160], [0, 0.2, 0.7, 1.0]);
  const opacityPass = useTransform(x, [0, -40, -100, -160], [0, 0.2, 0.7, 1.0]);
  const opacitySave = useTransform(y, [0, -40, -100, -160], [0, 0.2, 0.7, 1.0]);

  const swipe = useCallback(
    async (jobId: string, action: "LIKE" | "PASS" | "SUPER_LIKE") => {
      try {
        await fetch(`/api/jobs/${jobId}/swipe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
      } catch {
        // Swipes are best-effort in the UI; the queue already advanced.
      }
    },
    []
  );

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
    setIsBookmarked(true);
    setCurrentIndex((prev) => prev + 1);

    fetch(`/api/jobs/${jobToSave.id}/save`, { method: "POST" }).catch(() => {});
    success("Saved Job", `${jobToSave.title} at ${jobToSave.company} bookmarked.`);
  }, [currentJob, success]);

  // Handle Super Like
  const handleSuperLike = useCallback(async () => {
    if (!currentJob) return;
    const jobToLike = currentJob;
    setCurrentIndex((prev) => prev + 1);

    await swipe(jobToLike.id, "SUPER_LIKE");
    success("Super Liked ⭐", `${jobToLike.company} prioritized in your matches.`);
  }, [currentJob, swipe, success]);

  // Handle Apply (Swipe Right) — prepares materials and opens the official application URL
  const handleApply = useCallback(async () => {
    if (!currentJob) return;
    const targetJob = currentJob;
    setApplyingModalOpen(true);
    setApplicationStep(1);
    setIsSubmitting(true);
    setApplicationResult(null);

    try {
      setTimeout(() => setApplicationStep(2), 650);
      setTimeout(() => setApplicationStep(3), 1400);

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
      setApplicationStep(4);
      setCurrentIndex((prev) => prev + 1);
    } catch (err: any) {
      toastError("Application Preparation Failed", err.message);
      setApplyingModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentJob, toastError]);

  // The candidate confirms they applied on the employer's site.
  const handleConfirmApplied = useCallback(async () => {
    if (!applicationResult?.applicationId) return;
    setConfirmingApplied(true);
    try {
      const res = await fetch(
        `/api/applications/${applicationResult.applicationId}/apply-confirmation`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to confirm application");
      success("Tracked ✅", "Application marked as applied in your tracker.");
      setApplicationResult((prev: any) => ({ ...prev, status: "APPLIED", confirmed: true }));
    } catch (err: any) {
      toastError("Could not confirm", err.message);
    } finally {
      setConfirmingApplied(false);
    }
  }, [applicationResult, success, toastError]);

  const openOfficialApplicationPage = useCallback(() => {
    const url = applicationResult?.officialApplicationUrl || currentJob?.officialApplicationUrl;
    if (!url) {
      toastError("No application URL", "This job did not provide an official application link.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
    toastInfo("Employer site opened", "Submit your application there, then mark it as applied here.");
  }, [applicationResult, currentJob, toastError, toastInfo]);

  // Keyboard navigation shortcuts
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
      } else if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSuperLike();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePass, handleApply, handleSave, handleSuperLike, applyingModalOpen, selectedJobForDetail]);

  const handleDragEnd = (event: any, info: any) => {
    const swipeThreshold = 110;
    if (info.offset.x > swipeThreshold) {
      handleApply();
    } else if (info.offset.x < -swipeThreshold) {
      handlePass();
    } else if (info.offset.y < -swipeThreshold) {
      handleSave();
    }
  };

  const salary = currentJob ? formatSalary(currentJob) : null;
  const matchedSkills = currentJob?.matchedSkills || currentJob?.matchAnalysis?.matchingSkills || [];
  const missingSkills = currentJob?.missingSkills || currentJob?.matchAnalysis?.missingSkills || [];
  const officialUrl =
    currentJob?.officialApplicationUrl || currentJob?.applicationUrl || currentJob?.sourceUrl;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-surface-card shadow-sm">
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm" className="gap-1.5 shadow-sm">
            <Sparkles className="h-3 w-3" />
            <span>Discovering Jobs</span>
          </Badge>
          <span className="text-xs text-muted">
            {jobs.length > 0 ? `${currentIndex + 1} of ${jobs.length} loaded` : "Loading jobs..."}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer text-muted hover:text-foreground transition-colors select-none">
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
            className="h-8 px-2.5 rounded-xl border border-border bg-surface-elevated text-xs text-foreground focus:outline-none transition-colors hover:border-border-bright"
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
            <p className="text-xs text-muted">Ranking real jobs against your verified profile...</p>
          </div>
        ) : !currentJob ? (
          <Card className="p-10 text-center max-w-md mx-auto space-y-4 border-dashed border-border">
            <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto shadow-glow">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Queue Complete!</h3>
            <p className="text-xs text-muted leading-relaxed">
              You&apos;ve swiped through all available matching jobs for now. Check back soon or restart your
              queue.
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
            {/* Background stack shadow cards with subtle scale */}
            {jobs[currentIndex + 1] && (
              <div className="absolute inset-0 top-3 scale-[0.96] rounded-2xl border border-border bg-surface-card/60 -z-10 pointer-events-none transition-transform" />
            )}
            {jobs[currentIndex + 2] && (
              <div className="absolute inset-0 top-6 scale-[0.92] rounded-2xl border border-border bg-surface-card/35 -z-20 pointer-events-none transition-transform" />
            )}

            {/* Draggable Active Card */}
            <motion.div
              style={{ x, y, rotate }}
              drag
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              dragElastic={0.85}
              dragTransition={{ bounceStiffness: 300, bounceDamping: 25 }}
              onDragEnd={handleDragEnd}
              whileTap={{ cursor: "grabbing" }}
              className="cursor-grab select-none w-full"
            >
              <Card interactive className="p-6 sm:p-7 relative overflow-hidden backdrop-blur-md">
                {/* Swipe Stamp Indicators */}
                <motion.div
                  style={{ opacity: opacityApply }}
                  className="absolute top-6 right-6 z-20 pointer-events-none border-2 border-like text-like px-4 py-1.5 rounded-xl font-extrabold uppercase tracking-wider text-sm -rotate-12 bg-like/15 shadow-glow-accent"
                >
                  APPLY
                </motion.div>

                <motion.div
                  style={{ opacity: opacityPass }}
                  className="absolute top-6 left-6 z-20 pointer-events-none border-2 border-pass text-pass px-4 py-1.5 rounded-xl font-extrabold uppercase tracking-wider text-sm rotate-12 bg-pass-bg shadow-glow-pass"
                >
                  PASS
                </motion.div>

                <motion.div
                  style={{ opacity: opacitySave }}
                  className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none border-2 border-amber-400 text-amber-400 px-4 py-1.5 rounded-xl font-extrabold uppercase tracking-wider text-sm bg-amber-400/15 shadow-[0_0_20px_rgba(251,191,36,0.3)]"
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
                    <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1 leading-snug">
                      {currentJob.title}
                    </h2>
                  </div>

                  {/* AI Match percentage badge */}
                  <div className="flex flex-col items-end shrink-0">
                    <div className="px-3.5 py-1.5 rounded-xl bg-like/15 border border-like/30 text-like font-bold text-sm flex items-center gap-1.5 shadow-glow-accent">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>{currentJob.matchScore ?? 0}% MATCH</span>
                    </div>
                    <span className="text-[10px] text-muted mt-1">Grounded Evaluation</span>
                  </div>
                </div>

                {/* Job Metadata Badges */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted mb-3">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-muted" />
                    <span>{currentJob.location}</span>
                  </div>
                  <Badge variant={workplaceLabel(currentJob) === "Remote" ? "accent" : "outline"}>
                    <Globe className="h-3 w-3 mr-1" />
                    {workplaceLabel(currentJob)}
                  </Badge>
                  {salary && (
                    <div className="flex items-center gap-1 font-semibold text-like">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span>{salary}</span>
                    </div>
                  )}
                  <Badge variant="outline">{currentJob.employmentType || "Role"}</Badge>
                  {currentJob.seniority && <Badge variant="outline">{currentJob.seniority}</Badge>}
                </div>

                {/* Source transparency + posting date */}
                <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted mb-4 pb-3 border-b border-border">
                  <span className="inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                    Source: <span className="text-foreground font-semibold">{currentJob.sourceLabel || currentJob.source}</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {postedAgo(currentJob.postedAt)}
                  </span>
                  {officialUrl && (
                    <a
                      href={officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:text-primary-hover font-semibold"
                    >
                      View original posting
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>

                {/* Matched / missing skills */}
                <div className="my-3 space-y-2">
                  {matchedSkills.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-muted block mb-1.5">
                        Your matching skills:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {matchedSkills.slice(0, 8).map((skill: string) => (
                          <span
                            key={`match-${skill}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border bg-like/10 border-like/30 text-like"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {missingSkills.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-muted block mb-1.5">
                        Not on your profile yet:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {missingSkills.slice(0, 5).map((skill: string) => (
                          <span
                            key={`missing-${skill}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-amber-400/30 bg-amber-400/10 text-amber-400"
                          >
                            ! {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {matchedSkills.length === 0 && missingSkills.length === 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-muted block mb-1.5">
                        Skills required:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(currentJob.skills || []).slice(0, 10).map((skill: string) => (
                          <span
                            key={skill}
                            className="px-2.5 py-1 rounded-lg text-xs font-medium border bg-surface-elevated border-border text-foreground"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Why you match section */}
                <div className="p-3.5 rounded-xl bg-surface-elevated border border-border my-4 space-y-2 text-xs">
                  <span className="font-semibold text-foreground block">Why you match:</span>
                  <p className="text-muted leading-relaxed">
                    {currentJob.matchReason ||
                      currentJob.matchAnalysis?.explanation ||
                      `Evaluated against your verified profile and skills.`}
                  </p>
                </div>

                {/* Job Description Excerpt */}
                <div className="text-xs text-muted line-clamp-3 leading-relaxed mb-4">
                  {currentJob.description}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedJobForDetail(currentJob)}
                  className="link-animated-underline text-xs font-semibold flex items-center gap-1 mb-6 text-primary hover:text-primary-hover"
                >
                  <span>Read full job description & source details</span>
                  <ExternalLink className="h-3 w-3" />
                </button>

                {/* Swiping Action Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border">
                  <Button variant="pass" size="md" onClick={handlePass} className="gap-1.5">
                    <XCircle className="h-4 w-4" />
                    <span>Pass</span>
                  </Button>

                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleSave}
                    className="gap-1.5 group"
                  >
                    <Bookmark
                      className={`h-4 w-4 transition-all duration-200 group-hover:scale-110 ${
                        isBookmarked ? "text-amber-400 fill-amber-400" : "text-amber-400 group-hover:fill-amber-400/50"
                      }`}
                    />
                    <span>{isBookmarked ? "Saved" : "Save"}</span>
                  </Button>

                  <Button variant="outline" size="md" onClick={handleSuperLike} className="gap-1.5">
                    <Star className="h-4 w-4 text-primary" />
                    <span>Super Like</span>
                  </Button>

                  <Button variant="apply" size="md" onClick={handleApply} className="gap-1.5">
                    <Send className="h-4 w-4" />
                    <span>Apply</span>
                  </Button>
                </div>

                {/* Keyboard Shortcuts Guide */}
                <div className="flex items-center justify-center gap-4 text-[10px] text-muted pt-3">
                  <span>← Pass</span>
                  <span>↑ Save</span>
                  <span>S Super Like</span>
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
              <Badge variant="primary">{selectedJobForDetail.matchScore ?? 0}% Match</Badge>
              <Badge variant="accent">{workplaceLabel(selectedJobForDetail)}</Badge>
              <Badge variant="outline">
                Source: {selectedJobForDetail.sourceLabel || selectedJobForDetail.source}
              </Badge>
              <Badge variant="outline">{selectedJobForDetail.employmentType}</Badge>
              {selectedJobForDetail.salaryMax && (
                <Badge variant="outline">{formatSalary(selectedJobForDetail)}</Badge>
              )}
            </div>

            <div>
              <h4 className="font-bold text-foreground text-sm mb-1">Job Description</h4>
              <p className="text-muted leading-relaxed whitespace-pre-line">
                {selectedJobForDetail.description}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-foreground text-sm mb-2">Required Skills</h4>
              <div className="flex flex-wrap gap-1.5">
                {(selectedJobForDetail.skills || []).map((s: string) => {
                  const isMatched = matchedSkills.includes(s);
                  const isMissing = missingSkills.includes(s);
                  return (
                    <span
                      key={s}
                      className={`px-2.5 py-1 rounded-md border text-xs ${
                        isMatched
                          ? "bg-like/10 border-like/30 text-like"
                          : isMissing
                          ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                          : "bg-surface-elevated border-border text-foreground"
                      }`}
                    >
                      {s}
                    </span>
                  );
                })}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-surface-elevated border border-border space-y-1">
              <div className="text-[11px] font-semibold text-foreground">Source transparency</div>
              <div className="text-muted">
                This job comes from <strong>{selectedJobForDetail.sourceLabel || selectedJobForDetail.source}</strong>.
                ApplySwipe does not create jobs - every listing links back to the original posting.
              </div>
              {officialUrl && (
                <a
                  href={officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:text-primary-hover font-semibold pt-1"
                >
                  Open official application page
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-2 border-t border-border">
              <Button variant="ghost" onClick={() => setSelectedJobForDetail(null)}>
                Close
              </Button>
              <Button
                variant="apply"
                onClick={() => {
                  setSelectedJobForDetail(null);
                  handleApply();
                }}
              >
                Prepare Application
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* LIVE APPLYING PROGRESS MODAL */}
      <Dialog
        isOpen={applyingModalOpen}
        onClose={() => {
          if (!isSubmitting) setApplyingModalOpen(false);
        }}
        title="Application Preparation"
        description="Grounded AI is tailoring materials specifically for this employer."
      >
        <div className="space-y-6 py-2">
          {[
            {
              step: 1,
              title: "Analyzing Job & ATS Specifications",
              hint: "Extracting technologies, seniority level and key responsibilities",
            },
            {
              step: 2,
              title: "Tailoring Verified Resume Bullets",
              hint: "Reordering your verified skills and experience with zero fabrication",
            },
            {
              step: 3,
              title: "Crafting Cover Letter & Answers",
              hint: "Answering standard application questions from your profile facts",
            },
          ].map((entry) => (
            <div key={entry.step} className="flex items-center gap-3">
              <div
                className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                  applicationStep > entry.step
                    ? "bg-like text-white scale-100"
                    : applicationStep === entry.step
                    ? "bg-primary text-white animate-pulse"
                    : "bg-surface-elevated text-muted"
                }`}
              >
                {applicationStep > entry.step ? <CheckCircle2 className="h-4 w-4" /> : entry.step}
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">{entry.title}</div>
                <div className="text-[11px] text-muted">{entry.hint}</div>
              </div>
            </div>
          ))}

          {applicationStep === 4 && applicationResult && (
            <div className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 text-foreground font-bold text-sm">
                <CheckCircle2 className="h-5 w-5 text-like" />
                <span>
                  {applicationResult.status === "APPLIED"
                    ? "✓ Marked as applied"
                    : "✦ Materials ready — apply on the employer site"}
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{applicationResult.message}</p>

              <div className="p-3 rounded-lg bg-surface-card border border-border text-[11px] text-muted space-y-1">
                <div>
                  Source:{" "}
                  <span className="text-foreground font-semibold">
                    {applicationResult.sourceLabel || currentJob?.sourceLabel}
                  </span>
                </div>
                <div>
                  Tailored resume:{" "}
                  <span className="text-foreground font-semibold">
                    {applicationResult.readiness?.tailoredResume ? "Ready" : "Pending"}
                  </span>{" "}
                  • Cover letter:{" "}
                  <span className="text-foreground font-semibold">
                    {applicationResult.readiness?.coverLetter ? "Ready" : "Pending"}
                  </span>
                </div>
                <div className="text-muted">
                  ApplySwipe never submits on your behalf — you submit on the employer page, then confirm
                  here.
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <Button variant="apply" size="sm" className="flex-1" onClick={openOfficialApplicationPage}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Open official application page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={confirmingApplied || applicationResult.confirmed}
                  onClick={handleConfirmApplied}
                >
                  {applicationResult.confirmed ? "Tracked as applied" : confirmingApplied ? "Saving..." : "I've submitted it"}
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Link href="/dashboard/applications" className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full">
                    View in Application Tracker
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => setApplyingModalOpen(false)}>
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
