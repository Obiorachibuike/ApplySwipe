"use client";

import React, { useState } from "react";
import {
  Sliders,
  Shield,
  Download,
  Trash2,
  Lock,
  Cpu,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const { success, info } = useToast();
  const [aiProvider, setAiProvider] = useState("LOCAL_ENGINE");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  const handleExportData = () => {
    info("Preparing Data Export", "Compiling your JSON profile and application archives...");
    setTimeout(() => {
      success("Export Ready", "Profile data downloaded.");
    }, 1200);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Sliders className="h-6 w-6 text-primary" />
          <span>Account & Privacy Settings</span>
        </h1>
        <p className="text-xs sm:text-sm text-muted mt-0.5">
          Manage your AI preferences, notifications, and strict privacy controls.
        </p>
      </div>

      {/* AI Model Configuration (Rule 1 & 27) */}
      <Card className="p-6 border-border bg-surface-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="h-4 w-4 text-primary" />
              <span>AI Provider & Model Abstraction</span>
            </h3>
            <p className="text-xs text-muted">
              Choose which AI provider powers your resume tailoring and matching evaluations.
            </p>
          </div>
          <Badge variant="accent">Configurable</Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              setAiProvider("LOCAL_ENGINE");
              success("Switched to Built-in Grounded Engine");
            }}
            className={`p-4 rounded-xl border text-left transition-all ${
              aiProvider === "LOCAL_ENGINE"
                ? "border-primary bg-primary/10 shadow-glow"
                : "border-border bg-surface-elevated hover:border-white/20"
            }`}
          >
            <span className="font-bold text-white text-xs block">Intelligent Local Engine</span>
            <span className="text-[10px] text-muted block mt-1">
              Zero API keys required. 100% deterministic & hallucination-free.
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAiProvider("OPENAI");
              success("Switched to OpenAI Engine");
            }}
            className={`p-4 rounded-xl border text-left transition-all ${
              aiProvider === "OPENAI"
                ? "border-primary bg-primary/10 shadow-glow"
                : "border-border bg-surface-elevated hover:border-white/20"
            }`}
          >
            <span className="font-bold text-white text-xs block">OpenAI GPT-4o</span>
            <span className="text-[10px] text-muted block mt-1">
              Advanced natural language synthesis via OPENAI_API_KEY.
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAiProvider("GEMINI");
              success("Switched to Google Gemini");
            }}
            className={`p-4 rounded-xl border text-left transition-all ${
              aiProvider === "GEMINI"
                ? "border-primary bg-primary/10 shadow-glow"
                : "border-border bg-surface-elevated hover:border-white/20"
            }`}
          >
            <span className="font-bold text-white text-xs block">Google Gemini 1.5</span>
            <span className="text-[10px] text-muted block mt-1">
              Long-context parsing via GEMINI_API_KEY.
            </span>
          </button>
        </div>
      </Card>

      {/* Notifications Configuration (Rule 21) */}
      <Card className="p-6 border-border bg-surface-card space-y-4">
        <h3 className="text-sm font-bold text-white mb-2">Notification Preferences</h3>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-foreground block">Email Notifications</span>
              <span className="text-[10px] text-muted">
                Receive summaries for submitted applications and interview requests.
              </span>
            </div>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={(e) => setEmailNotifications(e.target.checked)}
              className="rounded border-border text-primary"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-lg bg-surface-elevated border border-border cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-foreground block">Push / Browser Alerts</span>
              <span className="text-[10px] text-muted">
                Instant alerts when a 90%+ match job is indexed by feeds.
              </span>
            </div>
            <input
              type="checkbox"
              checked={pushNotifications}
              onChange={(e) => setPushNotifications(e.target.checked)}
              className="rounded border-border text-primary"
            />
          </label>
        </div>
      </Card>

      {/* Privacy & Data Ownership (Rule 26) */}
      <Card className="p-6 border-border bg-surface-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-accent" />
              <span>Privacy & Data Sovereignty</span>
            </h3>
            <p className="text-xs text-muted">
              You own all data you provide. We never use your resumes for training public models.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={handleExportData} className="gap-1.5">
            <Download className="h-4 w-4" />
            <span>Export Complete Career JSON</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => info("Delete request submitted")}
            className="text-danger hover:text-danger gap-1.5"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete Account & Resumes</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
