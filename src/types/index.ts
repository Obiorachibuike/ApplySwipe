export type Role = "USER" | "ADMIN";

export type InteractionType =
  | "VIEWED"
  | "PASSED"
  | "SAVED"
  | "APPLIED"
  | "LIKE"
  | "SUPER_LIKE";

/**
 * Swipe decisions supported by the discovery interface.
 * PASS = left, LIKE = right, SUPER_LIKE = strongest positive signal.
 */
export type SwipeAction = "LIKE" | "PASS" | "SUPER_LIKE";

/** Canonical provider identifiers. New providers are added here + in the registry. */
export type JobProviderName =
  | "ADZUNA"
  | "GREENHOUSE"
  | "LEVER"
  | "LEGACY";

export type WorkplaceType = "REMOTE" | "HYBRID" | "ONSITE" | "UNKNOWN";

export type SalaryInterval = "YEAR" | "MONTH" | "WEEK" | "DAY" | "HOUR";

export type ProviderHealthStatus =
  | "IDLE"
  | "SYNCING"
  | "HEALTHY"
  | "WARNING"
  | "UNHEALTHY"
  | "DISABLED";

export type SyncRunStatus = "RUNNING" | "SUCCESS" | "FAILED" | "PARTIAL" | "SKIPPED";

export type ApplicationStatus =
  | "SAVED"
  | "PREPARING"
  | "READY"
  | "READY_FOR_REVIEW"
  | "SUBMITTING"
  | "SUBMITTED"
  | "APPLIED"
  | "INTERVIEW"
  | "OFFER"
  | "REJECTED"
  | "WITHDRAWN";

export type ApplicationMode =
  | "MANUAL"
  | "REVIEW_EVERYTHING"
  | "SMART_APPLY"
  | "AUTOPILOT";

export type AutomationCapability =
  | "API_SUPPORTED"
  | "FORM_SUPPORTED"
  | "MANUAL_REQUIRED"
  | "USER_CONFIRMATION_REQUIRED";

export type AtsProvider =
  | "GREENHOUSE"
  | "LEVER"
  | "WORKDAY"
  | "CUSTOM_API"
  | "MANUAL";

export type DocumentType =
  | "TAILORED_RESUME"
  | "COVER_LETTER"
  | "PORTFOLIO"
  | "OTHER";

export type SkillLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";

export type NotificationType =
  | "JOB_MATCH"
  | "APPLICATION_SUBMITTED"
  | "NEEDS_REVIEW"
  | "INTERVIEW"
  | "AUTOPILOT_SUMMARY"
  | "SYSTEM";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  isVerified: boolean;
  emailVerifiedAt?: string | null;
  resetToken?: string | null;
  resetTokenExpires?: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: Profile | null;
  resumes?: Resume[];
  applications?: Application[];
  savedJobs?: SavedJob[];
  preferences?: UserPreference | null;
  autopilotSetting?: AutopilotSetting | null;
  notifications?: Notification[];
}

export interface Profile {
  id: string;
  userId: string;
  headline?: string | null;
  bio?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  targetRoles: string[];
  experienceLevel?: string | null;
  preferredIndustries: string[];
  preferredEmploymentTypes: string[];
  remotePreference?: string | null;
  minSalary?: number | null;
  salaryCurrency: string;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
  user?: User | null;
  skills?: Skill[];
  experiences?: Experience[];
  educations?: Education[];
  projects?: Project[];
  certifications?: Certification[];
}

export interface Skill {
  id: string;
  profileId: string;
  name: string;
  category?: string | null;
  yearsExperience?: number | null;
  level: SkillLevel;
  createdAt: string;
  updatedAt: string;
}

