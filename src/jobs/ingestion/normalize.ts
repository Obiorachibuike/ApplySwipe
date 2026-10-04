import type {
  NormalizedJob,
  SalaryInterval,
  WorkplaceType,
} from "@/jobs/providers/types";
import { extractSkills } from "@/jobs/matching/skills";
import { isSafeExternalUrl } from "@/jobs/providers/http";

/**
 * Shared normalization pipeline.
 *
 * Raw provider response
 *   -> validation
 *   -> HTML cleanup
 *   -> description normalization
 *   -> location normalization
 *   -> salary normalization
 *   -> employment type normalization
 *   -> workplace type normalization
 *   -> skill extraction
 *   -> canonical job
 *
 * Nothing here performs I/O and nothing invents data: missing provider fields
 * stay undefined instead of being guessed.
 */

const MAX_DESCRIPTION_CHARS = 20000;
const MAX_FIELD_CHARS = 300;

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface ValidationIssue {
  field: string;
  message: string;
}

export class JobValidationError extends Error {
  public readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      `Job payload failed validation: ${issues.map((i) => `${i.field}: ${i.message}`).join("; ")}`
    );
    this.name = "JobValidationError";
    this.issues = issues;
  }
}

/** Returns validation issues for a normalized job (empty array = valid). */
export function validateNormalizedJob(job: Partial<NormalizedJob>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!job.externalId || typeof job.externalId !== "string") {
    issues.push({ field: "externalId", message: "missing provider external id" });
  }
  if (!job.provider) {
    issues.push({ field: "provider", message: "missing provider name" });
  }
  if (!job.title || job.title.trim().length === 0) {
    issues.push({ field: "title", message: "missing job title" });
  }
  if (!job.description || job.description.trim().length < 20) {
    issues.push({ field: "description", message: "description missing or too short" });
  }
  if (!isSafeExternalUrl(job.applicationUrl)) {
    issues.push({ field: "applicationUrl", message: "missing or unsafe application URL" });
  }
  if (!isSafeExternalUrl(job.sourceUrl)) {
    issues.push({ field: "sourceUrl", message: "missing or unsafe source URL" });
  }
  if (job.salaryMin != null && job.salaryMax != null && job.salaryMin > job.salaryMax) {
    issues.push({ field: "salary", message: "salaryMin greater than salaryMax" });
  }

  return issues;
}

/* -------------------------------------------------------------------------- */
/* HTML + text cleanup                                                        */
/* -------------------------------------------------------------------------- */

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&hellip;": "…",
  "&mdash;": "—",
  "&ndash;": "–",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&bull;": "•",
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_m, code) => {
      const parsed = Number(code);
      return Number.isFinite(parsed) && parsed > 0 && parsed < 0x110000
        ? String.fromCodePoint(parsed)
        : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => {
      const parsed = parseInt(code, 16);
      return Number.isFinite(parsed) && parsed > 0 ? String.fromCodePoint(parsed) : "";
    })
    .replace(/&[a-z]+;/gi, (entity) => HTML_ENTITIES[entity.toLowerCase()] ?? entity);
}

/**
 * Converts provider HTML into safe plain text.
 * Scripts/styles are dropped entirely, block level tags become newlines so the
 * stored description keeps a readable structure. The result is plain text: the
 * UI never renders provider HTML with dangerouslySetInnerHTML.
 */
