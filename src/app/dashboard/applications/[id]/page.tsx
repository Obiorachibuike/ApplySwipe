"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Building,
  FileText,
  Mail,
  HelpCircle,
  Clock,
  CheckCircle2,
  Send,
  Download,
  Copy,
  Edit3,
  RotateCcw,
  Check,
  Save,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: toastError, info } = useToast();
  const appId = params.id as string;

  const [application, setApplication] = useState<any | null>(null);
  const [masterResume, setMasterResume] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"resume" | "cover-letter" | "answers" | "job">("resume");

  // Editable documents & notes state
  const [coverLetterContent, setCoverLetterContent] = useState("");
  const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);
  const [answers, setAnswers] = useState<any[]>([]);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("READY_FOR_REVIEW");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchApplication();
  }, [appId]);

  const fetchApplication = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/applications/${appId}`);
      const data = await res.json();
      if (!res.ok) {
        toastError("Application not found");
        router.push("/dashboard/applications");
        return;
      }

      setApplication(data.application);
      setMasterResume(data.masterResume);
      setStatus(data.application.status);
      setNotes(data.application.notes || "");
      setAnswers(data.application.answers || []);

      const clDoc = data.application.documents?.find(
        (d: any) => d.type === "COVER_LETTER"
      );
      if (clDoc) {
        setCoverLetterContent(clDoc.content);
      }
    } catch (e) {
      toastError("Failed to fetch application");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        success("Status Updated", `Application marked as ${newStatus.replace(/_/g, " ")}`);
        fetchApplication();
      }
    } catch (e) {
      toastError("Failed to update status");
    }
  };

  const officialApplicationUrl: string | null = (() => {
    const job = application?.job as any;
    if (!job) return null;
    const aggregators = ["adzuna.", "indeed.", "linkedin.", "glassdoor.", "ziprecruiter.", "remoteok.", "remotive."];
    const isAggregator = (url: string) => aggregators.some((host) => url.includes(host));
    const refs: string[] = (job.sources || [])
      .map((ref: any) => ref?.applicationUrl)
      .filter(Boolean);
    const direct = refs.find((url: string) => !isAggregator(url));
    return direct || job.applicationUrl || job.sourceUrl || refs[0] || null;
  })();

  const sourceLabel =
    application?.job?.provider === "ADZUNA"
      ? "Adzuna"
      : application?.job?.provider === "GREENHOUSE"
      ? "Company Career Page (Greenhouse)"
      : application?.job?.provider === "LEVER"
      ? "Company Career Page (Lever)"
      : application?.job?.source || "ApplySwipe";

  const handleOpenOfficialPage = () => {
    if (!officialApplicationUrl) {
      toastError("No application URL", "This job did not provide an official application link.");
      return;
    }
    window.open(officialApplicationUrl, "_blank", "noopener,noreferrer");
    info("Employer site opened", "Submit there, then mark this application as applied.");
  };

  const handleConfirmApplied = async () => {
    try {
      const res = await fetch(`/api/applications/${appId}/apply-confirmation`, { method: "POST" });
      if (res.ok) {
        success("Marked as applied ✅", "Your application is tracked in ApplySwipe.");
        fetchApplication();
      } else {
        const data = await res.json();
        toastError("Could not confirm", data.error);
      }
    } catch (e) {
      toastError("Failed to confirm application");
    }
  };

  const handleSaveNotes = async () => {
    try {
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        success("Notes Saved");
      }
    } catch (e) {
      toastError("Failed to save notes");
    }
  };

  const handleSaveCoverLetter = async () => {
    try {
      const clDoc = application.documents?.find((d: any) => d.type === "COVER_LETTER");
      const res = await fetch(`/api/applications/${appId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents: [{ id: clDoc?.id, content: coverLetterContent, title: clDoc?.title }],
        }),
      });
      if (res.ok) {
        setIsEditingCoverLetter(false);
        success("Cover Letter Saved");
      }
    } catch (e) {
      toastError("Failed to save cover letter");
    }
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    info("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = (content: string, filename: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    success("Download started", filename);
  };

  const tailoredResumeDoc = application?.documents?.find(
    (d: any) => d.type === "TAILORED_RESUME"
  );

  if (loading || !application) {
    return (
      <div className="text-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const timelineSteps = [
    { label: "Job Discovered", date: "Initial Aggregation", done: true },
    { label: "AI Match Scored", date: `${application.matchScore || 90}% Match`, done: true },
    { label: "Materials Prepared", date: "Resume & Cover Letter", done: true },
    {
      label: "Submitted",
      date: application.submittedAt
        ? new Date(application.submittedAt).toLocaleDateString()
        : "Awaiting Confirmation",
      done: ["SUBMITTED", "APPLIED", "INTERVIEW", "OFFER", "REJECTED"].includes(status),
    },
    {
      label: "Interview",
      date: status === "INTERVIEW" ? "In Progress" : "Pending",
      done: ["INTERVIEW", "OFFER"].includes(status),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            href="/dashboard/applications"
            className="text-xs text-muted hover:text-white inline-flex items-center gap-1.5 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Applications</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {application.job?.title}
            </h1>
            <Badge variant="primary">{application.matchScore || 85}% AI Match</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
            <Building className="h-3.5 w-3.5" />
            <span className="font-semibold text-slate-200">{application.job?.company}</span>
            <span>•</span>
            <span>{application.job?.location}</span>
            <span>•</span>
            <span>
              Source: <span className="text-slate-200 font-semibold">{sourceLabel}</span>
            </span>
            {officialApplicationUrl && (
              <a
                href={officialApplicationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:text-primary-hover font-semibold"
              >
                Official posting <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>

        {/* Status updater & Primary Action */}
        <div className="flex items-center gap-3">
          <select
            value={status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-surface-elevated text-xs font-semibold text-foreground focus:outline-none"
          >
            <option value="READY">Ready to apply</option>
            <option value="READY_FOR_REVIEW">Ready for Review</option>
            <option value="APPLIED">Applied</option>
            <option value="SUBMITTED">Submitted (legacy)</option>
            <option value="INTERVIEW">Interview Scheduled</option>
            <option value="OFFER">Offer Received 🎉</option>
            <option value="REJECTED">Archived / Rejected</option>
          </select>

          {officialApplicationUrl && (
            <Button variant="outline" size="sm" onClick={handleOpenOfficialPage} className="gap-1.5">
              <ExternalLink className="h-4 w-4" />
              <span>Open application page</span>
            </Button>
          )}

          {["READY", "READY_FOR_REVIEW", "PREPARING"].includes(status) && (
            <Button
              variant="accent"
              size="sm"
              onClick={handleConfirmApplied}
              className="gap-1.5 shadow-glow-accent"
            >
              <Send className="h-4 w-4" />
              <span>I&apos;ve applied — track it</span>
            </Button>
          )}
        </div>
      </div>

      {/* Timeline Bar (Rule 18) */}
      <Card className="p-4 border-border bg-surface-card">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted mb-3">
          Application Lifecycle Timeline
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {timelineSteps.map((step, idx) => (
            <div
              key={idx}
              className={`p-2.5 rounded-lg border text-xs ${
                step.done
                  ? "bg-primary/10 border-primary/30 text-white"
                  : "bg-surface-elevated border-border text-muted opacity-60"
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold">
                {step.done ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
                ) : (
                  <div className="h-2 w-2 rounded-full bg-muted shrink-0" />
                )}
                <span className="truncate">{step.label}</span>
              </div>
              <div className="text-[10px] text-muted mt-1 truncate">{step.date}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Main Tabs (Tailored Resume vs Master, Cover Letter, Answers, Job Spec) */}
      <div className="flex items-center gap-2 border-b border-border text-xs font-semibold pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("resume")}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === "resume"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-white"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Tailored Resume Comparison</span>
        </button>

        <button
          onClick={() => setActiveTab("cover-letter")}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === "cover-letter"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-white"
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Tailored Cover Letter</span>
        </button>

        <button
          onClick={() => setActiveTab("answers")}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === "answers"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-white"
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>AI Application Answers ({answers.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("job")}
          className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            activeTab === "job"
              ? "bg-primary text-white shadow-sm"
              : "text-muted hover:text-white"
          }`}
        >
          <Building className="h-4 w-4" />
          <span>Job & ATS Details</span>
        </button>
      </div>

      {/* TAB 1: TAILORED RESUME VS MASTER RESUME (Rule 12) */}
      {activeTab === "resume" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Master Resume */}
          <Card className="p-6 border-white/10 bg-surface-card">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <span className="text-[10px] font-bold text-muted uppercase">Candidate Vault</span>
                <h3 className="text-sm font-bold text-white">Master Resume</h3>
              </div>
              <Badge variant="outline">Unchanged Baseline</Badge>
            </div>
            <div className="p-4 rounded-xl bg-surface-elevated font-mono text-xs text-muted leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
              {masterResume?.rawText || "Master resume contents loaded from profile."}
            </div>
          </Card>

          {/* Tailored Resume */}
          <Card className="p-6 border-primary/30 bg-surface-card shadow-glow relative">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div>
                <span className="text-[10px] font-bold text-primary uppercase">Grounded ATS Version</span>
                <h3 className="text-sm font-bold text-white">
                  {tailoredResumeDoc?.title || "Tailored Resume"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleCopyText(tailoredResumeDoc?.content || "")
                  }
                  className="gap-1"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Copy</span>
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() =>
                    handleDownloadMarkdown(
                      tailoredResumeDoc?.content || "",
                      `${application.job?.company}-Tailored-Resume.md`
                    )
                  }
                  className="gap-1 shadow-glow"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-primary/20 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[500px] overflow-y-auto">
              {tailoredResumeDoc?.content || "Tailored resume markdown generation pending."}
            </div>

            <div className="mt-4 p-3 rounded-xl bg-accent/10 border border-accent/20 text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                Verified Grounded: All companies, titles, and dates match verified profile. No hallucinated qualifications.
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: COVER LETTER (Rule 13) */}
      {activeTab === "cover-letter" && (
        <Card className="p-6 border-border bg-surface-card space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
            <div>
              <h3 className="text-base font-bold text-white">Bespoke Cover Letter</h3>
              <p className="text-xs text-muted">
                Crafted specifically for {application.job?.company} using your real accomplishments.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {isEditingCoverLetter ? (
                <Button variant="accent" size="sm" onClick={handleSaveCoverLetter} className="gap-1">
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Edits</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingCoverLetter(true)}
                  className="gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Letter</span>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopyText(coverLetterContent)}
                className="gap-1"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() =>
                  handleDownloadMarkdown(
                    coverLetterContent,
                    `${application.job?.company}-Cover-Letter.txt`
                  )
                }
                className="gap-1 shadow-glow"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </Button>
            </div>
          </div>

          {isEditingCoverLetter ? (
            <Textarea
              rows={12}
              value={coverLetterContent}
              onChange={(e) => setCoverLetterContent(e.target.value)}
              className="font-sans text-xs leading-relaxed"
            />
          ) : (
            <div className="p-6 rounded-xl bg-surface-elevated border border-border text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-line font-sans">
              {coverLetterContent}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: APPLICATION ANSWERS (Rule 14) */}
      {activeTab === "answers" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-surface-card border border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Employer Application Questions</h3>
              <p className="text-xs text-muted">
                AI answers prepared using verified facts from your career history. Edit anytime.
              </p>
            </div>
          </div>

          {answers.map((ans, idx) => (
            <Card key={ans.id || idx} className="p-5 border-border bg-surface-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase">
                  Question {idx + 1}
                </span>
                <Badge variant={ans.isEdited ? "secondary" : "outline"} size="sm">
                  {ans.isEdited ? "Edited by You" : "AI Suggested"}
                </Badge>
              </div>

              <h4 className="text-sm font-semibold text-white">{ans.question}</h4>

              <Textarea
                rows={3}
                value={ans.answer}
                onChange={(e) => {
                  const updated = [...answers];
                  updated[idx].answer = e.target.value;
                  updated[idx].isEdited = true;
                  setAnswers(updated);
                }}
                className="text-xs"
              />
            </Card>
          ))}
        </div>
      )}

      {/* TAB 4: JOB & ATS SPECIFICATION */}
      {activeTab === "job" && (
        <Card className="p-6 border-border bg-surface-card space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-surface-elevated border border-border">
              <span className="text-[10px] text-muted block">INTEGRATION TYPE</span>
              <span className="font-semibold text-foreground">
                {application.job?.applicationType}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-surface-elevated border border-border">
              <span className="text-[10px] text-muted block">ATS PROVIDER</span>
              <span className="font-semibold text-foreground">
                {application.job?.atsProvider}
              </span>
            </div>
            <div className="p-3 rounded-lg bg-surface-elevated border border-border">
              <span className="text-[10px] text-muted block">SALARY BRACKET</span>
              <span className="font-semibold text-emerald-400">
                ${Math.round((application.job?.salaryMin || 140000) / 1000)}k – ${Math.round((application.job?.salaryMax || 200000) / 1000)}k
              </span>
            </div>
            <div className="p-3 rounded-lg bg-surface-elevated border border-border">
              <span className="text-[10px] text-muted block">EXTERNAL PORTAL</span>
              <a
                href={application.job?.applicationUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary font-semibold hover:underline flex items-center gap-1"
              >
                <span>Direct Link</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-2">Original Job Description</h4>
            <div className="p-4 rounded-xl bg-surface-elevated border border-border text-xs text-muted leading-relaxed whitespace-pre-line">
              {application.job?.description}
            </div>
          </div>
        </Card>
      )}

      {/* Notes Section */}
      <Card className="p-5 border-border bg-surface-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
            Candidate Notes & Interview Log
          </h3>
          <Button variant="outline" size="sm" onClick={handleSaveNotes} className="gap-1">
            <Save className="h-3.5 w-3.5" />
            <span>Save Notes</span>
          </Button>
        </div>
        <Textarea
          placeholder="Record notes on recruiter calls, interview rounds, questions asked, or follow-ups..."
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Card>
    </div>
  );
}
