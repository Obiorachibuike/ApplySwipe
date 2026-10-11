/**
 * Deterministic skill extraction + canonicalization.
 *
 * Ingestion NEVER calls an LLM per job. Skills are extracted with a curated
 * dictionary (aliases + word-boundary matching) so the pipeline stays cheap,
 * fast and reproducible. AI enrichment is an optional second stage that only
 * runs for a small, bounded number of jobs (see jobs/matching/ai-rerank.ts).
 */

export interface SkillDefinition {
  /** Canonical display name stored on the job/profile. */
  name: string;
  category: string;
  aliases: string[];
}

const SKILLS: SkillDefinition[] = [
  // Languages
  { name: "JavaScript", category: "Language", aliases: ["js", "ecmascript", "es6"] },
  { name: "TypeScript", category: "Language", aliases: ["ts"] },
  { name: "Python", category: "Language", aliases: ["python3"] },
  { name: "Go", category: "Language", aliases: ["golang"] },
  { name: "Rust", category: "Language", aliases: [] },
  { name: "Java", category: "Language", aliases: [] },
  { name: "C#", category: "Language", aliases: ["csharp", "c sharp"] },
  { name: "C++", category: "Language", aliases: ["cpp"] },
  { name: "Ruby", category: "Language", aliases: [] },
  { name: "PHP", category: "Language", aliases: [] },
  { name: "Kotlin", category: "Language", aliases: [] },
  { name: "Swift", category: "Language", aliases: [] },
  { name: "Scala", category: "Language", aliases: [] },
  { name: "Solidity", category: "Language", aliases: [] },
  { name: "SQL", category: "Language", aliases: [] },
  { name: "Bash", category: "Language", aliases: ["shell scripting", "shell"] },

  // Frontend
  { name: "React", category: "Frontend", aliases: ["react.js", "reactjs"] },
  { name: "React Native", category: "Mobile", aliases: ["react-native"] },
  { name: "Next.js", category: "Frontend", aliases: ["nextjs", "next js", "next"] },
  { name: "Vue", category: "Frontend", aliases: ["vue.js", "vuejs"] },
  { name: "Angular", category: "Frontend", aliases: ["angularjs"] },
  { name: "Svelte", category: "Frontend", aliases: ["sveltekit"] },
  { name: "Redux", category: "Frontend", aliases: [] },
  { name: "Tailwind CSS", category: "Frontend", aliases: ["tailwind", "tailwindcss"] },
  { name: "HTML", category: "Frontend", aliases: ["html5"] },
  { name: "CSS", category: "Frontend", aliases: ["css3", "scss", "sass", "less"] },
  { name: "Web Performance", category: "Frontend", aliases: ["core web vitals", "web vitals"] },
  { name: "Accessibility", category: "Frontend", aliases: ["a11y", "wcag"] },
  { name: "Figma", category: "Design", aliases: [] },

  // Backend
  { name: "Node.js", category: "Backend", aliases: ["nodejs", "node"] },
  { name: "Express", category: "Backend", aliases: ["express.js", "expressjs"] },
  { name: "NestJS", category: "Backend", aliases: ["nest.js"] },
  { name: "Django", category: "Backend", aliases: ["django rest framework", "drf"] },
  { name: "FastAPI", category: "Backend", aliases: ["fast api"] },
  { name: "Flask", category: "Backend", aliases: [] },
  { name: "GraphQL", category: "Backend", aliases: ["apollo"] },
  { name: "REST APIs", category: "Backend", aliases: ["rest api", "restful", "rest"] },
  { name: "gRPC", category: "Backend", aliases: [] },
  { name: "Microservices", category: "Backend", aliases: ["micro-services"] },
  { name: "WebSockets", category: "Backend", aliases: ["websocket", "socket.io"] },
  { name: "Spring Boot", category: "Backend", aliases: ["spring"] },
  { name: ".NET", category: "Backend", aliases: ["dotnet", "asp.net", "aspnet"] },
  { name: "Rails", category: "Backend", aliases: ["ruby on rails"] },
  { name: "Laravel", category: "Backend", aliases: [] },

  // Data
  { name: "PostgreSQL", category: "Database", aliases: ["postgres", "psql"] },
  { name: "MySQL", category: "Database", aliases: ["mariadb"] },
  { name: "MongoDB", category: "Database", aliases: ["mongo"] },
  { name: "Redis", category: "Database", aliases: [] },
  { name: "Elasticsearch", category: "Database", aliases: ["opensearch"] },
  { name: "DynamoDB", category: "Database", aliases: ["dynamo"] },
  { name: "Prisma", category: "Database", aliases: [] },
  { name: "SQLAlchemy", category: "Database", aliases: [] },
  { name: "Kafka", category: "Data", aliases: ["apache kafka"] },
  { name: "Spark", category: "Data", aliases: ["apache spark", "pyspark"] },
  { name: "Airflow", category: "Data", aliases: ["apache airflow"] },
  { name: "dbt", category: "Data", aliases: [] },
  { name: "Snowflake", category: "Data", aliases: [] },
  { name: "BigQuery", category: "Data", aliases: ["big query"] },
  { name: "ETL", category: "Data", aliases: ["elt", "data pipelines", "data pipeline"] },
  { name: "Pandas", category: "Data", aliases: [] },
  { name: "Data Modeling", category: "Data", aliases: ["data modelling"] },

  // Cloud / DevOps
  { name: "AWS", category: "Cloud", aliases: ["amazon web services", "ec2", "s3", "lambda"] },
  { name: "Azure", category: "Cloud", aliases: ["microsoft azure"] },
  { name: "GCP", category: "Cloud", aliases: ["google cloud", "google cloud platform"] },
  { name: "Docker", category: "DevOps", aliases: ["containers", "containerization"] },
  { name: "Kubernetes", category: "DevOps", aliases: ["k8s", "eks", "gke"] },
  { name: "Terraform", category: "DevOps", aliases: ["infrastructure as code", "iac"] },
  { name: "CI/CD", category: "DevOps", aliases: ["ci cd", "continuous integration", "github actions", "gitlab ci", "jenkins"] },
  { name: "Linux", category: "DevOps", aliases: ["unix"] },
  { name: "Serverless", category: "Cloud", aliases: ["lambda functions"] },
  { name: "Observability", category: "DevOps", aliases: ["monitoring", "datadog", "grafana", "prometheus"] },
  { name: "Git", category: "DevOps", aliases: ["github", "gitlab", "version control"] },

  // Security / Quality
  { name: "Testing", category: "Quality", aliases: ["unit testing", "jest", "vitest", "pytest", "cypress", "playwright"] },
  { name: "TDD", category: "Quality", aliases: ["test driven development"] },
  { name: "Security", category: "Security", aliases: ["appsec", "owasp", "infosec"] },
  { name: "OAuth", category: "Security", aliases: ["oauth2", "openid connect", "sso"] },

  // AI / ML
  { name: "Machine Learning", category: "AI", aliases: ["ml", "machine-learning"] },
  { name: "Deep Learning", category: "AI", aliases: ["neural networks"] },
  { name: "LLMs", category: "AI", aliases: ["large language models", "llm", "gpt", "gpt-4", "openai api"] },
  { name: "LangChain", category: "AI", aliases: ["lang chain"] },
  { name: "RAG", category: "AI", aliases: ["retrieval augmented generation", "vector search", "embeddings"] },
  { name: "PyTorch", category: "AI", aliases: ["torch"] },
  { name: "TensorFlow", category: "AI", aliases: [] },
  { name: "NLP", category: "AI", aliases: ["natural language processing"] },
  { name: "Prompt Engineering", category: "AI", aliases: ["prompt design"] },
  { name: "MLOps", category: "AI", aliases: [] },

  // Product / process
  { name: "Agile", category: "Process", aliases: ["scrum", "kanban"] },
  { name: "System Design", category: "Architecture", aliases: ["distributed systems", "software architecture"] },
  { name: "Product Management", category: "Product", aliases: [] },
  { name: "Stakeholder Management", category: "Soft Skills", aliases: [] },
  { name: "Technical Leadership", category: "Soft Skills", aliases: ["mentoring", "tech lead", "mentorship"] },
  { name: "Communication", category: "Soft Skills", aliases: [] },
  { name: "Web3", category: "Blockchain", aliases: ["smart contracts", "ethereum", "blockchain"] },

  // Business systems
  { name: "Salesforce", category: "Business", aliases: [] },
  { name: "HubSpot", category: "Business", aliases: [] },
  { name: "Stripe", category: "Business", aliases: [] },
  { name: "Excel", category: "Business", aliases: ["spreadsheets"] },
];

