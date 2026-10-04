"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Code2,
  Briefcase,
  GraduationCap,
  Award,
  Sliders,
  FileText,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

export default function ProfilePage() {
  const { success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "personal" | "skills" | "experience" | "education" | "projects" | "preferences"
  >("personal");

  // Profile fields
  const [profile, setProfile] = useState<any>({
    headline: "",
    bio: "",
    phone: "",
    country: "",
    city: "",
    minSalary: 160000,
    salaryCurrency: "USD",
    remotePreference: "Remote",
    targetRoles: [],
    preferredIndustries: [],
    skills: [],
    experiences: [],
    educations: [],
    projects: [],
    certifications: [],
  });

  const [newSkill, setNewSkill] = useState("");

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data.profile) {
        setProfile({
          ...data.profile,
          skills: data.profile.skills || [],
          experiences: data.profile.experiences || [],
          educations: data.profile.educations || [],
          projects: data.profile.projects || [],
          certifications: data.profile.certifications || [],
          targetRoles: data.profile.targetRoles || [],
          preferredIndustries: data.profile.preferredIndustries || [],
        });
      }
    } catch (e) {
      toastError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      if (!res.ok) throw new Error("Failed to update profile");

      success("Profile Updated", "Single source of truth synchronized.");
    } catch (e: any) {
      toastError("Save Error", e.message);
    } finally {
      setSaving(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim()) {
      setProfile({
        ...profile,
        skills: [
          ...profile.skills,
          { name: newSkill.trim(), category: "Technical", yearsExperience: 3, level: "INTERMEDIATE" },
        ],
      });
      setNewSkill("");
    }
  };

  const removeSkill = (index: number) => {
    const updated = [...profile.skills];
    updated.splice(index, 1);
    setProfile({ ...profile, skills: updated });
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <User className="h-6 w-6 text-primary" />
            <span>AI Career Profile</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Your single source of truth. Grounded AI generates tailored materials exclusively from this data.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={handleSaveAll}
          isLoading={saving}
          className="gap-2 shadow-glow"
        >
          <Save className="h-4 w-4" />
          <span>Save Changes</span>
        </Button>
      </div>

      {/* Grounding Guarantee Notice */}
      <div className="p-3.5 rounded-xl bg-surface-card border border-accent/20 flex items-center justify-between text-xs text-muted">
        <div className="flex items-center gap-2 text-emerald-400 font-medium">
          <Shield className="h-4 w-4 shrink-0" />
          <span>Anti-Hallucination Policy: AI will never invent employers, degrees, or unlisted credentials.</span>
        </div>
        <Badge variant="accent" size="sm">Grounded</Badge>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border pb-2 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setActiveTab("personal")}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "personal" ? "bg-primary text-white" : "text-muted hover:text-foreground"
          }`}
        >
          Personal Info
        </button>
        <button
          onClick={() => setActiveTab("skills")}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "skills" ? "bg-primary text-white" : "text-muted hover:text-foreground"
          }`}
        >
          Skills ({profile.skills.length})
        </button>
        <button
          onClick={() => setActiveTab("experience")}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "experience" ? "bg-primary text-white" : "text-muted hover:text-foreground"
          }`}
        >
          Experience ({profile.experiences.length})
        </button>
        <button
          onClick={() => setActiveTab("education")}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "education" ? "bg-primary text-white" : "text-muted hover:text-foreground"
          }`}
        >
          Education ({profile.educations.length})
        </button>
        <button
          onClick={() => setActiveTab("projects")}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "projects" ? "bg-primary text-white" : "text-muted hover:text-foreground"
          }`}
        >
          Projects ({profile.projects.length})
        </button>
        <button
          onClick={() => setActiveTab("preferences")}
          className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
            activeTab === "preferences" ? "bg-primary text-white" : "text-muted hover:text-foreground"
          }`}
        >
          Preferences
        </button>
      </div>

      {/* PERSONAL INFO TAB */}
      {activeTab === "personal" && (
        <Card className="p-6 border-border bg-surface-card space-y-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Personal & Contact Details</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Professional Headline"
              value={profile.headline || ""}
              onChange={(e) => setProfile({ ...profile, headline: e.target.value })}
            />
            <Input
              label="Phone Number"
              value={profile.phone || ""}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            />
            <Input
              label="City"
              value={profile.city || ""}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
            />
            <Input
              label="Country"
              value={profile.country || ""}
              onChange={(e) => setProfile({ ...profile, country: e.target.value })}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Professional Summary / Bio"
                rows={4}
                value={profile.bio || ""}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              />
            </div>
          </div>
        </Card>
      )}

      {/* SKILLS TAB */}
      {activeTab === "skills" && (
        <Card className="p-6 border-border bg-surface-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">Verified Skill Registry</h3>
            <span className="text-xs text-muted">{profile.skills.length} skills listed</span>
          </div>

          <div className="flex gap-2">
            <Input
              placeholder="Add skill (e.g. Next.js, Rust, Docker, PyTorch)..."
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
            />
            <Button variant="primary" onClick={addSkill} size="md">
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {profile.skills.map((s: any, idx: number) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-elevated border border-border text-foreground hover:border-primary/50 transition-colors"
              >
                <span>{s.name}</span>
                <button
                  type="button"
                  onClick={() => removeSkill(idx)}
                  className="text-muted hover:text-danger ml-1"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* EXPERIENCE TAB */}
      {activeTab === "experience" && (
        <div className="space-y-4">
          {profile.experiences.map((exp: any, idx: number) => (
            <Card key={idx} className="p-5 border-border bg-surface-card space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-primary uppercase">Experience {idx + 1}</span>
                <button
                  onClick={() => {
                    const updated = [...profile.experiences];
                    updated.splice(idx, 1);
                    setProfile({ ...profile, experiences: updated });
                  }}
                  className="text-muted hover:text-danger text-xs p-1"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Company"
                  value={exp.company}
                  onChange={(e) => {
                    const updated = [...profile.experiences];
                    updated[idx].company = e.target.value;
                    setProfile({ ...profile, experiences: updated });
                  }}
                />
                <Input
                  label="Role / Title"
                  value={exp.role}
                  onChange={(e) => {
                    const updated = [...profile.experiences];
                    updated[idx].role = e.target.value;
                    setProfile({ ...profile, experiences: updated });
                  }}
                />
              </div>

              <Textarea
                label="Responsibilities & Impact"
                rows={3}
                value={exp.description}
                onChange={(e) => {
                  const updated = [...profile.experiences];
                  updated[idx].description = e.target.value;
                  setProfile({ ...profile, experiences: updated });
                }}
              />
            </Card>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setProfile({
                ...profile,
                experiences: [
                  ...profile.experiences,
                  {
                    company: "New Company",
                    role: "Software Engineer",
                    startDate: "2021-01-01",
                    description: "",
                    achievements: [],
                    technologies: [],
                  },
                ],
              })
            }
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            <span>Add Experience</span>
          </Button>
        </div>
      )}

      {/* EDUCATION TAB */}
      {activeTab === "education" && (
        <div className="space-y-4">
          {profile.educations.map((edu: any, idx: number) => (
            <Card key={idx} className="p-5 border-border bg-surface-card space-y-3">
              <Input
                label="Institution"
                value={edu.institution}
                onChange={(e) => {
                  const updated = [...profile.educations];
                  updated[idx].institution = e.target.value;
                  setProfile({ ...profile, educations: updated });
                }}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Degree"
                  value={edu.degree}
                  onChange={(e) => {
                    const updated = [...profile.educations];
                    updated[idx].degree = e.target.value;
                    setProfile({ ...profile, educations: updated });
                  }}
                />
                <Input
                  label="Field"
                  value={edu.field}
                  onChange={(e) => {
                    const updated = [...profile.educations];
                    updated[idx].field = e.target.value;
                    setProfile({ ...profile, educations: updated });
                  }}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* PROJECTS TAB */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          {profile.projects.map((proj: any, idx: number) => (
            <Card key={idx} className="p-5 border-border bg-surface-card space-y-3">
              <Input
                label="Project Name"
                value={proj.name}
                onChange={(e) => {
                  const updated = [...profile.projects];
                  updated[idx].name = e.target.value;
                  setProfile({ ...profile, projects: updated });
                }}
              />
              <Textarea
                label="Description"
                rows={2}
                value={proj.description}
                onChange={(e) => {
                  const updated = [...profile.projects];
                  updated[idx].description = e.target.value;
                  setProfile({ ...profile, projects: updated });
                }}
              />
            </Card>
          ))}
        </div>
      )}

      {/* PREFERENCES TAB */}
      {activeTab === "preferences" && (
        <Card className="p-6 border-border bg-surface-card space-y-4">
          <h3 className="text-sm font-bold text-foreground mb-2">Job & Search Preferences</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Workplace Preference
              </label>
              <select
                value={profile.remotePreference}
                onChange={(e) => setProfile({ ...profile, remotePreference: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated text-sm text-foreground focus:outline-none"
              >
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Minimum Annual Base Salary (USD)
              </label>
              <Input
                type="number"
                value={profile.minSalary || 150000}
                onChange={(e) => setProfile({ ...profile, minSalary: Number(e.target.value) })}
              />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
