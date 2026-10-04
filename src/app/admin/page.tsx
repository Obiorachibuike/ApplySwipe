"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Users,
  Briefcase,
  Layers,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { error: toastError, success } = useToast();
  const [stats, setStats] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "jobs" | "sources">("overview");

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch("/api/admin/stats");
      if (statsRes.status === 401) {
        toastError("Admin access required", "Please log in as an administrator.");
        router.push("/login");
        return;
      }
      const statsData = await statsRes.json();
      setStats(statsData.stats);

      const [usersRes, jobsRes, sourcesRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/jobs"),
        fetch("/api/admin/sources"),
      ]);

      const [uData, jData, sData] = await Promise.all([
        usersRes.json(),
        jobsRes.json(),
        sourcesRes.json(),
      ]);

      if (uData.users) setUsers(uData.users);
      if (jData.jobs) setJobs(jData.jobs);
      if (sData.sources) setSources(sData.sources);
    } catch (e) {
      toastError("Failed to fetch admin data");
    } finally {
      setLoading(false);
    }
  };

  const toggleJobStatus = async (jobId: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, isActive: !currentActive }),
      });
      if (res.ok) {
        success("Job Updated");
        fetchAdminData();
      }
    } catch (e) {
      toastError("Failed to update job");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-10 max-w-7xl mx-auto space-y-8">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <Link
            href="/dashboard/discover"
            className="text-xs text-muted hover:text-white inline-flex items-center gap-1.5 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to User Dashboard</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Shield className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">ApplySwipe Administration</h1>
          </div>
          <p className="text-xs text-muted">
            Global system telemetry, job sources, moderation, and AI token consumption.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="accent" size="sm" className="gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>System All Systems Operational</span>
          </Badge>
        </div>
      </div>

      {/* Overview Stat Cards (Rule 29) */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 border-border bg-surface-card">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Total Users</span>
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">{stats?.usersCount}</div>
        </Card>

        <Card className="p-4 border-border bg-surface-card">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Active Jobs</span>
            <Briefcase className="h-4 w-4 text-accent" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">{stats?.jobsCount}</div>
        </Card>

        <Card className="p-4 border-border bg-surface-card">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Applications</span>
            <Layers className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-extrabold text-white mt-1">{stats?.appsCount}</div>
        </Card>

        <Card className="p-4 border-border bg-surface-card">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>AI Operations</span>
            <Cpu className="h-4 w-4 text-secondary" />
          </div>
          <div className="text-2xl font-extrabold text-secondary mt-1">{stats?.ai?.totalCalls || 0}</div>
        </Card>

        <Card className="p-4 border-border bg-surface-card">
          <div className="flex items-center justify-between text-muted text-xs">
            <span>Est. AI Cost</span>
            <Sparkles className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-extrabold text-emerald-400 mt-1">
            ${stats?.ai?.totalEstimatedCost?.toFixed(4) || "0.0000"}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === "overview" ? "bg-primary text-white" : "text-muted hover:text-white"
          }`}
        >
          System Health
        </button>
        <button
          onClick={() => setActiveTab("jobs")}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === "jobs" ? "bg-primary text-white" : "text-muted hover:text-white"
          }`}
        >
          Jobs Directory ({jobs.length})
        </button>
        <button
          onClick={() => setActiveTab("sources")}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === "sources" ? "bg-primary text-white" : "text-muted hover:text-white"
          }`}
        >
          ATS Sources ({sources.length})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === "users" ? "bg-primary text-white" : "text-muted hover:text-white"
          }`}
        >
          Users Registry ({users.length})
        </button>
      </div>

      {/* TAB 1: SYSTEM HEALTH */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 border-border bg-surface-card space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span>Core Service Status</span>
            </h3>

            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white block">PostgreSQL / Persistent Store</span>
                  <span className="text-[10px] text-muted">Atomic JSON / SQL storage engine</span>
                </div>
                <Badge variant="accent">CONNECTED</Badge>
              </div>

              <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white block">AI Anti-Hallucination Engine</span>
                  <span className="text-[10px] text-muted">Grounded facts verification check</span>
                </div>
                <Badge variant="accent">HEALTHY</Badge>
              </div>

              <div className="p-3 rounded-xl bg-surface-elevated border border-border flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-white block">ATS Automation Adapters</span>
                  <span className="text-[10px] text-muted">Greenhouse, Lever, Feed adapters</span>
                </div>
                <Badge variant="accent">ACTIVE</Badge>
              </div>
            </div>
          </Card>

          {/* AI Usage Telemetry (Rule 27) */}
          <Card className="p-6 border-border bg-surface-card space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Cpu className="h-4 w-4 text-secondary" />
              <span>AI Token & Cost Telemetry</span>
            </h3>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                <span className="text-muted block text-[10px]">TOTAL TOKENS</span>
                <span className="text-lg font-bold text-foreground">
                  {stats?.ai?.totalTokens?.toLocaleString() || 0}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-surface-elevated border border-border">
                <span className="text-muted block text-[10px]">ESTIMATED COST</span>
                <span className="text-lg font-bold text-emerald-400">
                  ${stats?.ai?.totalEstimatedCost?.toFixed(4) || "0.0000"}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-muted leading-relaxed">
              Every call to match scoring, resume tailoring, and question answering is indexed in the AIUsage table to prevent cost overruns.
            </p>
          </Card>
        </div>
      )}

      {/* TAB 2: JOBS DIRECTORY */}
      {activeTab === "jobs" && (
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-muted uppercase font-semibold border-b border-border">
                <tr>
                  <th className="p-4">Title & Company</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">ATS Provider</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {jobs.map((job) => (
                  <tr key={job.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-white">
                      <div>{job.title}</div>
                      <div className="text-muted text-[11px] font-normal">{job.company}</div>
                    </td>
                    <td className="p-4 text-muted">{job.location}</td>
                    <td className="p-4">
                      <Badge variant="outline">{job.atsProvider}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={job.isActive ? "accent" : "muted"}>
                        {job.isActive ? "Active" : "Disabled"}
                      </Badge>
                    </td>
                    <td className="p-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleJobStatus(job.id, job.isActive)}
                      >
                        {job.isActive ? "Disable" : "Enable"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: ATS SOURCES */}
      {activeTab === "sources" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {sources.map((source) => (
            <Card key={source.id} className="p-5 border-border bg-surface-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">{source.name}</span>
                <Badge variant="accent">Connected</Badge>
              </div>
              <p className="text-xs text-muted">Type: {source.type}</p>
              <div className="text-xs font-mono text-indigo-300">
                {source.jobCount} jobs indexed
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 4: USERS REGISTRY */}
      {activeTab === "users" && (
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-muted uppercase font-semibold border-b border-border">
                <tr>
                  <th className="p-4">Name</th>
                  <th className="p-4">Email</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-white">{u.name}</td>
                    <td className="p-4 text-muted">{u.email}</td>
                    <td className="p-4">
                      <Badge variant={u.role === "ADMIN" ? "warning" : "outline"}>
                        {u.role}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
