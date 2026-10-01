"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Plus,
  Trash2,
  Upload,
  Briefcase,
  GraduationCap,
  Code2,
  Award,
  Sliders,
  FileText,
  User,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import confetti from "canvas-confetti";

export default function OnboardingPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Profile Form States
  const [basicInfo, setBasicInfo] = useState({
    name: "Alex Chen",
    email: "alex@applyswipe.io",
    phone: "+1 (555) 234-5678",
    country: "United States",
    city: "San Francisco, CA",
    headline: "Senior Full Stack & AI Systems Engineer",
    bio: "Passionate engineer building high-speed web apps and AI-driven workflows.",
  });

  const [careerTarget, setCareerTarget] = useState({
    targetRoles: ["Senior Full Stack Engineer", "Staff Frontend Architect"],
    experienceLevel: "Senior (5-8 years)",
    preferredIndustries: ["Developer Tools", "AI / Machine Learning", "Fintech"],
    preferredEmploymentTypes: ["Full-time", "Contract"],
  });

  const [skills, setSkills] = useState<string[]>([
    "React",
    "Next.js",
    "TypeScript",
    "Node.js",
    "Python",
    "PostgreSQL",
    "Tailwind CSS",
    "Docker",
    "FastAPI",
    "AWS",
  ]);
  const [newSkillInput, setNewSkillInput] = useState("");

  const [experiences, setExperiences] = useState<any[]>([
    {
      company: "TechVanguard Inc.",
      role: "Senior Full Stack Engineer",
      startDate: "2022-03-01",
      endDate: "",
      isCurrent: true,
      description: "Spearheaded core web architecture and high-throughput microservices.",
      achievements: [
        "Architected Next.js App Router migration reducing LCP load times by 42%",
        "Designed REST & GraphQL microservices handling 12,000 req/sec",
      ],
      technologies: ["React", "Next.js", "TypeScript", "PostgreSQL", "Tailwind CSS"],
    },
  ]);

  const [educations, setEducations] = useState<any[]>([
    {
      institution: "University of California, Berkeley",
      degree: "Bachelor of Science",
      field: "Computer Science",
      startYear: 2015,
      endYear: 2019,
      gpa: "3.85",
    },
  ]);

  const [projects, setProjects] = useState<any[]>([
    {
      name: "JobPulse",
      description: "Real-time job market analytics and scraping platform.",
      technologies: ["Next.js", "TypeScript", "Python", "FastAPI", "PostgreSQL"],
      url: "https://jobpulse-demo.dev",
      githubUrl: "https://github.com/alexchen/jobpulse",
      highlights: ["Indexes 50,000 tech postings daily with automated deduplication"],
    },
  ]);

  const [certifications, setCertifications] = useState<any[]>([
    {
      name: "AWS Certified Solutions Architect",
      issuer: "Amazon Web Services",
      credentialId: "AWS-SAA-84920412",
    },
  ]);

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState(
    "ALEX CHEN — Senior Full Stack Engineer\nSan Francisco, CA | alex@applyswipe.io\n\nExperienced building modern web apps with React, Next.js, TypeScript, Node.js, and PostgreSQL."
  );
  const [resumeParsedNotice, setResumeParsedNotice] = useState<string | null>(null);

  const [preferences, setPreferences] = useState({
    remotePreference: "Remote",
    minSalary: 160000,
    salaryCurrency: "USD",
    employmentTypes: ["Full-time"],
    preferredLocations: ["United States", "Remote"],
  });

  // Load existing profile if already present
  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          const p = data.profile;
          setBasicInfo((prev) => ({
            ...prev,
            name: p.user?.name || prev.name,
            email: p.user?.email || prev.email,
            phone: p.phone || prev.phone,
            country: p.country || prev.country,
            city: p.city || prev.city,
            headline: p.headline || prev.headline,
            bio: p.bio || prev.bio,
          }));

          if (p.skills && p.skills.length > 0) {
            setSkills(p.skills.map((s: any) => s.name));
          }
          if (p.experiences && p.experiences.length > 0) {
            setExperiences(p.experiences);
          }
          if (p.targetRoles && p.targetRoles.length > 0) {
            setCareerTarget((prev) => ({ ...prev, targetRoles: p.targetRoles }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const addSkill = () => {
    if (newSkillInput.trim() && !skills.includes(newSkillInput.trim())) {
      setSkills([...skills, newSkillInput.trim()]);
      setNewSkillInput("");
    }
  };

  const removeSkill = (name: string) => {
    setSkills(skills.filter((s) => s !== name));
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFile(file);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/upload-resume", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setResumeParsedNotice(
          `Successfully extracted skills: ${data.parsedData.detectedSkills.join(", ")}`
        );
        // Merge extracted skills
        const merged = Array.from(new Set([...skills, ...data.parsedData.detectedSkills]));
        setSkills(merged);
        success("Resume Parsed", "Structured qualifications extracted into your profile.");
      }
    } catch (err) {
      toastError("Upload Failed", "Could not parse resume file.");
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    setLoading(true);

    try {
      // 1. Submit Profile with all collections
      const payload = {
        headline: basicInfo.headline,
        bio: basicInfo.bio,
        phone: basicInfo.phone,
        country: basicInfo.country,
        city: basicInfo.city,
        targetRoles: careerTarget.targetRoles,
        experienceLevel: careerTarget.experienceLevel,
        preferredIndustries: careerTarget.preferredIndustries,
        preferredEmploymentTypes: careerTarget.preferredEmploymentTypes,
        remotePreference: preferences.remotePreference,
        minSalary: Number(preferences.minSalary),
        salaryCurrency: preferences.salaryCurrency,
        onboardingCompleted: true,
        skills: skills.map((name) => ({ name, category: "Core", yearsExperience: 4 })),
        experiences: experiences.map((e) => ({
          company: e.company,
          role: e.role,
          isCurrent: Boolean(e.isCurrent),
          startDate: e.startDate ? new Date(e.startDate).toISOString() : new Date().toISOString(),
          endDate: e.endDate ? new Date(e.endDate).toISOString() : null,
          description: e.description,
          achievements: e.achievements || [],
          technologies: e.technologies || [],
        })),
        educations,
        projects,
        certifications,
      };

      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save profile");
      }

      // Trigger celebration confetti
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#6366F1", "#8B5CF6", "#22C55E"],
      });

      success("Profile Ready!", "Your AI Career Profile is now configured.");
      setTimeout(() => {
        router.push("/dashboard/discover");
      }, 1500);
    } catch (e: any) {
      toastError("Error saving profile", e.message);
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (currentStep < 10) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const stepsList = [
    "Basic Info",
    "Career Target",
    "Skills",
    "Experience",
    "Education",
    "Projects",
    "Certifications",
    "Resume Upload",
    "Preferences",
    "Ready",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 blur-[120px] pointer-events-none rounded-full" />

      <div className="max-w-3xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-glow">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">
              Apply<span className="text-primary">Swipe</span>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Set up your AI Career Profile
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Step {currentStep} of 10: {stepsList[currentStep - 1]}
          </p>

          {/* Progress bar */}
          <div className="mt-4 max-w-md mx-auto">
            <Progress value={(currentStep / 10) * 100} indicatorColor="bg-primary" />
          </div>
        </div>

        {/* Wizard Card Container */}
        <Card className="p-6 sm:p-8 border-white/10 bg-surface-card shadow-2xl backdrop-blur-md relative min-h-[460px] flex flex-col justify-between">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              transition={{ duration: 0.25 }}
              className="flex-1"
            >
              {/* STEP 1: Basic Information */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      <span>Basic Information</span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Your identity and primary contact points.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <Input
                      label="Full Name"
                      value={basicInfo.name}
                      onChange={(e) => setBasicInfo({ ...basicInfo, name: e.target.value })}
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={basicInfo.email}
                      onChange={(e) => setBasicInfo({ ...basicInfo, email: e.target.value })}
                    />
                    <Input
                      label="Phone Number"
                      value={basicInfo.phone}
                      onChange={(e) => setBasicInfo({ ...basicInfo, phone: e.target.value })}
                    />
                    <Input
                      label="Country"
                      value={basicInfo.country}
                      onChange={(e) => setBasicInfo({ ...basicInfo, country: e.target.value })}
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="City / Location"
                        value={basicInfo.city}
                        onChange={(e) => setBasicInfo({ ...basicInfo, city: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Input
                        label="Professional Headline"
                        value={basicInfo.headline}
                        onChange={(e) => setBasicInfo({ ...basicInfo, headline: e.target.value })}
                        placeholder="e.g. Senior Full Stack Engineer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Career Target */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Briefcase className="h-5 w-5 text-secondary" />
                      <span>Career Target</span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Define the roles you are aiming for so our matching engine can score accurately.
                    </p>
                  </div>

                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Target Roles (comma-separated)
                      </label>
                      <Input
                        value={careerTarget.targetRoles.join(", ")}
                        onChange={(e) =>
                          setCareerTarget({
                            ...careerTarget,
                            targetRoles: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="e.g. Senior Full Stack Engineer, Staff Frontend Architect"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Seniority / Experience Level
                      </label>
                      <select
                        value={careerTarget.experienceLevel}
                        onChange={(e) =>
                          setCareerTarget({ ...careerTarget, experienceLevel: e.target.value })
                        }
                        className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                      >
                        <option>Entry Level (0-2 years)</option>
                        <option>Mid-Level (3-5 years)</option>
                        <option>Senior (5-8 years)</option>
                        <option>Staff / Principal (8+ years)</option>
                        <option>Lead / Engineering Manager</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Preferred Industries
                      </label>
                      <Input
                        value={careerTarget.preferredIndustries.join(", ")}
                        onChange={(e) =>
                          setCareerTarget({
                            ...careerTarget,
                            preferredIndustries: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Skills */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Code2 className="h-5 w-5 text-accent" />
                      <span>Technical & Domain Skills</span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Add verified competencies from your repertoire. AI will never fabricate skills beyond this list.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Input
                      placeholder="Add a skill (e.g. React, Python, Docker, AWS)..."
                      value={newSkillInput}
                      onChange={(e) => setNewSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                    />
                    <Button onClick={addSkill} variant="primary" size="md">
                      <Plus className="h-4 w-4" />
                      <span>Add</span>
                    </Button>
                  </div>

                  <div className="flex flex-wrap gap-2 p-4 rounded-xl bg-surface-elevated border border-border min-h-[140px] max-h-[220px] overflow-y-auto">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white border border-white/10 hover:border-danger/40 transition-colors"
                      >
                        <span>{skill}</span>
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="hover:text-danger text-muted ml-0.5"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>

                  <div className="text-[11px] text-muted flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-accent" />
                    <span>Skills added here form the factual basis for ATS keywords.</span>
                  </div>
                </div>
              )}

              {/* STEP 4: Experience */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <span>Work Experience</span>
                      </h3>
                      <p className="text-xs text-muted mt-0.5">
                        Your professional career chronology.
                      </p>
                    </div>
                  </div>

                  {experiences.map((exp, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Company"
                          value={exp.company}
                          onChange={(e) => {
                            const updated = [...experiences];
                            updated[idx].company = e.target.value;
                            setExperiences(updated);
                          }}
                        />
                        <Input
                          label="Job Title / Role"
                          value={exp.role}
                          onChange={(e) => {
                            const updated = [...experiences];
                            updated[idx].role = e.target.value;
                            setExperiences(updated);
                          }}
                        />
                      </div>
                      <Textarea
                        label="Description & Achievements"
                        value={exp.description}
                        onChange={(e) => {
                          const updated = [...experiences];
                          updated[idx].description = e.target.value;
                          setExperiences(updated);
                        }}
                      />
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setExperiences([
                        ...experiences,
                        {
                          company: "New Company",
                          role: "Full Stack Engineer",
                          startDate: "2020-01-01",
                          description: "Developed web applications and services.",
                          achievements: [],
                          technologies: ["React", "TypeScript"],
                        },
                      ])
                    }
                    className="gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Another Experience Record</span>
                  </Button>
                </div>
              )}

              {/* STEP 5: Education */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-secondary" />
                      <span>Education</span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Degrees, academic institutions, and graduation years.
                    </p>
                  </div>

                  {educations.map((edu, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3"
                    >
                      <Input
                        label="Institution"
                        value={edu.institution}
                        onChange={(e) => {
                          const updated = [...educations];
                          updated[idx].institution = e.target.value;
                          setEducations(updated);
                        }}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Degree"
                          value={edu.degree}
                          onChange={(e) => {
                            const updated = [...educations];
                            updated[idx].degree = e.target.value;
                            setEducations(updated);
                          }}
                        />
                        <Input
                          label="Field of Study"
                          value={edu.field}
                          onChange={(e) => {
                            const updated = [...educations];
                            updated[idx].field = e.target.value;
                            setEducations(updated);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 6: Projects */}
              {currentStep === 6 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Code2 className="h-5 w-5 text-accent" />
                      <span>Notable Projects</span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Showcase applications, open-source repositories, and technical accomplishments.
                    </p>
                  </div>

                  {projects.map((proj, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3"
                    >
                      <Input
                        label="Project Name"
                        value={proj.name}
                        onChange={(e) => {
                          const updated = [...projects];
                          updated[idx].name = e.target.value;
                          setProjects(updated);
                        }}
                      />
                      <Textarea
                        label="Summary Description"
                        value={proj.description}
                        onChange={(e) => {
                          const updated = [...projects];
                          updated[idx].description = e.target.value;
                          setProjects(updated);
                        }}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Live URL"
                          value={proj.url || ""}
                          onChange={(e) => {
                            const updated = [...projects];
                            updated[idx].url = e.target.value;
                            setProjects(updated);
                          }}
                        />
                        <Input
                          label="GitHub URL"
                          value={proj.githubUrl || ""}
                          onChange={(e) => {
                            const updated = [...projects];
                            updated[idx].githubUrl = e.target.value;
                            setProjects(updated);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 7: Certifications */}
              {currentStep === 7 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Award className="h-5 w-5 text-amber-400" />
                      <span>Certifications & Credentials</span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Industry accreditations (AWS, GCP, CKA, etc.).
                    </p>
                  </div>

                  {certifications.map((cert, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-surface-elevated border border-border space-y-3"
                    >
                      <Input
                        label="Certification Name"
                        value={cert.name}
                        onChange={(e) => {
                          const updated = [...certifications];
                          updated[idx].name = e.target.value;
                          setCertifications(updated);
                        }}
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Input
                          label="Issuer"
                          value={cert.issuer}
                          onChange={(e) => {
                            const updated = [...certifications];
                            updated[idx].issuer = e.target.value;
                            setCertifications(updated);
                          }}
                        />
                        <Input
                          label="Credential ID"
                          value={cert.credentialId || ""}
                          onChange={(e) => {
                            const updated = [...certifications];
                            updated[idx].credentialId = e.target.value;
                            setCertifications(updated);
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* STEP 8: Resume Upload & Parsing */}
              {currentStep === 8 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <span>Resume Upload & Ingestion</span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Upload your PDF/DOCX or review your master resume raw text.
                    </p>
                  </div>

                  <div className="p-6 rounded-2xl border-2 border-dashed border-border/80 hover:border-primary/50 text-center transition-colors bg-surface-elevated/40">
                    <Upload className="h-8 w-8 text-muted mx-auto mb-2" />
                    <label className="text-xs font-semibold text-primary cursor-pointer hover:underline">
                      <span>Click to upload PDF or DOCX</span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        onChange={handleResumeUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-muted mt-1">
                      Our system extracts structured qualifications for verification.
                    </p>
                  </div>

                  {resumeParsedNotice && (
                    <div className="p-3 rounded-lg bg-accent/15 border border-accent/30 text-xs text-accent">
                      {resumeParsedNotice}
                    </div>
                  )}

                  <Textarea
                    label="Master Resume Text Review"
                    rows={5}
                    value={resumeText}
                    onChange={(e) => setResumeText(e.target.value)}
                  />
                </div>
              )}

              {/* STEP 9: Job & Salary Preferences */}
              {currentStep === 9 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Sliders className="h-5 w-5 text-secondary" />
                      <span>Job Preferences</span>
                    </h3>
                    <p className="text-xs text-muted mt-0.5">
                      Preferences define which jobs match your threshold.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Workplace Type
                      </label>
                      <select
                        value={preferences.remotePreference}
                        onChange={(e) =>
                          setPreferences({ ...preferences, remotePreference: e.target.value })
                        }
                        className="w-full h-10 px-3 rounded-lg border border-border bg-surface-elevated text-sm text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                      >
                        <option>Remote Only</option>
                        <option>Hybrid Preferred</option>
                        <option>On-site</option>
                        <option>Open to Any</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-300 block mb-1">
                        Minimum Target Base Salary (Annual USD)
                      </label>
                      <Input
                        type="number"
                        value={preferences.minSalary}
                        onChange={(e) =>
                          setPreferences({ ...preferences, minSalary: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 10: Completion / Celebration */}
              {currentStep === 10 && (
                <div className="text-center py-6 space-y-4">
                  <div className="h-16 w-16 rounded-full bg-accent/20 text-accent flex items-center justify-center mx-auto shadow-glow-accent">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
                    Your AI Career Profile is ready!
                  </h2>
                  <p className="text-xs sm:text-sm text-muted max-w-md mx-auto leading-relaxed">
                    You've indexed <span className="text-white font-semibold">{skills.length} skills</span>,{" "}
                    <span className="text-white font-semibold">{experiences.length} experience records</span>, and set your preferences. You are primed to start swiping.
                  </p>

                  <div className="p-4 rounded-xl bg-surface-elevated border border-border text-left max-w-md mx-auto space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Single source of truth locked</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Zero hallucination constraint active</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Tailored resume generator standing by</span>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          <div className="pt-6 border-t border-border/60 flex items-center justify-between mt-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={prevStep}
              disabled={currentStep === 1 || loading}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous</span>
            </Button>

            {currentStep < 10 ? (
              <Button variant="primary" size="md" onClick={nextStep} className="gap-2 shadow-glow">
                <span>Continue</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                variant="accent"
                size="lg"
                onClick={handleFinalSubmit}
                isLoading={loading}
                className="gap-2 shadow-glow-accent"
              >
                <span>Launch ApplySwipe Discover</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