const ALIAS_INDEX = new Map<string, string>();
const CATEGORY_INDEX = new Map<string, string>();

for (const skill of SKILLS) {
  CATEGORY_INDEX.set(skill.name.toLowerCase(), skill.category);
  ALIAS_INDEX.set(skill.name.toLowerCase(), skill.name);
  for (const alias of skill.aliases) {
    ALIAS_INDEX.set(alias.toLowerCase(), skill.name);
  }
}

/** Sort longest-first so "React Native" wins over "React". */
const MATCHERS: { alias: string; canonical: string; pattern: RegExp }[] = SKILLS.flatMap((skill) =>
  [skill.name, ...skill.aliases].map((alias) => ({
    alias,
    canonical: skill.name,
    pattern: new RegExp(
      `(?<![a-z0-9])${escapeRegExp(alias.toLowerCase())}(?![a-z0-9])`,
      "g"
    ),
  }))
).sort((a, b) => b.alias.length - a.alias.length);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Maps a raw skill string onto its canonical name (or a cleaned-up original). */
export function canonicalizeSkill(raw: string): string | null {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (cleaned.length < 2 || cleaned.length > 48) return null;
  const known = ALIAS_INDEX.get(cleaned.toLowerCase());
  if (known) return known;
  const titleCased = cleaned
    .split(" ")
    .map((word) =>
      word.length <= 3 && word === word.toUpperCase()
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
  return titleCased;
}

export function canonicalizeSkills(raw: unknown, limit = 30): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const entry of raw) {
    const name = typeof entry === "string" ? canonicalizeSkill(entry) : null;
    if (name && !out.includes(name)) out.push(name);
    if (out.length >= limit) break;
  }
  return out;
}

