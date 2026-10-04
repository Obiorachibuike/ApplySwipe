import fs from "fs";
import path from "path";
import crypto from "crypto";

const DB_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DB_DIR, "applyswipe.json");

interface DatabaseSchema {
  users: any[];
  profiles: any[];
  skills: any[];
  experiences: any[];
  educations: any[];
  projects: any[];
  certifications: any[];
  resumes: any[];
  resumeVersions: any[];
  jobs: any[];
  jobSources: any[];
  jobInteractions: any[];
  savedJobs: any[];
  applications: any[];
  applicationAnswers: any[];
  applicationDocuments: any[];
  applicationEvents: any[];
  userPreferences: any[];
  autopilotSettings: any[];
  notifications: any[];
  subscriptions: any[];
  payments: any[];
  aiUsages: any[];
  auditLogs: any[];
}

const emptyDb: DatabaseSchema = {
  users: [],
  profiles: [],
  skills: [],
  experiences: [],
  educations: [],
  projects: [],
  certifications: [],
  resumes: [],
  resumeVersions: [],
  jobs: [],
  jobSources: [],
  jobInteractions: [],
  savedJobs: [],
  applications: [],
  applicationAnswers: [],
  applicationDocuments: [],
  applicationEvents: [],
  userPreferences: [],
  autopilotSettings: [],
  notifications: [],
  subscriptions: [],
  payments: [],
  aiUsages: [],
  auditLogs: [],
};

