"use client";

import React, { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Eye,
  Bookmark,
  Send,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export default function AnalyticsPage() {
  const { error: toastError } = useToast();
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((data) => {
        if (data.stats) setStats(data.stats);
      })
      .catch(() => toastError("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [toastError]);

  if (loading || !stats) {
    return (
      <div className="text-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          <span>Application Analytics</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5">
          Factual metrics based strictly on your historical interactions and application statuses.
        </p>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-border bg-surface-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase">Jobs Viewed</span>
            <Eye className="h-4 w-4 text-primary" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{stats.jobsViewed}</div>
          <span className="text-[11px] text-muted mt-1 block">In discovery feed</span>
        </Card>

        <Card className="p-5 border-border bg-surface-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase">Jobs Saved</span>
            <Bookmark className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-white mt-2">{stats.jobsSaved}</div>
          <span className="text-[11px] text-muted mt-1 block">Bookmarked roles</span>
        </Card>

        <Card className="p-5 border-border bg-surface-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase">Applications</span>
            <Send className="h-4 w-4 text-accent" />
          </div>
          <div className="text-3xl font-extrabold text-accent mt-2">{stats.totalApplications}</div>
          <span className="text-[11px] text-muted mt-1 block">{stats.submittedCount} officially submitted</span>
        </Card>

        <Card className="p-5 border-border bg-surface-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted uppercase">Interview Rate</span>
            <Award className="h-4 w-4 text-secondary" />
          </div>
          <div className="text-3xl font-extrabold text-indigo-400 mt-2">{stats.interviewRate}%</div>
          <span className="text-[11px] text-muted mt-1 block">Verified recruiter responses</span>
        </Card>
      </div>

      {/* Weekly & Monthly Volumes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6 border-border bg-surface-card space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span>Volume Breakdown</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-surface-elevated border border-border">
              <span className="text-xs text-muted block">Applications This Week</span>
              <span className="text-2xl font-extrabold text-foreground mt-1 block">
                {stats.appsThisWeek}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-surface-elevated border border-border">
              <span className="text-xs text-muted block">Applications This Month</span>
              <span className="text-2xl font-extrabold text-foreground mt-1 block">
                {stats.appsThisMonth}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-surface-elevated border border-border text-xs space-y-2">
            <span className="font-semibold text-slate-300 block">Response Metrics</span>
            <div className="flex justify-between text-muted">
              <span>Overall Employer Response Rate</span>
              <span className="font-bold text-foreground">{stats.responseRate}%</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Interviews Scheduled</span>
              <span className="font-bold text-accent">{stats.interviewCount}</span>
            </div>
            <div className="flex justify-between text-muted">
              <span>Offers Extended</span>
              <span className="font-bold text-indigo-300">{stats.offerCount || 0}</span>
            </div>
          </div>
        </Card>

        {/* Top Matching Roles */}
        <Card className="p-6 border-border bg-surface-card space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Target className="h-4 w-4 text-accent" />
            <span>Top Matching Roles</span>
          </h3>

          <div className="space-y-3">
            {stats.topMatchingRoles?.map((r: any, idx: number) => (
              <div
                key={idx}
                className="p-3 rounded-lg bg-surface-elevated border border-border flex items-center justify-between text-xs"
              >
                <span className="font-semibold text-white">{r.role}</span>
                <Badge variant="outline">{r.count} applications</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Top Skills Distribution */}
      <Card className="p-6 border-border bg-surface-card space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span>Core Profile Competencies</span>
        </h3>
        <p className="text-xs text-muted">
          Your primary verified technical assets evaluated during automated ATS matching.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.topSkills?.slice(0, 8).map((skill: any, idx: number) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-surface-elevated border border-border text-xs space-y-1"
            >
              <span className="font-bold text-foreground block">{skill.name}</span>
              <span className="text-[10px] text-muted block">
                {skill.years ? `${skill.years} yrs exp` : "Verified"} • {skill.level || "Intermediate"}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