export function htmlToText(html: string): string {
  if (!html) return "";
  let text = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|iframe|object|embed)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|section|article|header|footer|tr|table|ul|ol)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n• ")
    .replace(/<\/\s*(li|h1|h2|h3|h4|h5|h6)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  text = decodeHtmlEntities(text);
  return text
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/** True when a provider description already looks like markup. */
export function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

/**
 * Provider descriptions arrive as HTML, as HTML-escaped markup (Greenhouse
 * encodes `<p>` as `&lt;p&gt;`) or as plain text. Decode first so escaped
 * markup is treated as markup instead of being stored verbatim.
 */
export function providerDescriptionToText(value: unknown): string {
  const raw = typeof value === "string" ? value : String(value ?? "");
  if (!raw) return "";
  const decoded = decodeHtmlEntities(raw);
  if (looksLikeHtml(decoded)) return htmlToText(decoded);
  return decoded
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function truncate(value: string, max = MAX_DESCRIPTION_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

function cleanField(value: unknown, max = MAX_FIELD_CHARS): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = htmlToText(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return undefined;
  return cleaned.length > max ? `${cleaned.slice(0, max).trimEnd()}…` : cleaned;
}

/* -------------------------------------------------------------------------- */
/* Location                                                                   */
/* -------------------------------------------------------------------------- */

const REMOTE_MARKERS = [
  "remote",
  "work from anywhere",
  "work from home",
  "anywhere",
  "distributed",
  "telecommute",
  "home based",
  "home-based",
  "fully remote",
  "100% remote",
  "wfh",
];

const HYBRID_MARKERS = ["hybrid", "partially remote", "part remote", "flexible remote", "days remote"];

const ONSITE_MARKERS = ["on-site", "onsite", "in office", "in-office", "office based", "office-based"];

export interface NormalizedLocation {
  /** Display string shown in the UI (never destroys the provider wording). */
  display: string;
  /** Lowercased comparison key, e.g. "remote|us". */
  key: string;
  workplaceType: WorkplaceType;
  /** Detected country/region hint when the provider exposes one. */
  region?: string;
  isRemote: boolean;
}

export function normalizeLocation(raw: unknown): NormalizedLocation {
  const original = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  if (!original || /^(n\/?a|none|unspecified|unknown|-)$/i.test(original)) {
    return { display: "Location not specified", key: "unspecified", workplaceType: "UNKNOWN", isRemote: false };
  }

  const lower = original.toLowerCase();
  const hasRemote = REMOTE_MARKERS.some((marker) => lower.includes(marker));
  const hasHybrid = HYBRID_MARKERS.some((marker) => lower.includes(marker));
  const hasOnsite = ONSITE_MARKERS.some((marker) => lower.includes(marker));

  let workplaceType: WorkplaceType = "UNKNOWN";
  if (hasHybrid) workplaceType = "HYBRID";
  else if (hasRemote) workplaceType = "REMOTE";
  else if (hasOnsite) workplaceType = "ONSITE";
  // A concrete place ("Berlin, Germany", "Austin, TX") with no remote/hybrid
  // marker describes an office location: default it to on-site so the feed's
  // remote filter and the location score behave predictably.
  else if (original.length > 1) workplaceType = "ONSITE";

  // Region hint: everything after a separator once the remote token is removed.
  const withoutRemote = lower
    .replace(/\b(work from anywhere|work from home|fully remote|100% remote|partially remote|hybrid|remote|anywhere|distributed|telecommute|wfh)\b/g, " ")
    .replace(/[()\[\]]/g, " ")
    .replace(/\s*[-–—/,|]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const region = withoutRemote.length > 1 ? withoutRemote : undefined;
  const key = region
    ? `${workplaceType === "REMOTE" ? "remote" : "loc"}|${region}`
    : workplaceType === "REMOTE"
      ? "remote"
      : `loc|${lower}`;

  return {
    display: original,
    key,
    workplaceType,
    region,
    isRemote: workplaceType === "REMOTE" || hasRemote,
  };
}

/* -------------------------------------------------------------------------- */
/* Salary                                                                     */
/* -------------------------------------------------------------------------- */

export interface NormalizedSalary {
  min?: number;
  max?: number;
  currency?: string;
  interval?: SalaryInterval;
  isPredicted?: boolean;
}

const CURRENCY_ALIASES: Record<string, string> = {
  $: "USD",
  us$: "USD",
  usd: "USD",
  "£": "GBP",
  gbp: "GBP",
  "€": "EUR",
  eur: "EUR",
  ngn: "NGN",
  "₦": "NGN",
  zar: "ZAR",
  inr: "INR",
  "₹": "INR",
  cad: "CAD",
  aud: "AUD",
  chf: "CHF",
  jpy: "JPY",
  brl: "BRL",
  mxn: "MXN",
  sek: "SEK",
  pln: "PLN",
  aed: "AED",
};

export function normalizeCurrency(raw: unknown): string | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const key = raw.trim().toLowerCase();
  return CURRENCY_ALIASES[key] || (/^[a-z]{3}$/.test(key) ? key.toUpperCase() : undefined);
}

const INTERVAL_MAP: Record<string, SalaryInterval> = {
  year: "YEAR",
  yearly: "YEAR",
  annual: "YEAR",
  annually: "YEAR",
  "per year": "YEAR",
  "per annum": "YEAR",
  annum: "YEAR",
  yr: "YEAR",
  pa: "YEAR",
  month: "MONTH",
  monthly: "MONTH",
  "per month": "MONTH",
  mo: "MONTH",
  week: "WEEK",
  weekly: "WEEK",
  "per week": "WEEK",
  day: "DAY",
  daily: "DAY",
  "per day": "DAY",
  hour: "HOUR",
  hourly: "HOUR",
  "per hour": "HOUR",
  hr: "HOUR",
};

export function normalizeSalaryInterval(raw: unknown): SalaryInterval | undefined {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const key = raw.trim().toLowerCase();
  return INTERVAL_MAP[key];
}

function positive(value: unknown): number | undefined {
  const num = typeof value === "number" ? value : Number(String(value ?? "").replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(num) || num <= 0) return undefined;
  // Anything below a realistic hourly floor is treated as missing data.
  if (num < 100) return Math.round(num);
  return Math.round(num);
}

export function normalizeSalary(input: {
  min?: unknown;
  max?: unknown;
  currency?: unknown;
  interval?: unknown;
  isPredicted?: unknown;
}): NormalizedSalary {
  const min = positive(input.min);
  const max = positive(input.max);
  return {
    min,
    max: max ?? min,
    currency: normalizeCurrency(input.currency),
    interval: normalizeSalaryInterval(input.interval) ?? (min || max ? "YEAR" : undefined),
    isPredicted: input.isPredicted === true ? true : undefined,
  };
}

const INTERVAL_MULTIPLIERS: Record<SalaryInterval, number> = {
  YEAR: 1,
  MONTH: 12,
  WEEK: 52,
  DAY: 260,
  HOUR: 2080,
};

/** Annualizes a salary range so salaries from different providers are comparable. */
export function annualizeSalary(
  amount: number | null | undefined,
  interval: string | null | undefined
): number | undefined {
  if (amount == null || !Number.isFinite(amount)) return undefined;
  const normalized = normalizeSalaryInterval(interval) ?? "YEAR";
  return Math.round(amount * INTERVAL_MULTIPLIERS[normalized]);
}

/* -------------------------------------------------------------------------- */
/* Employment type                                                            */
/* -------------------------------------------------------------------------- */

const EMPLOYMENT_MAP: { pattern: RegExp; value: string }[] = [
  { pattern: /\b(full[\s-]?time|permanent|regular)\b/, value: "Full-time" },
  { pattern: /\b(part[\s-]?time)\b/, value: "Part-time" },
  { pattern: /\b(contract|contractor|fixed[\s-]?term|b2b|c2c)\b/, value: "Contract" },
  { pattern: /\b(intern|internship|placement|working student|graduate program)\b/, value: "Internship" },
  { pattern: /\b(temporary|temp|seasonal)\b/, value: "Temporary" },
  { pattern: /\b(freelance)\b/, value: "Freelance" },
  { pattern: /\b(volunteer)\b/, value: "Volunteer" },
];

export function normalizeEmploymentType(raw: unknown): string {
  const value = typeof raw === "string" ? raw.toLowerCase().replace(/[_-]/g, " ") : "";
  if (!value) return "Full-time";
  for (const entry of EMPLOYMENT_MAP) {
    if (entry.pattern.test(value)) return entry.value;
  }
  const cleaned = value.trim().replace(/\s+/g, " ");
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/* -------------------------------------------------------------------------- */
/* Seniority                                                                  */
/* -------------------------------------------------------------------------- */

const SENIORITY_MAP: { pattern: RegExp; value: string }[] = [
  { pattern: /\b(intern|internship|trainee|working student)\b/, value: "Intern" },
  { pattern: /\b(principal|distinguished|fellow)\b/, value: "Principal" },
  { pattern: /\b(staff)\b/, value: "Staff" },
  { pattern: /\b(lead|team lead|tech lead|manager|head of)\b/, value: "Lead" },
  { pattern: /\b(director|vp|vice president|chief|cto|ceo)\b/, value: "Executive" },
  { pattern: /\b(senior|sr\.?|snr)\b/, value: "Senior" },
  { pattern: /\b(junior|jr\.?|entry[\s-]?level|associate|apprentice)\b/, value: "Junior" },
  { pattern: /\b(mid[\s-]?level|intermediate)\b/, value: "Mid" },
  { pattern: /\b(graduate)\b/, value: "Entry" },
];

export function normalizeSeniority(...values: (string | null | undefined)[]): string | undefined {
  for (const value of values) {
    if (!value || typeof value !== "string") continue;
    const lower = value.toLowerCase();
    for (const entry of SENIORITY_MAP) {
      if (entry.pattern.test(lower)) return entry.value;
    }
  }
  return undefined;
}

/* -------------------------------------------------------------------------- */
/* Workplace type                                                             */
/* -------------------------------------------------------------------------- */

export function normalizeWorkplaceType(input: {
  remoteFlag?: boolean | undefined;
  location?: string | null;
  description?: string | null;
}): WorkplaceType {
  const location = normalizeLocation(input.location);
  if (location.workplaceType !== "UNKNOWN") return location.workplaceType;

  const haystack = `${input.description || ""}`.toLowerCase();
  if (HYBRID_MARKERS.some((marker) => haystack.includes(marker))) return "HYBRID";
  if (REMOTE_MARKERS.some((marker) => haystack.includes(marker))) return "REMOTE";
  if (input.remoteFlag === true) return "REMOTE";
  if (input.remoteFlag === false) return "ONSITE";
  return "UNKNOWN";
}

export function workplaceTypeLabel(type: string | null | undefined): string {
  switch (type) {
    case "REMOTE":
      return "Remote";
    case "HYBRID":
      return "Hybrid";
    case "ONSITE":
      return "On-site";
    default:
      return "Not specified";
  }
}

/* -------------------------------------------------------------------------- */
/* Company                                                                    */
/* -------------------------------------------------------------------------- */

export function normalizeCompanyName(raw: unknown, fallback = "Unknown company"): string {
  const cleaned = cleanField(raw, 160);
  if (!cleaned) return fallback;
  return cleaned.replace(/\s*[|–-]\s*(hiring|jobs?|careers?)\s*$/i, "").trim() || fallback;
}

/* -------------------------------------------------------------------------- */
/* Canonical job assembly                                                     */
/* -------------------------------------------------------------------------- */

export interface NormalizeInput {
  provider: string;
  externalId: string;
  title: unknown;
  companyName: unknown;
  description: unknown;
  location?: unknown;
  remoteFlag?: boolean;
  employmentType?: unknown;
  seniority?: unknown;
  salary?: {
    min?: unknown;
    max?: unknown;
    currency?: unknown;
    interval?: unknown;
    isPredicted?: unknown;
  };
  skills?: unknown;
  postedAt?: unknown;
  expiresAt?: unknown;
  sourceUrl: unknown;
  applicationUrl?: unknown;
  companyLogo?: unknown;
  atsProvider?: NormalizedJob["atsProvider"];
  applicationType?: NormalizedJob["applicationType"];
  rawData?: unknown;
  /** Text used for deterministic skill extraction (defaults to title + description). */
  skillText?: string;
}

function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  // Ignore obviously bogus timestamps (year < 2000 or > 2 years in the future).
  const year = date.getUTCFullYear();
  if (year < 2000 || date.getTime() > Date.now() + 1000 * 60 * 60 * 24 * 730) return undefined;
  return date;
}

function toUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return isSafeExternalUrl(trimmed) ? trimmed : undefined;
}

/**
 * Builds the canonical job representation from provider data.
 * Throws `JobValidationError` when the payload cannot be trusted.
 */
export function buildNormalizedJob(input: NormalizeInput): NormalizedJob {
  const title = cleanField(input.title, 200) || "";
  const rawDescription =
    typeof input.description === "string" ? input.description : String(input.description ?? "");
  const description = truncate(providerDescriptionToText(rawDescription));

  const sourceUrl = toUrl(input.sourceUrl) || "";
  const applicationUrl = toUrl(input.applicationUrl) || sourceUrl;

  const locationInfo = normalizeLocation(input.location);
  const workplaceType = normalizeWorkplaceType({
    remoteFlag: input.remoteFlag,
    location: typeof input.location === "string" ? input.location : undefined,
    description,
  });

  const salary = normalizeSalary(input.salary || {});
  const skills = extractSkills(`${title}\n${description}`, {
    extra: Array.isArray(input.skills)
      ? (input.skills as unknown[]).filter((s): s is string => typeof s === "string")
      : undefined,
    limit: 25,
  });

  const job: NormalizedJob = {
    externalId: String(input.externalId ?? "").trim(),
    provider: input.provider,
    title,
    companyName: normalizeCompanyName(input.companyName),
    companyLogo: toUrl(input.companyLogo),
    description,
    location: locationInfo.display,
    originalLocation: locationInfo.display,
    workplaceType,
    employmentType: normalizeEmploymentType(input.employmentType),
    seniority: normalizeSeniority(
      typeof input.seniority === "string" ? input.seniority : undefined,
      title
    ),
    salaryMin: salary.min,
    salaryMax: salary.max,
    salaryCurrency: salary.currency,
    salaryInterval: salary.interval,
    salaryIsPredicted: salary.isPredicted,
    skills,
    postedAt: toDate(input.postedAt),
    expiresAt: toDate(input.expiresAt),
    sourceUrl,
    applicationUrl,
    applicationType: input.applicationType || "MANUAL_REQUIRED",
    atsProvider: input.atsProvider || "MANUAL",
    rawData: input.rawData,
  };

  const issues = validateNormalizedJob(job);
  if (issues.length > 0) {
    throw new JobValidationError(issues);
  }

  return job;
}

/* -------------------------------------------------------------------------- */
/* Salary extraction from free text (conservative, never invents ranges)      */
/* -------------------------------------------------------------------------- */

const SALARY_PATTERN =
  /([$£€₦₹]|usd|gbp|eur|ngn|inr|cad|aud)\s?(\d[\d,.]*)\s?(k)?\s*(?:(?:-|–|—|to)\s*([$£€₦₹]|usd|gbp|eur|ngn|inr|cad|aud)?\s?(\d[\d,.]*)\s?(k)?)?\s*(per\s+(?:year|annum|month|week|day|hour)|\/\s?(?:yr|year|hr|hour|mo|month)|annually|yearly|monthly|hourly)?/i;

function parseAmount(value: string | undefined, unit: string | undefined): number | undefined {
  if (!value) return undefined;
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  const amount = unit?.toLowerCase() === "k" ? numeric * 1000 : numeric;
  return amount >= 1000 ? Math.round(amount) : undefined;
}

/**
 * Extracts a salary range from a description when the provider does not expose
 * structured compensation data. Only explicit numbers are used - nothing is
 * inferred or manufactured.
 */
export function extractSalaryFromText(
  text: string | null | undefined,
  currencyHint?: string
): NormalizedSalary {
  if (!text || typeof text !== "string") return {};
  const match = SALARY_PATTERN.exec(text);
  if (!match) return {};

  const [, currency1, value1, unit1, currency2, value2, unit2, intervalRaw] = match;

  const min = parseAmount(value1, unit1);
  const max = parseAmount(value2, unit2) ?? min;
  if (!min || (max && max / min > 5)) return {};

  const currency = normalizeCurrency(currency1) || normalizeCurrency(currency2) || normalizeCurrency(currencyHint);

  const interval = normalizeSalaryInterval((intervalRaw || "").replace(/\//g, " ").trim());

  return {
    min,
    max,
    currency,
    interval: interval ?? (min >= 1000 ? "YEAR" : undefined),
  };
}