class PersistentDb {
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return { ...emptyDb, ...parsed };
      }
    } catch (e) {
      console.error("Failed to load db file, using empty db", e);
    }
    return { ...emptyDb };
  }

  public save(): void {
    try {
      if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write db file", e);
    }
  }

  public getRawData(): DatabaseSchema {
    return this.data;
  }

  public setRawData(newData: DatabaseSchema): void {
    this.data = newData;
    this.save();
  }

  // Generic collection helper
  public table<T extends { id: string }>(tableName: keyof DatabaseSchema) {
    const items = this.data[tableName] as T[];

    return {
      findUnique: async (args: { where: any; include?: any }): Promise<T | null> => {
        const found = items.find((item: any) => {
          return Object.entries(args.where).every(([key, value]) => {
            if (key === "userId_jobId" && typeof value === "object") {
              const valObj = value as any;
              return item.userId === valObj.userId && item.jobId === valObj.jobId;
            }
            if (key === "userId_jobId_interactionType" && typeof value === "object") {
              const valObj = value as any;
              return (
                item.userId === valObj.userId &&
                item.jobId === valObj.jobId &&
                item.interactionType === valObj.interactionType
              );
            }
            return item[key] === value;
          });
        });
        if (!found) return null;
        return this.hydrateRelations(tableName, { ...found }, args.include);
      },

      findFirst: async (args?: { where?: any; include?: any; orderBy?: any }): Promise<T | null> => {
        let results = [...items];
        if (args?.where) {
          results = results.filter((item: any) => this.matchWhere(item, args.where));
        }
        if (args?.orderBy) {
          results = this.sortItems(results, args.orderBy);
        }
        const item = results[0] || null;
        if (!item) return null;
        return this.hydrateRelations(tableName, { ...item }, args?.include);
      },

      findMany: async (args?: {
        where?: any;
        include?: any;
        orderBy?: any;
        skip?: number;
        take?: number;
      }): Promise<T[]> => {
        let results = [...items];
        if (args?.where) {
          results = results.filter((item: any) => this.matchWhere(item, args.where));
        }
        if (args?.orderBy) {
          results = this.sortItems(results, args.orderBy);
        }
        if (args?.skip) {
          results = results.slice(args.skip);
        }
        if (args?.take) {
          results = results.slice(0, args.take);
        }
        return Promise.all(
          results.map((item) => this.hydrateRelations(tableName, { ...item }, args?.include))
        );
      },

      create: async (args: { data: any; include?: any }): Promise<T> => {
        const id = args.data.id || crypto.randomUUID();
        const now = new Date().toISOString();
        const newItem: any = {
          ...args.data,
          id,
          createdAt: args.data.createdAt || now,
          updatedAt: args.data.updatedAt || now,
        };
        items.push(newItem);
        this.save();
        return this.hydrateRelations(tableName, { ...newItem }, args.include);
      },

      createMany: async (args: { data: any[] }): Promise<{ count: number }> => {
        const now = new Date().toISOString();
        let count = 0;
        for (const d of args.data) {
          const id = d.id || crypto.randomUUID();
          items.push({
            ...d,
            id,
            createdAt: d.createdAt || now,
            updatedAt: d.updatedAt || now,
          });
          count++;
        }
        this.save();
        return { count };
      },

      update: async (args: { where: any; data: any; include?: any }): Promise<T> => {
        const idx = items.findIndex((item: any) => {
          return Object.entries(args.where).every(([key, value]) => item[key] === value);
        });
        if (idx === -1) {
          throw new Error(`Record to update not found in ${tableName}`);
        }
        const current = items[idx];
        const updated = {
          ...current,
          ...args.data,
          updatedAt: new Date().toISOString(),
        };
        items[idx] = updated;
        this.save();
        return this.hydrateRelations(tableName, { ...updated }, args.include);
      },

      updateMany: async (args: { where: any; data: any }): Promise<{ count: number }> => {
        let count = 0;
        items.forEach((item: any, idx) => {
          if (this.matchWhere(item, args.where)) {
            items[idx] = {
              ...item,
              ...args.data,
              updatedAt: new Date().toISOString(),
            };
            count++;
          }
        });
        if (count > 0) this.save();
        return { count };
      },

      upsert: async (args: {
        where: any;
        update: any;
        create: any;
        include?: any;
      }): Promise<T> => {
        const existing = await this.table<T>(tableName).findFirst({ where: args.where });
        if (existing) {
          return this.table<T>(tableName).update({
            where: { id: existing.id },
            data: args.update,
            include: args.include,
          });
        } else {
          return this.table<T>(tableName).create({
            data: args.create,
            include: args.include,
          });
        }
      },

      delete: async (args: { where: any }): Promise<T> => {
        const idx = items.findIndex((item: any) => {
          return Object.entries(args.where).every(([key, value]) => item[key] === value);
        });
        if (idx === -1) {
          throw new Error(`Record to delete not found in ${tableName}`);
        }
        const [deleted] = items.splice(idx, 1);
        this.save();
        return deleted;
      },

      deleteMany: async (args?: { where?: any }): Promise<{ count: number }> => {
        if (!args || !args.where || Object.keys(args.where).length === 0) {
          const count = items.length;
          items.length = 0;
          this.save();
          return { count };
        }
        const initialCount = items.length;
        const remaining = items.filter((item: any) => !this.matchWhere(item, args.where));
        this.data[tableName] = remaining as any;
        const count = initialCount - remaining.length;
        if (count > 0) this.save();
        return { count };
      },

      count: async (args?: { where?: any }): Promise<number> => {
        if (!args || !args.where) return items.length;
        return items.filter((item: any) => this.matchWhere(item, args.where)).length;
      },
    };
  }

  private matchWhere(item: any, where: any): boolean {
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) continue;

      if (key === "AND" && Array.isArray(value)) {
        if (!value.every((w) => this.matchWhere(item, w))) return false;
        continue;
      }

      if (key === "OR" && Array.isArray(value)) {
        if (!value.some((w) => this.matchWhere(item, w))) return false;
        continue;
      }

      if (key === "NOT") {
        if (this.matchWhere(item, value)) return false;
        continue;
      }

      const itemVal = item[key];

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const op = value as any;
        if ("equals" in op && itemVal !== op.equals) return false;
        if ("not" in op && itemVal === op.not) return false;
        if ("in" in op && Array.isArray(op.in) && !op.in.includes(itemVal)) return false;
        if ("notIn" in op && Array.isArray(op.notIn) && op.notIn.includes(itemVal)) return false;
        if ("contains" in op) {
          const strVal = String(itemVal || "").toLowerCase();
          const target = String(op.contains || "").toLowerCase();
          if (!strVal.includes(target)) return false;
        }
        if ("gte" in op && (itemVal === null || itemVal === undefined || itemVal < op.gte)) return false;
        if ("lte" in op && (itemVal === null || itemVal === undefined || itemVal > op.lte)) return false;
        if ("gt" in op && (itemVal === null || itemVal === undefined || itemVal <= op.gt)) return false;
        if ("lt" in op && (itemVal === null || itemVal === undefined || itemVal >= op.lt)) return false;
        continue;
      }

      if (itemVal !== value) return false;
    }
    return true;
  }

  private sortItems(items: any[], orderBy: any): any[] {
    const list = [...items];
    if (Array.isArray(orderBy)) {
      orderBy = orderBy[0];
    }
    if (!orderBy) return list;

    const [field, direction] = Object.entries(orderBy)[0];
    const isDesc = direction === "desc";

    return list.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      if (aVal === bVal) return 0;
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      if (typeof aVal === "string") {
        return isDesc ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
      }
      return isDesc ? (bVal > aVal ? 1 : -1) : aVal > bVal ? 1 : -1;
    });
  }

  private async hydrateRelations(tableName: keyof DatabaseSchema, item: any, include?: any): Promise<any> {
    if (!include || !item) return item;

    // Hydrate User relations
    if (tableName === "users") {
      if (include.profile) {
        const profile = this.data.profiles.find((p) => p.userId === item.id);
        item.profile = profile
          ? await this.hydrateRelations("profiles", { ...profile }, include.profile.include)
          : null;
      }
      if (include.resumes) {
        item.resumes = this.data.resumes.filter((r) => r.userId === item.id);
      }
      if (include.applications) {
        item.applications = await Promise.all(
          this.data.applications
            .filter((a) => a.userId === item.id)
            .map((a) => this.hydrateRelations("applications", { ...a }, include.applications?.include))
        );
      }
      if (include.savedJobs) {
        item.savedJobs = this.data.savedJobs.filter((s) => s.userId === item.id);
      }
      if (include.autopilotSetting) {
        item.autopilotSetting = this.data.autopilotSettings.find((a) => a.userId === item.id) || null;
      }
      if (include.preferences) {
        item.preferences = this.data.userPreferences.find((p) => p.userId === item.id) || null;
      }
      if (include.notifications) {
        item.notifications = this.data.notifications.filter((n) => n.userId === item.id);
      }
    }

    // Hydrate Profile relations
    if (tableName === "profiles") {
      if (include.skills) {
        item.skills = this.data.skills.filter((s) => s.profileId === item.id);
      }
      if (include.experiences) {
        item.experiences = this.data.experiences.filter((e) => e.profileId === item.id);
      }
      if (include.educations) {
        item.educations = this.data.educations.filter((e) => e.profileId === item.id);
      }
      if (include.projects) {
        item.projects = this.data.projects.filter((p) => p.profileId === item.id);
      }
      if (include.certifications) {
        item.certifications = this.data.certifications.filter((c) => c.profileId === item.id);
      }
      if (include.user) {
        item.user = this.data.users.find((u) => u.id === item.userId) || null;
      }
    }

    // Hydrate Job relations
    if (tableName === "jobs") {
      if (include.applications) {
        item.applications = this.data.applications.filter((a) => a.jobId === item.id);
      }
      if (include.savedJobs) {
        item.savedJobs = this.data.savedJobs.filter((s) => s.jobId === item.id);
      }
      if (include.interactions) {
        item.interactions = this.data.jobInteractions.filter((i) => i.jobId === item.id);
      }
    }

    // Hydrate Application relations
    if (tableName === "applications") {
      if (include.job) {
        item.job = this.data.jobs.find((j) => j.id === item.jobId) || null;
      }
      if (include.user) {
        item.user = this.data.users.find((u) => u.id === item.userId) || null;
      }
      if (include.answers) {
        item.answers = this.data.applicationAnswers.filter((a) => a.applicationId === item.id);
      }
      if (include.documents) {
        item.documents = this.data.applicationDocuments.filter((d) => d.applicationId === item.id);
      }
      if (include.events) {
        item.events = this.data.applicationEvents.filter((e) => e.applicationId === item.id);
      }
    }

    // Hydrate Resume relations
    if (tableName === "resumes") {
      if (include.versions) {
        item.versions = this.data.resumeVersions.filter((v) => v.resumeId === item.id);
      }
    }

    // Hydrate SavedJob relations
    if (tableName === "savedJobs") {
      if (include.job) {
        item.job = this.data.jobs.find((j) => j.id === item.jobId) || null;
      }
    }

    return item;
  }
}