export function skillCategory(name: string): string | undefined {
  return CATEGORY_INDEX.get(name.toLowerCase());
}

/**
 * Extracts canonical skills from free text (job title + description).
 * Deterministic, no network calls, bounded by `limit`.
 */
export function extractSkills(
  text: string | null | undefined,
  options: { limit?: number; extra?: string[] } = {}
): string[] {
  const limit = options.limit ?? 25;
  if (!text || typeof text !== "string") {
    return canonicalizeSkills(options.extra || [], limit);
  }

  const haystack = text.toLowerCase();
  const found: { name: string; index: number }[] = [];
  const seen = new Set<string>();

  for (const matcher of MATCHERS) {
    if (haystack.length > 200_000) break;
    matcher.pattern.lastIndex = 0;
    const match = matcher.pattern.exec(haystack);
    if (!match) continue;
    if (seen.has(matcher.canonical)) continue;
    seen.add(matcher.canonical);
    found.push({ name: matcher.canonical, index: match.index });
  }

  for (const extra of canonicalizeSkills(options.extra || [], limit)) {
    if (!seen.has(extra)) {
      seen.add(extra);
      found.push({ name: extra, index: Number.MAX_SAFE_INTEGER });
    }
  }

  return found
    .sort((a, b) => a.index - b.index || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map((entry) => entry.name);
}

/** Skill overlap used by the matching engine. */
export function compareSkills(
  candidateSkills: string[],
  requiredSkills: string[]
): { matched: string[]; missing: string[]; score: number } {
  const normalizedCandidate = new Set(
    candidateSkills.map((s) => s.toLowerCase().trim()).filter(Boolean)
  );

  const matched: string[] = [];
  const missing: string[] = [];

  for (const raw of requiredSkills) {
    const canonical = canonicalizeSkill(raw) || raw;
    const key = canonical.toLowerCase();
    const hasSkill =
      normalizedCandidate.has(key) ||
      Array.from(normalizedCandidate).some(
        (candidate) => candidate.includes(key) || key.includes(candidate)
      );

    const display = canonical;
    if (hasSkill) {
      if (!matched.includes(display)) matched.push(display);
    } else if (!missing.includes(display)) {
      missing.push(display);
    }
  }

  const total = matched.length + missing.length;
  const score = total === 0 ? 70 : Math.round((matched.length / total) * 100);
  return { matched, missing, score };
}

export const SKILL_DICTIONARY = SKILLS;
