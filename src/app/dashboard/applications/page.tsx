"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  FileCheck2,
  Kanban,
  List,
  Search,
  ExternalLink,
  Sparkles,
  Building,
  Calendar,
  Clock,
  ArrowRight,
  Plus,
  GripVertical,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/applications");
      const data = await res.json();
      if (data.applications) {
        setApplications(data.applications);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const filteredApps = applications.filter((app) => {
    const matchesSearch =
      (app.job?.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (app.job?.company || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterStatus === "ALL") return true;
    return app.status === filterStatus;
  });

  const kanbanColumns = [
    { key: "READY_FOR_REVIEW", label: "Ready for Review", badgeVariant: "warning" as const },
    { key: "SUBMITTED", label: "Submitted", badgeVariant: "primary" as const },
    { key: "INTERVIEW", label: "Interview", badgeVariant: "accent" as const },
    { key: "OFFER", label: "Offer", badgeVariant: "accent" as const },
    { key: "REJECTED", label: "Archived / Rejected", badgeVariant: "muted" as const },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileCheck2 className="h-6 w-6 text-primary" />
            <span>Application Pipeline</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Track and review your tailored applications across all hiring stages.
          </p>
        </div>

        {/* View mode toggle & CTA */}
        <div className="flex items-center gap-2">
          <div className="flex items-center p-1 rounded-lg border border-border bg-surface-elevated">
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === "kanban"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Kanban className="h-4 w-4" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                viewMode === "list"
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          <Link href="/dashboard/discover">
            <Button size="sm" variant="primary" className="gap-1.5 shadow-glow">
              <Plus className="h-4 w-4" />
              <span>Swipe More Jobs</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-xl border border-border bg-surface-card">
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search company or role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
          {["ALL", "READY_FOR_REVIEW", "SUBMITTED", "INTERVIEW", "OFFER"].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap ${
                filterStatus === status
                  ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                  : "bg-surface-elevated text-muted hover:text-foreground hover:border-white/20 border border-border"
              }`}
            >
              {status === "ALL" ? "All Applications" : status.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Main View: Kanban vs List */}
      {loading ? (
        <div className="text-center py-16">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : applications.length === 0 ? (
        <Card className="p-12 text-center max-w-md mx-auto space-y-3">
          <h3 className="text-base font-bold text-white">No applications yet</h3>
          <p className="text-xs text-muted">
            Swipe right on matching jobs in Discover to generate tailored applications automatically.
          </p>
          <Link href="/dashboard/discover">
            <Button variant="primary" size="sm" className="mt-2">
              Go to Discover
            </Button>
          </Link>
        </Card>
      ) : viewMode === "kanban" ? (
        /* KANBAN BOARD (Rule 23) */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {kanbanColumns.map((col) => {
            const colApps = filteredApps.filter((a) => {
              if (col.key === "READY_FOR_REVIEW") {
                return a.status === "READY_FOR_REVIEW" || a.status === "PREPARING";
              }
              if (col.key === "REJECTED") {
                return a.status === "REJECTED" || a.status === "WITHDRAWN";
              }
              return a.status === col.key;
            });

            return (
              <div
                key={col.key}
                className="rounded-xl border border-border bg-surface-card/60 p-3 flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={col.badgeVariant} size="sm">
                      {col.label}
                    </Badge>
                  </div>
                  <span className="text-xs font-mono text-muted">{colApps.length}</span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto">
                  {colApps.map((app) => (
                    <Link key={app.id} href={`/dashboard/applications/${app.id}`}>
                      <Card className="p-3.5 border-white/10 bg-surface-card hover:border-primary/50 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_20px_rgba(0,0,0,0.4)] cursor-pointer shadow-sm group relative">
                        {/* Drag Handle Indicator appears on hover */}
                        <div className="absolute top-2.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted hover:text-foreground">
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <div className="flex items-start justify-between gap-2 mb-1.5 pr-5">
                          <span className="text-[11px] font-bold text-muted uppercase tracking-wider">
                            {app.job?.company}
                          </span>
                          {app.matchScore && (
                            <span className="text-[10px] font-bold text-accent">
                              {app.matchScore}%
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors line-clamp-1">
                          {app.job?.title}
                        </h4>

                        {app.notes && (
                          <p className="text-[11px] text-muted line-clamp-2 mt-2 leading-relaxed">
                            {app.notes}
                          </p>
                        )}

                        <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between text-[10px] text-muted">
                          <span>{new Date(app.updatedAt).toLocaleDateString()}</span>
                          <span className="text-primary font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                            <span>Review</span>
                            <ArrowRight className="h-3 w-3" />
                          </span>
                        </div>
                      </Card>
                    </Link>
                  ))}

                  {colApps.length === 0 && (
                    <div className="text-center py-10 text-[11px] text-muted border border-dashed border-border/60 rounded-xl">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW (Rule 14 & 15) */
        <Card className="border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-elevated text-muted uppercase font-semibold border-b border-border">
                <tr>
                  <th className="p-4">Company & Role</th>
                  <th className="p-4">AI Match</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Mode</th>
                  <th className="p-4">Updated</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredApps.map((app) => (
                  <tr
                    key={app.id}
                    className="table-row-interactive group hover:bg-white/[0.04] transition-colors"
                  >
                    <td className="p-4 font-semibold text-white">
                      <div className="group-hover:text-primary transition-colors">{app.job?.title}</div>
                      <div className="text-muted text-[11px] font-normal">{app.job?.company}</div>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-accent">{app.matchScore || 85}%</span>
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          app.status === "SUBMITTED"
                            ? "primary"
                            : app.status === "INTERVIEW" || app.status === "OFFER"
                            ? "accent"
                            : app.status === "READY_FOR_REVIEW" || app.status === "PREPARING"
                            ? "warning"
                            : "outline"
                        }
                      >
                        {app.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="p-4 text-muted">
                      {app.mode.replace(/_/g, " ")}
                    </td>
                    <td className="p-4 text-muted">
                      {new Date(app.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <Link href={`/dashboard/applications/${app.id}`}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-80 group-hover:opacity-100 group-hover:bg-primary/10 group-hover:text-primary transition-all gap-1"
                        >
                          <Eye className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                          <span>View Details</span>
                        </Button>
                      </Link>
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