// Global singleton instance
const globalDb = (global as any).__APPLY_SWIPE_DB__ || new PersistentDb();
if (process.env.NODE_ENV !== "production") {
  (global as any).__APPLY_SWIPE_DB__ = globalDb;
}

export const db = {
  user: globalDb.table("users"),
  profile: globalDb.table("profiles"),
  skill: globalDb.table("skills"),
  experience: globalDb.table("experiences"),
  education: globalDb.table("educations"),
  project: globalDb.table("projects"),
  certification: globalDb.table("certifications"),
  resume: globalDb.table("resumes"),
  resumeVersion: globalDb.table("resumeVersions"),
  job: globalDb.table("jobs"),
  jobSource: globalDb.table("jobSources"),
  jobInteraction: globalDb.table("jobInteractions"),
  savedJob: globalDb.table("savedJobs"),
  application: globalDb.table("applications"),
  applicationAnswer: globalDb.table("applicationAnswers"),
  applicationDocument: globalDb.table("applicationDocuments"),
  applicationEvent: globalDb.table("applicationEvents"),
  userPreference: globalDb.table("userPreferences"),
  autopilotSetting: globalDb.table("autopilotSettings"),
  notification: globalDb.table("notifications"),
  subscription: globalDb.table("subscriptions"),
  payment: globalDb.table("payments"),
  aiUsage: globalDb.table("aiUsages"),
  auditLog: globalDb.table("auditLogs"),
  $raw: globalDb,
};

export default db;
