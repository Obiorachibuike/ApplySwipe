"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  Download,
  Copy,
  Eye,
  Star,
  Sparkles,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

export default function ResumesPage() {
  const { success, error: toastError, info } = useToast();
  const [resumes, setResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResume, setSelectedResume] = useState<any | null>(null);
  const [isCreatingModal, setIsCreatingModal] = useState(false);
  const [newResumeName, setNewResumeName] = useState("");
  const [newResumeText, setNewResumeText] = useState("");

  useEffect(() => {
    fetchResumes();
  }, []);

  const fetchResumes = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      if (data.resumes) {
        setResumes(data.resumes);
      }
    } catch (e) {
      toastError("Failed to fetch resumes");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateResume = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResumeName.trim()) return;

    try {
      const res = await fetch("/api/resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newResumeName,
          rawText: newResumeText,
          isDefault: resumes.length === 0,
        }),
      });

      if (res.ok) {
        success("Resume Created", newResumeName);
        setIsCreatingModal(false);
        setNewResumeName("");
        setNewResumeText("");
        fetchResumes();
      }
    } catch (e) {
      toastError("Failed to create resume");
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/resumes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (res.ok) {
        success("Default Updated");
        fetchResumes();
      }
    } catch (e) {
      toastError("Failed to set default");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resume?")) return;
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: "DELETE" });
      if (res.ok) {
        success("Resume Deleted");
        fetchResumes();
      }
    } catch (e) {
      toastError("Failed to delete resume");
    }
  };

  const handleDownload = (resume: any) => {
    const element = document.createElement("a");
    const file = new Blob([resume.rawText || ""], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${resume.name.replace(/\s+/g, "_")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    success("Downloaded", resume.name);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            <span>Resume Vault</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Manage your master resumes. Grounded AI tailors customized copies for every job you apply to.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsCreatingModal(true)}
          className="gap-2 shadow-glow"
        >
          <Plus className="h-4 w-4" />
          <span>New Resume Variant</span>
        </Button>
      </div>

      {/* Resumes Grid */}
      {loading ? (
        <div className="text-center py-20">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      ) : resumes.length === 0 ? (
        <Card className="p-12 text-center max-w-md mx-auto space-y-3 border-dashed">
          <FileText className="h-8 w-8 text-muted mx-auto" />
          <h3 className="text-base font-bold text-white">No resumes created yet</h3>
          <p className="text-xs text-muted">Create your master resume or variant.</p>
          <Button variant="primary" size="sm" onClick={() => setIsCreatingModal(true)}>
            Create Resume
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resumes.map((resume) => (
            <Card
              key={resume.id}
              interactive
              ai={resume.isDefault}
              className={`p-6 border-white/10 bg-surface-card flex flex-col justify-between ${
                resume.isDefault ? "border-primary/40 shadow-glow" : ""
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  {resume.isDefault ? (
                    <Badge variant="primary" size="sm" className="gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      <span>Default Master</span>
                    </Badge>
                  ) : (
                    <button
                      onClick={() => handleSetDefault(resume.id)}
                      className="text-[11px] text-muted hover:text-white hover:underline transition-colors"
                    >
                      Make Default
                    </button>
                  )}
                </div>

                <h3 className="text-base font-bold text-white mb-1">{resume.name}</h3>
                <p className="text-xs text-muted">
                  Updated {new Date(resume.updatedAt).toLocaleDateString()}
                </p>

                {resume.versions && resume.versions.length > 0 && (
                  <div className="mt-3 text-[11px] text-indigo-300 font-mono">
                    {resume.versions.length} tailored job copies generated
                  </div>
                )}
              </div>

              <div className="pt-4 mt-6 border-t border-border flex items-center justify-between text-xs">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedResume(resume)}
                  className="gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </Button>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(resume)}
                    className="p-2"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {!resume.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(resume.id)}
                      className="p-2 text-danger hover:text-danger"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE RESUME MODAL */}
      <Dialog
        isOpen={isCreatingModal}
        onClose={() => setIsCreatingModal(false)}
        title="Create New Resume Variant"
        description="Add a specialized resume version (e.g. Backend-focused, AI Engineer, React Native)."
      >
        <form onSubmit={handleCreateResume} className="space-y-4">
          <Input
            label="Resume Title"
            required
            placeholder="e.g. AI Systems & ML Resume"
            value={newResumeName}
            onChange={(e) => setNewResumeName(e.target.value)}
          />

          <Textarea
            label="Resume Raw Text / Summary"
            rows={8}
            placeholder="Paste raw markdown or text summary..."
            value={newResumeText}
            onChange={(e) => setNewResumeText(e.target.value)}
          />

          <div className="pt-2 flex justify-end gap-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreatingModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Resume
            </Button>
          </div>
        </form>
      </Dialog>

      {/* PREVIEW RESUME MODAL */}
      {selectedResume && (
        <Dialog
          isOpen={!!selectedResume}
          onClose={() => setSelectedResume(null)}
          title={selectedResume.name}
          description={`Created ${new Date(selectedResume.createdAt).toLocaleDateString()}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface-elevated font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap max-h-[450px] overflow-y-auto">
              {selectedResume.rawText || "No content provided."}
            </div>

            <div className="pt-3 flex justify-between items-center border-t border-border">
              <span className="text-xs text-muted">
                {selectedResume.isDefault ? "Default Active Resume" : "Secondary Variant"}
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDownload(selectedResume)}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                <span>Download File</span>
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