export interface Experience {
  id: string;
  profileId: string;
  company: string;
  role: string;
  location?: string | null;
  isCurrent: boolean;
  startDate: string;
  endDate?: string | null;
  description: string;
  achievements: string[];
  technologies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Education {
  id: string;
  profileId: string;
  institution: string;
  degree: string;
  field: string;
  startYear: number;
  endYear?: number | null;
  gpa?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  profileId: string;
  name: string;
  description: string;
  technologies: string[];
  url?: string | null;
  githubUrl?: string | null;
  highlights: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Certification {
  id: string;
  profileId: string;
  name: string;
  issuer: string;
  issueDate?: string | null;
  expiryDate?: string | null;
  credentialId?: string | null;
  credentialUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Resume {
  id: string;
  userId: string;
  name: string;
  fileUrl?: string | null;
  rawText?: string | null;
  parsedData?: any;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  versions?: ResumeVersion[];
}

export interface ResumeVersion {
  id: string;
  resumeId: string;
  jobId?: string | null;
  versionType: string;
  title: string;
  targetRole?: string | null;
  summary: string;
  skills: string[];
  experienceHighlights: string[];
  fullContent: string;
  matchScore?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobSourceRef {
  provider: string;
  externalId: string;
  sourceUrl?: string | null;
  applicationUrl?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
}

export interface Job {
  id: string;
  externalId?: string | null;
  /** Provider that produced the record: ADZUNA | GREENHOUSE | LEVER | LEGACY. */
  provider: string;
  /** Human readable source label kept for backwards compatibility. */
  source: string;
  title: string;
  company: string;
  companyLogo?: string | null;
  description: string;
  /** Canonical, human friendly location string (originals live in originalLocation/rawData). */
  location: string;
  originalLocation?: string | null;
  remote: boolean;
  workplaceType: WorkplaceType;
  employmentType: string;
  /** Canonical seniority (legacy alias: experienceLevel, kept in sync). */
  seniority?: string | null;
  experienceLevel?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryCurrency: string;
  salaryInterval?: SalaryInterval | string | null;
  /** Provider published an estimated (not exact) salary range. */
  salaryIsPredicted?: boolean | null;
  skills: string[];
  /** Denormalized lowercase blob used by database-side search. */
  searchText?: string | null;
  sourceUrl: string;
  applicationUrl: string;
  applicationType: AutomationCapability;
  atsProvider: AtsProvider;
  isReported: boolean;
  isActive: boolean;
  /** Cross-provider duplicate resolution. */
  fingerprint?: string | null;
  canonicalJobId?: string | null;
  /** Other providers/sources that advertised this same opening. */
  sources?: JobSourceRef[] | null;
  postedAt: string;
  expiresAt?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  seenCount?: number;
  rawData?: any;
  createdAt: string;
  updatedAt: string;
  matchScore?: number;
  matchAnalysis?: MatchAnalysis | null;
  matchReason?: string | null;
  recommendation?: string | null;
  isSaved?: boolean;
  isApplied?: boolean;
  isPassed?: boolean;
  isSuperLiked?: boolean;
  isSwiped?: boolean;
}

export interface JobSource {
  id: string;
  name: string;
  type: string;
  url?: string | null;
  isActive: boolean;
  lastSyncAt?: string | null;
  jobCount: number;
  config?: any;
  /** Provider this source belongs to (GREENHOUSE | LEVER | ADZUNA). */
  provider?: JobProviderName | string | null;
  companyName?: string | null;
  /**
   * Provider source token: the Greenhouse board token or the Lever company slug.
   * Stored generically so new providers can reuse the same configuration model.
   */
  boardToken?: string | null;
  active?: boolean;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
  jobsImported?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderState {
  id: string;
  provider: JobProviderName | string;
  isEnabled: boolean;
  status: ProviderHealthStatus;
  lastSyncAt?: string | null;
  lastSuccessAt?: string | null;
  lastErrorAt?: string | null;
  lastError?: string | null;
  consecutiveFailures: number;
  jobsImported: number;
  activeJobs: number;
  syncIntervalMinutes: number;
  freshnessHours: number;
  lockOwner?: string | null;
  lockExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderSyncRun {
  id: string;
  provider: JobProviderName | string;
  status: SyncRunStatus;
  triggeredBy: string;
  startedAt: string;
  finishedAt?: string | null;
  stats?: any;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobMatchScoreRecord {
  id: string;
  userId: string;
  jobId: string;
  score: number;
  stage: "DETERMINISTIC" | "AI_RERANK";
  reason?: string | null;
  matchedSkills?: string[] | null;
  missingSkills?: string[] | null;
  recommendation?: string | null;
  breakdown?: any;
  createdAt: string;
  updatedAt: string;
}

export interface FeedJob extends Job {
  matchScore: number;
  matchReason?: string | null;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation?: string | null;
  /** Full deterministic breakdown for the swipe card details. */
  matchAnalysis?: MatchAnalysis;
  /** Human readable provider label ("Adzuna", "Company Career Page"). */
  sourceLabel?: string;
  /** The employer's own application page (never an aggregator redirect). */
  officialApplicationUrl?: string | null;
  /** Other providers that advertised the same opening. */
  alternativeSources?: { provider: string; sourceUrl?: string | null; applicationUrl?: string | null }[];
  isSaved?: boolean;
  isApplied?: boolean;
  isSwiped?: boolean;
}

export interface DedupeSourceRef {
  provider: string;
  externalId: string;
  sourceUrl?: string | null;
  applicationUrl?: string | null;
}

export interface JobInteraction {
  id: string;
  userId: string;
  jobId: string;
  interactionType: InteractionType;
  metadata?: any;
  createdAt: string;
}

export interface SavedJob {
  id: string;
  userId: string;
  jobId: string;
  notes?: string | null;
  createdAt: string;
  job?: Job;
}

export interface Application {
  id: string;
  userId: string;
  jobId: string;
  status: ApplicationStatus;
  mode: ApplicationMode;
  submissionCapability: AutomationCapability;
  matchScore?: number | null;
  matchExplanation?: string | null;
  submissionMethod?: string | null;
  externalApplicationId?: string | null;
  notes?: string | null;
  submittedAt?: string | null;
  /** Timestamp the candidate confirmed the external application was sent. */
  appliedAt?: string | null;
  resumeId?: string | null;
  coverLetterId?: string | null;
  interviewDate?: string | null;
  createdAt: string;
  updatedAt: string;
  job?: Job;
  answers?: ApplicationAnswer[];
  documents?: ApplicationDocument[];
  events?: ApplicationEvent[];
}

export interface ApplicationAnswer {
  id: string;
  applicationId: string;
  question: string;
  answer: string;
  isAiGenerated: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationDocument {
  id: string;
  applicationId: string;
  type: DocumentType;
  title: string;
  content: string;
  fileUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApplicationEvent {
  id: string;
  applicationId: string;
  eventType: string;
  notes?: string | null;
  metadata?: any;
  createdAt: string;
}

export interface UserPreference {
  id: string;
  userId: string;
  targetRoles: string[];
  experienceLevel?: string | null;
  minSalary?: number | null;
  salaryCurrency: string;
  remoteOnly: boolean;
  preferredLocations: string[];
  employmentTypes: string[];
  excludedCompanies: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AutopilotSetting {
  id: string;
  userId: string;
  isEnabled: boolean;
  minMatchScore: number;
  dailyLimit: number;
  applicationsToday: number;
  allowedRoles: string[];
  allowedLocations: string[];
  minSalary?: number | null;
  employmentTypes: string[];
  excludedCompanies: string[];
  mode: ApplicationMode;
  lastRunAt?: string | null;
  scannedCount: number;
  matchedCount: number;
  preparedCount: number;
  submittedCount: number;
  needsReviewCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export interface AIUsage {
  id: string;
  userId: string;
  operation: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  details?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface MatchAnalysis {
  overallMatch: number;
  skillsMatch: number;
  experienceMatch: number;
  educationMatch: number;
  locationMatch: number;
  /** Component scores from the deterministic engine (all optional for compatibility). */
  employmentMatch?: number;
  salaryMatch?: number;
  seniorityMatch?: number;
  explanation: string;
  matchingSkills: string[];
  missingSkills: string[];
  concerns: string[];
  /** Optional weighted breakdown produced by the deterministic matching engine. */
  breakdown?: Record<string, number>;
  recommendation?: MatchRecommendation;
}

export type MatchRecommendation =
  | "strong_match"
  | "good_match"
  | "possible_match"
  | "weak_match";

export interface RankedJobMatch {
  score: number;
  reason: string;
  matchedSkills: string[];
  missingSkills: string[];
  recommendation: MatchRecommendation;
  stage: "DETERMINISTIC" | "AI_RERANK";
}
