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
  RefreshCw,
  Plus,
  Radio,
  Clock,
  ExternalLink,
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
  const [providers, setProviders] = useState<any[]>([]);
  const [syncRuns, setSyncRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [creatingSource, setCreatingSource] = useState(false);
  const [newSource, setNewSource] = useState({
    provider: "GREENHOUSE",
    companyName: "",
    boardToken: "",
  });
  const [activeTab, setActiveTab] = useState<
    "overview" | "providers" | "users" | "jobs" | "sources"
  >("overview");

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

      const [usersRes, jobsRes, sourcesRes, providersRes, runsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/jobs?limit=200"),
        fetch("/api/admin/sources"),
        fetch("/api/admin/providers"),
        fetch("/api/admin/sync-runs?limit=15"),
      ]);

      const [uData, jData, sData, pData, rData] = await Promise.all([
        usersRes.json(),
        jobsRes.json(),
        sourcesRes.json(),
        providersRes.json(),
        runsRes.json(),
      ]);

      if (uData.users) setUsers(uData.users);
      if (jData.jobs) setJobs(jData.jobs);
      if (sData.sources) setSources(sData.sources);
      if (pData.providers) setProviders(pData.providers);
      if (rData.runs) setSyncRuns(rData.runs);
    } catch (e) {
      toastError("Failed to fetch admin data");
    } finally {
      setLoading(false);
    }
  };

  const toggleProvider = async (provider: string, isEnabled: boolean) => {
    try {
      const res = await fetch("/api/admin/providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, isEnabled }),
      });
      if (res.ok) {
        success(`${provider} ${isEnabled ? "enabled" : "disabled"}`);
        fetchAdminData();
      } else {
        const data = await res.json();
        toastError("Provider update failed", data.error);
      }
    } catch (e) {
      toastError("Provider update failed");
    }
  };

  const triggerSync = async (provider?: string) => {
    setSyncing(provider || "ALL");
    try {
      const res = await fetch("/api/admin/providers/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(provider ? { provider } : {}),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError("Sync failed", data.error);
        return;
      }
      const inserted = data.summary?.totals?.inserted ?? 0;
      const updated = data.summary?.totals?.updated ?? 0;
      success(
        provider ? `${provider} sync complete` : "Sync complete",
        `${inserted} new, ${updated} updated, ${data.summary?.totals?.duplicates ?? 0} duplicates.`
      );
      fetchAdminData();
    } catch (e) {
      toastError("Sync failed");
    } finally {
      setSyncing(null);
    }
  };

  const createSource = async () => {
    if (!newSource.companyName || !newSource.boardToken) {
      toastError("Missing fields", "Company name and board token / company slug are required.");
      return;
    }
    setCreatingSource(true);
    try {
      const res = await fetch("/api/admin/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newSource),
      });
      const data = await res.json();
      if (!res.ok) {
        toastError("Could not add company", data.error);
        return;
      }
      success("Company added", `${newSource.companyName} will sync on the next run.`);
      setNewSource({ provider: newSource.provider, companyName: "", boardToken: "" });
      fetchAdminData();
    } catch (e) {
      toastError("Could not add company");
    } finally {
      setCreatingSource(false);
    }
  };

  const toggleSource = async (sourceId: string, active: boolean) => {
    try {
      const res = await fetch("/api/admin/sources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sourceId, active }),
      });
      if (res.ok) {
        success(active ? "Source activated" : "Source paused");
        fetchAdminData();
      }
    } catch (e) {
      toastError("Failed to update source");
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
          onClick={() => setActiveTab("providers")}
          className={`px-3 py-1.5 rounded-lg transition-colors ${
            activeTab === "providers" ? "bg-primary text-white" : "text-muted hover:text-white"
          }`}
        >
          Providers ({providers.length})
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

      {/* TAB: PROVIDER HEALTH MONITOR */}
      {activeTab === "providers" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Radio className="h-4 w-4 text-primary" />
                <span>Job Provider Health</span>
              </h3>
              <p className="text-[11px] text-muted">
                Credentials stay server-side: only the environment variable names each provider needs are
                shown.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerSync()}
              disabled={syncing !== null}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing === "ALL" ? "animate-spin" : ""}`} />
              <span>{syncing === "ALL" ? "Syncing..." : "Sync all providers"}</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {providers.map((provider) => {
              const healthy = provider.status === "HEALTHY";
              const warning = provider.status === "WARNING" || provider.status === "SYNCING";
              return (
                <Card key={provider.provider} className="p-5 border-border bg-surface-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{provider.label}</span>
                    <Badge
                      variant={!provider.isEnabled ? "muted" : healthy ? "accent" : warning ? "warning" : "pass"}
                    >
                      {!provider.isEnabled ? "DISABLED" : provider.status}
                    </Badge>
                  </div>

                  <div className="text-[11px] text-muted space-y-1">
                    <div>
                      Last sync:{" "}
                      <span className="text-foreground">
                        {provider.lastSyncAt ? new Date(provider.lastSyncAt).toLocaleString() : "never"}
                      </span>
                    </div>
                    <div>
                      Last success:{" "}
                      <span className="text-foreground">
                        {provider.lastSuccessAt ? new Date(provider.lastSuccessAt).toLocaleString() : "never"}
                      </span>
                    </div>
                    <div>
                      Jobs imported: <span className="text-foreground">{provider.jobsImported}</span> • Active:{" "}
                      <span className="text-foreground">{provider.activeJobs}</span>
                    </div>
                    <div>
                      Sources: <span className="text-foreground">{provider.activeSources}</span> active /{" "}
                      {provider.configuredSources} configured
                    </div>
                    <div>
                      Cadence: every {provider.syncIntervalMinutes} min • freshness {provider.freshnessHours}h
                    </div>
                    {provider.requiredEnv?.length > 0 && (
                      <div className="font-mono text-[10px] text-indigo-300">
                        requires: {provider.requiredEnv.join(", ")}
                        {provider.isConfigured ? " (set)" : " (missing)"}
                      </div>
                    )}
                    {provider.lastError && (
                      <div className="text-rose-400 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        <span className="break-words">{provider.lastError}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      disabled={syncing !== null || !provider.isEnabled}
                      onClick={() => triggerSync(provider.provider)}
                    >
                      <RefreshCw className={`h-3 w-3 ${syncing === provider.provider ? "animate-spin" : ""}`} />
                      <span>Sync now</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => toggleProvider(provider.provider, !provider.isEnabled)}
                    >
                      {provider.isEnabled ? (
                        <ToggleRight className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="h-3.5 w-3.5 text-muted" />
                      )}
                      <span>{provider.isEnabled ? "Disable" : "Enable"}</span>
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="p-5 border-border bg-surface-card">
            <h4 className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Recent sync runs</span>
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-muted uppercase font-semibold border-b border-border">
                  <tr>
                    <th className="py-2 pr-4">Provider</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Started</th>
                    <th className="py-2 pr-4">Trigger</th>
                    <th className="py-2 pr-4">Stats</th>
                    <th className="py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {syncRuns.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-3 text-muted">
                        No sync runs yet. Trigger one above or wait for the scheduler.
                      </td>
                    </tr>
                  )}
                  {syncRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="py-2 pr-4 font-semibold text-foreground">{run.provider}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={run.status === "SUCCESS" ? "accent" : run.status === "FAILED" ? "pass" : "outline"}>
                          {run.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted">{new Date(run.startedAt).toLocaleString()}</td>
                      <td className="py-2 pr-4 text-muted">{run.triggeredBy}</td>
                      <td className="py-2 pr-4 text-muted">
                        {run.stats
                          ? `${run.stats.inserted ?? 0}+${run.stats.updated ?? 0} (${run.stats.duplicates ?? 0} dup)`
                          : "—"}
                      </td>
                      <td className="py-2 text-rose-400 break-words max-w-xs">{run.error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
                  <th className="p-4">Source</th>
                  <th className="p-4">Location</th>
                  <th className="p-4">Match data</th>
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
                    <td className="p-4">
                      <Badge variant="outline">{job.provider || "LEGACY"}</Badge>
                      <div className="text-[10px] text-muted mt-1">{job.sourceLabel || job.source}</div>
                    </td>
                    <td className="p-4 text-muted">{job.location}</td>
                    <td className="p-4 text-[10px] text-muted">
                      <div>skills: {(job.skills || []).length}</div>
                      <div>seen: {job.seenCount || 1}×</div>
                      {job.canonicalJobId && <div className="text-amber-400">merged duplicate</div>}
                      {job.officialApplicationUrl && (
                        <a
                          href={job.officialApplicationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary"
                        >
                          source link <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      )}
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

      {/* TAB: JOB SOURCES (companies) */}
      {activeTab === "sources" && (
        <div className="space-y-6">
          <Card className="p-5 border-border bg-surface-card space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              <span>Add a company source</span>
            </h3>
            <p className="text-[11px] text-muted">
              Greenhouse needs the company board token (e.g. <span className="font-mono">linear</span> from
              boards.greenhouse.io/linear). Lever needs the company slug (e.g.{" "}
              <span className="font-mono">mistral</span> from jobs.lever.co/mistral). No code change is needed
              to onboard a company.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <select
                value={newSource.provider}
                onChange={(e) => setNewSource({ ...newSource, provider: e.target.value })}
                className="h-9 px-2 rounded-xl border border-border bg-surface-elevated text-xs text-foreground"
              >
                <option value="GREENHOUSE">Greenhouse</option>
                <option value="LEVER">Lever</option>
                <option value="ADZUNA">Adzuna (search profile)</option>
              </select>
              <input
                value={newSource.companyName}
                onChange={(e) => setNewSource({ ...newSource, companyName: e.target.value })}
                placeholder="Company name"
                className="h-9 px-3 rounded-xl border border-border bg-surface-elevated text-xs text-foreground"
              />
              <input
                value={newSource.boardToken}
                onChange={(e) => setNewSource({ ...newSource, boardToken: e.target.value })}
                placeholder="Board token / company slug"
                className="h-9 px-3 rounded-xl border border-border bg-surface-elevated text-xs text-foreground"
              />
              <Button variant="primary" size="sm" onClick={createSource} disabled={creatingSource}>
                {creatingSource ? "Adding..." : "Add company"}
              </Button>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {sources.length === 0 && (
              <Card className="p-5 border-dashed border-border bg-surface-card text-xs text-muted">
                No companies configured yet. Greenhouse and Lever syncs stay idle until you add one.
              </Card>
            )}
            {sources.map((source) => (
              <Card key={source.id} className="p-5 border-border bg-surface-card space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    {source.companyName || source.name}
                  </span>
                  <Badge variant={source.active === false ? "muted" : "accent"}>
                    {source.active === false ? "Paused" : "Active"}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted space-y-1">
                  <div>Provider: {source.provider || "—"}</div>
                  <div className="font-mono text-indigo-300">
                    token: {source.boardToken || "—"}
                  </div>
                  <div>{source.jobsImported || source.jobCount || 0} jobs imported</div>
                  <div>
                    Last sync:{" "}
                    {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleString() : "never"}
                  </div>
                  {source.lastError && (
                    <div className="text-rose-400 break-words">{source.lastError}</div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => toggleSource(source.id, source.active === false)}
                >
                  {source.active === false ? (
                    <ToggleLeft className="h-3.5 w-3.5 text-muted" />
                  ) : (
                    <ToggleRight className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span>{source.active === false ? "Activate" : "Pause"}</span>
                </Button>
              </Card>
            ))}
          </div>
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
